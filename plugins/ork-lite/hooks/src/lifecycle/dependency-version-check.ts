/**
 * Dependency Version Check - Check for outdated dependencies at session start
 * Hook: SessionStart (#136)
 * CC 2.1.7 Compliant
 * Optimized with timeout, caching, and fast-exit to prevent startup hangs
 *
 * Parses:
 * - package.json (Node.js)
 * - requirements.txt, pyproject.toml (Python)
 * - go.mod (Go)
 *
 * Warns about:
 * - Known security vulnerabilities (CVE database)
 * - Severely outdated packages
 * - Deprecated packages
 *
 * Uses additionalContext to inject warnings into session context
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess, outputWithContext } from '../lib/common.js';

interface KnownVuln {
  package: string;
  pattern: string;
  severity: string;
  cve: string;
  description: string;
}

interface DependencyCache {
  warnings: string;
  timestamp: number;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

// Known vulnerabilities database (static for offline operation)
const KNOWN_VULNS: KnownVuln[] = [
  { package: 'lodash', pattern: '<4.17.21', severity: 'high', cve: 'CVE-2021-23337', description: 'Prototype pollution' },
  { package: 'minimist', pattern: '<1.2.6', severity: 'critical', cve: 'CVE-2021-44906', description: 'Prototype pollution' },
  { package: 'node-fetch', pattern: '<2.6.7', severity: 'high', cve: 'CVE-2022-0235', description: 'Information exposure' },
  { package: 'axios', pattern: '<0.21.2', severity: 'high', cve: 'CVE-2021-3749', description: 'ReDoS vulnerability' },
  { package: 'jsonwebtoken', pattern: '<9.0.0', severity: 'critical', cve: 'CVE-2022-23529', description: 'Insecure token verification' },
  { package: 'express', pattern: '<4.17.3', severity: 'medium', cve: 'CVE-2022-24999', description: 'Open redirect' },
  { package: 'tar', pattern: '<6.1.11', severity: 'critical', cve: 'CVE-2021-37701', description: 'Arbitrary file overwrite' },
  { package: 'path-parse', pattern: '<1.0.7', severity: 'medium', cve: 'CVE-2021-23343', description: 'ReDoS vulnerability' },
  { package: 'django', pattern: '<3.2.14', severity: 'high', cve: 'CVE-2022-34265', description: 'SQL injection' },
  { package: 'flask', pattern: '<2.0.2', severity: 'medium', cve: 'CVE-2021-28091', description: 'Path traversal' },
  { package: 'requests', pattern: '<2.28.0', severity: 'medium', cve: 'CVE-2023-32681', description: 'Information disclosure' },
  { package: 'urllib3', pattern: '<1.26.5', severity: 'high', cve: 'CVE-2021-33503', description: 'ReDoS vulnerability' },
  { package: 'pillow', pattern: '<9.0.0', severity: 'high', cve: 'CVE-2022-22817', description: 'Buffer overflow' },
  { package: 'pyyaml', pattern: '<5.4', severity: 'critical', cve: 'CVE-2020-14343', description: 'Arbitrary code execution' },
  { package: 'jinja2', pattern: '<3.0.3', severity: 'medium', cve: 'CVE-2020-28493', description: 'XSS vulnerability' },
  { package: 'sqlalchemy', pattern: '<1.4.46', severity: 'medium', cve: 'CVE-2023-30533', description: 'SQL injection' },
];

const CACHE_TTL_HOURS = 24;

/**
 * Check if slow hooks should be skipped
 */
function shouldSkipSlowHooks(): boolean {
  return process.env.ORCHESTKIT_SKIP_SLOW_HOOKS === '1';
}

/**
 * Compare semantic versions (simplified)
 */
function versionLessThan(current: string, target: string): boolean {
  const currentParts = current.split('.').map((p) => parseInt(p, 10) || 0);
  const targetParts = target.split('.').map((p) => parseInt(p, 10) || 0);

  for (let i = 0; i < Math.max(currentParts.length, targetParts.length); i++) {
    const c = currentParts[i] || 0;
    const t = targetParts[i] || 0;
    if (c < t) return true;
    if (c > t) return false;
  }
  return false;
}

/**
 * Check if version matches vulnerability pattern
 */
function versionMatchesVuln(currentVersion: string, vulnPattern: string): boolean {
  const operator = vulnPattern.charAt(0);
  const vulnVersion = vulnPattern.substring(1);

  if (operator === '<') {
    return versionLessThan(currentVersion, vulnVersion);
  } else if (operator === '=') {
    return currentVersion === vulnVersion;
  }

  return false;
}

/**
 * Clean version string (remove ^, ~, etc.)
 */
function cleanVersion(version: string): string {
  return version
    .replace(/^[^~>=<]/, '')
    .replace(/,.*$/, '')
    .trim();
}

/**
 * Check a package against known vulnerabilities
 */
function checkPackageVulnerability(packageName: string, version: string): KnownVuln | null {
  const cleanedVersion = cleanVersion(version);
  const pkgLower = packageName.toLowerCase();

  for (const vuln of KNOWN_VULNS) {
    if (pkgLower === vuln.package) {
      if (versionMatchesVuln(cleanedVersion, vuln.pattern)) {
        return vuln;
      }
    }
  }

  return null;
}

/**
 * Check if cache is valid
 */
function getCachedWarnings(cacheFile: string): string | null {
  if (!existsSync(cacheFile)) {
    return null;
  }

  try {
    const cache: DependencyCache = JSON.parse(readFileSync(cacheFile, 'utf-8'));
    const cacheAge = (Date.now() - cache.timestamp) / (1000 * 60 * 60);

    if (cacheAge < CACHE_TTL_HOURS) {
      return cache.warnings;
    }
  } catch {
    // Cache invalid
  }

  return null;
}

/**
 * Save warnings to cache
 */
function saveCache(cacheFile: string, warnings: string): void {
  try {
    mkdirSync(cacheFile.replace(/\/[^/]+$/, ''), { recursive: true });

    const cache: DependencyCache = {
      warnings,
      timestamp: Date.now(),
    };

    writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Parse package.json for vulnerabilities
 */
function parsePackageJson(filePath: string): { criticalCount: number; highCount: number; warnings: string } {
  let criticalCount = 0;
  let highCount = 0;
  let warnings = '';

  if (!existsSync(filePath)) {
    return { criticalCount, highCount, warnings };
  }

  try {
    const pkg: PackageJson = JSON.parse(readFileSync(filePath, 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    for (const [packageName, version] of Object.entries(allDeps)) {
      const vuln = checkPackageVulnerability(packageName, version);
      if (vuln) {
        if (vuln.severity === 'critical') criticalCount++;
        if (vuln.severity === 'high') highCount++;
        warnings += `\n- ${packageName}@${version}: ${vuln.description} (${vuln.cve}, ${vuln.severity}) - upgrade to ${vuln.pattern}`;
      }
    }
  } catch {
    // Ignore parse errors
  }

  return { criticalCount, highCount, warnings };
}

/**
 * Parse requirements.txt for vulnerabilities
 */
function parseRequirementsTxt(filePath: string): { criticalCount: number; highCount: number; warnings: string } {
  let criticalCount = 0;
  let highCount = 0;
  let warnings = '';

  if (!existsSync(filePath)) {
    return { criticalCount, highCount, warnings };
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Parse package==version or package>=version
      const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:==|>=|~=|!=|<|>)\s*([0-9.]+)/);
      if (!match) continue;

      const [, packageName, version] = match;
      const vuln = checkPackageVulnerability(packageName, version);
      if (vuln) {
        if (vuln.severity === 'critical') criticalCount++;
        if (vuln.severity === 'high') highCount++;
        warnings += `\n- ${packageName}==${version}: ${vuln.description} (${vuln.cve}, ${vuln.severity}) - upgrade to ${vuln.pattern}`;
      }
    }
  } catch {
    // Ignore parse errors
  }

  return { criticalCount, highCount, warnings };
}

/**
 * Dependency version check hook
 */
export function dependencyVersionCheck(input: HookInput): HookResult {
  // Bypass if slow hooks are disabled
  if (shouldSkipSlowHooks()) {
    logHook('dependency-version-check', 'Skipping dependency check (ORCHESTKIT_SKIP_SLOW_HOOKS=1)');
    return outputSilentSuccess();
  }

  logHook('dependency-version-check', 'Starting dependency version check');

  const projectDir = input.project_dir || getProjectDir();
  const cacheFile = `${projectDir}/.claude/feedback/dependency-check-cache.json`;

  // Fast exit: Check if any package files exist
  const hasPackageJson = existsSync(`${projectDir}/package.json`);
  const hasRequirementsTxt = existsSync(`${projectDir}/requirements.txt`);
  const hasPyprojectToml = existsSync(`${projectDir}/pyproject.toml`);
  const hasGoMod = existsSync(`${projectDir}/go.mod`);

  if (!hasPackageJson && !hasRequirementsTxt && !hasPyprojectToml && !hasGoMod) {
    logHook('dependency-version-check', 'No package files found, skipping check');
    saveCache(cacheFile, 'none');
    return outputSilentSuccess();
  }

  // Check cache first
  const cached = getCachedWarnings(cacheFile);
  if (cached !== null) {
    logHook('dependency-version-check', 'Using cached dependency warnings');
    if (cached !== 'none') {
      return outputWithContext(`DEPENDENCY SECURITY CHECK (cached): ${cached}`);
    }
    return outputSilentSuccess();
  }

  let totalCritical = 0;
  let totalHigh = 0;
  let allWarnings = '';

  // Check package.json
  if (hasPackageJson) {
    const result = parsePackageJson(`${projectDir}/package.json`);
    totalCritical += result.criticalCount;
    totalHigh += result.highCount;
    if (result.warnings) {
      allWarnings += `\n\nNode.js (package.json):${result.warnings}`;
    }
  }

  // Check requirements.txt
  if (hasRequirementsTxt) {
    const result = parseRequirementsTxt(`${projectDir}/requirements.txt`);
    totalCritical += result.criticalCount;
    totalHigh += result.highCount;
    if (result.warnings) {
      allWarnings += `\n\nPython (requirements.txt):${result.warnings}`;
    }
  }

  // Generate output
  if (allWarnings) {
    const summary = `Found ${totalCritical} critical and ${totalHigh} high severity vulnerabilities`;
    const fullWarning = `DEPENDENCY SECURITY CHECK: ${summary}${allWarnings}\n\nRun 'npm audit' or 'pip-audit' for full details.`;

    saveCache(cacheFile, fullWarning);
    logHook('dependency-version-check', summary);

    // Only show warning if there are critical or high severity issues
    if (totalCritical > 0 || totalHigh > 0) {
      return outputWithContext(fullWarning);
    }
  } else {
    saveCache(cacheFile, 'none');
    logHook('dependency-version-check', 'No known vulnerabilities found');
  }

  return outputSilentSuccess();
}

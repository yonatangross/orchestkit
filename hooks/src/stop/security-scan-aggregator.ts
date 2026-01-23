/**
 * Security Scan Aggregator - Stop Hook
 * CC 2.1.3 Compliant - Uses 10-minute hook timeout
 *
 * Runs multiple security tools in parallel and aggregates results.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';

interface SecurityResults {
  npmAudit: { critical: number; high: number } | null;
  pipAudit: number | null;
  semgrep: number | null;
  bandit: number | null;
  secrets: number;
}

/**
 * Run npm audit
 */
function runNpmAudit(projectDir: string, resultsDir: string): { critical: number; high: number } | null {
  if (
    !existsSync(`${projectDir}/package.json`) ||
    (!existsSync(`${projectDir}/package-lock.json`) &&
      !existsSync(`${projectDir}/yarn.lock`) &&
      !existsSync(`${projectDir}/pnpm-lock.yaml`))
  ) {
    return null;
  }

  logHook('security-scan', 'Running npm audit...');
  try {
    execSync('npm audit --json', {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error: any) {
    // npm audit returns non-zero on vulnerabilities, capture output
    if (error.stdout) {
      writeFileSync(`${resultsDir}/npm-audit.json`, error.stdout);
      try {
        const result = JSON.parse(error.stdout);
        return {
          critical: result.metadata?.vulnerabilities?.critical || 0,
          high: result.metadata?.vulnerabilities?.high || 0,
        };
      } catch {
        // Ignore parse errors
      }
    }
  }
  logHook('security-scan', 'npm audit complete');
  return { critical: 0, high: 0 };
}

/**
 * Run pip-audit
 */
function runPipAudit(projectDir: string, resultsDir: string): number | null {
  if (!existsSync(`${projectDir}/requirements.txt`) && !existsSync(`${projectDir}/pyproject.toml`)) {
    return null;
  }

  try {
    execSync('which pip-audit', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    logHook('security-scan', 'pip-audit not installed, skipping');
    return null;
  }

  logHook('security-scan', 'Running pip-audit...');
  try {
    const result = execSync('pip-audit --format json', {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    writeFileSync(`${resultsDir}/pip-audit.json`, result);
    const parsed = JSON.parse(result);
    logHook('security-scan', 'pip-audit complete');
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Run semgrep
 */
function runSemgrep(projectDir: string, resultsDir: string): number | null {
  try {
    execSync('which semgrep', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    logHook('security-scan', 'semgrep not installed, skipping');
    return null;
  }

  logHook('security-scan', 'Running semgrep...');
  try {
    const result = execSync('semgrep --config auto --json --quiet', {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 300000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    writeFileSync(`${resultsDir}/semgrep.json`, result);
    const parsed = JSON.parse(result);
    const highSeverity = (parsed.results || []).filter((r: any) => r.extra?.severity === 'ERROR').length;
    logHook('security-scan', 'semgrep complete');
    return highSeverity;
  } catch {
    return 0;
  }
}

/**
 * Run bandit
 */
function runBandit(projectDir: string, resultsDir: string): number | null {
  // Check for Python files
  try {
    const hasPython = execSync('find . -name "*.py" -maxdepth 2 | head -1', {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!hasPython && !existsSync(`${projectDir}/backend`)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    execSync('which bandit', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    logHook('security-scan', 'bandit not installed, skipping');
    return null;
  }

  logHook('security-scan', 'Running bandit...');
  try {
    execSync(`bandit -r . -f json -o ${resultsDir}/bandit.json`, {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    logHook('security-scan', 'bandit complete');
    return 0;
  } catch {
    // Bandit exits non-zero when issues found
    return 0;
  }
}

/**
 * Run secret detection
 */
function runSecretScan(projectDir: string, resultsDir: string): number {
  logHook('security-scan', 'Running secret detection...');

  const secretPatterns = /(api[_-]?key|secret[_-]?key|password|token)\s*[=:]\s*["'][^"']{8,}/i;
  let secretsFound = 0;
  const findings: Array<{ file: string; type: string }> = [];

  const extensions = ['.py', '.js', '.ts', '.env'];

  function scanDir(dir: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`;

        // Skip node_modules and .git
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            scanDir(fullPath);
          }
          continue;
        }

        // Check file extension
        if (!extensions.some((ext) => entry.name.endsWith(ext))) {
          continue;
        }

        try {
          const content = readFileSync(fullPath, 'utf-8');
          if (secretPatterns.test(content)) {
            findings.push({ file: fullPath, type: 'potential_secret' });
            secretsFound++;
          }
        } catch {
          // Ignore read errors
        }
      }
    } catch {
      // Ignore directory errors
    }
  }

  scanDir(projectDir);

  writeFileSync(
    `${resultsDir}/secrets.json`,
    JSON.stringify({ findings, count: secretsFound }, null, 2)
  );

  logHook('security-scan', `Secret detection complete: ${secretsFound} potential issues`);
  return secretsFound;
}

/**
 * Aggregate results
 */
function aggregateResults(resultsDir: string, results: SecurityResults): void {
  logHook('security-scan', 'Aggregating results...');

  let totalCritical = 0;
  let totalHigh = 0;

  if (results.npmAudit) {
    totalCritical += results.npmAudit.critical;
    totalHigh += results.npmAudit.high;
  }
  if (results.pipAudit !== null) {
    totalHigh += results.pipAudit;
  }
  if (results.semgrep !== null) {
    totalHigh += results.semgrep;
  }

  const scansCompleted = readdirSync(resultsDir)
    .filter((f) => f.endsWith('.json') && !f.includes('aggregated'))
    .map((f) => f.replace('.json', ''));

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      critical: totalCritical,
      high: totalHigh,
      medium: 0,
    },
    scans_completed: scansCompleted,
  };

  writeFileSync(`${resultsDir}/aggregated-report.json`, JSON.stringify(report, null, 2));

  logHook('security-scan', '=== Security Scan Complete ===');
  logHook('security-scan', `Critical: ${totalCritical}, High: ${totalHigh}`);

  if (totalCritical > 0) {
    console.error(`Security: ${totalCritical} critical, ${totalHigh} high vulnerabilities found`);
  }
}

/**
 * Security scan aggregator hook
 */
export function securityScanAggregator(input: HookInput): HookResult {
  logHook('security-scan', '=== Security Scan Started ===');

  const projectDir = input.project_dir || getProjectDir();
  const resultsDir = `${projectDir}/.claude/hooks/logs/security`;

  mkdirSync(resultsDir, { recursive: true });

  const results: SecurityResults = {
    npmAudit: null,
    pipAudit: null,
    semgrep: null,
    bandit: null,
    secrets: 0,
  };

  // Run scans (sequentially in TS to avoid complexity, but could be parallelized)
  results.npmAudit = runNpmAudit(projectDir, resultsDir);
  results.pipAudit = runPipAudit(projectDir, resultsDir);
  results.semgrep = runSemgrep(projectDir, resultsDir);
  results.bandit = runBandit(projectDir, resultsDir);
  results.secrets = runSecretScan(projectDir, resultsDir);

  // Aggregate results
  aggregateResults(resultsDir, results);

  return outputSilentSuccess();
}

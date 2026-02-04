/**
 * Version Sync Hook
 * Checks version consistency across files
 * CC 2.1.9: Injects version warnings via additionalContext
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputAllowWithContext,
  logHook,
  logPermissionFeedback,
  getProjectDir,
} from '../../lib/common.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface VersionSource {
  file: string;
  version: string | null;
}

/**
 * Extract version from package.json
 */
function getPackageJsonVersion(projectDir: string): string | null {
  const filePath = join(projectDir, 'package.json');
  try {
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      return data.version || null;
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Extract version from pyproject.toml
 */
function getPyprojectVersion(projectDir: string): string | null {
  const filePath = join(projectDir, 'pyproject.toml');
  try {
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf8');
      const match = content.match(/version\s*=\s*["']([^"']+)["']/);
      return match ? match[1] : null;
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Get all version sources
 */
function getVersionSources(projectDir: string): VersionSource[] {
  const sources: VersionSource[] = [];

  const pkgVersion = getPackageJsonVersion(projectDir);
  if (pkgVersion) {
    sources.push({ file: 'package.json', version: pkgVersion });
  }

  const pyVersion = getPyprojectVersion(projectDir);
  if (pyVersion) {
    sources.push({ file: 'pyproject.toml', version: pyVersion });
  }

  return sources;
}

/**
 * Check version sync on version bump commands
 */
export function versionSync(input: HookInput): HookResult {
  const command = input.tool_input.command || '';
  const projectDir = getProjectDir();

  // Only process npm version or poetry version commands
  if (!/npm\s+version|poetry\s+version/.test(command)) {
    return outputSilentSuccess();
  }

  // Get all version sources
  const sources = getVersionSources(projectDir);

  if (sources.length < 2) {
    return outputSilentSuccess();
  }

  // Check if versions are in sync
  const versions = sources.map((s) => s.version);
  const uniqueVersions = [...new Set(versions)];

  if (uniqueVersions.length > 1) {
    const context = `Version mismatch detected:
${sources.map((s) => `${s.file}: ${s.version}`).join('\n')}

Consider syncing versions across all files.`;

    logPermissionFeedback('allow', 'Version mismatch detected', input);
    logHook('version-sync', `Versions: ${versions.join(', ')}`);
    return outputAllowWithContext(context);
  }

  // All in sync
  logPermissionFeedback('allow', `Versions in sync: ${uniqueVersions[0]}`, input);
  return outputSilentSuccess();
}

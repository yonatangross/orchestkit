/**
 * Monorepo Detector - Setup Hook
 * CC 2.1.20: Detects monorepo structures and suggests --add-dir usage
 *
 * Runs once at plugin load. Checks for monorepo indicators and
 * notifies users about multi-directory context support.
 */

import { existsSync, readdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess, outputWithContext } from '../lib/common.js';

// Monorepo indicator files
const MONOREPO_INDICATORS = [
  'pnpm-workspace.yaml',
  'lerna.json',
  'nx.json',
  'turbo.json',
  'rush.json',
];

/**
 * Count nested package.json files (depth 2 max)
 */
function countNestedPackageJsons(projectDir: string): number {
  let count = 0;

  try {
    const entries = readdirSync(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }
      const subDir = `${projectDir}/${entry.name}`;
      if (existsSync(`${subDir}/package.json`)) {
        count++;
      }
      // Check one more level deep (e.g., packages/api/package.json)
      try {
        const subEntries = readdirSync(subDir, { withFileTypes: true });
        for (const subEntry of subEntries) {
          if (!subEntry.isDirectory() || subEntry.name.startsWith('.') || subEntry.name === 'node_modules') {
            continue;
          }
          if (existsSync(`${subDir}/${subEntry.name}/package.json`)) {
            count++;
          }
        }
      } catch {
        // Ignore permission errors
      }
    }
  } catch {
    // Ignore permission errors
  }

  return count;
}

/**
 * Monorepo detector hook
 */
export function monorepoDetector(input: HookInput): HookResult {
  logHook('monorepo-detector', 'Checking for monorepo structure');

  // CC 2.1.47: Skip if user already added directories via --add-dir
  if (input.added_dirs && input.added_dirs.length > 0) {
    logHook('monorepo-detector', `Skipping: ${input.added_dirs.length} added_dirs already active`);
    return outputSilentSuccess();
  }

  // Skip if env var already set
  if (process.env.CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD === '1') {
    logHook('monorepo-detector', 'CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD already set, skipping');
    return outputSilentSuccess();
  }

  const projectDir = input.project_dir || getProjectDir();
  const detectedIndicators: string[] = [];

  // Check for monorepo indicator files
  for (const indicator of MONOREPO_INDICATORS) {
    if (existsSync(`${projectDir}/${indicator}`)) {
      detectedIndicators.push(indicator);
    }
  }

  // Check for multiple nested package.json files
  const nestedPackageCount = countNestedPackageJsons(projectDir);
  const isMonorepo = detectedIndicators.length > 0 || nestedPackageCount >= 3;

  if (!isMonorepo) {
    logHook('monorepo-detector', 'No monorepo detected');
    return outputSilentSuccess();
  }

  const indicators = detectedIndicators.length > 0
    ? `Detected: ${detectedIndicators.join(', ')}`
    : `Found ${nestedPackageCount} nested packages`;

  logHook('monorepo-detector', `Monorepo detected: ${indicators}`);

  return outputWithContext(
    `**Monorepo Detected** (${indicators})\n\n` +
    'CC 2.1.20 supports multi-directory context with `--add-dir`. ' +
    'Each service can have its own CLAUDE.md for targeted instructions.\n\n' +
    'Set `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` to auto-load CLAUDE.md from added directories.'
  );
}

/**
 * License Compliance Hook
 * Checks for license compliance issues in dependencies
 * CC 2.1.9: Injects license warnings via additionalContext
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

/**
 * Problematic license patterns
 */
const PROBLEMATIC_LICENSES = [
  'GPL', // Copyleft
  'AGPL', // Strong copyleft
  'LGPL', // Weaker copyleft but still restrictive
  'CC-BY-NC', // Non-commercial
  'SSPL', // Server Side Public License
];

/**
 * Check package.json dependencies for license issues
 */
function checkNpmLicenses(projectDir: string): string[] {
  const issues: string[] = [];
  const lockFile = join(projectDir, 'package-lock.json');

  try {
    if (existsSync(lockFile)) {
      const content = readFileSync(lockFile, 'utf8');

      for (const license of PROBLEMATIC_LICENSES) {
        if (content.includes(`"license": "${license}`)) {
          issues.push(`Found ${license} license in npm dependencies`);
        }
      }
    }
  } catch {
    // Ignore
  }

  return issues;
}

/**
 * Check for license compliance on install commands
 */
export function licenseCompliance(input: HookInput): HookResult {
  const command = input.tool_input.command || '';
  const projectDir = getProjectDir();

  // Only process npm install, yarn add, or pip install commands
  if (!/npm\s+install|yarn\s+add|pip\s+install|poetry\s+add/.test(command)) {
    return outputSilentSuccess();
  }

  // Skip if just installing from lock file
  if (/npm\s+ci|npm\s+install\s*$/.test(command)) {
    return outputSilentSuccess();
  }

  // Extract package name
  const pkgMatch = command.match(/(?:npm\s+install|yarn\s+add|pip\s+install|poetry\s+add)\s+(\S+)/);
  const pkgName = pkgMatch ? pkgMatch[1] : null;

  if (!pkgName) {
    return outputSilentSuccess();
  }

  // Check existing licenses
  const issues = checkNpmLicenses(projectDir);

  if (issues.length > 0) {
    const context = `License compliance check:
${issues.join('\n')}

New dependency: ${pkgName}
Consider checking its license before adding.

Use: npm view ${pkgName} license`;

    logPermissionFeedback('allow', 'License compliance warning', input);
    logHook('license-compliance', `Checking: ${pkgName}`);
    return outputAllowWithContext(context);
  }

  // Suggest checking license
  const context = `Installing: ${pkgName}
Verify license compatibility before production use.
Check: npm view ${pkgName} license`;

  logPermissionFeedback('allow', `Installing package: ${pkgName}`, input);
  return outputAllowWithContext(context);
}

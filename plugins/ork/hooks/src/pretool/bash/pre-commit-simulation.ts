/**
 * Pre-Commit Simulation Hook
 * Suggests running pre-commit hooks locally
 * CC 2.1.9: Injects pre-commit suggestions via additionalContext
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputAllowWithContext,
  logHook,
  logPermissionFeedback,
  getProjectDir,
} from '../../lib/common.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Check if pre-commit is configured
 */
function hasPreCommitConfig(projectDir: string): boolean {
  return (
    existsSync(join(projectDir, '.pre-commit-config.yaml')) ||
    existsSync(join(projectDir, '.pre-commit-config.yml'))
  );
}

/**
 * Check if husky is configured
 */
function hasHuskyConfig(projectDir: string): boolean {
  return existsSync(join(projectDir, '.husky'));
}

/**
 * Suggest pre-commit checks before commit
 */
export function preCommitSimulation(input: HookInput): HookResult {
  const command = input.tool_input.command || '';
  const projectDir = getProjectDir();

  // Only process git commit commands
  if (!/git\s+commit/.test(command)) {
    return outputSilentSuccess();
  }

  // Check if using --no-verify (skip hooks)
  if (/--no-verify/.test(command)) {
    const context = `WARNING: --no-verify will skip pre-commit hooks.
Consider removing it unless intentional.
Skipped checks may cause CI failures.`;

    logPermissionFeedback('allow', 'Skip pre-commit detected', input);
    logHook('pre-commit-simulation', '--no-verify used');
    return outputAllowWithContext(context);
  }

  // Check for pre-commit configuration
  if (hasPreCommitConfig(projectDir)) {
    const context = `Pre-commit hooks will run: .pre-commit-config.yaml
If hooks fail, fix issues and retry.
Run manually: pre-commit run --all-files`;

    logPermissionFeedback('allow', 'pre-commit config found', input);
    return outputAllowWithContext(context);
  }

  // Check for husky
  if (hasHuskyConfig(projectDir)) {
    const context = `Husky hooks will run: .husky/
If hooks fail, fix issues and retry.`;

    logPermissionFeedback('allow', 'husky config found', input);
    return outputAllowWithContext(context);
  }

  return outputSilentSuccess();
}

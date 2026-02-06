/**
 * CI Simulation Hook
 * Suggests running CI-like checks locally before push
 * CC 2.1.9: Injects CI suggestions via additionalContext
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
 * Detect available CI checks based on project files
 */
function detectCIChecks(projectDir: string): string[] {
  const checks: string[] = [];

  // Node.js project
  if (existsSync(join(projectDir, 'package.json'))) {
    checks.push('npm run lint');
    checks.push('npm run typecheck');
    checks.push('npm run test');
  }

  // Python project
  if (existsSync(join(projectDir, 'pyproject.toml'))) {
    checks.push('ruff check .');
    checks.push('mypy .');
    checks.push('pytest');
  }

  // Go project
  if (existsSync(join(projectDir, 'go.mod'))) {
    checks.push('go vet ./...');
    checks.push('go test ./...');
  }

  return checks;
}

/**
 * Suggest CI checks before git push
 */
export function ciSimulation(input: HookInput): HookResult {
  const command = input.tool_input.command || '';
  const projectDir = getProjectDir();

  // Only process git push commands
  if (!/git\s+push/.test(command)) {
    return outputSilentSuccess();
  }

  // Detect available checks
  const checks = detectCIChecks(projectDir);

  if (checks.length === 0) {
    return outputSilentSuccess();
  }

  const context = `Pre-push CI simulation suggested:
${checks.slice(0, 3).join('\n')}

Run these locally to catch issues before CI fails.
Or: git push --no-verify to skip (not recommended)`;

  logPermissionFeedback('allow', 'CI simulation suggested', input);
  logHook('ci-simulation', `Suggested checks: ${checks.join(', ')}`);
  return outputAllowWithContext(context);
}

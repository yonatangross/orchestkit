/**
 * CI Safety Check - Validates CI/CD commands for safety
 *
 * Used by: ci-cd-engineer agent
 *
 * Purpose: Prevent dangerous CI/CD operations without confirmation
 *
 * CC 2.1.7 compliant output format
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputDeny, outputWithContext, lineContainsAllCI } from '../lib/common.js';

// Dangerous CI/CD patterns — each entry is [pattern, label]
// String-based checks avoid ReDoS from polynomial regex backtracking
const DANGEROUS_PATTERNS: Array<{ test: (cmd: string) => boolean; source: string }> = [
  { test: (cmd) => lineContainsAllCI(cmd, 'force', 'push'), source: 'force push' },
  { test: (cmd) => lineContainsAllCI(cmd, 'push', '--force'), source: 'push --force' },
  { test: (cmd) => cmd.includes('--force-with-lease'), source: '--force-with-lease' },
  { test: (cmd) => cmd.toLowerCase().includes('workflow_dispatch'), source: 'workflow_dispatch' },
  { test: (cmd) => lineContainsAllCI(cmd, 'delete', 'workflow'), source: 'delete workflow' },
  { test: (cmd) => /gh\s+secret\s+delete/i.test(cmd), source: 'gh secret delete' },
  { test: (cmd) => /gh\s+variable\s+delete/i.test(cmd), source: 'gh variable delete' },
  { test: (cmd) => lineContainsAllCI(cmd, 'rm', '-rf', '.github'), source: 'rm -rf .github' },
];

/**
 * CI safety check hook
 */
export function ciSafetyCheck(input: HookInput): HookResult {
  const command = input.tool_input.command || '';

  // Check for dangerous CI/CD patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return outputDeny(
        `BLOCKED: Potentially destructive CI/CD operation detected. Pattern: '${pattern.source}'. This requires explicit user approval.`
      );
    }
  }

  // Warn on deployment-related commands
  if (/deploy|release|publish/i.test(command)) {
    return outputWithContext(
      'CI/CD Safety: Deployment commands detected. Verify target environment and ensure proper approvals are in place.'
    );
  }

  // Allow other commands
  return outputSilentSuccess();
}

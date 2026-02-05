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
import { outputSilentSuccess, outputDeny, outputWithContext } from '../lib/common.js';

// Dangerous CI/CD patterns
const DANGEROUS_PATTERNS = [
  /force.*push/i,
  /push.*--force/i,
  /--force-with-lease/i,
  /workflow_dispatch/i,
  /delete.*workflow/i,
  /gh\s+secret\s+delete/i,
  /gh\s+variable\s+delete/i,
  /rm.*-rf.*\.github/i,
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

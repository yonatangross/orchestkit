/**
 * Deployment Safety Check - Validates deployment commands for safety
 *
 * Used by: deployment-manager agent
 *
 * Purpose: Prevent dangerous deployment operations without verification
 *
 * CC 2.1.7 compliant output format
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputDeny, outputWithContext } from '../lib/common.js';

// Production patterns that should be blocked
const PRODUCTION_PATTERNS = [
  /\bprod\b/i,
  /production/i,
  /--env.*prod/i,
  /ENV=prod/i,
  /ENVIRONMENT=prod/i,
  /deploy.*main/i,
  /deploy.*master/i,
];

/**
 * Deployment safety check hook
 */
export function deploymentSafetyCheck(input: HookInput): HookResult {
  const command = input.tool_input.command || '';

  // Block production deployments without explicit markers
  for (const pattern of PRODUCTION_PATTERNS) {
    if (pattern.test(command)) {
      return outputDeny(
        `BLOCKED: Production deployment detected. Pattern: '${pattern.source}'. Production deployments require explicit user approval and should go through proper release processes.`
      );
    }
  }

  // Warn on rollback operations
  if (/rollback|revert|downgrade/i.test(command)) {
    return outputWithContext(
      'Deployment Safety: Rollback operation detected. Verify the target version and ensure proper change management procedures are followed.'
    );
  }

  // Warn on infrastructure changes
  if (/terraform|kubectl|helm|docker.*push/i.test(command)) {
    return outputWithContext(
      'Deployment Safety: Infrastructure change detected. Verify changes in staging before production deployment.'
    );
  }

  // Allow other commands
  return outputSilentSuccess();
}

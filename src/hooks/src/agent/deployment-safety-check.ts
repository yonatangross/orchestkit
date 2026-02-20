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
const PRODUCTION_PATTERNS: Array<{ test: (cmd: string) => boolean; source: string }> = [
  { test: (cmd) => /\bprod\b/i.test(cmd), source: 'prod' },
  { test: (cmd) => /production/i.test(cmd), source: 'production' },
  { test: (cmd) => cmd.includes('--env') && /prod/i.test(cmd), source: '--env.*prod' },
  { test: (cmd) => cmd.includes('ENV=prod'), source: 'ENV=prod' },
  { test: (cmd) => cmd.includes('ENVIRONMENT=prod'), source: 'ENVIRONMENT=prod' },
  { test: (cmd) => cmd.toLowerCase().includes('deploy') && cmd.toLowerCase().includes('main'), source: 'deploy.*main' },
  { test: (cmd) => cmd.toLowerCase().includes('deploy') && cmd.toLowerCase().includes('master'), source: 'deploy.*master' },
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
  if (/terraform|kubectl|helm/i.test(command) || (command.toLowerCase().includes('docker') && command.toLowerCase().includes('push'))) {
    return outputWithContext(
      'Deployment Safety: Infrastructure change detected. Verify changes in staging before production deployment.'
    );
  }

  // Allow other commands
  return outputSilentSuccess();
}

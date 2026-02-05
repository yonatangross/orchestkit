/**
 * Migration Safety Check - Validates database commands are safe
 *
 * Used by: database-engineer agent
 *
 * Purpose: Prevent destructive database operations without explicit confirmation
 *
 * CC 2.1.7 compliant output format
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputDeny } from '../lib/common.js';

// Dangerous database patterns
const DANGEROUS_PATTERNS = [
  /DROP\s+TABLE/i,
  /DROP\s+DATABASE/i,
  /TRUNCATE/i,
  /DELETE\s+FROM.*WHERE\s+1/i,
  /DELETE\s+FROM\s+[^W]*$/i, // DELETE without WHERE
  /--force/i,
  /alembic\s+downgrade/i,
];

/**
 * Migration safety check hook
 */
export function migrationSafetyCheck(input: HookInput): HookResult {
  const toolName = input.tool_name;

  // Only check Bash commands
  if (toolName !== 'Bash') {
    return outputSilentSuccess();
  }

  const command = input.tool_input.command || '';

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return outputDeny(
        `BLOCKED: Potentially destructive database command detected. Pattern: '${pattern.source}'. Please confirm this operation is intentional before proceeding.`
      );
    }
  }

  // Safe to proceed
  return outputSilentSuccess();
}

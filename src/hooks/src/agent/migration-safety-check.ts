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
import { normalizeSingle } from '../lib/normalize-command.js';

// Dangerous database patterns
const DANGEROUS_PATTERNS: Array<{ test: (s: string) => boolean; source: string }> = [
  { test: (s) => /DROP\s+TABLE/i.test(s), source: 'DROP TABLE' },
  { test: (s) => /DROP\s+DATABASE/i.test(s), source: 'DROP DATABASE' },
  { test: (s) => /TRUNCATE/i.test(s), source: 'TRUNCATE' },
  { test: (s) => /DELETE\s+FROM/i.test(s) && /WHERE\s+1/i.test(s), source: 'DELETE FROM...WHERE 1' },
  { test: (s) => /DELETE\s+FROM/i.test(s) && !/WHERE/i.test(s), source: 'DELETE FROM (no WHERE)' },
  { test: (s) => s.includes('--force'), source: '--force' },
  { test: (s) => /alembic\s+downgrade/i.test(s), source: 'alembic downgrade' },
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

  const rawCommand = input.tool_input.command || '';

  // Normalize: expand hex/octal escapes, strip quotes, collapse whitespace
  const command = rawCommand ? normalizeSingle(rawCommand) : '';

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

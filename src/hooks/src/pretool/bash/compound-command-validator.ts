/**
 * Compound Command Validator Hook
 * Detects suspicious shell features that bypass simple pattern matching.
 * CC 2.1.7: Catches process substitution, brace expansion, IFS manipulation, etc.
 *
 * NOTE: Dangerous command patterns (rm -rf, dd, mkfs, etc.) are handled by
 * dangerous-command-blocker.ts which runs FIRST in sync-bash-dispatcher.
 * This hook focuses solely on shell feature detection — its unique value.
 */

import type { HookInput, HookResult , HookContext} from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
} from '../../lib/common.js';
import { detectSuspiciousShellFeatures } from '../../lib/normalize-command.js';
import { NOOP_CTX } from '../../lib/context.js';

/**
 * Validate compound commands for suspicious shell features
 */
export function compoundCommandValidator(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const command = input.tool_input.command || '';

  if (!command) {
    return outputSilentSuccess();
  }

  // Detect shell features that bypass simple pattern matching:
  // process substitution <(...), brace expansion {cmd,...},
  // here-strings <<<, IFS manipulation, nested command substitution
  const suspiciousFeatures = detectSuspiciousShellFeatures(command);
  if (suspiciousFeatures.length > 0) {
    const reason = suspiciousFeatures.join('; ');
    ctx.logPermission('deny', `Suspicious shell feature: ${reason}`, input);
    ctx.log('compound-command-validator', `BLOCKED: ${reason}`);

    return outputDeny(
      `BLOCKED: Suspicious shell feature detected.

Finding: ${reason}

These shell features can bypass command validation and are not permitted.
Please rewrite the command using standard shell syntax.`
    );
  }

  // Safe compound command - allow execution
  ctx.logPermission('allow', 'Compound command validated: safe', input);
  return outputSilentSuccess();
}

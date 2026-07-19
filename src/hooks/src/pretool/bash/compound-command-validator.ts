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
  outputAsk,
} from '../../lib/common.js';
import { detectSuspiciousShellFeatures } from '../../lib/normalize-command.js';
import { NOOP_CTX } from '../../lib/context.js';

/**
 * Validate compound commands for suspicious shell features.
 *
 * Two tiers:
 *  - DENY: process substitution, brace expansion, IFS manipulation, nested
 *    command substitution. These OBFUSCATE a command (hide it from the
 *    substring denylist), which is the feature-detector's whole reason to
 *    exist — hard-blocked.
 *  - ASK: here-strings (<<<). A here-string is a stdin redirection, not
 *    obfuscation. It is usually benign (`grep x <<< "$v"`), but feeding one to
 *    a shell interpreter (`bash <<< "code"`) executes arbitrary code — and the
 *    receiver cannot be told apart statically (`source /dev/stdin <<<`,
 *    `$SHELL <<<`, `env bash <<<` all execute; adversarial analysis found 9
 *    such bypasses of any first-word check). So instead of a blanket hard-block
 *    that also rejects the benign case, escalate to the user: nothing runs
 *    without confirmation, and the operator sees `bash <<<` and can decline.
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
  if (suspiciousFeatures.length === 0) {
    ctx.logPermission('allow', 'Compound command validated: safe', input);
    return outputSilentSuccess();
  }

  const hereStringFindings = suspiciousFeatures.filter((f) => f.startsWith('here-string'));
  const denyFindings = suspiciousFeatures.filter((f) => !f.startsWith('here-string'));

  // Any obfuscation feature present → DENY (wins even if a here-string is
  // also present — the more dangerous tier governs).
  if (denyFindings.length > 0) {
    const reason = denyFindings.join('; ');
    ctx.logPermission('deny', `Suspicious shell feature: ${reason}`, input);
    ctx.log('compound-command-validator', `BLOCKED: ${reason}`);

    return outputDeny(
      `BLOCKED: Suspicious shell feature detected.

Finding: ${reason}

These shell features can bypass command validation and are not permitted.
Please rewrite the command using standard shell syntax.`
    );
  }

  // Only here-string findings remain → ASK. Nothing runs without confirmation.
  const reason = hereStringFindings.join('; ');
  ctx.logPermission('ask', `Here-string redirection: ${reason}`, input);
  ctx.log('compound-command-validator', `ASK: ${reason}`);

  return outputAsk(
    `Here-string (<<<) detected.

A here-string feeds text to a command's stdin. This is usually harmless \
(e.g. grep x <<< "$v"), but feeding one to a shell interpreter \
(bash <<< "code", source /dev/stdin <<< "code") executes arbitrary code. \
Approve only if you recognize this command.`
  );
}

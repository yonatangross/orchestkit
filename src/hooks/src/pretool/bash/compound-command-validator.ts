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

// A process substitution feeding an interpreter (`bash <(curl x)`,
// `python3 <(curl x)`) is the procsub spelling of `curl | bash`. Like the pipe
// guard's deny (dangerous-command-blocker), the reason must REDIRECT to the
// allowed shape or the model re-emits it every turn: CC feeds the deny reason
// back but keeps no memory of a denied command (no dedup, no backoff). Appended
// ONLY for the interpreter-feeding findings; brace expansion / IFS / nested
// substitution have no fetch-to-file analogue, so "rewrite plainly" stays the
// right guidance there.
const PROCSUB_INTERP_REDIRECT =
  '\n\nThat finding is the process-substitution spelling of piping fetched code into ' +
  'an interpreter. Do the fetch and the run as SEPARATE steps you can inspect:\n' +
  '  1. curl -fsSL "<url>" -o /tmp/x        (fetch to a file)\n' +
  '  2. less /tmp/x                         (read what it does)\n' +
  '  3. bash /tmp/x   (or: python3 /tmp/x)  (run the local file; no guard blocks that)\n' +
  'For an API read, prefer a real client or MCP query tool.';

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

  // ASK tier: here-strings AND process substitutions whose receiver is a
  // variable ($SHELL <(x)) — both are "cannot be told apart statically"
  // cases; the operator sees the command and decides. Everything else denies.
  const isAskTier = (f: string) => f.startsWith('here-string') || f.startsWith('unresolved-receiver');
  const hereStringFindings = suspiciousFeatures.filter(isAskTier);
  const denyFindings = suspiciousFeatures.filter((f) => !isAskTier(f));

  // Any obfuscation feature present → DENY (wins even if a here-string is
  // also present — the more dangerous tier governs).
  if (denyFindings.length > 0) {
    const reason = denyFindings.join('; ');
    ctx.logPermission('deny', `Suspicious shell feature: ${reason}`, input);
    ctx.log('compound-command-validator', `BLOCKED: ${reason}`);

    const feedsInterpreter = denyFindings.some((f) => f.includes('process substitution feeding'));
    const redirect = feedsInterpreter ? PROCSUB_INTERP_REDIRECT : '';

    return outputDeny(
      `BLOCKED: Suspicious shell feature detected.

Finding: ${reason}

These shell features can bypass command validation and are not permitted.
Please rewrite the command using standard shell syntax.${redirect}`
    );
  }

  // Only here-string findings remain → ASK. Nothing runs without confirmation.
  const reason = hereStringFindings.join('; ');
  ctx.logPermission('ask', `Here-string redirection: ${reason}`, input);
  ctx.log('compound-command-validator', `ASK: ${reason}`);

  return outputAsk(
    `Stdin/receiver redirection detected: ${reason}.

This is usually harmless (e.g. grep x <<< "$v", diff <(sort a) <(sort b)), \
but feeding a shell interpreter (bash <<< "code") or an unresolvable \
receiver ($SHELL <(x)) executes arbitrary code. \
Approve only if you recognize this command.`
  );
}

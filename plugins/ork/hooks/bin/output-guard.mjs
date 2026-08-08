/**
 * Output shape guard for run-hook.mjs dispatcher (defense-in-depth, #1794)
 *
 * Symmetric counterpart to the isValidPath input guard (#1250).
 * run-hook.mjs blindly JSON.stringifies hook return values without per-event
 * shape validation. When a hook returns hookEventName:'UserPromptSubmit' on a
 * WorktreeCreate event, CC misreads stdout and (in the case of #1794) creates a
 * literal-named directory from the additionalContext string.
 *
 * This guard runs BEFORE console.log(JSON.stringify(result)) and strips
 * hookEventName / additionalContext from events that do not consume them.
 *
 * Opt-out:
 *   ORCHESTKIT_DISABLE_OUTPUT_GUARD=1  — bypass all stripping for emergency revert
 *   without rolling the package. Set in the invoking shell before CC starts; not
 *   intended for production use.
 *
 * The guard NEVER throws. Failing-closed would itself create a new failure mode
 * (all hooks break instead of one event being mishandled). When in doubt, emit
 * the result unmodified.
 *
 * Refs #1794
 */

/**
 * The allow-lists are GENERATED from spec/cc-output-keys.spec.yml, which is
 * derived from the shipped CC binary.
 *
 * They used to be hand-typed here, with a provenance comment citing
 * "types.ts plus the #1234 audit" — one hand-maintained artifact plus a memory.
 * Both lists were wrong: CC documents Stop, SubagentStop and PostToolBatch as
 * additionalContext consumers and this guard named none of them, so it silently
 * deleted valid output from six live hooks. A guard that strips CORRECT output
 * fails in the one direction nobody checks.
 *
 * Regenerate: node scripts/derive-cc-output-keys.mjs
 * Drift gate:  node scripts/derive-cc-output-keys.mjs --check
 */
import {
  EVENTS_WITH_HOOK_EVENT_NAME,
  EVENTS_WITH_ADDITIONAL_CONTEXT,
} from './cc-output-keys.generated.mjs';

/**
 * Sanitize a hook result before it is written to stdout.
 *
 * @param {unknown} result - The raw return value from the hook function
 * @param {string} firingEvent - The hook_event that triggered execution (e.g. 'WorktreeCreate')
 * @returns {unknown} The sanitized result — always a plain object safe for JSON.stringify
 */
export function sanitizeOutput(result, firingEvent) {
  // Opt-out escape hatch for emergency revert.
  if (process.env.ORCHESTKIT_DISABLE_OUTPUT_GUARD === '1') {
    return result;
  }

  // Guard can only inspect objects. Non-objects pass through unmodified.
  if (typeof result !== 'object' || result === null || Array.isArray(result)) {
    return result;
  }

  // No hookSpecificOutput at all — nothing to sanitize.
  if (
    typeof result.hookSpecificOutput !== 'object' ||
    result.hookSpecificOutput === null
  ) {
    return result;
  }

  let mutated = false;
  // Shallow-clone to avoid mutating the original hook return value.
  const sanitized = { ...result, hookSpecificOutput: { ...result.hookSpecificOutput } };

  // NOTE — a mismatched-hookEventName rule was tried here and REVERTED.
  //
  // The idea was sound: #1794 was a WorktreeCreate response carrying
  // hookEventName:'UserPromptSubmit', and checking that mismatch directly is
  // narrower than checking whether the event consumes hookSpecificOutput.
  //
  // It broke 9 security tests, turning "expected deny" into "got abstain".
  // The reason is in lib/output.ts: outputDeny/outputAsk/outputDefer HARDCODE
  // hookEventName:'PreToolUse' regardless of which event the hook fires on, so
  // a PermissionRequest hook legitimately emits a 'PreToolUse' label. Dropping
  // the envelope on that mismatch deleted the permission decision itself —
  // a guard turning a denial into an abstention, which is the single worst
  // direction for this file to fail in.
  //
  // Fixing it properly means teaching the builders their firing event, which is
  // a wider change than this one. Tracked separately; do not re-add the rule
  // without that.
  const declared = sanitized.hookSpecificOutput.hookEventName;

  // --- Rule 1: Strip hookEventName on events that don't consume it ---
  if (declared !== undefined) {
    if (!EVENTS_WITH_HOOK_EVENT_NAME.has(firingEvent)) {
      process.stderr.write(
        `[orchestkit] WARN: stripped hookEventName=${declared}` +
        ` from ${firingEvent} response — see #1794\n`
      );
      delete sanitized.hookSpecificOutput.hookEventName;
      mutated = true;
    }
  }

  // --- Rule 2: Strip additionalContext on events that don't consume it ---
  if (sanitized.hookSpecificOutput.additionalContext !== undefined) {
    if (!EVENTS_WITH_ADDITIONAL_CONTEXT.has(firingEvent)) {
      process.stderr.write(
        `[orchestkit] WARN: stripped additionalContext from ${firingEvent} response` +
        ` — CC does not read additionalContext for this event type (see #1794)\n`
      );
      delete sanitized.hookSpecificOutput.additionalContext;
      mutated = true;
    }
  }

  // If hookSpecificOutput is now empty, drop the key entirely to keep stdout clean.
  if (mutated && Object.keys(sanitized.hookSpecificOutput).length === 0) {
    delete sanitized.hookSpecificOutput;
  }

  return sanitized;
}

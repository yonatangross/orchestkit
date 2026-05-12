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
 * Events where hookEventName is valid and CC reads hookSpecificOutput.
 * Derived from src/hooks/src/types.ts:223 HookSpecificOutput.hookEventName union.
 */
const EVENTS_WITH_HOOK_EVENT_NAME = new Set([
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'PermissionDenied',
  'UserPromptSubmit',
  'SubagentStart',
  'SubagentStop',
]);

/**
 * Events where additionalContext is read by CC.
 * Only UserPromptSubmit and PostToolUse* consume additionalContext.
 */
const EVENTS_WITH_ADDITIONAL_CONTEXT = new Set([
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
]);

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

  // --- Rule 1: Strip hookEventName on events that don't consume it ---
  if (sanitized.hookSpecificOutput.hookEventName !== undefined) {
    if (!EVENTS_WITH_HOOK_EVENT_NAME.has(firingEvent)) {
      process.stderr.write(
        `[orchestkit] WARN: stripped hookEventName=${sanitized.hookSpecificOutput.hookEventName}` +
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

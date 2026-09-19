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
 * hookSpecificOutput / additionalContext from events that do not consume
 * them. Whatever leaves this function MUST satisfy CC's envelope contract:
 * a hookSpecificOutput object without hookEventName is a hard validation
 * error on CC's side ("hookSpecificOutput is missing required field
 * hookEventName"), so the guard repairs or drops — never emits one.
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
 * @param {boolean} [emptyPayload] - stdin delivered no payload (#3415 watchdog,
 *   stdin error, unparseable body): the hook ran on `{}` and any verdict it
 *   produced is noise. Drops hookSpecificOutput regardless of event.
 * @returns {unknown} The sanitized result — always a plain object safe for JSON.stringify
 */
export function sanitizeOutput(result, firingEvent, emptyPayload = false) {
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

  // 'unknown' is normalizeInput's token for "the payload carried no event
  // field" (CC always sends one; ad-hoc probes and the test harness do not).
  // It is an UNIDENTIFIED event, not a known non-consumer — the envelope's
  // own hookEventName is then the only event signal, and it is the field CC
  // routes on. The rules below therefore distinguish "provably wrong event"
  // (drop) from "event unidentifiable" (trust the declared label).
  const unidentified = !firingEvent || firingEvent === 'unknown';

  // --- Rule -1: a verdict computed on an empty payload is noise ---
  // The stdin watchdog (#3415), a stdin error, or an unparseable truncated
  // body all run the hook on `{}`. Whatever it returns is a guess — the
  // observed production failure was default-timeout-setter's
  // updatedInput{command:'',timeout:120000}, which would have blanked the
  // pending command had it reached CC in a valid envelope. Drop the
  // envelope wholesale; the rest of the result (continue, systemMessage)
  // still stands.
  if (emptyPayload) {
    process.stderr.write(
      `[orchestkit] WARN: dropped hookSpecificOutput from ${firingEvent || 'unknown'} response` +
      ` — hook ran on an empty payload, the verdict is not trustworthy (#3415)\n`
    );
    delete sanitized.hookSpecificOutput;
    return sanitized;
  }

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

  // --- Rule 0: Repair a missing hookEventName on events that consume it ---
  // Several emitters hand-roll hookSpecificOutput envelopes without the field
  // (pretool/bash/playground-presence-warner, worktree-merge-verifier and
  // delete-branch-stacked-pr-guard did exactly this). Their dispatcher merge
  // re-wraps them today, but any path that returns such a result verbatim
  // emits an envelope CC rejects outright. Inject the firing event — the hook
  // ran on it, so it is the honest label.
  if (declared === undefined && EVENTS_WITH_HOOK_EVENT_NAME.has(firingEvent)) {
    sanitized.hookSpecificOutput.hookEventName = firingEvent;
    mutated = true;
  }

  // --- Rule 1: Drop hookSpecificOutput on events that don't consume it ---
  //
  // The old rule deleted only hookEventName. That was the bug behind the
  // "hookSpecificOutput is missing required field hookEventName" validation
  // errors seen in production: when the stdin-read race (#3415) left the
  // payload empty, hook_event normalized to 'unknown', the firing event was
  // not allow-listed, and the guard stripped hookEventName while leaving
  // updatedInput/permissionDecision/etc. behind — emitting exactly the
  // malformed envelope it exists to prevent. Every key inside
  // hookSpecificOutput is event-scoped, so on a non-consuming event the
  // object as a whole is unrepresentable. Drop it entirely.
  //
  // Scoped to IDENTIFIED events only: on 'unknown' we cannot prove the
  // firing event rejects hookSpecificOutput, and dropping a well-formed
  // envelope would turn a measured verdict (e.g. a deny) into a silent
  // abstain. CC routes on the declared hookEventName, so a self-describing
  // envelope is emitted intact; a nameless one still dies at the invariant.
  if (!unidentified && !EVENTS_WITH_HOOK_EVENT_NAME.has(firingEvent)) {
    const declaredLabel = sanitized.hookSpecificOutput.hookEventName;
    const detail = declaredLabel !== undefined ? ` (hookEventName=${declaredLabel})` : '';
    process.stderr.write(
      `[orchestkit] WARN: dropped hookSpecificOutput${detail}` +
      ` from ${firingEvent} response — event does not consume it, see #1794\n`
    );
    delete sanitized.hookSpecificOutput;
    return sanitized;
  }

  // --- Rule 2: Strip additionalContext on events that don't consume it ---
  // On an unidentifiable firing event, judge consumption by the declared
  // hookEventName — that is the event CC will route on, so an envelope that
  // labels itself PermissionRequest cannot smuggle additionalContext past a
  // 'unknown' firing event just because the firing event could not be read.
  if (sanitized.hookSpecificOutput?.additionalContext !== undefined) {
    const contextEvent = unidentified ? declared : firingEvent;
    if (!EVENTS_WITH_ADDITIONAL_CONTEXT.has(contextEvent)) {
      process.stderr.write(
        `[orchestkit] WARN: stripped additionalContext from ${firingEvent} response` +
        ` — CC does not read additionalContext for this event type (see #1794)\n`
      );
      delete sanitized.hookSpecificOutput.additionalContext;
      mutated = true;
    }
  }

  // If hookSpecificOutput is now empty, drop the key entirely to keep stdout clean.
  if (mutated && Object.keys(sanitized.hookSpecificOutput ?? {}).length === 0) {
    delete sanitized.hookSpecificOutput;
  }

  // --- Final invariant: never emit hookSpecificOutput without a valid
  // hookEventName --- CC's envelope validator hard-requires the field and
  // routes on it, so the label must name a real event that consumes
  // hookSpecificOutput. A nameless envelope (nothing to infer on an
  // unidentifiable firing event) or a garbage label is unrepresentable —
  // drop rather than ship malformed.
  const emittedName = sanitized.hookSpecificOutput?.hookEventName;
  if (
    sanitized.hookSpecificOutput !== undefined &&
    (typeof emittedName !== 'string' || !EVENTS_WITH_HOOK_EVENT_NAME.has(emittedName))
  ) {
    process.stderr.write(
      `[orchestkit] WARN: dropped hookSpecificOutput from ${firingEvent} response` +
      ` — no usable hookEventName and none could be inferred\n`
    );
    delete sanitized.hookSpecificOutput;
  }

  return sanitized;
}

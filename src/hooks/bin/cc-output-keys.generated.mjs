// DERIVED FILE — edit spec/cc-output-keys.spec.yml, then mirror the change here.
//
// Source of truth: spec/cc-output-keys.spec.yml
// Drift gate:     node scripts/derive-cc-output-keys.mjs --check
//
// This header used to say "Regenerate: node scripts/derive-cc-output-keys.mjs",
// which was FALSE: that script only ever READS this module (it imports it to
// compare against the binary) and contains no write path. A maintainer
// following the instruction got a printed report and an unchanged file, and
// could reasonably believe the file had been re-derived from the binary when
// nothing was rewritten (#3418). Until an emit path exists, the sync is manual:
// spec first, this file second, in the same commit, and the --check gate
// arbitrates against the shipped binary.
//
// Editing this file WITHOUT the spec is the exact failure it exists to prevent.
// The Sets it replaces were hand-typed, drifted from CC's real contract, and
// silently stripped valid output from six live hooks for as long as they
// existed.

/** CC version this contract was derived from. */
export const CC_VERSION = '2.1.278';

/**
 * Events on which CC reads hookSpecificOutput at all.
 * Emitting hookEventName outside this set is inert: CC's validator rejects the
 * envelope ("missing required field hookEventName") and drops the decision.
 *
 * Closed set = hookEventName:R("X") literals in the shipped binary's output
 * schema union (22 on CC 2.1.278), plus HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS.
 * The derive script's check mode arbitrates this Set bidirectionally (#4291).
 */
export const EVENTS_WITH_HOOK_EVENT_NAME = new Set([
  // CC 2.1.278 output-schema union (hookEventName:R("...")):
  'CwdChanged',
  'Elicitation',
  'ElicitationResult',
  'FileChanged',
  'MessageDisplay',
  'Notification',
  'PermissionDenied',
  'PermissionRequest',
  'PostModelSwitch',
  'PostToolBatch',
  'PostToolUse',
  'PostToolUseFailure',
  'PreModelSwitch',
  'PreToolUse',
  'SessionStart',
  'Setup',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'UserPromptExpansion',
  'UserPromptSubmit',
  'WorktreeCreate',
  // Reviewed exception: see HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS.
  'PostCompact',
]);

/**
 * hookEventName events the binary's R("...") extract does NOT name, but the
 * derive script's check mode treats as PROVEN rather than DRIFT.
 *
 * PostCompact (#4291): the input schema carries hook_event_name:R("PostCompact")
 * and executePostCompactHooks, but the output-schema union has no matching
 * hookEventName:R("PostCompact") variant. Removing it would be a guess that
 * the pattern is complete; keeping it without a reviewed exception would fail
 * the reverse arm. Membership here keeps the prior guard behaviour
 * (envelope allowed; additionalContext still stripped per #3457) while naming
 * the ambiguity. Do not add further exceptions on documentation absence alone.
 */
export const HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS = new Set([
  'PostCompact',
]);

/**
 * Events on which CC reads additionalContext.
 *
 * Stop, SubagentStop and PostToolBatch were MISSING from the hand-typed list
 * this replaces. CC documents all three verbatim; see the spec's evidence
 * block. Six ork hooks were emitting into the void because of it.
 *
 * Notification, Setup, PostModelSwitch and UserPromptExpansion were added from
 * the CC 2.1.278 output-schema union (#4291): each declares additionalContext
 * in its hookSpecificOutput variant. Without them the guard drops the whole
 * envelope (EVENTS_WITH_HOOK_EVENT_NAME miss) or strips the key after the name
 * list is fixed. They are reviewed exceptions (schema accept, not prose named).
 */
export const EVENTS_WITH_ADDITIONAL_CONTEXT = new Set([
  'Notification',
  'PostModelSwitch',
  'PostToolBatch',
  'PostToolUse',
  'PostToolUseFailure',
  'PreToolUse',
  'SessionStart',
  'Setup',
  'Stop',
  'SubagentStop',
  'UserPromptExpansion',
  'UserPromptSubmit',
]);

/**
 * additionalContext events the binary's prose does NOT name, but the
 * derive script's --check gate treats as PROVEN rather than DRIFT.
 *
 * The gate is bidirectional (#3418): an EVENTS_WITH_ADDITIONAL_CONTEXT entry
 * uncorroborated by the binary now fails --check UNLESS it is listed here.
 * Membership requires the same trace-and-observe evidence the missing-only
 * check itself would demand — emitting hook -> output builder ->
 * hookSpecificOutput.additionalContext with a matching hookEventName ->
 * observed arriving in the model's context — recorded in
 * spec/cc-output-keys.spec.yml's additionalContext.reviewed_exceptions, with
 * a citation. Do NOT add an event here on documentation-prose absence alone;
 * that is the exact unproven-assertion shape this gate exists to catch, and
 * a blanket "except everything uncorroborated" defeats the gate entirely.
 *
 * PostToolUseFailure was settled 2026-08-12 (issue #3457 follow-up): a live
 * firing could not be forced (it requires a genuine tool-execution exception
 * or user interrupt, not an ordinary tool_use_error), so this was proven by
 * tracing the shipped 2.1.228 binary's executor strings instead — the
 * PostToolUseFailure code block carries `hook_additional_context` in the same
 * position as PostToolUse's own block (already proven live, above), and a
 * negative control (PermissionRequest, no additionalContext support) carries
 * no such marker anywhere nearby. See spec/cc-output-keys.spec.yml for the
 * full trace.
 *
 * Notification, Setup, PostModelSwitch, UserPromptExpansion (#4291): settled
 * by the binary's output-schema union (hookEventName:R + additionalContext on
 * the same variant), not by prose. Parser ACCEPTS the shape; runtime delivery
 * is not yet trace-and-observe proven. Listed so the guard stops dropping the
 * envelope / stripping the key on ignorance (the direction that broke Stop).
 *
 * PostCompact is deliberately ABSENT — not merely unreviewed, but REMOVED
 * from EVENTS_WITH_ADDITIONAL_CONTEXT entirely. The same binary trace used to
 * settle PostToolUseFailure above found `hook_additional_context` absent from
 * every one of PostCompact's string-block occurrences, confirming #3321's
 * original finding over its later "Correction 1" push-back (which cited only
 * this repo's own allow-list and a guard unit test, not independent CC
 * evidence). lifecycle/post-compact-recovery.ts no longer builds
 * hookSpecificOutput.additionalContext for it.
 */
export const ADDITIONAL_CONTEXT_REVIEWED_EXCEPTIONS = new Set([
  'PreToolUse',
  'UserPromptSubmit',
  'SessionStart',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'Setup',
  'PostModelSwitch',
  'UserPromptExpansion',
]);

/**
 * Per-key event allow-lists for the keys beyond hookEventName/additionalContext.
 * A key absent from this map is not guarded — that is a coverage gap, not a
 * permission. Track additions in the spec, never here.
 */
export const KEY_EVENTS = new Map([
  ['permissionDecision', new Set(['PreToolUse', 'PermissionRequest', 'PreModelSwitch'])],
  ['permissionDecisionReason', new Set(['PreToolUse', 'PermissionRequest', 'PreModelSwitch'])],
  ['retry', new Set(['PermissionDenied'])],
  ['worktreePath', new Set(['WorktreeCreate'])],
  ['updatedInput', new Set(['PreToolUse'])],
  ['updatedToolOutput', new Set(['PostToolUse', 'PostToolUseFailure'])],
  ['updatedMCPToolOutput', new Set(['PostToolUse'])],
  ['displayContent', new Set(['MessageDisplay'])],
  ['action', new Set(['Elicitation', 'ElicitationResult'])],
]);

/**
 * Keys the spec records as UNVERIFIED. The guard must not strip these — an
 * unverified key is "we do not know", and stripping on ignorance is how the
 * previous guard broke Stop.
 */
export const UNVERIFIED_KEYS = new Set([
  'watchPaths',
  'updatedPermissions',
  'sessionTitle',
]);

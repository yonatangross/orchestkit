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
export const CC_VERSION = '2.1.226';

/**
 * Events on which CC reads hookSpecificOutput at all.
 * Emitting hookEventName outside this set is inert: CC's validator rejects the
 * envelope ("missing required field hookEventName") and drops the decision.
 */
export const EVENTS_WITH_HOOK_EVENT_NAME = new Set([
  'PermissionDenied',
  'PermissionRequest',
  'PostCompact',
  'PostToolBatch',
  'PostToolUse',
  'PostToolUseFailure',
  'PreToolUse',
  'SessionStart',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'UserPromptSubmit',
]);

/**
 * Events on which CC reads additionalContext.
 *
 * Stop, SubagentStop and PostToolBatch were MISSING from the hand-typed list
 * this replaces. CC documents all three verbatim; see the spec's evidence
 * block. Six ork hooks were emitting into the void because of it.
 */
export const EVENTS_WITH_ADDITIONAL_CONTEXT = new Set([
  'PostCompact',
  'PostToolBatch',
  'PostToolUse',
  'PostToolUseFailure',
  'PreToolUse',
  'SessionStart',
  'Stop',
  'SubagentStop',
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
 * PostCompact and PostToolUseFailure are deliberately ABSENT: PostCompact has
 * independent evidence of being wrong (#3321), and PostToolUseFailure's own
 * emitting hook was reading a field CC never sends until #3418's failure-
 * handler.ts fix, so it was unobservable regardless of CC support. Both fail
 * --check until settled by the same method as the four below.
 */
export const ADDITIONAL_CONTEXT_REVIEWED_EXCEPTIONS = new Set([
  'PreToolUse',
  'UserPromptSubmit',
  'SessionStart',
  'PostToolUse',
]);

/**
 * Per-key event allow-lists for the keys beyond hookEventName/additionalContext.
 * A key absent from this map is not guarded — that is a coverage gap, not a
 * permission. Track additions in the spec, never here.
 */
export const KEY_EVENTS = new Map([
  ['permissionDecision', new Set(['PreToolUse', 'PermissionRequest'])],
  ['permissionDecisionReason', new Set(['PreToolUse', 'PermissionRequest'])],
  ['retry', new Set(['PermissionDenied'])],
  ['worktreePath', new Set(['WorktreeCreate'])],
  ['updatedInput', new Set(['PreToolUse'])],
  ['updatedToolOutput', new Set(['PostToolUse', 'PostToolUseFailure'])],
  ['updatedMCPToolOutput', new Set(['PostToolUse'])],
  ['displayContent', new Set(['MessageDisplay'])],
  ['action', new Set(['Elicitation'])],
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

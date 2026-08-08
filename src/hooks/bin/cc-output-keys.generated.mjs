// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Source of truth: spec/cc-output-keys.spec.yml
// Regenerate:     node scripts/derive-cc-output-keys.mjs
// Drift gate:     node scripts/derive-cc-output-keys.mjs --check
//
// Hand-editing this file is the exact failure it exists to prevent. The Sets it
// replaces were hand-typed, drifted from CC's real contract, and silently
// stripped valid output from six live hooks for as long as they existed.

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

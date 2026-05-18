/**
 * Hook event registry — single source of truth (npm side, M141-1).
 *
 * Manually authored for M141-1. M141-2 will replace this file with codegen
 * output derived from a shared spec, plus PyPI parity.
 *
 * Event list mirrors the 19 events emitted by Claude Code 2.1.71+ and
 * consumed by OrchestKit's HTTP hook fan-out (see
 * src/hooks/src/cli/generate-http-hooks.ts).
 */

export const HOOK_EVENT_NAMES = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'SubagentStart',
  'SubagentStop',
  'Stop',
  'SessionEnd',
  'Setup',
  'Notification',
  'PreCompact',
  'TeammateIdle',
  'TaskCompleted',
  'InstructionsLoaded',
  'WorktreeCreate',
  'WorktreeRemove',
  'ConfigChange',
] as const;

export type HookEventName = (typeof HOOK_EVENT_NAMES)[number];

/**
 * Common envelope fields present on every hook payload, per CC 2.1.71+.
 * Concrete events extend with their own `payload` shape.
 */
export interface HookEventEnvelope {
  /** The event tag. Discriminator for the union. */
  event: HookEventName;
  /** ISO-8601 UTC timestamp emitted by CC. */
  timestamp?: string;
  /** Session correlation ID, when CC supplies one. */
  session_id?: string;
  /** Project working directory at fire time. */
  cwd?: string;
  /** Per-event payload. Refined per discriminant in M141-2 codegen. */
  payload?: unknown;
}

/**
 * Discriminated union over all known hook events.
 *
 * For M141-1 the payload is intentionally `unknown` for every variant —
 * the parity gate test only checks the tag + envelope, not field-level
 * structure. M141-2 will narrow each variant.
 */
export type HookEvent = HookEventEnvelope & { event: HookEventName };

/**
 * Type guard — narrow `string` to `HookEventName`.
 */
export function isHookEventName(value: unknown): value is HookEventName {
  return typeof value === 'string' && (HOOK_EVENT_NAMES as readonly string[]).includes(value);
}

/**
 * Set of event names, frozen — convenient for O(1) lookups in consumers.
 */
export const HOOK_EVENT_NAME_SET: ReadonlySet<HookEventName> = new Set(HOOK_EVENT_NAMES);

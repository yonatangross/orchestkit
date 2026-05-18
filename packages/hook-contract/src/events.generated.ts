/**
 * Hook event registry — codegen output (M141-2, #1864).
 *
 * DO NOT EDIT BY HAND. Source: spec/hook-events.spec.yml.
 * Regenerate via `npm run -w @orchestkit/hook-contract codegen`.
 *
 * CI parity gate: scripts/codegen.mjs --check fails if this file drifts
 * from the spec.
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

export interface HookEventEnvelope {
  event: HookEventName;
  timestamp?: string;
  session_id?: string;
  cwd?: string;
  payload?: unknown;
}

export type HookEvent = HookEventEnvelope & { event: HookEventName };

export function isHookEventName(value: unknown): value is HookEventName {
  return typeof value === 'string' && (HOOK_EVENT_NAMES as readonly string[]).includes(value);
}

export const HOOK_EVENT_NAME_SET: ReadonlySet<HookEventName> = new Set(HOOK_EVENT_NAMES);

/**
 * Map from event name to its payload type. Events without a payload
 * block in the spec map to `unknown` for backwards compatibility.
 * Consumers can index into this for typed payload access:
 *
 *   function handle(p: PayloadFor<'PreToolUse'>) { p.tool_name; }
 */
export interface PayloadMap {
  SessionStart: unknown;
  UserPromptSubmit: unknown;
  PreToolUse: unknown;
  PostToolUse: unknown;
  PostToolUseFailure: unknown;
  PermissionRequest: unknown;
  SubagentStart: unknown;
  SubagentStop: unknown;
  Stop: unknown;
  SessionEnd: unknown;
  Setup: unknown;
  Notification: unknown;
  PreCompact: unknown;
  TeammateIdle: unknown;
  TaskCompleted: unknown;
  InstructionsLoaded: unknown;
  WorktreeCreate: unknown;
  WorktreeRemove: unknown;
  ConfigChange: unknown;
}

export type PayloadFor<E extends HookEventName> = PayloadMap[E];

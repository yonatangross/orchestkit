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
 * Payload for the SessionStart event.
 * Fired when a CC session starts. Async hooks observe project state before the first prompt.
 */
export interface SessionStartPayload {
  /** Absolute path to the plugin root (injected by run-hook.mjs) */
  plugin_root?: string;
  /** Permission mode (default | acceptEdits | dontAsk | auto) */
  permissionMode?: string;
}

/**
 * Payload for the UserPromptSubmit event.
 * Fires when the user submits a prompt — used to inject additionalContext.
 */
export interface UserPromptSubmitPayload {
  /** The user prompt text being submitted */
  prompt: string;
}

/**
 * Payload for the PreToolUse event.
 * Before any tool invocation — gate or transform tool input.
 */
export interface PreToolUsePayload {
  /** The tool being invoked (e.g. Bash, Write, Read) */
  tool_name: string;
  /** Tool-specific input parameters */
  tool_input: Record<string, unknown>;
  /** CC 2.1.69 correlation ID for matching with PostToolUse */
  tool_use_id?: string;
}

/**
 * Payload for the PostToolUse event.
 * After a successful tool invocation — observe result.
 */
export interface PostToolUsePayload {
  /** The tool that was invoked */
  tool_name: string;
  /** Tool input passed to the invocation */
  tool_input: Record<string, unknown>;
  /** Tool output (type varies by tool) */
  tool_output?: unknown;
  /** Tool error message if one was produced */
  tool_error?: string;
  /** Tool exit code where applicable */
  exit_code?: number;
  /** CC 2.1.69 correlation ID */
  tool_use_id?: string;
  /** Tool execution duration in milliseconds */
  duration_ms?: number;
}

/**
 * Payload for the PostToolUseFailure event.
 * After a failed tool invocation — observe error.
 */
export interface PostToolUseFailurePayload {
  /** The tool that failed */
  tool_name: string;
  /** Tool input passed to the failed invocation */
  tool_input: Record<string, unknown>;
  /** Error message from the tool */
  tool_error: string;
  /** Tool exit code */
  exit_code?: number;
  /** CC 2.1.69 correlation ID */
  tool_use_id?: string;
}

/**
 * Payload for the PermissionRequest event.
 * Fires when a tool needs permission approval.
 */
export interface PermissionRequestPayload {
  /** The tool requesting permission */
  tool_name: string;
  /** Tool input that triggered the permission request */
  tool_input: Record<string, unknown>;
  /** CC 2.1.69 suggested "always allow" options */
  permission_suggestions?: Record<string, unknown>;
}

/**
 * Payload for the SubagentStart event.
 * Fires when a subagent begins execution.
 */
export interface SubagentStartPayload {
  /** Subagent type (CC 2.1.0+ field name) */
  subagent_type?: string;
  /** Alternative agent type field name */
  agent_type?: string;
  /** Agent ID */
  agent_id?: string;
  /** Parent agent ID for trace stitching (CC 2.1.139) */
  parent_agent_id?: string;
}

/**
 * Payload for the SubagentStop event.
 * Fires when a subagent finishes (success or error).
 */
export interface SubagentStopPayload {
  /** Agent type */
  agent_type?: string;
  /** Agent ID */
  agent_id?: string;
  /** Final agent output text */
  agent_output?: string;
  /** Alternative output field name */
  output?: string;
  /** Error from subagent if it failed */
  error?: string;
  /** Total subagent execution duration */
  duration_ms?: number;
  /** Path to subagent transcript (CC 2.1.69) */
  agent_transcript_path?: string;
  /** Final assistant message text (CC 2.1.47+) */
  last_assistant_message?: string;
}

/**
 * Payload for the Stop event.
 * Fires when the assistant finishes a turn.
 */
export interface StopPayload {
  /** Final assistant message text (CC 2.1.47+) */
  last_assistant_message?: string;
  /** Whether a stop hook is currently active (prevents re-entry) */
  stop_hook_active?: boolean;
}

/**
 * Payload for the Notification event.
 * Fires on user-facing notifications.
 */
export interface NotificationPayload {
  /** Notification message text */
  message: string;
  /** Notification type discriminator */
  notification_type?: string;
}

/**
 * Payload for the PreCompact event.
 * Fires before automatic context compaction.
 */
export interface PreCompactPayload {
  /** Number of compactions in this session so far */
  compaction_count?: number;
  /** Estimated context size after compaction (tokens) */
  context_size_after?: number;
}

/**
 * Payload for the TeammateIdle event.
 * Fires when a teammate agent has been idle past a threshold.
 */
export interface TeammateIdlePayload {
  /** Teammate agent ID */
  teammate_id: string;
  /** Teammate agent type */
  teammate_type: string;
  /** How long the teammate has been idle */
  idle_duration_ms: number;
}

/**
 * Payload for the TaskCompleted event.
 * Fires when a TaskCreate task is marked completed.
 */
export interface TaskCompletedPayload {
  /** Completed task ID */
  task_id: string;
  /** Task subject */
  task_subject?: string;
  /** Task result status */
  task_status?: string;
  /** Tokens consumed by the task (CC 2.1.30) */
  token_count?: number;
  /** Tool invocations in the task (CC 2.1.30) */
  tool_uses?: number;
}

/**
 * Map from event name to its payload type. Events without a payload
 * block in the spec map to `unknown` for backwards compatibility.
 * Consumers can index into this for typed payload access:
 *
 *   function handle(p: PayloadFor<'PreToolUse'>) { p.tool_name; }
 */
export interface PayloadMap {
  SessionStart: SessionStartPayload;
  UserPromptSubmit: UserPromptSubmitPayload;
  PreToolUse: PreToolUsePayload;
  PostToolUse: PostToolUsePayload;
  PostToolUseFailure: PostToolUseFailurePayload;
  PermissionRequest: PermissionRequestPayload;
  SubagentStart: SubagentStartPayload;
  SubagentStop: SubagentStopPayload;
  Stop: StopPayload;
  SessionEnd: unknown;
  Setup: unknown;
  Notification: NotificationPayload;
  PreCompact: PreCompactPayload;
  TeammateIdle: TeammateIdlePayload;
  TaskCompleted: TaskCompletedPayload;
  InstructionsLoaded: unknown;
  WorktreeCreate: unknown;
  WorktreeRemove: unknown;
  ConfigChange: unknown;
}

export type PayloadFor<E extends HookEventName> = PayloadMap[E];

/**
 * TypeScript type definitions for Claude Code hooks
 * CC 2.1.9 compliant with additionalContext support
 */

/**
 * Hook events supported by Claude Code
 */
export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PermissionRequest'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Stop'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'Setup'
  | 'Notification';

/**
 * Hook input envelope from Claude Code (sent via stdin as JSON)
 */
export interface HookInput {
  /** The hook event type */
  hook_event?: HookEvent;
  /** The tool being invoked */
  tool_name: string;
  /** Session ID (CC 2.1.9 guarantees availability) */
  session_id: string;
  /** Tool-specific input parameters */
  tool_input: ToolInput;
  /** Tool output (PostToolUse only) */
  tool_output?: unknown;
  /** Tool error message if any */
  tool_error?: string;
  /** Tool exit code */
  exit_code?: number;
  /** User prompt (UserPromptSubmit only) */
  prompt?: string;
  /** Project directory */
  project_dir?: string;

  // SubagentStart/SubagentStop specific fields
  /** Agent type for subagent hooks */
  subagent_type?: string;
  /** Agent type (alternative field name) */
  agent_type?: string;
  /** Agent ID */
  agent_id?: string;
  /** Agent output (SubagentStop) */
  agent_output?: string;
  /** Output (alternative field name) */
  output?: string;
  /** Error from subagent */
  error?: string;
  /** Duration in milliseconds */
  duration_ms?: number;
  /** Tool result (SubagentStop) */
  tool_result?: string;

  // Notification specific fields
  /** Notification message */
  message?: string;
  /** Notification type */
  notification_type?: string;
}

/**
 * Tool input types - union of all tool inputs
 */
export interface ToolInput {
  /** Bash command (Bash tool) */
  command?: string;
  /** Timeout in ms (Bash tool) */
  timeout?: number;
  /** File path (Write/Edit/Read tools) */
  file_path?: string;
  /** File content (Write tool) */
  content?: string;
  /** Old text to replace (Edit tool) */
  old_string?: string;
  /** New text (Edit tool) */
  new_string?: string;
  /** Pattern (Glob/Grep tools) */
  pattern?: string;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Hook-specific output for CC 2.1.9
 */
export interface HookSpecificOutput {
  /** Hook event name for context */
  hookEventName?: 'PreToolUse' | 'PostToolUse' | 'PermissionRequest' | 'UserPromptSubmit';
  /** Permission decision (PermissionRequest hooks) */
  permissionDecision?: 'allow' | 'deny';
  /** Reason for permission decision */
  permissionDecisionReason?: string;
  /** Additional context injected before tool execution (CC 2.1.9) */
  additionalContext?: string;
}

/**
 * Hook result - output JSON to stdout
 * CC 2.1.7+ compliant
 */
export interface HookResult {
  /** Whether to continue execution */
  continue: boolean;
  /** Suppress hook output from user */
  suppressOutput?: boolean;
  /** System message shown to user */
  systemMessage?: string;
  /** Reason for stopping (when continue is false) */
  stopReason?: string;
  /** Hook-specific output fields */
  hookSpecificOutput?: HookSpecificOutput;
}

/**
 * Hook function signature
 */
export type HookFn = (input: HookInput) => Promise<HookResult> | HookResult;

/**
 * Hook metadata for auto-discovery and governance
 * Co-export alongside hook functions for single-source-of-truth registration
 */
export interface HookMeta {
  /** Full hook name path (e.g., 'pretool/bash/dangerous-command-blocker') */
  name: string;
  /** Human-readable description */
  description: string;
  /** Hook event type */
  event: HookEvent;
  /** Tool matcher patterns for hooks.json (e.g., 'Bash', 'Write|Edit') */
  matchers?: string[];
  /** Run asynchronously (non-blocking) */
  async?: boolean;
  /** Only run once per session */
  once?: boolean;
  /** Timeout in seconds (async hooks only) */
  timeout?: number;
  /** Risk category for prioritization */
  tier?: 'security-critical' | 'data-loss' | 'quality-gate' | 'standard';
}

/**
 * Hook overrides configuration for per-project toggle/customization
 * Stored at .claude/hook-overrides.json (gitignored)
 */
export interface HookOverrides {
  /** Hook names to disable entirely */
  disabled?: string[];
  /** Per-hook timeout overrides (seconds) */
  timeouts?: Record<string, number>;
}

/**
 * Hook registration entry
 */
export interface HookRegistration {
  /** Hook name (e.g., 'permission/auto-approve-readonly') */
  name: string;
  /** Hook event type */
  event: HookEvent;
  /** Tool matcher (string pattern or regex) */
  matcher?: string | RegExp;
  /** Hook implementation function */
  fn: HookFn;
}

/**
 * Bash tool input (type guard helper)
 */
export interface BashToolInput extends ToolInput {
  command: string;
  timeout?: number;
}

/**
 * Write tool input (type guard helper)
 */
export interface WriteToolInput extends ToolInput {
  file_path: string;
  content: string;
}

/**
 * Edit tool input (type guard helper)
 */
export interface EditToolInput extends ToolInput {
  file_path: string;
  old_string: string;
  new_string: string;
}

/**
 * Read tool input (type guard helper)
 */
export interface ReadToolInput extends ToolInput {
  file_path: string;
  offset?: number;
  limit?: number;
}

/**
 * Type guards for tool inputs
 */
export function isBashInput(input: ToolInput): input is BashToolInput {
  return typeof input.command === 'string';
}

export function isWriteInput(input: ToolInput): input is WriteToolInput {
  return typeof input.file_path === 'string' && typeof input.content === 'string';
}

export function isEditInput(input: ToolInput): input is EditToolInput {
  return (
    typeof input.file_path === 'string' &&
    typeof input.old_string === 'string' &&
    typeof input.new_string === 'string'
  );
}

export function isReadInput(input: ToolInput): input is ReadToolInput {
  return typeof input.file_path === 'string' && input.content === undefined;
}

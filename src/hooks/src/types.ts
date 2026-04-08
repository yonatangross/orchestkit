/**
 * TypeScript type definitions for Claude Code hooks
 * CC 2.1.94 compliant (2.1.9 additionalContext, 2.1.25 updatedInput, 2.1.69 hook fields, 2.1.76 PostCompact/Elicitation, 2.1.78 StopFailure, 2.1.83 CwdChanged/FileChanged, 2.1.84 TaskCreated/WorktreeCreate HTTP, 2.1.88 PermissionDenied + auto permission mode, 2.1.89 defer permission, 2.1.94 sessionTitle on UserPromptSubmit)
 */

/**
 * Hook events supported by Claude Code
 */
export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'PermissionRequest'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Stop'
  | 'StopFailure'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'Setup'
  | 'Notification'
  | 'PreCompact'
  | 'TeammateIdle'
  | 'TaskCreated'
  | 'TaskCompleted'
  | 'WorktreeCreate'
  | 'WorktreeRemove'
  | 'ConfigChange'
  | 'InstructionsLoaded'
  | 'PostCompact'
  | 'Elicitation'
  | 'ElicitationResult'
  | 'PermissionDenied'
  | 'CwdChanged'
  | 'FileChanged';

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
  /** Whether a stop hook is currently active (prevents re-entry) */
  stop_hook_active?: boolean;
  /** Permission mode (CC 2.1.25: dontAsk mode makes quality gates warn-only; CC 2.1.88: 'auto' mode — classifier-based approval) */
  permissionMode?: 'default' | 'acceptEdits' | 'dontAsk' | 'auto';
  /** User prompt (UserPromptSubmit only) */
  prompt?: string;
  /** Project directory */
  project_dir?: string;
  /** Resolved absolute path to the plugin root (injected by run-hook.mjs) */
  plugin_root?: string;

  // PreToolUse/PostToolUse correlation (CC 2.1.69)
  /** Unique tool use ID for correlating PreToolUse with PostToolUse calls */
  tool_use_id?: string;

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
  /** Tool result — string from most hooks, object from Skill PostToolUse */
  tool_result?: string | { is_error?: boolean; content?: string };
  /** Path to subagent's transcript file (SubagentStop, CC 2.1.69) */
  agent_transcript_path?: string;

  // TeammateIdle specific fields (CC 2.1.33)
  /** Teammate agent ID */
  teammate_id?: string;
  /** Teammate agent type */
  teammate_type?: string;
  /** How long the teammate has been idle (ms) */
  idle_duration_ms?: number;

  // TaskCompleted specific fields (CC 2.1.33)
  /** Completed task ID */
  task_id?: string;
  /** Task subject */
  task_subject?: string;
  /** Task result status */
  task_status?: string;
  /** Token count consumed by the task (CC 2.1.30) */
  token_count?: number;
  /** Number of tool invocations in the task (CC 2.1.30) */
  tool_uses?: number;

  // Notification specific fields
  /** Notification message */
  message?: string;
  /** Notification type */
  notification_type?: string;

  // Stop/StopFailure/SubagentStop specific fields (CC 2.1.47, 2.1.78)
  /** The final assistant message text (Stop and SubagentStop, CC 2.1.47+) */
  last_assistant_message?: string;

  // StopFailure specific fields (CC 2.1.78)
  /** Error type that caused the failure (e.g., 'rate_limit', 'auth_failure', 'api_error') */
  stop_failure_reason?: string;
  /** HTTP status code from the API error, if applicable */
  api_status_code?: number;

  // Workspace/statusline fields (CC 2.1.47)
  /** Directories added via /add-dir, from statusline workspace section (CC 2.1.47+) */
  added_dirs?: string[];

  // PermissionRequest specific fields (CC 2.1.69)
  /** Suggested "always allow" options for the permission prompt */
  permission_suggestions?: Array<{ type: string; tool: string }>;

  // PostCompact specific fields (CC 2.1.76)
  /** Number of compactions in this session so far */
  compaction_count?: number;
  /** Estimated context size after compaction (tokens) */
  context_size_after?: number;

  // Elicitation specific fields (CC 2.1.76)
  /** Elicitation mode: form (JSON Schema dialog) or url (external browser flow) */
  elicitation_mode?: 'form' | 'url';
  /** Human-readable message shown in the elicitation dialog */
  elicitation_message?: string;
  /** JSON Schema for form-mode fields (flat object, primitive properties only) */
  elicitation_schema?: Record<string, unknown>;
  /** URL for url-mode elicitation (external auth, OAuth, payments) */
  elicitation_url?: string;
  /** MCP server name that requested the elicitation */
  mcp_server_name?: string;

  // ElicitationResult specific fields (CC 2.1.76)
  /** User action on the elicitation: accept, decline, or cancel */
  elicitation_action?: 'accept' | 'decline' | 'cancel';
  /** Form field values submitted by the user (form mode, accept only) */
  elicitation_content?: Record<string, unknown>;

  // PostToolUseFailure specific fields (CC 2.1.69)
  /** Whether the tool failure was caused by a user interrupt */
  is_interrupt?: boolean;

  // TaskCreated specific fields (CC 2.1.84)
  /** Created task subject (TaskCreated) */
  task_description?: string;

  // WorktreeCreate/WorktreeRemove specific fields (CC 2.1.69, 2.1.84)
  /** Worktree slug identifier, e.g. 'feature-auth' or 'bold-oak-a3f2' (WorktreeCreate) */
  name?: string;
  /** Absolute path to worktree being removed (WorktreeRemove) */
  worktree_path?: string;
  /** Hook type: "command" (default) or "http" (CC 2.1.84 — returns worktreePath in hookSpecificOutput) */
  type?: string;

  // CwdChanged specific fields (CC 2.1.83)
  /** Previous working directory (CwdChanged) */
  old_cwd?: string;
  /** New working directory (CwdChanged) */
  new_cwd?: string;

  // SubagentStart context (CC 2.1.89)
  /** Whether this subagent was forked (cache-sharing) vs cold-started (CC 2.1.89) */
  is_fork?: boolean;
  /** Cache creation input tokens (CC 2.1.89 — SubagentStop) */
  cache_creation_input_tokens?: number;
  /** Cache read input tokens (CC 2.1.89 — SubagentStop) */
  cache_read_input_tokens?: number;

  // FileChanged specific fields (CC 2.1.83)
  /** Basename of the changed file (FileChanged — matched via hook `matcher` on basename) */
  changed_file?: string;
  /** Absolute path to the changed file (FileChanged) */
  changed_file_path?: string;
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
  hookEventName?: 'PreToolUse' | 'PostToolUse' | 'PostToolUseFailure' | 'PermissionRequest' | 'PermissionDenied' | 'UserPromptSubmit' | 'SubagentStart' | 'SubagentStop';
  /** Permission decision (PermissionRequest/PreToolUse hooks, CC 2.1.69: added 'ask', CC 2.1.89: added 'defer') */
  permissionDecision?: 'allow' | 'deny' | 'ask' | 'defer';
  /** Reason for permission decision */
  permissionDecisionReason?: string;
  /** Additional context injected before tool execution (CC 2.1.9) */
  additionalContext?: string;
  /** Modified tool input (CC 2.1.25: canonical way to modify tool inputs) */
  updatedInput?: Record<string, unknown>;
  /** Replace MCP tool output (PostToolUse, CC 2.1.69) */
  updatedMCPToolOutput?: unknown;
  /** Apply permission rules (PermissionRequest, CC 2.1.69) */
  updatedPermissions?: Record<string, unknown>;
  /** Worktree path returned by HTTP-type WorktreeCreate hooks (CC 2.1.84) */
  worktreePath?: string;
  /** Signal model to retry the denied tool call (PermissionDenied, CC 2.1.88) */
  retry?: boolean;
  /** Paths to watch for changes (CwdChanged, CC 2.1.89) */
  watchPaths?: string[];
  /** Session title (UserPromptSubmit, CC 2.1.94) — sets the display name shown in the prompt bar and remote sessions */
  sessionTitle?: string;
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
export type HookFn = (input: HookInput, ctx: HookContext) => Promise<HookResult> | HookResult;

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

// -----------------------------------------------------------------------------
// Hook Context — Dependency Injection (v7.29.0 Phase 4)
// -----------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * HookContext provides environment and side-effect dependencies to hooks.
 * Production: constructed by run-hook.mjs from real env/filesystem.
 * Tests: plain objects with vi.fn() stubs — ZERO vi.mock needed.
 */
export interface HookContext {
  /** Project directory (from CLAUDE_PROJECT_DIR or cwd) */
  readonly projectDir: string;
  /** Log directory (platform-specific) */
  readonly logDir: string;
  /** Plugin root directory (from CLAUDE_PLUGIN_ROOT) */
  readonly pluginRoot: string;
  /** Plugin persistent data directory (CC 2.1.78+, null if unavailable) */
  readonly pluginDataDir: string | null;
  /** Session ID (from CLAUDE_SESSION_ID or generated) */
  readonly sessionId: string;
  /** Current git branch (cached) */
  readonly branch: string;
  /** Log level (debug/info/warn/error) */
  readonly logLevel: string;

  /** Log a message (writes to logDir/hooks.log with rotation) */
  log(hookName: string, message: string, level?: LogLevel): void;
  /** Log a permission decision (security audit trail) */
  logPermission(decision: 'allow' | 'deny' | 'ask' | 'warn', reason: string, input?: HookInput | Record<string, unknown>): void;
  /** Write a rules file atomically with hash-guard skip */
  writeRules(rulesDir: string, filename: string, content: string, hookName: string): boolean;
  /** Check if should log at given level */
  shouldLog(level: LogLevel): boolean;
}

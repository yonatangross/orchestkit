/**
 * TypeScript type definitions for Claude Code hooks
 * Reviewed through CC 2.1.206 (2.1.9 additionalContext, 2.1.25 updatedInput, 2.1.69 hook fields, 2.1.76 PostCompact/Elicitation, 2.1.78 StopFailure, 2.1.83 CwdChanged/FileChanged, 2.1.84 TaskCreated/WorktreeCreate HTTP, 2.1.88 PermissionDenied + auto permission mode, 2.1.89 defer permission, 2.1.94 sessionTitle on UserPromptSubmit, 2.1.152 MessageDisplay event, 2.1.163 Stop/SubagentStop may return additionalContext — ork opts out, see stop/unified-dispatcher.ts, 2.1.173 reloadSkills + sessionTitle on SessionStart, 2.1.177 continueOnBlock PostToolUse config).
 * 2.1.184–2.1.206 reviewed via the per-range adoption triages (docs/audits/cc-adoption-*): no new hook input/output JSON field ork consumes — 2.1.203's worktree shell-command leak closure and 2.1.206's EnterWorktree external-path confirmation are behavioral, not contract fields; 2.1.204's SessionStart headless hook-event streaming changes delivery, not shape.
 * 2.1.171–2.1.183 added NO new hook output JSON field that ork consumes: 2.1.173 `reloadSkills` (SessionStart) is unused — ork installs no skills mid-session; 2.1.173 `sessionTitle` on SessionStart is the existing field on a new event (the hookEventName union already permits SessionStart); 2.1.177 `continueOnBlock` is a hooks.json registration flag, not an output field (used by goal-budget-guard/goal-tracker/check-plugins-drift); 2.1.177 Stop/SubagentStop additionalContext — ork still opts out (stop/unified-dispatcher.ts); 2.1.178 removed the TeamCreate/TeamDelete TOOLS (not hooks.json events) and added Tool(param:value) permission rules; 2.1.183 lets a teammate's background task outlive its turn (no hooks-contract change). So these types are unchanged.
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
  | 'FileChanged'
  | 'MessageDisplay'
  // P3-A3 (CC 2.1.208): observer-only events
  | 'UserPromptExpansion'
  | 'PostToolBatch'
  // #3327 (CC 2.1.219): fires after /add-dir or the SDK register_repo_root
  // control request registers a new working directory mid-session
  | 'DirectoryAdded';

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
  /** Tool result the model received (PostToolUse only) — the field CC actually sends */
  tool_response?: unknown;
  /** Tool output (PostToolUse only) — legacy alias for tool_response */
  tool_output?: unknown;
  /** NOT sent by CC — the 2.1.228 binary builds PostToolUseFailure as
   *  {tool_name, tool_input, tool_use_id, error, is_interrupt, duration_ms}
   *  (verified from the shipped binary's decompiled payload builder, #3418).
   *  `error` (declared below, shared with SubagentStop/StopFailure) is the
   *  field CC actually sends. Kept only so old readers typecheck. */
  tool_error?: string;
  /** Tool exit code */
  exit_code?: number;
  /** Whether a stop hook is currently active (prevents re-entry) */
  stop_hook_active?: boolean;
  /**
   * Permission mode (CC 2.1.25: dontAsk mode makes quality gates warn-only;
   * CC 2.1.88: 'auto' mode, classifier-based approval).
   *
   * The union mirrors CC 2.1.222's own mode enum verbatim, read from the
   * binary: `acceptEdits | auto | bypassPermissions | default | dontAsk | plan`.
   * It previously listed only 4, so `bypassPermissions` — the mode
   * `--dangerously-skip-permissions` selects — was not expressible and no hook
   * could gate on it.
   *
   * `manual` was in this union and is NOT in CC's enum; nothing can ever send
   * it. Removed rather than left as a value a reader would reasonably code
   * against.
   *
   * NOTE: CC serialises the mode SNAKE_CASE as `permission_mode` on the wire.
   * Do not read this field directly — use the helpers in lib/guards.ts, which
   * read the key CC actually sends.
   */
  permissionMode?:
    | 'default'
    | 'acceptEdits'
    | 'auto'
    | 'bypassPermissions'
    | 'dontAsk'
    | 'plan';
  /** User prompt (UserPromptSubmit only) */
  prompt?: string;
  /** Project directory */
  project_dir?: string;
  /** Path to the session transcript jsonl (sent on all hook events) */
  transcript_path?: string;
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
  /** Parent agent ID for trace stitching — NOT sent by CC ≤ 2.1.173 at any subagent event (live-verified 2026-06-11); kept for forward-compat with anthropics/claude-code#16424 */
  parent_agent_id?: string;
  /** Agent output (SubagentStop) */
  agent_output?: string;
  /** Output (alternative field name) */
  output?: string;
  /** Error from subagent (SubagentStop/StopFailure) — also the real field
   *  PostToolUseFailure sends for the tool's error message (verified 2.1.228,
   *  #3418; `tool_error` above is never populated). */
  error?: string;
  /** Duration in milliseconds */
  duration_ms?: number;
  /** Tool result — string from most hooks, object from Skill PostToolUse */
  tool_result?: string | { is_error?: boolean; content?: string };
  /** Path to subagent's transcript file (SubagentStop, CC 2.1.69) */
  agent_transcript_path?: string;

  // TeammateIdle fields. The 2.1.227 binary builds this payload as
  // {teammate_name, team_name} and NOTHING else (#3335 A3): the three legacy
  // fields below never arrive on TeammateIdle, so readers must prefer
  // teammate_name/team_name and treat the rest as absent.
  /** Teammate agent name — the field CC actually sends (verified 2.1.227) */
  teammate_name?: string;
  /** Team name — the field CC actually sends (verified 2.1.227) */
  team_name?: string;
  /** Teammate agent ID (NOT sent on TeammateIdle; kept for other events) */
  teammate_id?: string;
  /** Teammate agent type (NOT sent on TeammateIdle) */
  teammate_type?: string;
  /** Idle duration ms (NOT sent on TeammateIdle — CC provides no duration) */
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

  // StopFailure fields. The 2.1.227 binary builds this payload as
  // {error, error_details, last_assistant_message} (#3335 A6). `error` is
  // declared above in the SubagentStop block and shared here.
  /** Structured error details accompanying `error` (verified 2.1.227) */
  error_details?: unknown;
  /** NOT sent by any observed CC version — the 2.1.78 speculation never landed */
  stop_failure_reason?: string;
  /** NOT sent by any observed CC version */
  api_status_code?: number;

  // Workspace/statusline fields (CC 2.1.47)
  /** Directories added via /add-dir, from statusline workspace section (CC 2.1.47+) */
  added_dirs?: string[];

  // PermissionRequest specific fields (CC 2.1.69)
  /** Suggested "always allow" options for the permission prompt */
  permission_suggestions?: Array<{ type: string; tool: string }>;

  // PostCompact fields. The 2.1.227 binary builds this payload as
  // {trigger, compact_summary} (#3335 A5). The two "2.1.76" fields below were
  // never observed in any payload builder and readers must not depend on them.
  /** What triggered the compaction ('auto' | 'manual', verified 2.1.227) */
  trigger?: string;
  /** Summary text produced by the compaction (verified 2.1.227) */
  compact_summary?: string;
  /** NOT sent by any observed CC version */
  compaction_count?: number;
  /** NOT sent by any observed CC version */
  context_size_after?: number;

  // Elicitation event. HISTORY, because this block has now been wrong TWICE in
  // opposite directions: the original hook read invented names, #1264 Phase 3
  // "fixed" it onto server_name/form_schema and left a comment asserting
  // mcp_server_name was the invented one. The 2.1.227 binary builds the payload
  // as {mcp_server_name, message, mode, url, elicitation_id, requested_schema}
  // (#3335 A1), so mcp_server_name/requested_schema are the REAL fields and
  // server_name/form_schema are the invented ones. Do not "correct" this again
  // without extracting the payload builder from the shipped binary.
  /** MCP server name that requested the elicitation (verified 2.1.227) */
  mcp_server_name?: string;
  /** JSON Schema for the elicitation form fields (verified 2.1.227) */
  requested_schema?: Record<string, unknown>;
  /** Elicitation mode (verified 2.1.227) */
  mode?: string;
  /** Elicitation id (verified 2.1.227) */
  elicitation_id?: string;
  /** NOT sent — the #1264 invented name, kept only so old readers typecheck */
  server_name?: string;
  /** NOT sent — the #1264 invented name */
  form_schema?: Record<string, unknown>;

  // ElicitationResult event: fires after the user responds.
  /** The user's response — action + submitted field values */
  user_response?: {
    action?: 'accept' | 'decline' | 'cancel';
    content?: Record<string, unknown>;
  };

  // ConfigChange event (CC documented payload).
  /** Which settings layer changed */
  config_source?: 'user_settings' | 'project_settings' | 'local_settings' | 'policy_settings' | 'skills';
  /** NOT sent — ConfigChange delivers the path as `file_path` (verified
   *  2.1.227: {hook_event_name:"ConfigChange", source, file_path}). Use the
   *  shared `file_path` field declared in the FileChanged block. */
  config_file_path?: string;
  /** The changed fields (hooks, permissions, …) */
  changes?: Record<string, unknown>;

  // PostToolUseFailure specific fields (CC 2.1.69)
  /** Whether the tool failure was caused by a user interrupt */
  is_interrupt?: boolean;

  // TaskCreated specific fields (CC 2.1.84)
  /** Created task subject (TaskCreated) */
  task_description?: string;

  // WorktreeCreate/WorktreeRemove specific fields (CC 2.1.69, 2.1.84)
  /** Worktree slug identifier, e.g. 'feature-auth' or 'bold-oak-a3f2' (WorktreeCreate, legacy field) */
  name?: string;
  /** NOT sent — WorktreeRemove delivers `worktree_path` (verified 2.1.227:
   *  {hook_event_name:"WorktreeRemove", worktree_path}, declared below);
   *  #2335's name never appeared in a payload builder. */
  worktree_name?: string;
  /** Branch to create/check out in the new worktree (WorktreeCreate, #2335) */
  branch?: string;
  /** When true, provision the worktree detached from any branch (WorktreeCreate, #2335) */
  detach?: boolean;
  /** Absolute path to worktree being removed (WorktreeRemove) */
  worktree_path?: string;
  /** Hook type: "command" (default) or "http" (CC 2.1.84 — returns worktreePath in hookSpecificOutput) */
  type?: string;

  // CwdChanged specific fields (CC 2.1.83)
  /** Previous working directory (CwdChanged) */
  old_cwd?: string;
  /** New working directory (CwdChanged) */
  new_cwd?: string;

  // Fork/cache fields — NONE of these are sent on any hook event (#3321 claim 3).
  // #1227 declared them off the CC 2.1.89 changelog without probing a payload.
  // Verified against the 2.1.228 binary: SubagentStart builds
  // {...base, hook_event_name, agent_id, agent_type} and SubagentStop builds
  // {...base, hook_event_name, stop_hook_active, agent_id,
  //  agent_transcript_path, agent_type, last_assistant_message,
  //  background_tasks, session_crons}; the shared base contributes
  // {session_id, transcript_path, cwd, prompt_id, permission_mode, agent_id,
  //  agent_type, effort}. `is_fork` exists in the binary only as a field on
  // CC's internal tengu_agent_tool_selected telemetry event, never in a hook
  // payload. Kept declared (not deleted) so the next reader finds the verdict
  // instead of re-deriving it — same convention as worktree_name below.
  /** NOT sent on any hook event — see the note above. */
  is_fork?: boolean;
  /** NOT sent on any hook event — see the note above. */
  cache_creation_input_tokens?: number;
  /** NOT sent on any hook event — see the note above. */
  cache_read_input_tokens?: number;

  // FileChanged fields. The 2.1.227 binary builds this payload as
  // {file_path, event} (#3335 A2); the two changed_* names below never existed
  // in any payload builder and made the hook inert for every matcher.
  /** Absolute path to the changed file — the field CC actually sends. Shared
   *  name with the tool-input field; on FileChanged it is top-level. */
  file_path?: string;
  /** Change kind (verified 2.1.227) */
  event?: string;
  /** NOT sent by any observed CC version */
  changed_file?: string;
  /** NOT sent by any observed CC version */
  changed_file_path?: string;

  // Stop/SubagentStop authoritative state (CC 2.1.145)
  /**
   * Authoritative list of background tasks currently running at hook fire time.
   * When present, treat as the source of truth for which subagents are live —
   * cross-reference against home-grown spawn logs to drop stale entries.
   * Schema not formally documented in CC 2.1.145 CHANGELOG; field is typed
   * loosely until a real payload pins it down.
   */
  background_tasks?: Array<{
    agent_id?: string;
    subagent_type?: string;
    session_id?: string;
    started_at?: string;
    status?: string;
    [key: string]: unknown;
  }>;
  /**
   * Session cron schedules active at hook fire time (CC 2.1.145).
   * Useful for hooks that want to suppress action when a cron is mid-tick.
   */
  session_crons?: Array<{
    cron_id?: string;
    expression?: string;
    next_run_at?: string;
    [key: string]: unknown;
  }>;
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
  hookEventName?: 'PreToolUse' | 'PostToolUse' | 'PostToolUseFailure' | 'PermissionRequest' | 'PermissionDenied' | 'UserPromptSubmit' | 'SubagentStart' | 'SubagentStop' | 'SessionStart' | 'PostCompact';
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
  /** Replace tool output for ANY tool (PostToolUse, CC 2.1.121 — extends 2.1.69's MCP-only path to all tools, #1543) */
  updatedToolOutput?: unknown;
  /** Apply permission rules (PermissionRequest, CC 2.1.69) */
  updatedPermissions?: Record<string, unknown>;
  /** Worktree path returned by HTTP-type WorktreeCreate hooks (CC 2.1.84) */
  worktreePath?: string;
  /** Signal model to retry the denied tool call (PermissionDenied, CC 2.1.88) */
  retry?: boolean;
  /** Paths to watch for changes (CwdChanged, CC 2.1.89) */
  watchPaths?: string[];
  /** Session title (UserPromptSubmit CC 2.1.94; also SessionStart CC 2.1.173) — sets the display name shown in the prompt bar and remote sessions */
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
  /** Decision for hooks that can block actions (CC 2.1.105: PreCompact block) */
  decision?: 'block' | 'approve';
  /**
   * User-facing message for a decision:'block'. On the PreCompact command-hook
   * path the 2.1.227 binary builds the message as `json.reason || stderr` and
   * never consults stopReason (#3321 claim 6), so a block without `reason`
   * fires with an empty message. Set BOTH reason and stopReason on blocks.
   */
  reason?: string;
  /** Retry flag for PermissionDenied hooks (CC 2.1.89) */
  retry?: boolean;
  /**
   * Terminal escape sequence emitted by CC to the user's terminal (#1847).
   * Command hooks only; macOS/Linux. e.g. OSC 777 desktop notify
   * (`\u001b]777;notify;TITLE;BODY\u0007`) or a bare BEL (`\u0007`) for sound.
   * Any untrusted text embedded in the sequence MUST be sanitized first
   * (strip control chars + `;` field delimiters).
   */
  terminalSequence?: string;
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

/**
 * InstructionsLoaded event input (#2475).
 *
 * The real CC InstructionsLoaded payload is SINGLE-FILE — one event fires per
 * loaded instruction file. There is NO `files_loaded` array (that shape was
 * fabricated and silently disabled every handler until #2475).
 */
export interface InstructionsLoadedInput extends HookInput {
  /** Absolute path of the instruction file that was just loaded */
  file_path: string;
  /** Memory tier the file belongs to (e.g. project, user, local) */
  memory_type?: string;
  /** Why CC loaded the file (e.g. startup, changed) */
  load_reason?: string;
}

/** Type guard for the real single-file InstructionsLoaded payload (#2475). */
export function isInstructionsLoadedInput(input: HookInput): input is InstructionsLoadedInput {
  const fp = (input as unknown as Record<string, unknown>).file_path;
  return typeof fp === 'string' && fp.length > 0;
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
  /** Whether cwd is inside a linked git worktree (CC 2.1.97 workspace.git_worktree) */
  readonly isWorktree: boolean;
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

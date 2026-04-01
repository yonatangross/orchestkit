/**
 * CC Version Compatibility Matrix
 *
 * Runtime feature matrix for Claude Code version checking.
 * Used by doctor skill hooks and version-gated features.
 *
 * Keep in sync with: src/skills/doctor/references/version-compatibility.md
 */

export const MIN_CC_VERSION = '2.1.89';

export interface CCFeatureEntry {
  readonly feature: string;
  readonly minVersion: string;
  readonly description: string;
}

/**
 * Features that OrchestKit depends on, with their minimum CC version.
 * Ordered by version (ascending).
 */
export const CC_FEATURE_MATRIX: readonly CCFeatureEntry[] = [
  { feature: 'permission_unreachable',  minVersion: '2.1.3',  description: 'CC detects unreachable permission rules' },
  { feature: 'hook_result_continue',    minVersion: '2.1.7',  description: 'continue field required in HookResult' },
  { feature: 'subagent_type',           minVersion: '2.1.7',  description: 'subagent_type in SubagentStart input' },
  { feature: 'session_id_guaranteed',   minVersion: '2.1.9',  description: 'session_id always present in HookInput' },
  { feature: 'additional_context',      minVersion: '2.1.9',  description: 'hookSpecificOutput.additionalContext' },
  { feature: 'setup_hook_event',        minVersion: '2.1.11', description: 'Setup hook event for deferred init' },
  { feature: 'permission_mode',         minVersion: '2.1.25', description: 'permissionMode field in HookInput' },
  { feature: 'updated_input',           minVersion: '2.1.25', description: 'updatedInput for canonical tool modification' },
  { feature: 'task_token_count',        minVersion: '2.1.30', description: 'token_count/tool_uses in TaskCompleted' },
  { feature: 'teammate_idle_event',     minVersion: '2.1.33', description: 'TeammateIdle + TaskCompleted hook events' },
  { feature: 'sonnet_4_6',             minVersion: '2.1.45', description: 'claude-sonnet-4-6 model availability' },
  { feature: 'plugin_hot_reload',       minVersion: '2.1.45', description: 'Plugin hot reload without restart' },
  { feature: 'last_assistant_message',  minVersion: '2.1.47', description: 'last_assistant_message in Stop/SubagentStop' },
  { feature: 'added_dirs',             minVersion: '2.1.47', description: 'added_dirs from /add-dir statusline' },
  { feature: 'agent_model_field',       minVersion: '2.1.47', description: 'model field in agent frontmatter (teams)' },
  { feature: 'worktree_discovery',      minVersion: '2.1.47', description: 'Skills/agents found from worktrees' },
  { feature: 'windows_hooks',           minVersion: '2.1.47', description: 'Hooks execute on Windows via Git Bash' },
  { feature: 'improved_agent_memory',   minVersion: '2.1.47', description: 'Larger context for agent spawns' },
  { feature: 'enter_worktree_tool',    minVersion: '2.1.49', description: 'Native EnterWorktree tool and --worktree CLI flag' },
  { feature: 'worktree_hooks',         minVersion: '2.1.50', description: 'WorktreeCreate/WorktreeRemove hook events' },
  { feature: 'agent_isolation_worktree', minVersion: '2.1.50', description: 'isolation: worktree in agent definitions' },
  { feature: 'startup_timeout_lsp',    minVersion: '2.1.50', description: 'startupTimeout configuration for LSP servers' },
  { feature: 'claude_agents_cli',      minVersion: '2.1.50', description: 'claude agents CLI command to list agents' },
  { feature: 'opus_46_fast_1m',        minVersion: '2.1.50', description: 'Opus 4.6 1M context window (GA, no beta header needed)' },
  { feature: 'disable_1m_context_env', minVersion: '2.1.50', description: 'CLAUDE_CODE_DISABLE_1M_CONTEXT env var support' },
  { feature: 'config_change_event',   minVersion: '2.1.50', description: 'ConfigChange hook event for mid-session settings changes' },
  { feature: 'auto_memory',           minVersion: '2.1.59', description: 'Claude auto-saves learnings to ~/.claude/projects/*/memory/' },
  { feature: 'claude_md_imports',     minVersion: '2.1.59', description: '@import syntax in CLAUDE.md for modular instructions' },
  { feature: 'claude_rules_dir',      minVersion: '2.1.59', description: '.claude/rules/*.md with paths: frontmatter for scoped rules' },
  { feature: 'http_hooks',           minVersion: '2.1.63', description: 'type:"http" hooks POST JSON to URL instead of shell commands' },
  { feature: 'worktree_config_share', minVersion: '2.1.63', description: 'Project configs & auto memory shared across git worktrees' },
  { feature: 'clear_resets_skills',  minVersion: '2.1.63', description: '/clear resets cached skills (fixes stale skill content)' },
  { feature: 'teammate_memory_fix',  minVersion: '2.1.63', description: 'Fixed teammate message retention leak after compaction' },
  { feature: 'bundled_simplify_batch', minVersion: '2.1.63', description: 'Built-in /simplify and /batch slash commands' },
  { feature: 'disable_claudeai_mcp', minVersion: '2.1.63', description: 'ENABLE_CLAUDEAI_MCP_SERVERS=false env var to opt out' },
  { feature: 'instructions_loaded',  minVersion: '2.1.69', description: 'InstructionsLoaded hook event fires after CLAUDE.md/rules loaded' },
  { feature: 'once_true_hooks',      minVersion: '2.1.69', description: 'once: true in hook config auto-removes after first fire' },
  { feature: 'output_ask_decision',  minVersion: '2.1.69', description: 'permissionDecision: "ask" escalates gray-zone commands to user' },
  { feature: 'tool_use_id_correlation', minVersion: '2.1.69', description: 'tool_use_id correlates PreToolUse/PostToolUse pairs' },
  { feature: 'updated_mcp_output',   minVersion: '2.1.69', description: 'updatedMCPToolOutput replaces MCP tool output in PostToolUse' },
  { feature: 'path_scoped_rules',    minVersion: '2.1.69', description: 'paths: frontmatter in .claude/rules/*.md for conditional loading' },
  // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal ${ENV_VAR} text
  { feature: 'env_var_interpolation', minVersion: '2.1.69', description: '${ENV_VAR} interpolation in type:http hook URLs and headers' },
  { feature: 'worktree_dedup',       minVersion: '2.1.70', description: 'Worktree dedup fixes prevent duplicate hook fires' },
  { feature: 'prompt_rerender_opt',  minVersion: '2.1.70', description: '74% prompt re-render reduction (CC-internal optimization)' },
  { feature: 'skill_listing_savings', minVersion: '2.1.70', description: '~600 token savings on skill listing injection' },
  { feature: 'mcp_cache_invalidation', minVersion: '2.1.70', description: 'MCP tool cache properly invalidated on reconnect' },
  // 2.1.71
  { feature: 'loop_command',          minVersion: '2.1.71', description: '/loop slash command for recurring prompts on interval' },
  { feature: 'cron_scheduling',       minVersion: '2.1.71', description: 'CronCreate/CronDelete/CronList tools for in-session scheduling' },
  { feature: 'voice_pushto_talk_key', minVersion: '2.1.71', description: 'voice:pushToTalk keybinding rebindable in keybindings.json' },
  { feature: 'resume_skill_savings',  minVersion: '2.1.71', description: 'Skill listing not re-injected on --resume (~600 tokens saved)' },
  // 2.1.72
  { feature: 'exit_worktree_tool',    minVersion: '2.1.72', description: 'ExitWorktree tool lets agents leave worktree sessions' },
  { feature: 'agent_model_override',  minVersion: '2.1.72', description: 'model parameter restored on Agent tool for per-invocation overrides' },
  { feature: 'team_model_inherit',    minVersion: '2.1.72', description: 'Team agents inherit the leader agent model' },
  { feature: 'plan_with_description', minVersion: '2.1.72', description: '/plan accepts description argument for contextual plan mode entry' },
  { feature: 'effort_simplified',     minVersion: '2.1.72', description: 'Effort levels simplified to low/medium/high, /effort auto resets' },
  { feature: 'disable_cron_env',      minVersion: '2.1.72', description: 'CLAUDE_CODE_DISABLE_CRON env var stops scheduled cron jobs' },
  { feature: 'skill_hook_dedup_fix',  minVersion: '2.1.72', description: 'Skill hooks no longer fire twice per event' },
  { feature: 'clear_preserves_bg',    minVersion: '2.1.72', description: '/clear only clears foreground, background agents preserved' },
  { feature: 'agent_prompt_fix',      minVersion: '2.1.72', description: 'Agent prompt no longer silently deleted from settings.json' },
  { feature: 'always_allow_fix',      minVersion: '2.1.72', description: 'AlwaysAllow permission rules now match correctly' },
  { feature: 'worktree_task_fix',     minVersion: '2.1.72', description: 'Worktree task resume restores cwd, bg notifications include metadata' },
  { feature: 'prompt_cache_12x',      minVersion: '2.1.72', description: 'SDK query() prompt cache fix reduces input token costs up to 12x' },
  { feature: 'bash_process_tools',    minVersion: '2.1.72', description: 'lsof, pgrep, tput, ss, fd, fdfind added to bash auto-approval' },
  { feature: 'uri_handler',           minVersion: '2.1.72', description: 'vscode://anthropic.claude-code/open URI handler for programmatic sessions' },
  // 2.1.73
  { feature: 'skill_file_deadlock_fix', minVersion: '2.1.73', description: 'Fixes skill-file deadlock on git pull with large plugins' },
  { feature: 'session_start_dedup',   minVersion: '2.1.73', description: 'SessionStart hooks fire exactly once on --resume/--continue' },
  { feature: 'noop_reminder_fix',     minVersion: '2.1.73', description: 'No-op system reminder injection suppressed (~2K tokens/turn recovered)' },
  { feature: 'opus_46_cloud_default', minVersion: '2.1.73', description: 'Opus 4.6 default on Bedrock/Vertex/Foundry cloud providers' },
  // 2.1.74
  { feature: 'context_optimization_hints', minVersion: '2.1.74', description: '/context surfaces actionable optimization suggestions' },
  { feature: 'auto_memory_directory',     minVersion: '2.1.74', description: 'autoMemoryDirectory setting for custom auto-memory storage path' },
  { feature: 'session_end_timeout_fix',   minVersion: '2.1.74', description: 'SessionEnd hook.timeout now respected (was hardcoded 1.5s)' },
  { feature: 'session_end_timeout_env',   minVersion: '2.1.74', description: 'CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS env var for SessionEnd timeout' },
  { feature: 'plugin_dir_precedence',     minVersion: '2.1.74', description: '--plugin-dir local overrides take precedence over marketplace plugins' },
  { feature: 'full_model_ids_agent',      minVersion: '2.1.74', description: 'Full model IDs (claude-opus-4-6) accepted in agent frontmatter' },
  { feature: 'managed_policy_precedence', minVersion: '2.1.74', description: 'Managed policy ask rules override user allow + skill allowed-tools' },
  { feature: 'streaming_memory_fix',      minVersion: '2.1.74', description: 'Streaming API response buffer + bash prefix caching memory leaks fixed' },
  // 2.1.75
  { feature: 'opus_46_1m_default',       minVersion: '2.1.75', description: '1M context for Opus 4.6 default on Max/Team/Enterprise (no extra usage)' },
  { feature: 'color_command',            minVersion: '2.1.75', description: '/color command to set prompt-bar color for session' },
  { feature: 'session_rename_display',   minVersion: '2.1.75', description: 'Session name shown on prompt bar via /rename' },
  { feature: 'memory_timestamps',        minVersion: '2.1.75', description: 'Last-modified timestamps on memory files for freshness reasoning' },
  { feature: 'hook_source_display',      minVersion: '2.1.75', description: 'Hook source (settings/plugin/skill) shown in permission prompts' },
  { feature: 'token_estimation_fix',     minVersion: '2.1.75', description: 'Token estimation fix prevents premature compaction from over-counting' },
  { feature: 'async_hook_suppress',      minVersion: '2.1.75', description: 'Async hook completion messages suppressed by default (visible with --verbose)' },
  // 2.1.76
  { feature: 'mcp_elicitation',          minVersion: '2.1.76', description: 'MCP elicitation support — servers request structured input via form/URL dialog' },
  { feature: 'elicitation_hooks',        minVersion: '2.1.76', description: 'Elicitation/ElicitationResult hooks intercept and override MCP input dialogs' },
  { feature: 'session_name_flag',        minVersion: '2.1.76', description: '-n/--name CLI flag sets display name for session at startup' },
  { feature: 'worktree_sparse_paths',    minVersion: '2.1.76', description: 'worktree.sparsePaths setting for selective sparse-checkout in large monorepos' },
  { feature: 'post_compact_hook',        minVersion: '2.1.76', description: 'PostCompact hook fires after compaction completes' },
  { feature: 'effort_command',           minVersion: '2.1.76', description: '/effort slash command to set model effort level mid-session' },
  { feature: 'feedback_survey_rate',     minVersion: '2.1.76', description: 'feedbackSurveyRate setting for enterprise session quality surveys' },
  { feature: 'deferred_tools_compaction_fix', minVersion: '2.1.76', description: 'Deferred tools retain input schemas after compaction (array/number params fixed)' },
  { feature: 'bg_agent_partial_results', minVersion: '2.1.76', description: 'Killed background agents preserve partial results in conversation context' },
  { feature: 'compaction_circuit_breaker', minVersion: '2.1.76', description: 'Auto-compaction circuit breaker stops after 3 consecutive failures' },
  { feature: 'worktree_startup_perf',    minVersion: '2.1.76', description: 'Faster --worktree startup via direct ref reads and skipped redundant fetch' },
  { feature: 'stale_worktree_cleanup',   minVersion: '2.1.76', description: 'Stale worktrees from interrupted parallel runs auto-cleaned on next launch' },
  { feature: 'model_fallback_visible',   minVersion: '2.1.76', description: 'Model fallback notifications always visible with human-friendly model names' },
  { feature: 'plugin_dir_single_path',   minVersion: '2.1.76', description: '--plugin-dir accepts one path per flag (use repeated flags for multiple)' },
  // 2.1.77
  { feature: 'opus_64k_default',         minVersion: '2.1.77', description: 'Opus 4.6 default output 64k tokens, upper bound 128k for Opus+Sonnet' },
  { feature: 'allow_read_sandbox',       minVersion: '2.1.77', description: 'allowRead sandbox setting re-allows read access within denyRead regions' },
  { feature: 'plugin_validate_frontmatter', minVersion: '2.1.77', description: 'claude plugin validate checks skill/agent/command frontmatter + hooks.json' },
  { feature: 'sendmessage_auto_resume',  minVersion: '2.1.77', description: 'SendMessage auto-resumes stopped agents instead of returning error' },
  { feature: 'agent_resume_removed',     minVersion: '2.1.77', description: 'Agent tool no longer accepts resume parameter — use SendMessage({to: id})' },
  { feature: 'bg_bash_5gb_limit',        minVersion: '2.1.77', description: 'Background bash tasks killed if output exceeds 5GB' },
  { feature: 'fork_renamed_branch',      minVersion: '2.1.77', description: '/fork renamed to /branch (/fork still works as alias)' },
  { feature: 'pretooluse_allow_deny_fix', minVersion: '2.1.77', description: 'PreToolUse "allow" no longer bypasses deny permission rules' },
  { feature: 'worktree_race_fix',        minVersion: '2.1.77', description: 'Stale-worktree cleanup race condition fixed (no longer deletes resumed agent worktrees)' },
  { feature: 'resume_memory_perf',       minVersion: '2.1.77', description: '--resume 45% faster loading, ~100-150MB less peak memory' },
  { feature: 'macos_startup_perf',       minVersion: '2.1.77', description: '~60ms faster macOS startup via parallel keychain reads' },
  { feature: 'progress_msg_memory_fix',  minVersion: '2.1.77', description: 'Progress messages no longer survive compaction (memory growth fix)' },
  // 2.1.78
  { feature: 'stop_failure_event',       minVersion: '2.1.78', description: 'StopFailure hook event fires on API errors (rate limit, auth failure)' },
  { feature: 'plugin_data_dir',          minVersion: '2.1.78', description: 'CLAUDE_PLUGIN_DATA persistent state survives plugin updates' },
  { feature: 'agent_effort_maxturns',    minVersion: '2.1.78', description: 'Agent effort/maxTurns/disallowedTools frontmatter fields' },
  // 2.1.79
  { feature: 'console_auth',            minVersion: '2.1.79', description: 'claude auth login --console for API billing auth' },
  { feature: 'turn_duration_display',    minVersion: '2.1.79', description: 'Show turn duration toggle in /config menu' },
  { feature: 'remote_control',          minVersion: '2.1.79', description: '/remote-control bridges VSCode session to claude.ai/code' },
  // 2.1.80
  { feature: 'rate_limits_statusline',   minVersion: '2.1.80', description: 'StatusLine receives rate_limits with used_percentage and resets_at' },
  { feature: 'source_settings_marketplace', minVersion: '2.1.80', description: 'Declare plugin entries inline in settings.json via source:settings' },
  { feature: 'skill_effort_frontmatter', minVersion: '2.1.80', description: 'Skills declare effort level (low/high) in frontmatter' },
  { feature: 'channels_preview',         minVersion: '2.1.80', description: 'MCP servers push messages into active session via --channels' },
  // 2.1.81
  { feature: 'bare_flag',               minVersion: '2.1.81', description: '--bare flag for -p mode skips hooks/LSP/plugin sync for eval pipelines' },
  { feature: 'channels_permission_relay', minVersion: '2.1.81', description: 'Channel servers relay tool approval prompts to phone' },
  { feature: 'plugin_freshness_reclone', minVersion: '2.1.81', description: 'Ref-tracked plugins re-clone on every load for latest upstream' },
  { feature: 'mcp_tool_call_collapse',   minVersion: '2.1.81', description: 'MCP read/search calls collapse to single line (Ctrl+O to expand)' },
  // 2.1.83
  { feature: 'managed_settings_dropin',  minVersion: '2.1.83', description: 'managed-settings.d/ drop-in directory for team policy fragments' },
  { feature: 'cwd_changed_event',        minVersion: '2.1.83', description: 'CwdChanged hook event fires on working directory change' },
  { feature: 'file_changed_event',       minVersion: '2.1.83', description: 'FileChanged hook event fires on file changes' },
  { feature: 'sandbox_fail_unavailable', minVersion: '2.1.83', description: 'sandbox.failIfUnavailable fails fast when sandbox unavailable' },
  { feature: 'subprocess_env_scrub',     minVersion: '2.1.83', description: 'CLAUDE_CODE_SUBPROCESS_ENV_SCRUB strips creds from subprocesses' },
  { feature: 'agent_initial_prompt',     minVersion: '2.1.83', description: 'Agent initialPrompt frontmatter for zero-wasted-turn bootstrap' },
  { feature: 'plugin_user_config',       minVersion: '2.1.83', description: 'Plugin userConfig with sensitive:true for keychain-stored secrets' },
  // 2.1.84
  { feature: 'task_created_event',       minVersion: '2.1.84', description: 'TaskCreated hook event for task initialization tracking' },
  { feature: 'paths_yaml_glob',          minVersion: '2.1.84', description: 'paths: YAML glob list for auto-loading relevant skill/rule files' },
  { feature: 'stream_idle_timeout_ms',   minVersion: '2.1.84', description: 'CLAUDE_STREAM_IDLE_TIMEOUT_MS configurable streaming idle watchdog' },
  { feature: 'mcp_startup_nonblocking',  minVersion: '2.1.84', description: 'REPL renders immediately, MCP servers connect in background' },
  // 2.1.85
  { feature: 'pretool_ask_hook',         minVersion: '2.1.85', description: 'PreToolUse fires for AskUserQuestion, enabling headless responders' },
  // 2.1.86
  { feature: 'config_disk_write_fix',    minVersion: '2.1.86', description: 'Eliminates unnecessary config disk writes on every skill invocation' },
  { feature: 'write_edit_outside_root',  minVersion: '2.1.86', description: 'Write/Edit fix for files outside project root' },
  // 2.1.88
  { feature: 'permission_denied_hook',  minVersion: '2.1.88', description: 'PermissionDenied hook event fires after auto mode classifier denials' },
  { feature: 'absolute_file_path_hooks', minVersion: '2.1.88', description: 'PreToolUse/PostToolUse file_path always absolute for Write/Edit/Read' },
  { feature: 'compound_if_matching',    minVersion: '2.1.88', description: 'Hook if conditions match compound commands (ls && git push) and env prefixes' },
  { feature: 'structured_output_fix',   minVersion: '2.1.88', description: 'StructuredOutput schema cache fix (~50% failure rate with multiple schemas)' },
  { feature: 'no_flicker_env',          minVersion: '2.1.88', description: 'CLAUDE_CODE_NO_FLICKER=1 env var for flicker-free alt-screen rendering' },
  // 2.1.89
  { feature: 'defer_permission',       minVersion: '2.1.89', description: 'PreToolUse hooks can return decision:"defer" to pause headless sessions for later --resume' },
  { feature: 'task_created_hook',      minVersion: '2.1.89', description: 'TaskCreated hook event fires when tasks are created, with blocking behavior' },
  { feature: 'autocompact_thrash_fix', minVersion: '2.1.89', description: 'Detects autocompact thrash loop (3 refills) and stops with actionable error' },
  { feature: 'cleanup_period_validation', minVersion: '2.1.89', description: 'cleanupPeriodDays:0 in settings.json now rejected with validation error' },
  { feature: 'mcp_nonblocking_p_mode', minVersion: '2.1.89', description: 'MCP_CONNECTION_NONBLOCKING=true skips MCP wait in -p mode, bounded at 5s' },
  { feature: 'named_subagent_typeahead', minVersion: '2.1.89', description: 'Named subagents appear in @ mention typeahead suggestions' },
  { feature: 'hook_output_disk_spill', minVersion: '2.1.89', description: 'Hook output over 50K chars saved to disk with file path + preview' },
  { feature: 'edit_after_bash_view',   minVersion: '2.1.89', description: 'Edit works on files viewed via Bash sed/cat without separate Read call' },
  { feature: 'symlink_permission_check', minVersion: '2.1.89', description: 'Edit/Read allow rules check resolved symlink target, not just requested path' },
] as const;

export type CCFeature = typeof CC_FEATURE_MATRIX[number]['feature'];

/**
 * Compare two semver-like CC version strings (e.g. "2.1.47").
 * Returns -1, 0, or 1.
 */
export function compareCCVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

/**
 * Get features available at a given CC version.
 */
export function getAvailableFeatures(ccVersion: string): CCFeatureEntry[] {
  return CC_FEATURE_MATRIX.filter(f => compareCCVersions(ccVersion, f.minVersion) >= 0);
}

/**
 * Get features missing at a given CC version.
 */
export function getMissingFeatures(ccVersion: string): CCFeatureEntry[] {
  return CC_FEATURE_MATRIX.filter(f => compareCCVersions(ccVersion, f.minVersion) < 0);
}

/**
 * Check if a specific feature is available at a given CC version.
 */
export function hasFeature(ccVersion: string, feature: CCFeature): boolean {
  const entry = CC_FEATURE_MATRIX.find(f => f.feature === feature);
  if (!entry) return false;
  return compareCCVersions(ccVersion, entry.minVersion) >= 0;
}

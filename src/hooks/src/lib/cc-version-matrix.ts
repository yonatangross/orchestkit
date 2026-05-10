/**
 * CC Version Compatibility Matrix
 *
 * Runtime feature matrix for Claude Code version checking.
 * Used by doctor skill hooks and version-gated features.
 *
 * Keep in sync with: src/skills/doctor/references/version-compatibility.md
 */

export const MIN_CC_VERSION = '2.1.138';

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
  { feature: 'auto_permission_mode',  minVersion: '2.1.88', description: 'permissionMode:"auto" — classifier-based approval, replaces interactive prompts' },
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
  // 2.1.90
  { feature: 'powerup_lessons',          minVersion: '2.1.90', description: '/powerup interactive lessons teaching Claude Code features with animated demos' },
  { feature: 'plugin_keep_marketplace',  minVersion: '2.1.90', description: 'CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE keeps marketplace cache when git pull fails' },
  { feature: 'husky_protected_dir',      minVersion: '2.1.90', description: '.husky added to protected directories in acceptEdits mode' },
  { feature: 'pretool_exit2_json_fix',   minVersion: '2.1.90', description: 'PreToolUse hooks emitting JSON to stdout with exit code 2 now correctly block tool calls' },
  { feature: 'format_on_save_fix',       minVersion: '2.1.90', description: 'Edit/Write no longer fail with "File content has changed" when PostToolUse format-on-save rewrites' },
  { feature: 'resume_prompt_cache_fix',  minVersion: '2.1.90', description: '--resume no longer causes full prompt-cache miss with deferred tools/MCP/agents' },
  { feature: 'mcp_schema_cache_perf',    minVersion: '2.1.90', description: 'Eliminated per-turn JSON.stringify of MCP tool schemas on cache-key lookup' },
  { feature: 'sse_linear_perf',          minVersion: '2.1.90', description: 'SSE transport handles large streamed frames in linear time (was quadratic)' },
  { feature: 'transcript_write_perf',    minVersion: '2.1.90', description: 'SDK sessions with long conversations no longer slow down quadratically on transcript writes' },
  { feature: 'resume_hides_p_sessions',  minVersion: '2.1.90', description: '--resume picker no longer shows sessions created by claude -p or SDK invocations' },
  { feature: 'dns_cache_auto_allow_removed', minVersion: '2.1.90', description: 'Get-DnsClientCache and ipconfig /displaydns removed from auto-allow (DNS privacy)' },
  // 2.1.91
  { feature: 'mcp_result_size_override',    minVersion: '2.1.91', description: 'MCP tool result persistence via _meta["anthropic/maxResultSizeChars"] annotation (up to 500K)' },
  { feature: 'disable_skill_shell_exec',    minVersion: '2.1.91', description: 'disableSkillShellExecution setting disables inline shell execution in skills/commands/plugins' },
  { feature: 'deep_link_multiline',         minVersion: '2.1.91', description: 'Multi-line prompts supported in claude-cli://open?q= deep links (encoded newlines)' },
  { feature: 'plugin_bin_executables',      minVersion: '2.1.91', description: 'Plugins can ship executables under bin/ invokable as bare Bash commands' },
  { feature: 'transcript_chain_fix',        minVersion: '2.1.91', description: 'Transcript chain breaks on --resume fixed (async write failures no longer lose history)' },
  { feature: 'edit_shorter_anchors',        minVersion: '2.1.91', description: 'Edit tool uses shorter old_string anchors, reducing output tokens' },
  { feature: 'auto_permission_validation',  minVersion: '2.1.91', description: 'JSON schema validates permissions.defaultMode:"auto" in settings.json' },
  { feature: 'plan_mode_remote_fix',        minVersion: '2.1.91', description: 'Plan mode in remote sessions retains plan file after container restart' },
  // 2.1.92
  { feature: 'force_remote_settings_refresh', minVersion: '2.1.92', description: 'forceRemoteSettingsRefresh policy blocks startup until remote managed settings fetched (fail-closed)' },
  { feature: 'stop_hook_prevent_continuation_fix', minVersion: '2.1.92', description: 'prompt-type Stop hooks no longer fail when small fast model returns ok:false; preventContinuation:true restored' },
  { feature: 'tool_input_json_string_fix', minVersion: '2.1.92', description: 'Array/object tool_input fields no longer emitted as JSON-encoded strings during streaming' },
  { feature: 'plugin_mcp_connecting_fix',  minVersion: '2.1.92', description: 'Plugin MCP servers no longer stuck connecting when duplicating unauthenticated claude.ai connectors' },
  { feature: 'write_diff_perf',            minVersion: '2.1.92', description: 'Write tool diff computation 60% faster for large files with tabs/&/$ characters' },
  { feature: 'remote_control_hostname',    minVersion: '2.1.92', description: 'Remote Control session names default to hostname prefix, overridable with --remote-control-session-name-prefix' },
  { feature: 'cost_per_model_breakdown',   minVersion: '2.1.92', description: '/cost shows per-model and cache-hit breakdown for subscription users' },
  { feature: 'subagent_tmux_pane_fix',     minVersion: '2.1.92', description: 'Subagent spawning no longer permanently fails after tmux windows killed/renumbered' },
  // 2.1.94 (2026-04-07) — skipped 2.1.93
  { feature: 'skill_frontmatter_hooks_fix', minVersion: '2.1.94', description: 'Plugin skill hooks defined in YAML frontmatter now fire (previously silently ignored) — unlocks 20 OrchestKit context loaders' },
  { feature: 'session_title_hook_output',   minVersion: '2.1.94', description: 'UserPromptSubmit hooks can set session title via hookSpecificOutput.sessionTitle' },
  { feature: 'keep_coding_instructions',    minVersion: '2.1.94', description: 'keep-coding-instructions frontmatter field preserves coding instructions in plugin output styles' },
  { feature: 'plugin_skill_name_stability', minVersion: '2.1.94', description: 'Plugin skills declared via "skills": ["./"] use frontmatter name for stable invocation across install methods' },
  // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal ${CLAUDE_PLUGIN_ROOT} text
  { feature: 'plugin_root_local_mkt_fix',   minVersion: '2.1.94', description: '${CLAUDE_PLUGIN_ROOT} resolves to installed cache (not marketplace source) for local-marketplace plugins' },
  { feature: 'plugin_hooks_no_root_env_fix', minVersion: '2.1.94', description: 'Plugin hooks no longer fail with "No such file or directory" when CLAUDE_PLUGIN_ROOT env var unset' },
  { feature: 'effort_default_high',         minVersion: '2.1.94', description: 'Default effort level changed medium → high for API-key/Bedrock/Vertex/Foundry/Team/Enterprise users' },
  { feature: 'rate_limit_429_surface',      minVersion: '2.1.94', description: 'Agents no longer stuck after 429 rate-limit with long Retry-After — error surfaces immediately' },
  { feature: 'sdk_partial_response_fix',    minVersion: '2.1.94', description: 'SDK/print mode preserves partial assistant response on interrupt mid-stream' },
  { feature: 'resume_across_worktrees',     minVersion: '2.1.94', description: '--resume can attach to sessions in other worktrees of the same repo directly' },
  { feature: 'stream_json_cjk_fix',         minVersion: '2.1.94', description: 'CJK/multibyte text no longer corrupted with U+FFFD when chunk boundaries split UTF-8 sequences in stream-json I/O' },
  { feature: 'mantle_bedrock',              minVersion: '2.1.94', description: 'Amazon Bedrock powered by Mantle via CLAUDE_CODE_USE_MANTLE=1' },
  // 2.1.95 (2026-04-07, npm-only — no GitHub release tag)
  { feature: 'mcp_tool_description_cap',    minVersion: '2.1.95', description: 'MCP tool descriptions and server instructions capped at 2KB to prevent context bloat from verbose OpenAPI schemas' },
  { feature: 'mcp_local_config_dedup',      minVersion: '2.1.95', description: 'MCP servers configured both locally and via claude.ai connectors are deduplicated, local config wins' },
  // 2.1.96 (2026-04-08) — hotfix only
  { feature: 'bedrock_bearer_token_fix',    minVersion: '2.1.96', description: 'Fixed Bedrock 403 "Authorization header is missing" regression when using AWS_BEARER_TOKEN_BEDROCK or CLAUDE_CODE_SKIP_BEDROCK_AUTH (hotfix from 2.1.94)' },
  // 2.1.97 (2026-04-08)
  { feature: 'focus_view_toggle',           minVersion: '2.1.97', description: 'Ctrl+O focus view in NO_FLICKER mode — shows prompt, one-line tool summary with edit diffstats, and final response' },
  { feature: 'statusline_refresh_interval', minVersion: '2.1.97', description: 'refreshInterval status line setting re-runs the status line command every N seconds automatically' },
  { feature: 'statusline_git_worktree',     minVersion: '2.1.97', description: 'workspace.git_worktree boolean in status line JSON input, set when cwd is inside a linked git worktree' },
  { feature: 'agents_running_indicator',    minVersion: '2.1.97', description: '● N running indicator in /agents next to agent types with live subagent instances' },
  { feature: 'stop_hook_long_session_fix',  minVersion: '2.1.97', description: 'prompt-type Stop/SubagentStop hooks no longer fail on long sessions; hook evaluator API errors show actual message' },
  { feature: 'subagent_cwd_leak_fix',       minVersion: '2.1.97', description: 'Subagents with worktree isolation or cwd: override no longer leak working directory back to parent Bash tool' },
  { feature: 'plugin_update_marketplace_fix', minVersion: '2.1.97', description: 'claude plugin update no longer reports "already at latest" for git-based marketplace plugins with newer remote commits' },
  { feature: 'yaml_boolean_skill_name_fix', minVersion: '2.1.97', description: 'Slash command picker no longer breaks when a plugin frontmatter name is a YAML boolean keyword (true/false/yes/no)' },
  { feature: 'bash_permissions_hardened',   minVersion: '2.1.97', description: 'Bash tool permissions hardened: tighter env-var prefix checks and network redirect validation, fewer false prompts' },
  { feature: 'accept_edits_env_prefix',     minVersion: '2.1.97', description: 'Accept Edits mode auto-approves filesystem commands prefixed with safe env vars or process wrappers (e.g. LANG=C rm foo)' },
  { feature: 'sandbox_mach_lookup_macos',   minVersion: '2.1.97', description: 'sandbox.network.allowMachLookup now takes effect on macOS' },
  { feature: 'mcp_sse_memory_leak_fix',     minVersion: '2.1.97', description: 'MCP HTTP/SSE connections no longer accumulate ~50 MB/hr of unreleased buffers on reconnect' },
  { feature: 'mcp_oauth_metadata_url_fix',  minVersion: '2.1.97', description: 'MCP OAuth oauth.authServerMetadataUrl honored on token refresh after restart (fixes ADFS/similar IdPs)' },
  { feature: 'retry_429_exponential_backoff', minVersion: '2.1.97', description: '429 retries use exponential backoff as minimum instead of burning all attempts in ~13 seconds' },
  { feature: 'resume_picker_fixes',         minVersion: '2.1.97', description: 'Multiple /resume fixes: --resume <name> editable, Ctrl+A reload preserves search, task-status text, cross-project staleness' },
  { feature: 'resume_large_file_diff_fix',  minVersion: '2.1.97', description: 'File-edit diffs no longer disappear on --resume when edited file exceeds 10KB' },
  { feature: 'compaction_subagent_dedup',   minVersion: '2.1.97', description: 'Compaction no longer writes duplicate multi-MB subagent transcript files on prompt-too-long retries' },
  { feature: 'prototype_settings_fix',      minVersion: '2.1.97', description: 'Permission rules with names matching JS prototype properties (toString, constructor) no longer cause settings.json to be silently ignored' },
  { feature: 'image_compression_parity',    minVersion: '2.1.97', description: 'Pasted and attached images compressed to same token budget as images read via Read tool' },
  { feature: 'bash_otel_traceparent',       minVersion: '2.1.97', description: 'Bash subprocesses inherit W3C TRACEPARENT env var when OTEL tracing is enabled' },
  { feature: 'managed_settings_removal_fix', minVersion: '2.1.97', description: 'Managed-settings allow rules removed by admin now take effect without process restart' },
  { feature: 'additional_dirs_mid_session',  minVersion: '2.1.97', description: 'permissions.additionalDirectories changes in settings now apply mid-session' },
  { feature: 'bridge_session_git_info',     minVersion: '2.1.97', description: 'Bridge sessions show local git repo, branch, and working directory on claude.ai session card' },
  { feature: 'transcript_size_optimization', minVersion: '2.1.97', description: 'Session transcripts skip empty hook entries and cap stored pre-edit file copies' },
  // 2.1.98 (2026-04-09)
  { feature: 'monitor_tool',               minVersion: '2.1.98', description: 'Monitor tool streams events from background scripts (each stdout line → notification)' },
  { feature: 'vertex_ai_wizard',           minVersion: '2.1.98', description: 'Interactive Google Vertex AI setup wizard from login screen' },
  { feature: 'script_caps_env',            minVersion: '2.1.98', description: 'CLAUDE_CODE_SCRIPT_CAPS limits per-session script invocations' },
  { feature: 'perforce_mode',              minVersion: '2.1.98', description: 'CLAUDE_CODE_PERFORCE_MODE fails Edit/Write on read-only files with p4 edit hint' },
  { feature: 'pid_namespace_sandbox',      minVersion: '2.1.98', description: 'Subprocess PID namespace isolation on Linux via CLAUDE_CODE_SUBPROCESS_ENV_SCRUB' },
  { feature: 'exclude_dynamic_prompt',     minVersion: '2.1.98', description: '--exclude-dynamic-system-prompt-sections for cross-user prompt caching in print mode' },
  { feature: 'agents_tabbed_layout',       minVersion: '2.1.98', description: '/agents tabbed layout: Running tab for live subagents, Library tab with actions' },
  { feature: 'reload_plugins_skills',      minVersion: '2.1.98', description: '/reload-plugins picks up plugin-provided skills without restart' },
  { feature: 'hook_stderr_display',        minVersion: '2.1.98', description: 'Hook errors show first line of stderr in transcript for self-diagnosis' },
  { feature: 'bg_subagent_partial_report', minVersion: '2.1.98', description: 'Background subagents that fail with errors now report partial progress to parent' },
  { feature: 'accept_edits_safe_wrappers', minVersion: '2.1.98', description: 'Accept Edits mode auto-approves filesystem commands with safe env vars or process wrappers' },
  { feature: 'vim_jk_history_nav',         minVersion: '2.1.98', description: 'Vim j/k in NORMAL mode navigate history and select footer pill' },
  { feature: 'bash_backslash_escape_fix',  minVersion: '2.1.98', description: 'Fixed Bash tool permission bypass where backslash-escaped flags could auto-allow' },
  { feature: 'compound_cmd_forced_prompt', minVersion: '2.1.98', description: 'Compound Bash commands no longer bypass forced permission prompts' },
  { feature: 'stale_worktree_untracked_fix', minVersion: '2.1.98', description: 'Stale subagent worktree cleanup no longer removes worktrees with untracked files' },
  { feature: 'team_permission_inherit',    minVersion: '2.1.98', description: 'Agent team members inherit leader permission mode in bypass-permissions' },
  { feature: 'lsp_client_info',           minVersion: '2.1.98', description: 'LSP: Claude Code identifies itself to language servers via clientInfo in initialize request' },
  // 2.1.101 (2026-04-10)
  { feature: 'team_onboarding_command',    minVersion: '2.1.101', description: '/team-onboarding generates teammate ramp-up guide from local CC usage' },
  { feature: 'os_ca_cert_store',           minVersion: '2.1.101', description: 'OS CA certificate store trusted by default — enterprise TLS proxies work OOTB' },
  { feature: 'deny_overrides_ask',         minVersion: '2.1.101', description: 'permissions.deny rules override PreToolUse hook permissionDecision:"ask"' },
  { feature: 'subagent_dynamic_mcp',       minVersion: '2.1.101', description: 'Subagents inherit MCP tools from dynamically-injected servers' },
  { feature: 'worktree_agent_file_access', minVersion: '2.1.101', description: 'Worktree-isolated agents can Read/Edit files inside their own worktree' },
  { feature: 'skill_context_fork_fix',     minVersion: '2.1.101', description: 'Skills honor context:fork and agent frontmatter fields (previously silently ignored)' },
  { feature: 'settings_resilience',        minVersion: '2.1.101', description: 'Unrecognized hook event name in settings.json no longer causes entire file to be ignored' },
  { feature: 'focus_mode_summaries',       minVersion: '2.1.101', description: 'Focus mode: Claude writes self-contained summaries knowing user only sees final message' },
  { feature: 'remote_trigger_run_fix',     minVersion: '2.1.101', description: 'RemoteTrigger run action no longer sends empty body (scheduled triggers work)' },
  { feature: 'resume_session_title',       minVersion: '2.1.101', description: '--resume accepts session titles set via /rename or --name' },
  { feature: 'rate_limit_detail',          minVersion: '2.1.101', description: 'Rate-limit retry messages show which limit was hit and when it resets' },
  { feature: 'managed_hooks_force_run',    minVersion: '2.1.101', description: 'Plugin hooks from force-enabled managed settings run with allowManagedHooksOnly' },
  { feature: 'lsp_which_injection_fix',    minVersion: '2.1.101', description: 'Fixed command injection vulnerability in POSIX which fallback for LSP binary detection' },
  { feature: 'long_session_memory_fix',    minVersion: '2.1.101', description: 'Fixed memory leak retaining historical message list copies in virtual scroller' },
  { feature: 'resume_chain_recovery_fix',  minVersion: '2.1.101', description: '--resume no longer bridges into unrelated subagent conversation on write gaps' },
  { feature: 'worktree_stale_cleanup_fix', minVersion: '2.1.101', description: 'claude -w <name> no longer fails with "already exists" after stale worktree cleanup' },
  { feature: 'sandbox_mktemp_fix',         minVersion: '2.1.101', description: 'Sandboxed Bash commands no longer fail with mktemp ENOENT after fresh boot' },
  { feature: 'grep_rg_fallback',           minVersion: '2.1.101', description: 'Grep tool falls back to system rg when embedded ripgrep path is stale' },
  // 2.1.105 (2026-04-13)
  { feature: 'enter_worktree_path_param',   minVersion: '2.1.105', description: 'EnterWorktree tool accepts path parameter to switch into an existing worktree' },
  { feature: 'precompact_blocking',         minVersion: '2.1.105', description: 'PreCompact hooks can block compaction via exit code 2 or {"decision":"block"} JSON response' },
  { feature: 'plugin_monitors_manifest',    minVersion: '2.1.105', description: 'Background monitor support for plugins via top-level monitors manifest key' },
  { feature: 'skill_description_cap_1536',  minVersion: '2.1.105', description: 'Skill description listing cap raised from 250 to 1,536 characters' },
  { feature: 'webfetch_strip_scripts',      minVersion: '2.1.105', description: 'WebFetch strips <style> and <script> body content before returning markdown' },
  { feature: 'stale_worktree_squash_cleanup', minVersion: '2.1.105', description: 'Stale agent worktrees from squash-merged PRs cleaned up automatically' },
  { feature: 'mcp_truncation_recipes',      minVersion: '2.1.105', description: 'MCP large-output truncation includes format-specific reduction recipes (jq for JSON, Read chunks for files)' },
  { feature: 'doctor_interactive_fix',      minVersion: '2.1.105', description: '/doctor press f to have Claude auto-fix detected issues' },
  { feature: 'stream_stall_retry',          minVersion: '2.1.105', description: 'Stalled API streams abort after 5 minutes and retry with non-streaming fallback' },
  { feature: 'proactive_loop_alias',        minVersion: '2.1.105', description: '/proactive alias for /loop command' },
  // 2.1.107 (2026-04-14)
  { feature: 'thinking_hints_early',        minVersion: '2.1.107', description: 'Extended thinking hints shown sooner during long operations' },
  // 2.1.108 (2026-04-14)
  { feature: 'prompt_caching_1h_env',       minVersion: '2.1.108', description: 'ENABLE_PROMPT_CACHING_1H env var for 1-hour prompt cache TTL across API key, Bedrock, Vertex, Foundry' },
  { feature: 'force_prompt_caching_5m_env', minVersion: '2.1.108', description: 'FORCE_PROMPT_CACHING_5M to explicitly force 5-minute cache TTL' },
  { feature: 'recap_command',               minVersion: '2.1.108', description: '/recap command + auto-recap for session context restoration after idle periods' },
  { feature: 'away_summary_env',            minVersion: '2.1.108', description: 'CLAUDE_CODE_ENABLE_AWAY_SUMMARY forces session recap even with DISABLE_TELEMETRY set' },
  { feature: 'skill_builtin_discovery',     minVersion: '2.1.108', description: 'Model can auto-discover and invoke built-in slash commands (/init, /review, /security-review) via Skill tool' },
  { feature: 'undo_rewind_alias',           minVersion: '2.1.108', description: '/undo alias for /rewind command' },
  { feature: 'model_switch_warning',        minVersion: '2.1.108', description: '/model warns before switching models mid-conversation to prevent prompt cache invalidation' },
  { feature: 'resume_cwd_default',          minVersion: '2.1.108', description: '/resume picker defaults to sessions from current directory; Ctrl+A shows all projects' },
  { feature: 'lazy_language_grammars',      minVersion: '2.1.108', description: 'Language grammars loaded on demand, reducing memory footprint for file reads/edits/syntax highlighting' },
  { feature: 'rate_limit_server_distinction', minVersion: '2.1.108', description: 'Error messages distinguish server rate limits from plan usage limits with status.claude.com link' },
  { feature: 'prompt_cache_disable_warning', minVersion: '2.1.108', description: 'Startup warning when DISABLE_PROMPT_CACHING* env vars are set' },
  { feature: 'agent_auto_classifier_fix',   minVersion: '2.1.108', description: 'Agent tool no longer prompts in auto mode when safety classifier transcript exceeds context window' },
  { feature: 'telemetry_cache_ttl_fix',     minVersion: '2.1.108', description: 'Subscribers with DISABLE_TELEMETRY get 1-hour cache TTL instead of falling back to 5-minute' },
  // 2.1.109 (2026-04-15)
  { feature: 'thinking_progress_rotation',  minVersion: '2.1.109', description: 'Extended thinking indicator with rotating progress hint during long operations' },
  // 2.1.110 (2026-04-15)
  { feature: 'tui_command',                 minVersion: '2.1.110', description: '/tui command + tui setting — switch to flicker-free fullscreen TUI rendering mid-conversation' },
  { feature: 'push_notification_tool',      minVersion: '2.1.110', description: 'PushNotification built-in tool — sends mobile push when Remote Control enabled' },
  { feature: 'focus_command',               minVersion: '2.1.110', description: '/focus command for condensed view (replaces Ctrl+O focus toggle from 2.1.97)' },
  { feature: 'ctrl_o_transcript_only',      minVersion: '2.1.110', description: 'Ctrl+O now only toggles between normal and verbose transcript (no longer focus view)' },
  { feature: 'auto_scroll_enabled_config',  minVersion: '2.1.110', description: 'autoScrollEnabled config option to disable auto-scroll in fullscreen mode' },
  { feature: 'editor_commented_context',    minVersion: '2.1.110', description: 'External editor (Ctrl+G) optionally shows Claude last response as commented context' },
  { feature: 'bash_max_timeout_enforced',   minVersion: '2.1.110', description: 'Bash tool enforces documented max timeout — values exceeding limit now hard-fail' },
  { feature: 'write_user_edit_signal',      minVersion: '2.1.110', description: 'Write tool tells model when user edits proposed diff before accepting — PostToolUse hooks see different tool_response' },
  { feature: 'resume_scheduled_tasks',      minVersion: '2.1.110', description: '--resume/--continue resurrects unexpired scheduled tasks, not just session history' },
  { feature: 'session_recap_default_on',    minVersion: '2.1.110', description: 'Session recap enabled by default even with telemetry disabled — opt out via /config or CLAUDE_CODE_ENABLE_AWAY_SUMMARY=0' },
  { feature: 'remote_control_commands',     minVersion: '2.1.110', description: '/autocompact, /context, /exit, /reload-plugins now work from Remote Control clients' },
  { feature: 'sdk_traceparent_tracestate',  minVersion: '2.1.110', description: 'TRACEPARENT and TRACESTATE env vars auto-read in SDK/headless sessions for OpenTelemetry propagation' },
  { feature: 'plugin_favorites_sorting',    minVersion: '2.1.110', description: '/plugin Installed tab: favorites and needs-attention sort to top, disabled items hidden behind fold' },
  { feature: 'doctor_mcp_duplicate_warn',   minVersion: '2.1.110', description: '/doctor warns when same MCP server defined in multiple config scopes with different endpoints' },
  { feature: 'mcp_hang_fix',               minVersion: '2.1.110', description: 'MCP tool call hang fixes and connection hardening' },
  { feature: 'open_in_editor_security',     minVersion: '2.1.110', description: 'Security hardening for "Open in editor" actions — command injection protection' },
  // 2.1.111 (2026-04-16) — Opus 4.7 launch
  { feature: 'opus_4_7_xhigh',              minVersion: '2.1.111', description: 'xhigh effort level (between high and max) for Opus 4.7 — finer reasoning/latency control, new default for Claude Code plans' },
  { feature: 'auto_mode_opus47_max',        minVersion: '2.1.111', description: 'Auto mode available for Max subscribers on Opus 4.7 without --enable-auto-mode flag' },
  { feature: 'effort_slider',               minVersion: '2.1.111', description: '/effort without arguments opens interactive slider UI for effort level selection' },
  { feature: 'ultrareview_command',         minVersion: '2.1.111', description: '/ultrareview skill — parallel multi-agent comprehensive code review (3 free per month for Pro/Max)' },
  { feature: 'less_permission_prompts',     minVersion: '2.1.111', description: '/less-permission-prompts skill — scans transcripts for read-only Bash calls and proposes permission allowlist additions' },
  { feature: 'auto_match_terminal_theme',   minVersion: '2.1.111', description: '"Auto (match terminal)" theme option mirrors terminal dark/light mode' },
  { feature: 'powershell_tool_env',         minVersion: '2.1.111', description: 'CLAUDE_CODE_USE_POWERSHELL_TOOL env var opts into native PowerShell tool on Windows (progressively rolling out)' },
  { feature: 'readonly_bash_glob_no_prompt', minVersion: '2.1.111', description: 'Read-only Bash commands containing glob patterns no longer trigger permission prompts' },
  { feature: 'subcommand_typo_suggest',     minVersion: '2.1.111', description: 'CLI suggests closest matching subcommand on typo (e.g. `claude udpate` → suggests update)' },
  { feature: 'plan_files_prompt_named',     minVersion: '2.1.111', description: 'Plan files named after the prompt instead of random words, improving discoverability' },
  { feature: 'setup_vertex_bedrock_path',   minVersion: '2.1.111', description: '/setup-vertex and /setup-bedrock display settings path for the settings they write' },
  { feature: 'skills_token_sort',           minVersion: '2.1.111', description: '/skills menu supports sorting by token count — press `t` to toggle' },
  { feature: 'ctrl_u_y_clear_restore',      minVersion: '2.1.111', description: 'Ctrl+U clears entire input buffer; Ctrl+Y restores what was cleared' },
  { feature: 'ctrl_l_full_redraw',          minVersion: '2.1.111', description: 'Ctrl+L forces full screen redraw in addition to clearing the prompt' },
  { feature: 'transcript_view_footer_keys', minVersion: '2.1.111', description: 'Transcript view footer adds `[` (dump to scrollback) and `v` (open in editor) shortcuts' },
  { feature: 'stream_json_plugin_errors',   minVersion: '2.1.111', description: 'Headless --output-format stream-json includes plugin_errors array on init event for CI/eval observability' },
  { feature: 'otel_raw_api_bodies_env',     minVersion: '2.1.111', description: 'OTEL_LOG_RAW_API_BODIES env var logs raw API request/response bodies for debugging (secret leakage risk)' },
  // 2.1.112 (2026-04-16)
  { feature: 'opus_47_auto_mode_fix',       minVersion: '2.1.112', description: 'Fix: Opus 4.7 auto mode availability for Max subscribers' },
  // 2.1.113 (2026-04-17) — native binary + security hardening
  { feature: 'native_binary_spawn',         minVersion: '2.1.113', description: 'CLI spawns native platform binary instead of bundled JS — affects hooks that inspect process.argv0 / __dirname / node_modules paths' },
  { feature: 'sandbox_denied_domains',      minVersion: '2.1.113', description: 'sandbox.network.deniedDomains setting blocklists outbound domains (wildcards supported) for Bash/WebFetch' },
  { feature: 'loop_wakeup_esc_cancel',      minVersion: '2.1.113', description: '/loop pending wakeups cancellable via Esc; resumption transcript marker "Claude resuming /loop wakeup" enables analytics' },
  { feature: 'bash_multiline_comments',     minVersion: '2.1.113', description: 'Multi-line Bash commands with leading # comments now show full command in transcript — improves transcript self-documentation' },
  { feature: 'remote_control_extra_usage',  minVersion: '2.1.113', description: 'Remote Control: /extra-usage command and @-file autocomplete work from mobile/web clients' },
  { feature: 'bash_rm_private_paths',       minVersion: '2.1.113', description: 'macOS /private/{etc,var,tmp,home} treated as dangerous under Bash(rm:*) deny rules (symlink targets of /etc, /var, /tmp, /home)' },
  { feature: 'bash_deny_wrappers',          minVersion: '2.1.113', description: 'Bash deny rules now match commands wrapped in env/sudo/watch/ionice/setsid — previous bypasses closed' },
  { feature: 'bash_find_exec_no_approve',   minVersion: '2.1.113', description: 'Bash(find:*) auto-approve no longer covers -exec/-delete — these now require explicit allowlist or manual approval' },
  { feature: 'mcp_concurrent_timeout_fix',  minVersion: '2.1.113', description: 'MCP concurrent-call timeout handling fixed — hanging calls error cleanly instead of blocking queue' },
  { feature: 'subagent_timeout_error',      minVersion: '2.1.113', description: 'Subagent timeouts produce clear error after 10 min instead of hanging indefinitely — affects long-running Agent spawns' },
  // 2.1.114 (2026-04-18)
  { feature: 'agent_team_permission_fix',   minVersion: '2.1.114', description: 'Fix: permission dialog crash when agent teams request tool approval' },
  // 2.1.116 (2026-04-21) — perf, UX, agent main-thread hooks, sandbox hardening
  { feature: 'agent_hooks_main_thread',        minVersion: '2.1.116', description: 'Agent frontmatter `hooks:` now fires when running as --agent main thread (previously subagent-only) — expands reach of PreToolUse/PostToolUse blockers' },
  { feature: 'reload_plugins_auto_deps',       minVersion: '2.1.116', description: '/reload-plugins and background auto-update auto-install missing plugin dependencies from known marketplaces' },
  { feature: 'doctor_while_responding',        minVersion: '2.1.116', description: '/doctor can run while Claude is responding (was queued until turn end) — enables mid-session diagnostics' },
  { feature: 'config_search_option_values',    minVersion: '2.1.116', description: '/config search matches option values, not just keys (e.g. search "vim" finds Editor mode)' },
  { feature: 'slash_no_match_empty_state',     minVersion: '2.1.116', description: 'Slash command menu shows explicit "No commands match" when filter has zero results (was disappearing)' },
  { feature: 'bash_gh_rate_limit_hint',        minVersion: '2.1.116', description: 'Bash tool surfaces a hint when `gh` commands hit GitHub API rate limit — helps agents back off instead of retrying' },
  { feature: 'usage_tab_immediate',            minVersion: '2.1.116', description: 'Settings Usage tab shows 5-hour and weekly usage immediately, with fallback when /usage endpoint is rate-limited' },
  { feature: 'terminal_setup_scroll_tuning',   minVersion: '2.1.116', description: '/terminal-setup configures VS Code/Cursor/Windsurf editor scroll sensitivity for smoother fullscreen-mode scrolling' },
  { feature: 'sandbox_rm_dangerous_path_fix',  minVersion: '2.1.116', description: 'Security: sandbox auto-allow no longer bypasses dangerous-path check for rm/rmdir targeting /, $HOME, or critical system dirs — closes prior escape' },
  { feature: 'resume_large_sessions_fast',     minVersion: '2.1.116', description: '/resume on 40 MB+ sessions up to 67% faster; MCP stdio startup parallelized with resources/templates/list deferred to first @-mention' },
  // 2.1.117 (2026-04-22) — agent mcpServers main-thread, forked subagents, managed settings enforcement, OTEL enrichments
  { feature: 'agent_mcp_servers_main_thread',  minVersion: '2.1.117', description: 'Agent frontmatter `mcpServers:` now loads for --agent main-thread sessions (previously subagent-only) — parallels 2.1.116 agent_hooks_main_thread behavior' },
  { feature: 'fork_subagent_env_var',          minVersion: '2.1.117', description: 'CLAUDE_CODE_FORK_SUBAGENT=1 enables forked subagents on external builds (was opt-in only via plan-level signals before)' },
  { feature: 'plugin_install_auto_deps',       minVersion: '2.1.117', description: 'plugin install on already-installed plugins now fetches missing dependencies instead of short-circuiting at "already installed"' },
  { feature: 'marketplace_install_auto_deps',  minVersion: '2.1.117', description: 'claude plugin marketplace add auto-resolves missing dependencies from configured marketplaces' },
  { feature: 'managed_settings_marketplace_enforce', minVersion: '2.1.117', description: 'blockedMarketplaces and strictKnownMarketplaces managed settings now enforced on plugin install, update, refresh, and autoupdate (previously enforced only at add time)' },
  { feature: 'model_pin_persists_restart',     minVersion: '2.1.117', description: '/model selections persist across restarts even when project pins a different model; startup header shows when the active model comes from a project or managed-settings pin' },
  { feature: 'resume_large_session_summary',   minVersion: '2.1.117', description: '/resume command now offers to summarize stale large sessions before re-reading them, matching existing --resume behavior' },
  { feature: 'otel_command_attrs',             minVersion: '2.1.117', description: 'OTEL user_prompt events include command_name and command_source attributes for slash commands (distinguish user-typed from model-invoked via SlashCommand tool)' },
  { feature: 'otel_effort_attr',               minVersion: '2.1.117', description: 'OTEL cost.usage, token.usage, api_request, and api_error events include effort attribute when supported — enables per-effort-level cost breakdown' },
  { feature: 'opus_46_sonnet_46_default_high', minVersion: '2.1.117', description: 'Pro/Max subscribers on Opus 4.6 and Sonnet 4.6 now default to high effort (was medium) — real prompt-cost change; skills assuming medium-as-default need rewording' },
  { feature: 'advisor_tool_experimental',      minVersion: '2.1.117', description: 'Advisor Tool (experimental) dialog carries experimental label + learn-more link; sessions no longer get stuck with "Advisor tool result content could not be processed" errors' },
  { feature: 'retention_expands_tasks_backups', minVersion: '2.1.117', description: 'cleanupPeriodDays now covers ~/.claude/tasks/, ~/.claude/shell-snapshots/, ~/.claude/backups/ (previously only transcripts)' },
  { feature: 'native_bfs_ugrep',               minVersion: '2.1.117', description: 'Native builds replace Glob/Grep tools with embedded bfs and ugrep through Bash tool for faster searches (Windows and npm builds unchanged)' },
  { feature: 'opus_47_context_window_fix',     minVersion: '2.1.117', description: 'Opus 4.7 sessions now correctly compute /context percentage against 1M context window instead of 200K (was causing inflated percentages and too-early autocompacts)' },
  // 2.1.118 (2026-04-23) — mcp_tool hook type, plugin tag, autoMode $defaults, named themes
  { feature: 'mcp_tool_hook_type',             minVersion: '2.1.118', description: 'Hooks can invoke MCP tools directly via type:"mcp_tool" instead of spawning a subagent — see src/skills/chain-patterns/references/mcp-tool-hooks.md' },
  { feature: 'claude_plugin_tag',              minVersion: '2.1.118', description: 'claude plugin tag command for plugin release tagging with version validation — see src/skills/chain-patterns/references/plugin-tag.md' },
  { feature: 'auto_mode_defaults_extension',   minVersion: '2.1.118', description: 'autoMode.allow/soft_deny/environment accept "$defaults" sentinel to extend (instead of replace) base policy' },
  { feature: 'named_themes_directory',         minVersion: '2.1.118', description: 'Named/custom themes via ~/.claude/themes/ + plugin themes/ directory — plugins can ship themes' },
  { feature: 'disable_updates_env',            minVersion: '2.1.118', description: 'DISABLE_UPDATES env var (stricter than DISABLE_AUTOUPDATER) — blocks all update channels' },
  { feature: 'usage_command_merge',            minVersion: '2.1.118', description: '/cost + /stats merged into /usage — skill copy referencing the old commands should migrate' },
  // 2.1.119 (2026-04-24) — duration_ms, OTEL tool_use_id + input_size, --from-pr multi-host, --print agent tools enforcement
  { feature: 'posttool_duration_ms',           minVersion: '2.1.119', description: 'PostToolUse + PostToolUseFailure inputs include duration_ms — server-measured per-tool latency, accurate for streaming/async tools' },
  { feature: 'otel_tool_use_id_attr',          minVersion: '2.1.119', description: 'OTEL tool_result and tool_decision events carry tool_use_id — enables PreToolUse/PostToolUse correlation in tracing' },
  { feature: 'otel_tool_input_size_bytes',     minVersion: '2.1.119', description: 'OTEL tool_result events include tool_input_size_bytes — surfaces over-sized tool inputs that bloat context' },
  { feature: 'from_pr_multi_host',             minVersion: '2.1.119', description: '--from-pr accepts GitLab MR, Bitbucket PR, and GitHub Enterprise URLs — see src/skills/chain-patterns/references/pr-from-platform.md' },
  { feature: 'print_agent_tools_enforced',     minVersion: '2.1.119', description: '--print mode honors agent tools: and disallowedTools: — eval reproducibility matches interactive mode' },
  { feature: 'agent_permission_mode_print',    minVersion: '2.1.119', description: '--agent <name> honors permissionMode in --print mode — was previously ignored' },
  { feature: 'pr_url_template_setting',        minVersion: '2.1.119', description: 'prUrlTemplate setting for custom code-review URL formatting (e.g., enterprise GitLab/Bitbucket)' },
  { feature: 'config_persists_settings',       minVersion: '2.1.119', description: '/config settings persist to ~/.claude/settings.json with override precedence' },
  { feature: 'powershell_auto_approve',        minVersion: '2.1.119', description: 'PowerShell tool auto-approves in permission mode (parity with Bash on POSIX)' },
  { feature: 'statusline_effort_thinking',     minVersion: '2.1.119', description: 'Status line stdin includes effort.level + thinking.enabled — exposes runtime mode for custom statuslines' },
  { feature: 'blocked_marketplaces_pattern',   minVersion: '2.1.119', description: 'blockedMarketplaces enforces hostPattern/pathPattern — plus 2.1.117 enforcement points fix' },
  { feature: 'claude_code_hide_cwd_env',       minVersion: '2.1.119', description: 'CLAUDE_CODE_HIDE_CWD env var hides cwd from statusline (privacy/screenshare)' },
  // 2.1.128 (2026-05-04) — worktree HEAD fix, MCP reserved name, .zip plugins, channels console-auth, eval init plugin_errors expansion
  { feature: 'enter_worktree_branch_from_head', minVersion: '2.1.128', description: 'EnterWorktree creates branch from local HEAD (not origin/<default>) — unpushed commits no longer dropped; agent guidance no longer needs "commit before entering worktree" warning' },
  { feature: 'workspace_reserved_mcp_name',     minVersion: '2.1.128', description: 'MCP server name "workspace" is reserved — any .mcp.json or example using it is silently skipped with a warning; doctor surfaces this' },
  { feature: 'plugin_dir_zip_archives',         minVersion: '2.1.128', description: '--plugin-dir accepts .zip plugin archives — enables ork.zip distribution path for release-engineer agent' },
  { feature: 'channels_console_auth',           minVersion: '2.1.128', description: '--channels works with console (API key) auth when org has channelsEnabled:true — setup skill documents the org config requirement' },
  { feature: 'init_plugin_errors_plugin_dir',   minVersion: '2.1.128', description: 'init.plugin_errors in --output-format stream-json now includes --plugin-dir load failures — eval-runner preflight surfaces local-plugin breakage that 2.1.111 only detected for marketplace plugins' },
  { feature: 'subagent_idle_summary_capped',    minVersion: '2.1.128', description: 'Sub-agent summaries no longer fire repeatedly on idle sub-agents — caps worst-case token cost for long-lived background agents' },
  { feature: 'plugin_update_npm_detection_fix', minVersion: '2.1.128', description: '/plugin update now detects new versions of npm-sourced plugins (was a no-op before) — direct benefit to OrchestKit users on the npm channel' },
  { feature: 'parallel_tool_failure_isolated',  minVersion: '2.1.128', description: 'Parallel shell tool calls: a failing read-only command (grep, git diff, ls) no longer cancels sibling calls — every fan-out skill (ork:explore, ork:cover, ork:review-pr) gets free reliability with no code change' },
  { feature: 'subagent_progress_cache_hit',     minVersion: '2.1.128', description: 'Sub-agent progress summaries now hit the prompt cache (~3x cache_creation reduction) — applies to every multi-agent skill including ork:brainstorm, ork:implement, ork:review-pr' },
  { feature: 'subprocess_no_otel_inherit',      minVersion: '2.1.128', description: 'Subprocesses (Bash, hooks, MCP, LSP) no longer inherit OTEL_* env vars from the CLI — OTEL-instrumented apps run via Bash no longer pick up the CLI OTLP endpoint' },
  // 2.1.129 (2026-05-06) — plugin manifest experimental:, skillOverrides, gateway opt-in, /context no-dump, prompt cache TTL fix
  { feature: 'experimental_themes_monitors',    minVersion: '2.1.129', description: 'Plugin manifests: themes and monitors should now be declared under experimental: { ... } — top-level still works but claude plugin validate warns. Direct hit on manifests/ork.json (we declare monitors top-level today)' },
  { feature: 'skill_overrides_setting',         minVersion: '2.1.129', description: 'skillOverrides setting works: off hides from model and /, user-invocable-only hides from model only, name-only collapses description — pairs with our disable-model-invocation: true skills (e.g. ork:brainstorm) by exposing a user-side equivalent' },
  { feature: 'gateway_model_discovery_optin',   minVersion: '2.1.129', description: 'Gateway /v1/models discovery for the /model picker is now opt-in via CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1 (was automatic in 2.1.126-2.1.128)' },
  { feature: 'plugin_url_flag',                 minVersion: '2.1.129', description: '--plugin-url <url> fetches a plugin .zip archive from a URL for the current session — enables hosted distribution beyond marketplace + --plugin-dir' },
  { feature: 'pull_request_count_mcp_tools',    minVersion: '2.1.129', description: 'claude_code.pull_request.count OTel metric now counts PRs/MRs created via MCP tools (e.g., gh MCP), not just shell commands — analytics undercount fix' },
  { feature: 'policy_refusal_request_id',       minVersion: '2.1.129', description: 'Policy refusal error messages now include the API Request ID — easier support debugging when org policy blocks a model' },
  { feature: 'context_no_grid_dump',            minVersion: '2.1.129', description: '/context no longer dumps its rendered ASCII grid into the conversation — saves ~1.6k tokens per call. Free win for any skill that introspects context.' },
  { feature: 'prompt_cache_1h_ttl_honored',     minVersion: '2.1.129', description: '1-hour prompt cache TTL is no longer silently downgraded to 5 minutes — long-running multi-agent skills can rely on the declared TTL' },
  { feature: 'bash_glob_allow_rules_in_project', minVersion: '2.1.129', description: 'Bash(mkdir *), Bash(touch *) and similar glob allow rules are now honored for in-project paths (regression fix). Affects settings.json policies that allow file-creation commands.' },
  // 2.1.132 (2026-05-06) — CLAUDE_CODE_SESSION_ID env var, statusline current-only, MCP retry, graceful SIGINT
  { feature: 'claude_code_session_id_env',      minVersion: '2.1.132', description: 'CLAUDE_CODE_SESSION_ID env var is now set in Bash tool subprocesses, matching the session_id passed to hooks — hooks that shell out can correlate spawned commands to the parent session without minting their own UUID' },
  { feature: 'mcp_tools_list_retry_once',       minVersion: '2.1.132', description: 'MCP servers that connect but fail tools/list now retry once and show "connected · tools fetch failed" in /mcp instead of silently appearing with 0 tools' },
  { feature: 'statusline_context_window_current', minVersion: '2.1.132', description: 'Statusline context_window token counts now reflect current context usage instead of cumulative session totals — custom statuslines reading this field need to verify they handle the new semantics' },
  { feature: 'mcp_unbounded_memory_fix',        minVersion: '2.1.132', description: 'Fixed unbounded memory growth (10GB+ RSS) when a stdio MCP server writes non-protocol data to stdout — stability fix for noisy MCP integrations' },
  { feature: 'external_sigint_graceful',        minVersion: '2.1.132', description: 'External SIGINT (IDE stop button, kill -INT) now runs graceful shutdown — terminal modes restored, --resume hint printed instead of an abrupt exit' },
  { feature: 'permission_mode_resume_plan',     minVersion: '2.1.132', description: '--permission-mode flag is honored when resuming a plan-mode session with -p --continue / --resume; plan mode is re-applied after ExitPlanMode within the same session' },
  { feature: 'effort_env_picker_fix',           minVersion: '2.1.132', description: '/effort picker reflects the CLAUDE_CODE_EFFORT_LEVEL env var override (was previously ignored)' },
  { feature: 'disable_alt_screen_env',          minVersion: '2.1.132', description: 'CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1 opts out of the fullscreen alternate-screen renderer and keeps the conversation in the terminal native scrollback — useful for screen-recording and CI capture' },
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

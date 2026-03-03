/**
 * CC Version Compatibility Matrix
 *
 * Runtime feature matrix for Claude Code version checking.
 * Used by doctor skill hooks and version-gated features.
 *
 * Keep in sync with: src/skills/doctor/references/version-compatibility.md
 */

export const MIN_CC_VERSION = '2.1.59';

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
  { feature: 'opus_46_fast_1m',        minVersion: '2.1.50', description: 'Opus 4.6 fast mode includes 1M context window' },
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

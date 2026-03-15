/**
 * Preset: project-config
 *
 * JSON Schema for Phase 3.5 steps 1-5 of the setup wizard.
 * Maps user selections to ORCHESTKIT_* env vars.
 */

export const projectConfigSchema = {
  type: 'object' as const,
  properties: {
    protected_branches: {
      type: 'string' as const,
      description: 'Which branches should block direct commits and pushes?',
      enum: ['main,master', 'main,master,dev', 'main'],
      default: 'main,master',
    },
    commit_scope: {
      type: 'string' as const,
      description:
        'How strictly should commit message scope be enforced? optional = both "feat: msg" and "feat(scope): msg" valid; required = scope mandatory; none = scope ignored.',
      enum: ['optional', 'required', 'none'],
      default: 'optional',
    },
    localhost_browser: {
      type: 'boolean' as const,
      description:
        'Allow agents to browse *.localhost URLs (RFC 6761 reserved TLD, cannot route externally)?',
      default: true,
    },
    perf_snapshots: {
      type: 'boolean' as const,
      description:
        'Write token-usage snapshots at session end? Used by /ork:assess and perf-compare.sh.',
      default: true,
    },
    log_level: {
      type: 'string' as const,
      description:
        'Hook log verbosity. warn = quiet (recommended), info = key events, debug = full trace.',
      enum: ['warn', 'info', 'debug'],
      default: 'warn',
    },
  },
  required: [
    'protected_branches',
    'commit_scope',
    'localhost_browser',
    'perf_snapshots',
    'log_level',
  ],
};

export const projectConfigMessage =
  'Configure OrchestKit project settings (steps 1-5 of the setup wizard)';

export interface ProjectConfigValues {
  protected_branches: string;
  commit_scope: string;
  localhost_browser: boolean;
  perf_snapshots: boolean;
  log_level: string;
}

/**
 * Maps form values to ORCHESTKIT_* env vars.
 */
export function mapProjectConfigToEnv(
  values: ProjectConfigValues,
): Record<string, string> {
  return {
    ORCHESTKIT_PROTECTED_BRANCHES: values.protected_branches,
    ORCHESTKIT_COMMIT_SCOPE: values.commit_scope,
    ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST: values.localhost_browser
      ? '1'
      : '0',
    ORCHESTKIT_PERF_SNAPSHOT_ENABLED: values.perf_snapshots ? '1' : '0',
    ORCHESTKIT_LOG_LEVEL: values.log_level,
  };
}

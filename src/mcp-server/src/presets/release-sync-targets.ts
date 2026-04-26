/**
 * Preset: release-sync-targets
 *
 * Form schema for `ork:release-sync` target selection (M118 #1468).
 * Replaces 3 sequential AskUserQuestion calls with one checkbox form.
 *
 * IMPORTANT — all targets default to `false`. OrchestKit is an open-source
 * plugin; the targets (NotebookLM notebook IDs, HQ KB, Slack channels) are
 * USER-PRIVATE infrastructure that the plugin cannot assume is configured.
 * Users explicitly opt in per release; the form pre-checks nothing.
 */

export const releaseSyncTargetsSchema = {
  type: 'object' as const,
  properties: {
    notebooklm: {
      type: 'boolean' as const,
      description:
        'Push the release digest to NotebookLM (requires user-configured notebook ID in .claude/release-sync-config.json).',
      default: false,
    },
    hq_kb: {
      type: 'boolean' as const,
      description:
        'Ingest into a private HQ knowledge base (requires HQ MCP — user-private infra, off by default).',
      default: false,
    },
    slack: {
      type: 'boolean' as const,
      description:
        'Announce the release in a configured Slack channel (off by default).',
      default: false,
    },
    notes: {
      type: 'string' as const,
      description:
        'Extra release notes appended to the digest before sync (optional).',
      default: '',
    },
  },
  required: ['notebooklm', 'hq_kb', 'slack'],
};

export const releaseSyncTargetsMessage =
  'Where should this release sync? (NotebookLM / HQ KB / Slack — pick any combination.)';

export interface ReleaseSyncTargetsValues {
  notebooklm: boolean;
  hq_kb: boolean;
  slack: boolean;
  notes: string;
}

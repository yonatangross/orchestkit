/**
 * Preset: release-sync-targets
 *
 * Form schema for `ork:release-sync` target selection (M118 #1468).
 * Replaces 3 sequential AskUserQuestion calls with one checkbox form.
 */

export const releaseSyncTargetsSchema = {
  type: 'object' as const,
  properties: {
    notebooklm: {
      type: 'boolean' as const,
      description:
        'Push the release digest to NotebookLM (updates the OrchestKit notebook sources).',
      default: true,
    },
    hq_kb: {
      type: 'boolean' as const,
      description:
        'Ingest into the HQ knowledge base (assumes HQ MCP is configured).',
      default: true,
    },
    slack: {
      type: 'boolean' as const,
      description: 'Announce the release in the configured Slack channel.',
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

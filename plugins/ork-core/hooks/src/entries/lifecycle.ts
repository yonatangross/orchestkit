/**
 * Lifecycle Hooks Entry Point
 *
 * Hooks that run on session start/end (SessionStart, SessionEnd)
 * Bundle: lifecycle.mjs (~30 KB estimated)
 */

// Re-export types and utilities
export * from '../types.js';
export * from '../lib/common.js';
export * from '../lib/git.js';

// Lifecycle hooks (18) - SessionStart/SessionEnd
import { analyticsConsentCheck } from '../lifecycle/analytics-consent-check.js';
import { coordinationCleanup } from '../lifecycle/coordination-cleanup.js';
import { coordinationInit } from '../lifecycle/coordination-init.js';
import { instanceHeartbeat } from '../lifecycle/instance-heartbeat.js';
import { mem0AnalyticsTracker } from '../lifecycle/mem0-analytics-tracker.js';
import { mem0ContextRetrieval } from '../lifecycle/mem0-context-retrieval.js';
import { mem0WebhookSetup } from '../lifecycle/mem0-webhook-setup.js';
import { multiInstanceInit } from '../lifecycle/multi-instance-init.js';
import { patternSyncPull } from '../lifecycle/pattern-sync-pull.js';
import { patternSyncPush } from '../lifecycle/pattern-sync-push.js';
import { prStatusEnricher } from '../lifecycle/pr-status-enricher.js';
import { sessionCleanup } from '../lifecycle/session-cleanup.js';
import { sessionContextLoader } from '../lifecycle/session-context-loader.js';
import { sessionEnvSetup } from '../lifecycle/session-env-setup.js';
import { sessionMetricsSummary } from '../lifecycle/session-metrics-summary.js';
import { dependencyVersionCheck } from '../lifecycle/dependency-version-check.js';
import { unifiedSessionStartDispatcher } from '../lifecycle/unified-dispatcher.js';

import type { HookFn } from '../types.js';

/**
 * Lifecycle hooks registry
 */
export const hooks: Record<string, HookFn> = {
  'lifecycle/analytics-consent-check': analyticsConsentCheck,
  'lifecycle/coordination-cleanup': coordinationCleanup,
  'lifecycle/coordination-init': coordinationInit,
  'lifecycle/instance-heartbeat': instanceHeartbeat,
  'lifecycle/mem0-analytics-tracker': mem0AnalyticsTracker,
  'lifecycle/mem0-context-retrieval': mem0ContextRetrieval,
  'lifecycle/mem0-webhook-setup': mem0WebhookSetup,
  'lifecycle/multi-instance-init': multiInstanceInit,
  'lifecycle/pattern-sync-pull': patternSyncPull,
  'lifecycle/pattern-sync-push': patternSyncPush,
  'lifecycle/pr-status-enricher': prStatusEnricher,
  'lifecycle/session-cleanup': sessionCleanup,
  'lifecycle/session-context-loader': sessionContextLoader,
  'lifecycle/session-env-setup': sessionEnvSetup,
  'lifecycle/session-metrics-summary': sessionMetricsSummary,
  'lifecycle/dependency-version-check': dependencyVersionCheck,
  'lifecycle/unified-dispatcher': unifiedSessionStartDispatcher,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}

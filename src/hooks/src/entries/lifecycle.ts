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

// Lifecycle hooks (13) - SessionStart/SessionEnd
import { analyticsConsentCheck } from '../lifecycle/analytics-consent-check.js';
import { patternSyncPull } from '../lifecycle/pattern-sync-pull.js';
import { patternSyncPush } from '../lifecycle/pattern-sync-push.js';
import { prStatusEnricher } from '../lifecycle/pr-status-enricher.js';
import { sessionCleanup } from '../lifecycle/session-cleanup.js';
import { sessionContextLoader } from '../lifecycle/session-context-loader.js';
import { sessionEnvSetup } from '../lifecycle/session-env-setup.js';
import { sessionTracking } from '../lifecycle/session-tracking.js';
import { sessionMetricsSummary } from '../lifecycle/session-metrics-summary.js';
import { dependencyVersionCheck } from '../lifecycle/dependency-version-check.js';
import { unifiedSessionStartDispatcher } from '../lifecycle/unified-dispatcher.js';
import { preCompactSaver } from '../lifecycle/pre-compact-saver.js';
import { prefillGuard } from '../lifecycle/prefill-guard.js';
import { mcpHealthCheck } from '../lifecycle/mcp-health-check.js';
import { syncSessionDispatcher } from '../lifecycle/sync-session-dispatcher.js';

// TeammateIdle hooks (CC 2.1.33) — consolidated into unified dispatcher (#853)
import { progressReporter } from '../teammate-idle/progress-reporter.js';
import { teamSynthesisTrigger } from '../teammate-idle/team-synthesis-trigger.js';
import { teamQualityGate } from '../teammate-idle/team-quality-gate.js';
import { unifiedTeammateIdleDispatcher } from '../teammate-idle/unified-dispatcher.js';

// TaskCompleted hooks (CC 2.1.33)
import { completionTracker } from '../task-completed/completion-tracker.js';

// WorktreeCreate/WorktreeRemove hooks (CC 2.1.50)
import { worktreeLifecycleLogger } from '../worktree/worktree-lifecycle-logger.js';

// ConfigChange hooks (CC 2.1.50)
import { settingsReload } from '../config-change/settings-reload.js';

import type { HookFn } from '../types.js';

/**
 * Lifecycle hooks registry
 */
export const hooks: Record<string, HookFn> = {
  'lifecycle/analytics-consent-check': analyticsConsentCheck,
  'lifecycle/pattern-sync-pull': patternSyncPull,
  'lifecycle/pattern-sync-push': patternSyncPush,
  'lifecycle/pr-status-enricher': prStatusEnricher,
  'lifecycle/session-cleanup': sessionCleanup,
  'lifecycle/session-context-loader': sessionContextLoader,
  'lifecycle/session-env-setup': sessionEnvSetup,
  'lifecycle/session-tracking': sessionTracking,
  'lifecycle/session-metrics-summary': sessionMetricsSummary,
  'lifecycle/dependency-version-check': dependencyVersionCheck,
  'lifecycle/unified-dispatcher': unifiedSessionStartDispatcher,
  'lifecycle/pre-compact-saver': preCompactSaver,
  'lifecycle/prefill-guard': prefillGuard,
  'lifecycle/mcp-health-check': mcpHealthCheck,
  'lifecycle/sync-session-dispatcher': syncSessionDispatcher,

  // TeammateIdle hooks (CC 2.1.33)
  'teammate-idle/unified-dispatcher': unifiedTeammateIdleDispatcher,
  'teammate-idle/progress-reporter': progressReporter,
  'teammate-idle/team-synthesis-trigger': teamSynthesisTrigger,
  'teammate-idle/team-quality-gate': teamQualityGate,

  // TaskCompleted hooks (CC 2.1.33)
  'task-completed/completion-tracker': completionTracker,

  // WorktreeCreate/WorktreeRemove hooks (CC 2.1.50)
  'worktree/worktree-lifecycle-logger': worktreeLifecycleLogger,

  // ConfigChange hooks (CC 2.1.50)
  'config-change/settings-reload': settingsReload,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}

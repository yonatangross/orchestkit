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

// Lifecycle hooks (15) - SessionStart/SessionEnd/Stop
import { analyticsConsentCheck } from '../lifecycle/analytics-consent-check.js';
import { patternSyncPull } from '../lifecycle/pattern-sync-pull.js';
import { patternSyncPush } from '../lifecycle/pattern-sync-push.js';
import { sessionCleanup } from '../lifecycle/session-cleanup.js';
import { cwdChanged } from '../lifecycle/cwd-changed.js';
import { fileChanged } from '../lifecycle/file-changed.js';
import { sessionEnvSetup } from '../lifecycle/session-env-setup.js';
import { sessionTracking } from '../lifecycle/session-tracking.js';
import { sessionMetricsSummary } from '../lifecycle/session-metrics-summary.js';
import { dependencyVersionCheck } from '../lifecycle/dependency-version-check.js';
import { unifiedSessionStartDispatcher } from '../lifecycle/unified-dispatcher.js';
import { preCompactSaver } from '../lifecycle/pre-compact-saver.js';
import { prefillGuard } from '../lifecycle/prefill-guard.js';
import { mcpHealthCheck } from '../lifecycle/mcp-health-check.js';
import { syncSessionDispatcher } from '../lifecycle/sync-session-dispatcher.js';
import { syncSessionEndDispatcher } from '../lifecycle/sync-session-end-dispatcher.js';
import { usageSummaryReporter } from '../lifecycle/usage-summary-reporter.js';
import { webhookForwarder } from '../lifecycle/webhook-forwarder.js';
import { sessionHandoffGenerator } from '../lifecycle/session-handoff-generator.js';
import { sessionHandoffInjector } from '../lifecycle/session-handoff-injector.js';

// TeammateIdle hooks (CC 2.1.33) — consolidated into unified dispatcher (#853)
import { progressReporter } from '../teammate-idle/progress-reporter.js';
import { teamSynthesisTrigger } from '../teammate-idle/team-synthesis-trigger.js';
import { teamQualityGate } from '../teammate-idle/team-quality-gate.js';
import { unifiedTeammateIdleDispatcher } from '../teammate-idle/unified-dispatcher.js';

// TaskCreated hooks (CC 2.1.84)
import { creationTracker } from '../task-created/creation-tracker.js';
// taskContextInjector removed — unregistered to reduce hook count (#optimization)
import { taskProgressInitializer } from '../task-created/task-progress-initializer.js';

// TaskCompleted hooks (CC 2.1.33)
import { completionTracker } from '../task-completed/completion-tracker.js';
import { taskCommitLinker } from '../task-completed/task-commit-linker.js';
import { taskProgressTracker } from '../task-completed/task-progress-tracker.js';

// WorktreeCreate/WorktreeRemove hooks (CC 2.1.50)
import { worktreeLifecycleLogger } from '../worktree/worktree-lifecycle-logger.js';

// ConfigChange hooks (CC 2.1.50)
import { settingsReload } from '../config-change/settings-reload.js';

// InstructionsLoaded hooks (CC 2.1.69)
import { instructionsLoadedDispatcher } from '../instructions-loaded/instructions-loaded-dispatcher.js';

// PostCompact hooks (CC 2.1.76)
import { postCompactRecovery } from '../lifecycle/post-compact-recovery.js';
import { staleCacheCleanup } from '../lifecycle/stale-cache-cleanup.js';

// Elicitation hooks (CC 2.1.76)
import { elicitationGuard } from '../elicitation/elicitation-guard.js';
import { elicitationResultLogger } from '../elicitation/elicitation-result-logger.js';

import type { HookFn } from '../types.js';

/**
 * Lifecycle hooks registry
 */
export const hooks: Record<string, HookFn> = {
  'lifecycle/analytics-consent-check': analyticsConsentCheck,
  'lifecycle/pattern-sync-pull': patternSyncPull,
  'lifecycle/pattern-sync-push': patternSyncPush,
  'lifecycle/session-cleanup': sessionCleanup,
  'lifecycle/cwd-changed': cwdChanged,
  'lifecycle/file-changed': fileChanged,
  'lifecycle/session-env-setup': sessionEnvSetup,
  'lifecycle/session-tracking': sessionTracking,
  'lifecycle/session-metrics-summary': sessionMetricsSummary,
  'lifecycle/dependency-version-check': dependencyVersionCheck,
  'lifecycle/unified-dispatcher': unifiedSessionStartDispatcher,
  'lifecycle/pre-compact-saver': preCompactSaver,
  'lifecycle/prefill-guard': prefillGuard,
  'lifecycle/mcp-health-check': mcpHealthCheck,
  'lifecycle/sync-session-dispatcher': syncSessionDispatcher,
  'lifecycle/sync-session-end-dispatcher': syncSessionEndDispatcher,
  'lifecycle/usage-summary-reporter': usageSummaryReporter,
  'lifecycle/webhook-forwarder': webhookForwarder,
  'lifecycle/session-handoff-generator': sessionHandoffGenerator,
  'lifecycle/session-handoff-injector': sessionHandoffInjector,

  // TeammateIdle hooks (CC 2.1.33)
  'teammate-idle/unified-dispatcher': unifiedTeammateIdleDispatcher,
  'teammate-idle/progress-reporter': progressReporter,
  'teammate-idle/team-synthesis-trigger': teamSynthesisTrigger,
  'teammate-idle/team-quality-gate': teamQualityGate,

  // TaskCreated hooks (CC 2.1.84)
  'task-created/creation-tracker': creationTracker,
  // task-context-injector removed — unregistered to reduce hook count
  'task-created/task-progress-initializer': taskProgressInitializer,

  // TaskCompleted hooks (CC 2.1.33)
  'task-completed/completion-tracker': completionTracker,
  'task-completed/task-commit-linker': taskCommitLinker,
  'task-completed/task-progress-tracker': taskProgressTracker,

  // WorktreeCreate/WorktreeRemove hooks (CC 2.1.50)
  'worktree/worktree-lifecycle-logger': worktreeLifecycleLogger,

  // ConfigChange hooks (CC 2.1.50)
  'config-change/settings-reload': settingsReload,

  // InstructionsLoaded hooks (CC 2.1.69)
  'instructions-loaded/instructions-loaded-dispatcher': instructionsLoadedDispatcher,

  // Cache management
  'lifecycle/stale-cache-cleanup': staleCacheCleanup,

  // PostCompact hooks (CC 2.1.76)
  'lifecycle/post-compact-recovery': postCompactRecovery,

  // Elicitation hooks (CC 2.1.76)
  'elicitation/elicitation-guard': elicitationGuard,
  'elicitation/elicitation-result-logger': elicitationResultLogger,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}

/**
 * Stop Hooks Entry Point
 *
 * Hooks that run when conversation stops (Stop event)
 * Bundle: stop.mjs (~25 KB estimated)
 */

// Re-export types and utilities
export * from '../types.js';
export * from '../lib/common.js';

// Stop hooks (9) + StopFailure handler (CC 2.1.78)
import { handoffWriter } from '../stop/handoff-writer.js';
import { fullTestSuite } from '../stop/full-test-suite.js';
import { issueWorkSummary } from '../stop/issue-work-summary.js';
import { securityScanAggregator } from '../stop/security-scan-aggregator.js';
import { taskCompletionCheck } from '../stop/task-completion-check.js';
import { unifiedStopDispatcher } from '../stop/unified-dispatcher.js';
import { stopFailureHandler } from '../stop/stop-failure-handler.js';

// Intelligent Decision Capture System
import { workflowPreferenceLearner } from '../stop/workflow-preference-learner.js';
import { sessionEndTracking } from '../stop/session-end-tracking.js';
// Graph-first session summary (replaces memory-capture.ts)
import { sessionSummary } from '../stop/session-summary.js';

import type { HookFn } from '../types.js';

/**
 * Stop hooks registry
 */
export const hooks: Record<string, HookFn> = {
  'stop/handoff-writer': handoffWriter,
  'stop/full-test-suite': fullTestSuite,
  'stop/issue-work-summary': issueWorkSummary,
  'stop/security-scan-aggregator': securityScanAggregator,
  'stop/task-completion-check': taskCompletionCheck,
  'stop/unified-dispatcher': unifiedStopDispatcher,
  'stop/stop-failure-handler': stopFailureHandler,
  // Intelligent Decision Capture System
  'stop/workflow-preference-learner': workflowPreferenceLearner,
  'stop/session-end-tracking': sessionEndTracking,
  'stop/session-summary': sessionSummary,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}

// Phase 4: HookContext DI
export { buildContext } from '../lib/context.js';

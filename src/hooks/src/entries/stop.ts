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
import { securityScanAggregator } from '../stop/security-scan-aggregator.js';
import { taskCompletionCheck } from '../stop/task-completion-check.js';
import { stopFailureHandler } from '../stop/stop-failure-handler.js';
import { ledgerCleanup } from '../stop/ledger-cleanup.js';

// Intelligent Decision Capture System
// #1885 — cross-session state bus finalizer (companion to posttool publisher)
import { sessionHeartbeatFinalizer } from '../stop/session-heartbeat-finalizer.js';
// Graph-first session summary (replaces memory-capture.ts)
import { sessionSummary } from '../stop/session-summary.js';

// M140 G3 (#1790) — /goal convergence telemetry stop hook
import { goalTrackerStop } from '../stop/goal-tracker.js';

import type { HookFn } from '../types.js';

/**
 * Stop hooks registry
 */
export const hooks: Record<string, HookFn> = {
  'stop/handoff-writer': handoffWriter,
  'stop/security-scan-aggregator': securityScanAggregator,
  'stop/task-completion-check': taskCompletionCheck,
  'stop/stop-failure-handler': stopFailureHandler,
  'stop/ledger-cleanup': ledgerCleanup,
  // Intelligent Decision Capture System
  // #1885 — marks status=completed in cross-session state bus
  'stop/session-heartbeat-finalizer': sessionHeartbeatFinalizer,
  'stop/session-summary': sessionSummary,
  // M140 G3 (#1790) — /goal convergence telemetry stop hook
  'stop/goal-tracker': goalTrackerStop,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}

// Phase 4: HookContext DI
export { buildContext } from '../lib/context.js';

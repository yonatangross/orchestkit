/**
 * Stop Hooks Entry Point
 *
 * Hooks that run when conversation stops (Stop event)
 * Bundle: stop.mjs (~25 KB estimated)
 */

// Re-export types and utilities
export * from '../types.js';
export * from '../lib/common.js';

// Re-export calibration engine for stop hooks
export * from '../lib/calibration-engine.js';

// Stop hooks (12)
import { autoRememberContinuity } from '../stop/auto-remember-continuity.js';
import { autoSaveContext } from '../stop/auto-save-context.js';
import { cleanupInstance } from '../stop/cleanup-instance.js';
import { contextCompressor } from '../stop/context-compressor.js';
import { fullTestSuite } from '../stop/full-test-suite.js';
import { issueWorkSummary } from '../stop/issue-work-summary.js';
import { mem0PreCompactionSync } from '../stop/mem0-pre-compaction-sync.js';
import { multiInstanceCleanup } from '../stop/multi-instance-cleanup.js';
import { securityScanAggregator } from '../stop/security-scan-aggregator.js';
import { sessionPatterns } from '../stop/session-patterns.js';
import { taskCompletionCheck } from '../stop/task-completion-check.js';
import { calibrationPersist } from '../stop/calibration-persist.js';

import type { HookFn } from '../types.js';

/**
 * Stop hooks registry
 */
export const hooks: Record<string, HookFn> = {
  'stop/auto-remember-continuity': autoRememberContinuity,
  'stop/auto-save-context': autoSaveContext,
  'stop/cleanup-instance': cleanupInstance,
  'stop/context-compressor': contextCompressor,
  'stop/full-test-suite': fullTestSuite,
  'stop/issue-work-summary': issueWorkSummary,
  'stop/mem0-pre-compaction-sync': mem0PreCompactionSync,
  'stop/multi-instance-cleanup': multiInstanceCleanup,
  'stop/security-scan-aggregator': securityScanAggregator,
  'stop/session-patterns': sessionPatterns,
  'stop/task-completion-check': taskCompletionCheck,
  'stop/calibration-persist': calibrationPersist,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}

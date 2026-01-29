/**
 * Unified Stop Dispatcher
 * Issue #235: Hook Architecture Refactor
 *
 * Consolidates 4 async Stop hooks into a single dispatcher.
 * Reduces "Async hook Stop completed" messages from 4 to 1.
 *
 * CC 2.1.19 Compliant: Single async hook with internal routing
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';

// Import individual hook implementations
import { autoSaveContext } from './auto-save-context.js';
import { sessionPatterns } from './session-patterns.js';
import { issueWorkSummary } from './issue-work-summary.js';
import { calibrationPersist } from './calibration-persist.js';
import { sessionProfileAggregator } from './session-profile-aggregator.js';
import { sessionEndTracking } from './session-end-tracking.js';
// Issue #245: GAP-001 & GAP-002 - Wire missing tracking hooks
import { graphQueueSync } from './graph-queue-sync.js';
import { workflowPreferenceLearner } from './workflow-preference-learner.js';
// Issue #245: GAP-006 - mem0 cloud memory sync
import { mem0QueueSync } from './mem0-queue-sync.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type HookFn = (input: HookInput) => HookResult | Promise<HookResult>;

interface HookConfig {
  name: string;
  fn: HookFn;
}

// -----------------------------------------------------------------------------
// Hook Registry
// -----------------------------------------------------------------------------

/**
 * Registry of all async Stop hooks consolidated into dispatcher
 * Issue #245: Added graph-queue-sync (GAP-001) and workflow-preference-learner (GAP-002)
 */
const HOOKS: HookConfig[] = [
  { name: 'auto-save-context', fn: autoSaveContext },
  { name: 'session-patterns', fn: sessionPatterns },
  { name: 'issue-work-summary', fn: issueWorkSummary },
  { name: 'calibration-persist', fn: calibrationPersist },
  { name: 'session-profile-aggregator', fn: sessionProfileAggregator },
  { name: 'session-end-tracking', fn: sessionEndTracking },
  // Issue #245 GAP-001: Graph memory sync - processes queued entity/relation operations
  { name: 'graph-queue-sync', fn: graphQueueSync },
  // Issue #245 GAP-002: Workflow preference learning - tracks user's development patterns
  { name: 'workflow-preference-learner', fn: workflowPreferenceLearner },
  // Issue #245 GAP-006: mem0 cloud sync - processes queued memories to mem0 (gated by MEM0_API_KEY)
  { name: 'mem0-queue-sync', fn: mem0QueueSync },
];

/** Exposed for registry wiring tests */
export const registeredHookNames = () => HOOKS.map(h => h.name);

// -----------------------------------------------------------------------------
// Dispatcher Implementation
// -----------------------------------------------------------------------------

/**
 * Unified dispatcher that runs all Stop hooks in parallel
 */
export async function unifiedStopDispatcher(input: HookInput): Promise<HookResult> {
  // Run all hooks in parallel
  const results = await Promise.allSettled(
    HOOKS.map(async hook => {
      try {
        const result = hook.fn(input);
        if (result instanceof Promise) {
          await result;
        }
        return { hook: hook.name, status: 'success' };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logHook('stop-dispatcher', `${hook.name} failed: ${message}`);
        return { hook: hook.name, status: 'error', message };
      }
    })
  );

  // Log summary for debugging (only errors)
  const errors = results.filter(
    r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 'error')
  );

  if (errors.length > 0) {
    logHook('stop-dispatcher', `${errors.length}/${HOOKS.length} hooks had errors`);
  }

  return outputSilentSuccess();
}

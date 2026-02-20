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

// Import individual stop hook implementations
import { autoSaveContext } from './auto-save-context.js';
import { sessionPatterns } from './session-patterns.js';
import { issueWorkSummary } from './issue-work-summary.js';
import { calibrationPersist } from './calibration-persist.js';
import { sessionProfileAggregator } from './session-profile-aggregator.js';
import { sessionEndTracking } from './session-end-tracking.js';
// Issue #245: GAP-002 - Wire missing tracking hooks
import { workflowPreferenceLearner } from './workflow-preference-learner.js';
// Issue #243: Additional stop hooks previously run separately
import { taskCompletionCheck } from './task-completion-check.js';
import { autoRememberContinuity } from './auto-remember-continuity.js';
import { fullTestSuite } from './full-test-suite.js';
import { securityScanAggregator } from './security-scan-aggregator.js';

// Import skill hooks that run at stop time
import { coverageCheck } from '../skill/coverage-check.js';
import { evidenceCollector } from '../skill/evidence-collector.js';
import { coverageThresholdGate } from '../skill/coverage-threshold-gate.js';
import { crossInstanceTestValidator } from '../skill/cross-instance-test-validator.js';
import { diPatternEnforcer } from '../skill/di-pattern-enforcer.js';
import { duplicateCodeDetector } from '../skill/duplicate-code-detector.js';
import { evalMetricsCollector } from '../skill/eval-metrics-collector.js';
import { migrationValidator } from '../skill/migration-validator.js';
import { reviewSummaryGenerator } from '../skill/review-summary-generator.js';
import { securitySummary } from '../skill/security-summary.js';
import { testPatternValidator } from '../skill/test-pattern-validator.js';
import { testRunner } from '../skill/test-runner.js';

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
 * Registry of all Stop hooks consolidated into dispatcher
 * Issue #243: Fire-and-forget pattern - all 21 hooks run in background
 * Issue #245: Added graph-queue-sync (GAP-001) and workflow-preference-learner (GAP-002)
 */
const HOOKS: HookConfig[] = [
  // --- Core session hooks ---
  { name: 'auto-save-context', fn: autoSaveContext },
  { name: 'session-patterns', fn: sessionPatterns },
  { name: 'issue-work-summary', fn: issueWorkSummary },
  { name: 'calibration-persist', fn: calibrationPersist },
  { name: 'session-profile-aggregator', fn: sessionProfileAggregator },
  { name: 'session-end-tracking', fn: sessionEndTracking },

  // --- Memory sync hooks ---
  { name: 'workflow-preference-learner', fn: workflowPreferenceLearner },

  // --- Instance management hooks ---
  { name: 'task-completion-check', fn: taskCompletionCheck },

  // --- Analysis hooks ---
  { name: 'auto-remember-continuity', fn: autoRememberContinuity },
  { name: 'security-scan-aggregator', fn: securityScanAggregator },

  // --- Skill validation hooks (run at stop time) ---
  { name: 'coverage-check', fn: coverageCheck },
  { name: 'evidence-collector', fn: evidenceCollector },
  { name: 'coverage-threshold-gate', fn: coverageThresholdGate },
  { name: 'cross-instance-test-validator', fn: crossInstanceTestValidator },
  { name: 'di-pattern-enforcer', fn: diPatternEnforcer },
  { name: 'duplicate-code-detector', fn: duplicateCodeDetector },
  { name: 'eval-metrics-collector', fn: evalMetricsCollector },
  { name: 'migration-validator', fn: migrationValidator },
  { name: 'review-summary-generator', fn: reviewSummaryGenerator },
  { name: 'security-summary', fn: securitySummary },
  { name: 'test-pattern-validator', fn: testPatternValidator },
  { name: 'test-runner', fn: testRunner },

  // --- Heavy analysis hooks (run last, optional) ---
  { name: 'full-test-suite', fn: fullTestSuite },
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
  // Prevent infinite re-entry (CC 2.1.25: stop_hook_active)
  if (input.stop_hook_active) {
    logHook('stop-dispatcher', 'Skipping: stop_hook_active=true (re-entry prevention)');
    return outputSilentSuccess();
  }

  // CC 2.1.49: Log last assistant message snippet for audit trail
  if (input.last_assistant_message) {
    const snippet = input.last_assistant_message.substring(0, 200);
    logHook('stop-dispatcher', `last_assistant_message (first 200): ${snippet}`);
  }

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

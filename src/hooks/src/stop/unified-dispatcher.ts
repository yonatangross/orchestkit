/**
 * Unified Stop Dispatcher
 * Issue #235: Hook Architecture Refactor
 *
 * Consolidates async Stop hooks into a single dispatcher.
 * Reduces "Async hook Stop completed" messages to 1.
 *
 * CC 2.1.19 Compliant: Single async hook with internal routing
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';

// Import individual stop hook implementations
import { handoffWriter } from './handoff-writer.js';
// Issue #243: Additional stop hooks previously run separately
import { taskCompletionCheck } from './task-completion-check.js';
import { securityScanAggregator } from './security-scan-aggregator.js';
// Session summary — graph-first memory capture (replaces memory-capture.ts)
import { sessionSummary } from './session-summary.js';

// Import skill hooks that run at stop time
import { coverageCheck } from '../skill/coverage-check.js';
import { evidenceCollector } from '../skill/evidence-collector.js';
import { coverageThresholdGate } from '../skill/coverage-threshold-gate.js';
import { crossInstanceTestValidator } from '../skill/cross-instance-test-validator.js';

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
 * Issue #243: Fire-and-forget pattern - all 8 hooks run in background
 * Analytics hooks removed — now handled by HQ content pipeline
 */
const HOOKS: HookConfig[] = [
  // --- Core session hooks ---
  { name: 'handoff-writer', fn: handoffWriter },
  { name: 'session-summary', fn: sessionSummary },

  // --- Instance management hooks ---
  { name: 'task-completion-check', fn: taskCompletionCheck },

  // --- Analysis hooks ---
  { name: 'security-scan-aggregator', fn: securityScanAggregator },

  // --- Skill validation hooks (run at stop time) ---
  { name: 'coverage-check', fn: coverageCheck },
  { name: 'evidence-collector', fn: evidenceCollector },
  { name: 'coverage-threshold-gate', fn: coverageThresholdGate },
  { name: 'cross-instance-test-validator', fn: crossInstanceTestValidator },
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

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
 */
const HOOKS: HookConfig[] = [
  { name: 'auto-save-context', fn: autoSaveContext },
  { name: 'session-patterns', fn: sessionPatterns },
  { name: 'issue-work-summary', fn: issueWorkSummary },
  { name: 'calibration-persist', fn: calibrationPersist },
];

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

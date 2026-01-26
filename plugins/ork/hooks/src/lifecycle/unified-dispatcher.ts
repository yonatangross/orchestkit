/**
 * Unified SessionStart Dispatcher
 * Issue #235: Hook Architecture Refactor
 * Issue #239: Move initialization hooks to Setup event
 *
 * Consolidates session-specific async hooks into a single dispatcher.
 * Reduces "Async hook SessionStart completed" messages.
 *
 * Note: One-time initialization hooks (dependency-version-check,
 * mem0-webhook-setup, coordination-init) moved to Setup dispatcher
 * in Issue #239 - they only need to run once at plugin load.
 *
 * CC 2.1.19 Compliant: Single async hook with internal routing
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';

// Import session-specific hook implementations
// Note: dependency-version-check, mem0-webhook-setup, coordination-init
// moved to setup/unified-dispatcher.ts (Issue #239)
import { mem0ContextRetrieval } from './mem0-context-retrieval.js';
import { mem0AnalyticsTracker } from './mem0-analytics-tracker.js';
import { patternSyncPull } from './pattern-sync-pull.js';
import { multiInstanceInit } from './multi-instance-init.js';
import { instanceHeartbeat } from './instance-heartbeat.js';
import { sessionEnvSetup } from './session-env-setup.js';

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
 * Registry of session-specific async SessionStart hooks
 * One-time initialization hooks moved to Setup dispatcher (Issue #239)
 */
const HOOKS: HookConfig[] = [
  { name: 'mem0-context-retrieval', fn: mem0ContextRetrieval },
  { name: 'mem0-analytics-tracker', fn: mem0AnalyticsTracker },
  { name: 'pattern-sync-pull', fn: patternSyncPull },
  { name: 'multi-instance-init', fn: multiInstanceInit },
  { name: 'instance-heartbeat', fn: instanceHeartbeat },
  { name: 'session-env-setup', fn: sessionEnvSetup },
];

// -----------------------------------------------------------------------------
// Dispatcher Implementation
// -----------------------------------------------------------------------------

/**
 * Unified dispatcher that runs all SessionStart hooks in parallel
 */
export async function unifiedSessionStartDispatcher(input: HookInput): Promise<HookResult> {
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
        logHook('session-start-dispatcher', `${hook.name} failed: ${message}`);
        return { hook: hook.name, status: 'error', message };
      }
    })
  );

  // Collect failures for reporting
  const failures: Array<{ hook: string; message: string }> = [];

  for (const result of results) {
    if (result.status === 'rejected') {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failures.push({ hook: 'unknown', message: reason });
    } else if (result.value.status === 'error') {
      failures.push({ hook: result.value.hook, message: result.value.message || 'Unknown error' });
    }
  }

  // On failure: return informative message visible to user
  if (failures.length > 0) {
    const failedNames = failures.map(f => f.hook).join(', ');
    logHook('session-start-dispatcher', `${failures.length}/${HOOKS.length} hooks failed: ${failedNames}`);

    return {
      continue: true,
      systemMessage: `⚠️ SessionStart: ${failures.length}/${HOOKS.length} hooks failed (${failedNames})`
    };
  }

  // On success: silent (no extra output)
  return outputSilentSuccess();
}

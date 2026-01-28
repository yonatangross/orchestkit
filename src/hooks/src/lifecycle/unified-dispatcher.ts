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
 *
 * NOTE: Async hooks are fire-and-forget by design. They can only return
 * { async: true, asyncTimeout } - fields like systemMessage, continue,
 * decision are NOT processed by Claude Code for async hooks.
 * Failures are logged to file but not surfaced to users.
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
import { sessionTracking } from './session-tracking.js';

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
  { name: 'session-tracking', fn: sessionTracking },
];

/** Exposed for registry wiring tests */
export const registeredHookNames = () => HOOKS.map(h => h.name);

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

  // Count failures for logging (async hooks can't report to users)
  const failures: string[] = [];

  for (const result of results) {
    if (result.status === 'rejected') {
      failures.push('unknown');
    } else if (result.value.status === 'error') {
      failures.push(result.value.hook);
    }
  }

  // Log failures (async hooks are fire-and-forget - can't surface to users)
  if (failures.length > 0) {
    logHook('session-start-dispatcher', `${failures.length}/${HOOKS.length} hooks failed: ${failures.join(', ')}`);
  }

  // Async hooks always return silent success - CC ignores other fields
  return outputSilentSuccess();
}

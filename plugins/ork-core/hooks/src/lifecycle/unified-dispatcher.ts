/**
 * Unified SessionStart Dispatcher
 * Issue #235: Hook Architecture Refactor
 *
 * Consolidates 7 async SessionStart hooks into a single dispatcher.
 * Reduces "Async hook SessionStart completed" messages from 7 to 1.
 *
 * CC 2.1.19 Compliant: Single async hook with internal routing
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';

// Import individual hook implementations (only hooks that exist as files)
import { mem0ContextRetrieval } from './mem0-context-retrieval.js';
import { mem0WebhookSetup } from './mem0-webhook-setup.js';
import { mem0AnalyticsTracker } from './mem0-analytics-tracker.js';
import { patternSyncPull } from './pattern-sync-pull.js';
import { coordinationInit } from './coordination-init.js';
import { dependencyVersionCheck } from './dependency-version-check.js';
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
 * Registry of all async SessionStart hooks consolidated into dispatcher
 */
const HOOKS: HookConfig[] = [
  { name: 'mem0-context-retrieval', fn: mem0ContextRetrieval },
  { name: 'mem0-webhook-setup', fn: mem0WebhookSetup },
  { name: 'mem0-analytics-tracker', fn: mem0AnalyticsTracker },
  { name: 'pattern-sync-pull', fn: patternSyncPull },
  { name: 'coordination-init', fn: coordinationInit },
  { name: 'dependency-version-check', fn: dependencyVersionCheck },
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

  // Log summary for debugging (only errors)
  const errors = results.filter(
    r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 'error')
  );

  if (errors.length > 0) {
    logHook('session-start-dispatcher', `${errors.length}/${HOOKS.length} hooks had errors`);
  }

  return outputSilentSuccess();
}

/**
 * Unified Setup Dispatcher
 * Issue #239: Move initialization hooks to Setup event (CC 2.1.10)
 *
 * Consolidates one-time initialization hooks that only need to run
 * at plugin load, not every session.
 *
 * Migrated from SessionStart dispatcher:
 * - dependency-version-check (only needs once per plugin load)
 * - mem0-webhook-setup (only needs once per plugin load)
 * - coordination-init (can init at plugin load)
 *
 * CC 2.1.10+ Compliant: Uses Setup event for plugin-level initialization
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';

// Import hook implementations from lifecycle (they stay there, we just call them from Setup)
import { dependencyVersionCheck } from '../lifecycle/dependency-version-check.js';
import { mem0WebhookSetup } from '../lifecycle/mem0-webhook-setup.js';
import { coordinationInit } from '../lifecycle/coordination-init.js';

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
 * Registry of hooks that should run once at plugin load (Setup event)
 * These were previously in SessionStart but don't need session context
 */
const HOOKS: HookConfig[] = [
  { name: 'dependency-version-check', fn: dependencyVersionCheck },
  { name: 'mem0-webhook-setup', fn: mem0WebhookSetup },
  { name: 'coordination-init', fn: coordinationInit },
];

// -----------------------------------------------------------------------------
// Dispatcher Implementation
// -----------------------------------------------------------------------------

/**
 * Unified dispatcher that runs Setup hooks in parallel
 * Runs once at plugin load, not every session
 */
export async function unifiedSetupDispatcher(input: HookInput): Promise<HookResult> {
  logHook('setup-dispatcher', `Running ${HOOKS.length} Setup hooks in parallel`);

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
        logHook('setup-dispatcher', `${hook.name} failed: ${message}`);
        return { hook: hook.name, status: 'error', message };
      }
    })
  );

  // Log summary for debugging (only errors)
  const errors = results.filter(
    r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 'error')
  );

  if (errors.length > 0) {
    logHook('setup-dispatcher', `${errors.length}/${HOOKS.length} hooks had errors`);
  } else {
    logHook('setup-dispatcher', `All ${HOOKS.length} Setup hooks completed successfully`);
  }

  return outputSilentSuccess();
}

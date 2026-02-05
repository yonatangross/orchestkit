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
 *
 * NOTE: Async hooks are fire-and-forget by design. They can only return
 * { async: true, asyncTimeout } - fields like systemMessage, continue,
 * decision are NOT processed by Claude Code for async hooks.
 * Failures are logged to file but not surfaced to users.
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

/** Exposed for registry wiring tests */
export const registeredHookNames = () => HOOKS.map(h => h.name);

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
    logHook('setup-dispatcher', `${failures.length}/${HOOKS.length} hooks failed: ${failures.join(', ')}`);
  } else {
    logHook('setup-dispatcher', `All ${HOOKS.length} Setup hooks completed successfully`);
  }

  // Async hooks always return silent success - CC ignores other fields
  return outputSilentSuccess();
}

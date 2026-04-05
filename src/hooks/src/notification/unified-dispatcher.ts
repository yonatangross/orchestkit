/**
 * Unified Notification Dispatcher
 * Issue #235: Hook Architecture Refactor
 *
 * Consolidates 2 async Notification hooks into a single dispatcher.
 * Reduces "Async hook Notification completed" messages from 2 to 1.
 *
 * CC 2.1.19 Compliant: Single async hook with internal routing
 */

import type { HookInput, HookResult, HookFn , HookContext} from '../types.js';
import { outputSilentSuccess } from '../lib/common.js';

// Import individual hook implementations
import { desktopNotification } from './desktop.js';
import { soundNotification } from './sound.js';
import { NOOP_CTX } from '../lib/context.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface HookConfig {
  name: string;
  fn: HookFn;
}

// -----------------------------------------------------------------------------
// Hook Registry
// -----------------------------------------------------------------------------

/**
 * Registry of all async Notification hooks consolidated into dispatcher
 */
const HOOKS: HookConfig[] = [
  { name: 'desktop', fn: desktopNotification },
  { name: 'sound', fn: soundNotification },
];

/** Exposed for registry wiring tests */
export const registeredHookNames = () => HOOKS.map(h => h.name);

// -----------------------------------------------------------------------------
// Dispatcher Implementation
// -----------------------------------------------------------------------------

/**
 * Unified dispatcher that runs all Notification hooks in parallel
 */
export async function unifiedNotificationDispatcher(input: HookInput, ctx: HookContext = NOOP_CTX): Promise<HookResult> {
  // Run all hooks in parallel
  const results = await Promise.allSettled(
    HOOKS.map(async hook => {
      try {
        const result = hook.fn(input, ctx);
        if (result instanceof Promise) {
          await result;
        }
        return { hook: hook.name, status: 'success' };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.log('notification-dispatcher', `${hook.name} failed: ${message}`);
        return { hook: hook.name, status: 'error', message };
      }
    })
  );

  // Log per-hook results for debuggability
  const summary = results.map((r, i) => {
    if (r.status === 'fulfilled' && r.value.status === 'success') {
      return `${HOOKS[i].name}=ok`;
    }
    if (r.status === 'fulfilled' && r.value.status === 'error') {
      return `${HOOKS[i].name}=FAIL(${r.value.message})`;
    }
    // Promise.allSettled rejected — should not happen due to inner try/catch
    return `${HOOKS[i].name}=REJECTED`;
  }).join(', ');

  ctx.log('notification-dispatcher', `Results: ${summary}`);

  return outputSilentSuccess();
}

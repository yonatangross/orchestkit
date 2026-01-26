/**
 * Unified Notification Dispatcher
 * Issue #235: Hook Architecture Refactor
 *
 * Consolidates 2 async Notification hooks into a single dispatcher.
 * Reduces "Async hook Notification completed" messages from 2 to 1.
 *
 * CC 2.1.19 Compliant: Single async hook with internal routing
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';

// Import individual hook implementations
import { desktopNotification } from './desktop.js';
import { soundNotification } from './sound.js';

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
 * Registry of all async Notification hooks consolidated into dispatcher
 */
const HOOKS: HookConfig[] = [
  { name: 'desktop', fn: desktopNotification },
  { name: 'sound', fn: soundNotification },
];

// -----------------------------------------------------------------------------
// Dispatcher Implementation
// -----------------------------------------------------------------------------

/**
 * Unified dispatcher that runs all Notification hooks in parallel
 */
export async function unifiedNotificationDispatcher(input: HookInput): Promise<HookResult> {
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
        logHook('notification-dispatcher', `${hook.name} failed: ${message}`);
        return { hook: hook.name, status: 'error', message };
      }
    })
  );

  // Log summary for debugging (only errors)
  const errors = results.filter(
    r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 'error')
  );

  if (errors.length > 0) {
    logHook('notification-dispatcher', `${errors.length}/${HOOKS.length} hooks had errors`);
  }

  return outputSilentSuccess();
}

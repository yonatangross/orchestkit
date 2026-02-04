/**
 * Notification Hooks Entry Point
 *
 * Hooks that handle notifications (Notification event)
 * Bundle: notification.mjs (~8 KB estimated - smallest bundle)
 */

// Re-export types and utilities
export * from '../types.js';
export * from '../lib/common.js';

// Notification hooks (2)
import { desktopNotification } from '../notification/desktop.js';
import { soundNotification } from '../notification/sound.js';
import { unifiedNotificationDispatcher } from '../notification/unified-dispatcher.js';

import type { HookFn } from '../types.js';

/**
 * Notification hooks registry
 */
export const hooks: Record<string, HookFn> = {
  'notification/desktop': desktopNotification,
  'notification/sound': soundNotification,
  'notification/unified-dispatcher': unifiedNotificationDispatcher,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}

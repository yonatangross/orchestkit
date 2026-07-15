/**
 * Notification Hooks Entry Point
 *
 * Hooks that handle notifications (Notification event)
 * Bundle: notification.mjs (~8 KB estimated - smallest bundle)
 */

// Notification hooks (3)
import { desktopNotification } from '../notification/desktop.js';
import { soundNotification } from '../notification/sound.js';
// P3-A3: MessageDisplay observer (CC 2.1.208) — observer-only telemetry
import { messageDisplayObserver } from '../notification/message-display-observer.js';

import type { HookFn } from '../types.js';

/**
 * Notification hooks registry
 */
export const hooks: Record<string, HookFn> = {
  'notification/desktop': desktopNotification,
  'notification/sound': soundNotification,
  // P3-A3: MessageDisplay (CC 2.1.208) — never blocks, never modifies
  'notification/message-display-observer': messageDisplayObserver,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}

// Phase 4: HookContext DI
export { buildContext } from '../lib/context.js';

/**
 * Denial Notification — PermissionDenied Hook
 *
 * Fires a desktop notification when 3+ denials occur within a 60-second
 * sliding window. This signals potential misconfiguration or overly
 * restrictive auto mode settings.
 *
 * Async — never blocks. Never returns retry.
 *
 * CC 2.1.88 Compliant: PermissionDenied hook
 * @hook PermissionDenied (async)
 * @since v7.27.0
 * @see #1211
 */

import { execFileSync } from 'node:child_process';
import { platform } from 'node:os';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';

const HOOK_NAME = 'denial-notification';

/** Sliding window config */
const WINDOW_MS = 60_000;
const THRESHOLD = 3;

/** In-process denial timestamp tracker */
const denialTimestamps: number[] = [];

/** Track if we already notified in this window to avoid spam */
let lastNotifiedAt = 0;
const COOLDOWN_MS = 120_000; // 2 minutes between notifications

function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function sendDesktopNotification(title: string, message: string): void {
  const os = platform();
  try {
    if (os === 'darwin') {
      execFileSync('osascript', [
        '-e',
        `display notification "${escapeAppleScript(message)}" with title "${escapeAppleScript(title)}"`,
      ], { timeout: 3000, stdio: 'ignore' });
    } else if (os === 'linux') {
      execFileSync('notify-send', [title, message], { timeout: 3000, stdio: 'ignore' });
    }
    // Windows: skip (no reliable silent notification command)
  } catch {
    logHook(HOOK_NAME, 'Failed to send desktop notification');
  }
}

export function denialNotification(input: HookInput): HookResult {
  const now = Date.now();

  // Add current denial
  denialTimestamps.push(now);

  // Prune entries outside the window
  while (denialTimestamps.length > 0 && denialTimestamps[0] < now - WINDOW_MS) {
    denialTimestamps.shift();
  }

  logHook(HOOK_NAME, `Denial count in window: ${denialTimestamps.length}/${THRESHOLD}`);

  // Check threshold
  if (denialTimestamps.length >= THRESHOLD) {
    // Cooldown: don't spam notifications
    if (now - lastNotifiedAt < COOLDOWN_MS) {
      logHook(HOOK_NAME, 'Threshold reached but in cooldown period');
      return outputSilentSuccess();
    }

    lastNotifiedAt = now;
    const toolName = input.tool_name || 'unknown';

    sendDesktopNotification(
      'OrchestKit: Repeated Permission Denials',
      `${denialTimestamps.length} commands denied in ${WINDOW_MS / 1000}s. Last: ${toolName}. Check /permissions.`,
    );

    logHook(HOOK_NAME, 'Desktop notification sent for repeated denials');
  }

  return outputSilentSuccess();
}

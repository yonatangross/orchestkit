/**
 * Desktop Notifications - Notification Hook
 * CC 2.1.7 Compliant: Outputs proper JSON with suppressOutput
 *
 * Sends desktop notifications for important events.
 *
 * Version: 1.0.0 (TypeScript port)
 */

import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function escapeForAppleScript(message: string): string {
  // Escape backslashes and double quotes for AppleScript
  return message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function sendMacNotification(message: string): boolean {
  try {
    const escaped = escapeForAppleScript(message);
    execSync(
      `osascript -e 'display notification "${escaped}" with title "Claude Code" sound name "Ping"'`,
      { stdio: 'ignore' }
    );
    return true;
  } catch {
    return false;
  }
}

function sendLinuxNotification(message: string): boolean {
  try {
    execSync(`notify-send -- "Claude Code" "${message}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function hasCommand(command: string): boolean {
  try {
    execSync(`command -v ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function desktopNotification(input: HookInput): HookResult {
  const toolInput = input.tool_input || {};
  const message = (toolInput.message as string) || '';
  const notificationType = (toolInput.notification_type as string) || '';

  logHook('desktop', `Notification: [${notificationType}] ${message.substring(0, 100)}`);

  // Show desktop notifications for permission prompts and idle prompts
  if (notificationType === 'permission_prompt' || notificationType === 'idle_prompt') {
    // Try macOS notification
    if (hasCommand('osascript')) {
      sendMacNotification(message);
    }
    // Try Linux notification
    else if (hasCommand('notify-send')) {
      sendLinuxNotification(message);
    }
  }

  return outputSilentSuccess();
}

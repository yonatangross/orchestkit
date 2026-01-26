/**
 * Desktop Notifications - Notification Hook
 * CC 2.1.7 Compliant: Outputs proper JSON with suppressOutput
 *
 * Sends rich desktop notifications with context (repo, branch, task).
 * Uses native osascript title/subtitle/message - no external deps.
 *
 * Version: 2.0.0
 */

import { execSync } from 'node:child_process';
import { basename } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir, getCachedBranch } from '../lib/common.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const SOUNDS: Record<string, string> = {
  permission_prompt: 'Sosumi',  // Attention-grabbing
  idle_prompt: 'Ping',          // Gentle
  default: 'Ping',
};

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function escapeForAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function hasCommand(command: string): boolean {
  try {
    execSync(`command -v ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract issue number from branch name (e.g., feature/235-foo → #235)
 */
function extractIssueFromBranch(branch: string): string | null {
  const match = branch.match(/(?:feature|fix|bug|issue)[/-](\d+)/i);
  return match ? `#${match[1]}` : null;
}

/**
 * Get repo name from project directory
 */
function getRepoName(): string {
  try {
    const projectDir = getProjectDir();
    return basename(projectDir);
  } catch {
    return 'Claude Code';
  }
}

/**
 * Build subtitle with branch and optional issue number
 */
function buildSubtitle(branch: string, notificationType: string): string {
  const issue = extractIssueFromBranch(branch);
  const typeLabel = notificationType === 'permission_prompt' ? '⏸ Permission needed' : '💤 Waiting';

  if (issue) {
    return `${typeLabel} · ${issue} · ${branch}`;
  }
  return `${typeLabel} · ${branch}`;
}

/**
 * Truncate message to fit notification (keep it readable)
 */
function truncateMessage(message: string, maxLen = 120): string {
  if (message.length <= maxLen) return message;
  return message.substring(0, maxLen - 3) + '...';
}

/**
 * Send macOS notification with title, subtitle, and message
 */
function sendMacNotification(
  title: string,
  subtitle: string,
  message: string,
  sound: string
): boolean {
  try {
    const t = escapeForAppleScript(title);
    const s = escapeForAppleScript(subtitle);
    const m = escapeForAppleScript(truncateMessage(message));

    execSync(
      `osascript -e 'display notification "${m}" with title "${t}" subtitle "${s}" sound name "${sound}"'`,
      { stdio: 'ignore', timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Send Linux notification (simpler, no subtitle support)
 */
function sendLinuxNotification(title: string, subtitle: string, message: string): boolean {
  try {
    const fullMessage = `${subtitle}\n${message}`;
    execSync(`notify-send -- "${title}" "${fullMessage}"`, { stdio: 'ignore', timeout: 5000 });
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
  const message = (toolInput.message as string) || input.message || '';
  const notificationType = (toolInput.notification_type as string) || input.notification_type || '';

  logHook('desktop', `Notification: [${notificationType}] ${message.substring(0, 100)}`);

  // Only show for permission prompts and idle prompts
  if (notificationType !== 'permission_prompt' && notificationType !== 'idle_prompt') {
    return outputSilentSuccess();
  }

  // Build rich notification content
  const repoName = getRepoName();
  const branch = getCachedBranch();
  const subtitle = buildSubtitle(branch, notificationType);
  const sound = SOUNDS[notificationType] || SOUNDS.default;

  // Send platform-appropriate notification
  if (hasCommand('osascript')) {
    sendMacNotification(repoName, subtitle, message, sound);
  } else if (hasCommand('notify-send')) {
    sendLinuxNotification(repoName, subtitle, message);
  }

  return outputSilentSuccess();
}

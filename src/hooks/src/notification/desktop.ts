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
import { assertSafeCommandName, shellQuote } from '../lib/sanitize-shell.js';

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function escapeForAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

const _commandCache = new Map<string, boolean>();

/** Check if a command exists. assertSafeCommandName guards against injection if callers change. */
function hasCommand(command: string): boolean {
  const cached = _commandCache.get(command);
  if (cached !== undefined) return cached;
  try {
    assertSafeCommandName(command);
    execSync(`command -v ${command}`, { stdio: 'ignore' });
    _commandCache.set(command, true);
    return true;
  } catch {
    _commandCache.set(command, false);
    return false;
  }
}

/** @internal Test-only: reset the command cache */
export function _resetCommandCacheForTesting(): void {
  _commandCache.clear();
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
  return `${message.substring(0, maxLen - 3)}...`;
}

/**
 * Send macOS notification with title, subtitle, and message.
 * Sound is handled separately by sound.ts to avoid double-sound.
 */
function sendMacNotification(
  title: string,
  subtitle: string,
  message: string,
): boolean {
  try {
    const t = escapeForAppleScript(title);
    const s = escapeForAppleScript(subtitle);
    const m = escapeForAppleScript(truncateMessage(message));

    const script = `display notification "${m}" with title "${t}" subtitle "${s}"`;
    execSync(`osascript -e ${shellQuote(script)}`, { stdio: 'ignore', timeout: 5000 });
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
    execSync(`notify-send -- ${shellQuote(title)} ${shellQuote(fullMessage)}`, { stdio: 'ignore', timeout: 5000 });
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

  // Send platform-appropriate notification (sound handled by sound.ts)
  if (hasCommand('osascript')) {
    sendMacNotification(repoName, subtitle, message);
  } else if (hasCommand('notify-send')) {
    sendLinuxNotification(repoName, subtitle, message);
  }

  return outputSilentSuccess();
}

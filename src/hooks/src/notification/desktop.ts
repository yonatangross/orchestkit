/**
 * Desktop Notifications - Notification Hook
 * CC 2.1.7 Compliant: Outputs proper JSON with suppressOutput
 *
 * Sends rich desktop notifications with context (repo, branch, task).
 * Uses native osascript title/subtitle/message - no external deps.
 *
 * Version: 2.0.0
 */

import { execSync, spawn } from 'node:child_process';
import { basename } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir, getCachedBranch } from '../lib/common.js';
import { assertSafeCommandName } from '../lib/sanitize-shell.js';

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function escapeForAppleScript(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — stripping control chars from notification text
    .replace(/[\x00-\x1f\x7f]/g, '');
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
 * Build a clean, actionable notification title
 */
function buildTitle(repoName: string, notificationType: string): string {
  if (notificationType === 'permission_prompt') {
    return `${repoName} needs approval`;
  }
  return `${repoName} is waiting for you`;
}

/**
 * Build subtitle with branch context
 */
function buildSubtitle(branch: string): string {
  if (!branch || branch === 'unknown') return '';
  const issue = extractIssueFromBranch(branch);
  return issue ? `${branch} (${issue})` : branch;
}

/**
 * Build a useful message body from CC's notification message
 */
function buildMessage(message: string, notificationType: string): string {
  // If CC provided a real message, use it
  if (message && message !== 'test' && message.length > 5) {
    return message;
  }
  // Fallback to actionable default
  if (notificationType === 'permission_prompt') {
    return 'A tool needs your permission to proceed.';
  }
  return 'Claude is idle and waiting for your response.';
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
 * Activates the terminal app so the user lands back in the right window.
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
    // Display notification only — never steal focus from the user's current app
    const script = `display notification "${m}" with title "${t}" subtitle "${s}"`;
    const child = spawn('osascript', ['-e', script], { stdio: 'ignore', detached: true });
    child.unref();
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
    const child = spawn('notify-send', ['--', title, fullMessage], { stdio: 'ignore', detached: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export async function desktopNotification(input: HookInput): Promise<HookResult> {
  const toolInput = input.tool_input || {};
  const message = input.message || (toolInput.message as string) || '';
  const notificationType = input.notification_type || (toolInput.notification_type as string) || '';

  logHook('desktop', `Notification: [${notificationType}] ${message.substring(0, 100)}`);

  // Only show for permission prompts and idle prompts
  if (notificationType !== 'permission_prompt' && notificationType !== 'idle_prompt') {
    return outputSilentSuccess();
  }

  // Build rich notification content
  const repoName = getRepoName();
  const branch = getCachedBranch();
  const title = buildTitle(repoName, notificationType);
  const subtitle = buildSubtitle(branch);
  const body = buildMessage(message, notificationType);

  // Send platform-appropriate notification (sound handled by sound.ts)
  if (hasCommand('osascript')) {
    sendMacNotification(title, subtitle, body);
  } else if (hasCommand('notify-send')) {
    sendLinuxNotification(title, subtitle, body);
  }

  return outputSilentSuccess();
}

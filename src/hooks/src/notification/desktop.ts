/**
 * Desktop Notifications - Notification Hook
 * CC 2.1.7 Compliant: Outputs proper JSON with suppressOutput
 *
 * Sends rich desktop notifications with context (repo, branch, task).
 *
 * PRIMARY PATH (#1847): returns the top-level `terminalSequence` hook-output
 * field with an OSC 777 notify sequence (\u001b]777;notify;TITLE;BODY\u0007).
 * CC emits it to the user's terminal, which raises the desktop banner —
 * zero process spawns, works on macOS + Linux, command hooks only.
 *
 * LEGACY FALLBACK: set ORK_NOTIFY_OSASCRIPT=1 to restore the old behavior of
 * spawning `osascript` (macOS) / `notify-send` (Linux) per notification —
 * for terminals that do not implement OSC 777. When the flag is set the hook
 * spawns the native notifier and returns silent success (no terminalSequence).
 *
 * SECURITY: notification text is untrusted hook input. Before embedding it in
 * the OSC 777 sequence we strip control chars (incl. ESC/BEL, so the text
 * cannot terminate or nest escape sequences) and `;` (the OSC field
 * delimiter), then truncate.
 *
 * Version: 3.0.0 (terminalSequence primary, osascript legacy via env flag)
 */

import { execFileSync, spawn } from 'node:child_process';
import { basename } from 'node:path';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess, getProjectDir } from '../lib/common.js';
import { outputTerminalSequence } from '../lib/output.js';
import { assertSafeCommandName } from '../lib/sanitize-shell.js';
import { NOOP_CTX } from '../lib/context.js';

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
    execFileSync('which', [command], { stdio: 'ignore', windowsHide: true });
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
  if (notificationType === 'agent_needs_input') {
    return `${repoName}: background agent needs input`;
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
  if (notificationType === 'agent_needs_input') {
    return 'A background agent is waiting for your input.';
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

// -----------------------------------------------------------------------------
// terminalSequence primary path (#1847)
// -----------------------------------------------------------------------------

/**
 * Sanitize untrusted text for embedding in an OSC 777 field:
 * strip control chars (C0 + DEL + C1 — kills ESC/BEL injection) and `;`
 * (the OSC field delimiter), then truncate.
 */
function sanitizeForOsc777(text: string, maxLen: number): string {
  const cleaned = text
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional -- untrusted text must not carry escape/control bytes into the terminal
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/;/g, '')
    .trim();
  return truncateMessage(cleaned, maxLen);
}

/**
 * Build the OSC 777 notify sequence: ESC ] 777 ; notify ; TITLE ; BODY BEL
 */
function buildOsc777Notify(title: string, body: string): string {
  return `\u001b]777;notify;${sanitizeForOsc777(title, 80)};${sanitizeForOsc777(body, 120)}\u0007`;
}

// -----------------------------------------------------------------------------
// Legacy osascript/notify-send path (ORK_NOTIFY_OSASCRIPT=1)
// -----------------------------------------------------------------------------

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
    // Display notification only — never steal focus from the user's current app
    const script = `display notification "${m}" with title "${t}" subtitle "${s}"`;
    const child = spawn('osascript', ['-e', script], { stdio: 'ignore', windowsHide: true, detached: true });
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
    const child = spawn('notify-send', ['--', title, fullMessage], { stdio: 'ignore', windowsHide: true, detached: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export async function desktopNotification(input: HookInput, ctx: HookContext = NOOP_CTX): Promise<HookResult> {
  // Global opt-out for OrchestKit Notification hooks (desktop banner + sound).
  // Set once in your env; survives version bumps (unlike editing the install
  // cache's hooks.json). Mirrors the ORK_NO_* opt-out convention (#2430).
  if (process.env.ORK_NO_NOTIFY === '1') return outputSilentSuccess();

  const toolInput = input.tool_input || {};
  const message = input.message || (toolInput.message as string) || '';
  const notificationType = input.notification_type || (toolInput.notification_type as string) || '';

  ctx.log('desktop', `Notification: [${notificationType}] ${message.substring(0, 100)}`);

  // Only show for actionable prompts: permission, idle, and background-agent
  // input requests (CC 2.1.198+). agent_completed stays sound-only (sound.ts)
  // so a fleet of finishing agents doesn't spam banners.
  if (
    notificationType !== 'permission_prompt'
    && notificationType !== 'idle_prompt'
    && notificationType !== 'agent_needs_input'
  ) {
    return outputSilentSuccess();
  }

  // Build rich notification content
  const repoName = getRepoName();
  const branch = ctx.branch;
  const title = buildTitle(repoName, notificationType);
  const subtitle = buildSubtitle(branch);
  const body = buildMessage(message, notificationType);

  // LEGACY fallback (#1847): explicit opt-in only. Spawns the native notifier
  // instead of emitting the OSC 777 terminalSequence.
  if (process.env.ORK_NOTIFY_OSASCRIPT === '1') {
    if (hasCommand('osascript')) {
      sendMacNotification(title, subtitle, body);
    } else if (hasCommand('notify-send')) {
      sendLinuxNotification(title, subtitle, body);
    }
    return outputSilentSuccess();
  }

  // PRIMARY path (#1847): OSC 777 notify via terminalSequence — no spawns.
  // terminalSequence is macOS/Linux only; skip on Windows.
  if (process.platform === 'win32') return outputSilentSuccess();

  const oscBody = subtitle ? `${subtitle} — ${body}` : body;
  return outputTerminalSequence(buildOsc777Notify(title, oscBody));
}

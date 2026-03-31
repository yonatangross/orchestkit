/**
 * Denial Notification — PermissionDenied Hook
 *
 * Fires a desktop notification when 3+ denials occur within a 60-second
 * sliding window. This signals potential misconfiguration or overly
 * restrictive auto mode settings.
 *
 * Reads denial timestamps from permission-denials.jsonl (written by
 * denial-logger.ts). Persists cooldown state to a separate JSON file
 * so it survives across hook process spawns.
 *
 * Sync — never blocks. Never returns retry.
 *
 * CC 2.1.88 Compliant: PermissionDenied hook
 * @hook PermissionDenied (sync)
 * @since v7.27.0 (fixed v7.27.1: persisted state replaces in-memory)
 * @see #1211
 */

import { execFileSync } from 'node:child_process';
import { existsSync, openSync, readSync, fstatSync, closeSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { platform } from 'node:os';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir } from '../lib/common.js';
import { atomicWriteSync } from '../lib/atomic-write.js';

const HOOK_NAME = 'denial-notification';

/** Sliding window config */
const WINDOW_MS = 60_000;
const THRESHOLD = 3;
const COOLDOWN_MS = 120_000; // 2 minutes between notifications

function getDenialLogPath(): string {
  return join(getProjectDir(), '.claude', 'feedback', 'permission-denials.jsonl');
}

function getStatePath(): string {
  return join(getProjectDir(), '.claude', 'feedback', 'denial-notification-state.json');
}

/** Max bytes to read from tail of JSONL (~27 lines at ~150 bytes each) */
const TAIL_BYTES = 4096;

/**
 * Read recent denial timestamps from the JSONL log file.
 * Reads only the last 4KB (bounded) to avoid loading large files.
 */
function getRecentDenialCount(now: number): number {
  const logPath = getDenialLogPath();
  if (!existsSync(logPath)) return 0;

  try {
    const fd = openSync(logPath, 'r');
    const size = fstatSync(fd).size;
    const readSize = Math.min(size, TAIL_BYTES);
    const offset = Math.max(0, size - TAIL_BYTES);
    const buf = Buffer.alloc(readSize);
    readSync(fd, buf, 0, readSize, offset);
    closeSync(fd);

    const content = buf.toString('utf-8');
    const lines = content.split('\n').filter(Boolean);
    // If we read from middle of file, first line may be partial — skip it
    const recentLines = offset > 0 ? lines.slice(1) : lines;

    let count = 0;
    for (const line of recentLines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        const ts = new Date(entry.timestamp).getTime();
        if (ts >= now - WINDOW_MS) {
          count++;
        }
      } catch {
        // Skip malformed lines
      }
    }
    return count;
  } catch {
    return 0;
  }
}

function getLastNotifiedAt(): number {
  const statePath = getStatePath();
  if (!existsSync(statePath)) return 0;

  try {
    const state = JSON.parse(readFileSync(statePath, 'utf-8'));
    return state.lastNotifiedAt || 0;
  } catch {
    return 0;
  }
}

function setLastNotifiedAt(ts: number): void {
  const statePath = getStatePath();
  try {
    const dir = dirname(statePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    atomicWriteSync(statePath, JSON.stringify({ lastNotifiedAt: ts }) + '\n');
  } catch {
    logHook(HOOK_NAME, 'Failed to persist notification state');
  }
}

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
  } catch {
    logHook(HOOK_NAME, 'Failed to send desktop notification');
  }
}

export function denialNotification(input: HookInput): HookResult {
  const now = Date.now();

  // Read denial count from persisted log (written by denial-logger.ts)
  const denialCount = getRecentDenialCount(now);

  logHook(HOOK_NAME, `Denial count in window: ${denialCount}/${THRESHOLD}`);

  if (denialCount >= THRESHOLD) {
    const lastNotifiedAt = getLastNotifiedAt();

    if (now - lastNotifiedAt < COOLDOWN_MS) {
      logHook(HOOK_NAME, 'Threshold reached but in cooldown period');
      return outputSilentSuccess();
    }

    setLastNotifiedAt(now);
    const toolName = input.tool_name || 'unknown';

    sendDesktopNotification(
      'OrchestKit: Repeated Permission Denials',
      `${denialCount} commands denied in ${WINDOW_MS / 1000}s. Last: ${toolName}. Check /permissions.`,
    );

    logHook(HOOK_NAME, 'Desktop notification sent for repeated denials');
  }

  return outputSilentSuccess();
}

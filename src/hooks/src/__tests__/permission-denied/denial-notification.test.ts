/**
 * Unit tests for denial-notification PermissionDenied hook
 *
 * Tests sliding-window threshold and cooldown for desktop notifications.
 * Post-P0 fix: reads timestamps from permission-denials.jsonl (disk-based),
 * persists cooldown state to denial-notification-state.json.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// Mock node:child_process
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

// Mock node:os
vi.mock('node:os', () => ({
  platform: vi.fn().mockReturnValue('darwin'),
}));

// Mock node:fs for JSONL reading and state persistence
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  openSync: vi.fn().mockReturnValue(3),
  readSync: vi.fn(),
  fstatSync: vi.fn().mockReturnValue({ size: 0 }),
  closeSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock atomic-write for state persistence
vi.mock('../../lib/atomic-write.js', () => ({
  atomicWriteSync: vi.fn(),
}));

// Mock the common module
vi.mock('../../lib/common.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/common.js')>('../../lib/common.js');
  return {
    ...actual,
    logHook: vi.fn(),
    getProjectDir: () => '/test/project',
    outputSilentSuccess: () => ({ continue: true, suppressOutput: true }),
  };
});

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, openSync, readSync, fstatSync, closeSync } from 'node:fs';
import { atomicWriteSync } from '../../lib/atomic-write.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockOpenSync = vi.mocked(openSync);
const mockReadSync = vi.mocked(readSync);
const mockFstatSync = vi.mocked(fstatSync);
const mockCloseSync = vi.mocked(closeSync);
const mockAtomicWriteSync = vi.mocked(atomicWriteSync);
const mockExecFileSync = vi.mocked(execFileSync);

function createDeniedInput(toolName = 'Bash'): HookInput {
  return {
    tool_name: toolName,
    session_id: 'test-session-789',
    tool_input: { command: 'some command' },
    project_dir: '/test/project',
    hook_event: 'PermissionDenied',
  };
}

/** Generate JSONL log content with N entries at given timestamps */
function makeJSONL(timestamps: number[]): string {
  return `${timestamps
    .map((ts) => JSON.stringify({ timestamp: new Date(ts).toISOString(), tool_name: 'Bash' }))
    .join('\n')}\n`;
}

/** Mock fs so log file has given denial timestamps and state file has given lastNotifiedAt */
function setupMocks(opts: {
  denialTimestamps?: number[];
  lastNotifiedAt?: number;
  logExists?: boolean;
  stateExists?: boolean;
}): void {
  const {
    denialTimestamps = [],
    lastNotifiedAt = 0,
    logExists = denialTimestamps.length > 0,
    stateExists = lastNotifiedAt > 0,
  } = opts;

  const jsonlContent = makeJSONL(denialTimestamps);
  const jsonlBytes = Buffer.from(jsonlContent, 'utf-8');

  mockExistsSync.mockImplementation((path: unknown) => {
    const p = String(path);
    if (p.includes('permission-denials.jsonl')) return logExists;
    if (p.includes('denial-notification-state.json')) return stateExists;
    if (p.includes('feedback')) return true; // directory
    return false;
  });

  // Bounded tail read: openSync → fstatSync → readSync → closeSync
  mockOpenSync.mockReturnValue(3 as unknown as number);
  mockFstatSync.mockReturnValue({ size: jsonlBytes.length } as ReturnType<typeof fstatSync>);
  mockReadSync.mockImplementation((_fd: number, buf: Buffer) => {
    jsonlBytes.copy(buf, 0, 0, Math.min(jsonlBytes.length, buf.length));
    return Math.min(jsonlBytes.length, buf.length);
  });
  mockCloseSync.mockImplementation(() => {});

  // State file still uses readFileSync (small JSON, not JSONL)
  mockReadFileSync.mockImplementation((path: unknown) => {
    const p = String(path);
    if (p.includes('denial-notification-state.json')) {
      return JSON.stringify({ lastNotifiedAt });
    }
    return '';
  });
}

describe('denial-notification (disk-based)', () => {
  let denialNotification: typeof import('../../permission-denied/denial-notification.js').denialNotification;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T12:00:00Z'));

    vi.resetModules();
    const mod = await import('../../permission-denied/denial-notification.js');
    denialNotification = mod.denialNotification;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('No notification under threshold', () => {
    test('0 denials in log — no notification', () => {
      setupMocks({ logExists: false });
      const result = denialNotification(createDeniedInput());
      expect(mockExecFileSync).not.toHaveBeenCalled();
      expect(result.continue).toBe(true);
    });

    test('1 denial in window — no notification', () => {
      const now = Date.now();
      setupMocks({ denialTimestamps: [now - 10_000] });
      const result = denialNotification(createDeniedInput());
      expect(mockExecFileSync).not.toHaveBeenCalled();
      expect(result.continue).toBe(true);
    });

    test('2 denials in window — no notification', () => {
      const now = Date.now();
      setupMocks({ denialTimestamps: [now - 20_000, now - 10_000] });
      const _result = denialNotification(createDeniedInput());
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });
  });

  describe('Notification fires at 3+ denials in 60s window', () => {
    test('3 denials in window triggers notification', () => {
      const now = Date.now();
      setupMocks({ denialTimestamps: [now - 30_000, now - 20_000, now - 10_000] });

      const result = denialNotification(createDeniedInput());

      expect(mockExecFileSync).toHaveBeenCalledTimes(1);
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'osascript',
        expect.arrayContaining(['-e', expect.stringContaining('display notification')]),
        expect.objectContaining({ timeout: 3000 })
      );
      expect(result.continue).toBe(true);
    });

    test('5 denials in window triggers notification', () => {
      const now = Date.now();
      setupMocks({
        denialTimestamps: [now - 50_000, now - 40_000, now - 30_000, now - 20_000, now - 10_000],
      });

      denialNotification(createDeniedInput());
      expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    });

    test('notification message includes tool name', () => {
      const now = Date.now();
      setupMocks({ denialTimestamps: [now - 30_000, now - 20_000, now - 10_000] });

      denialNotification(createDeniedInput('Write'));

      const osascriptArg = mockExecFileSync.mock.calls[0][1]![1] as string;
      expect(osascriptArg).toContain('Write');
    });

    test('persists lastNotifiedAt to state file', () => {
      const now = Date.now();
      setupMocks({ denialTimestamps: [now - 30_000, now - 20_000, now - 10_000] });

      denialNotification(createDeniedInput());

      expect(mockAtomicWriteSync).toHaveBeenCalledWith(
        expect.stringContaining('denial-notification-state.json'),
        expect.stringContaining('"lastNotifiedAt"'),
      );
    });
  });

  describe('Sliding window excludes old entries', () => {
    test('denials older than 60s do not count', () => {
      const now = Date.now();
      // 3 denials but all older than 60s
      setupMocks({
        denialTimestamps: [now - 90_000, now - 80_000, now - 70_000],
      });

      denialNotification(createDeniedInput());
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    test('mix of old and recent — only recent count', () => {
      const now = Date.now();
      // 5 old + 2 recent = only 2 in window (below threshold)
      setupMocks({
        denialTimestamps: [
          now - 120_000, now - 110_000, now - 100_000, now - 90_000, now - 80_000,
          now - 20_000, now - 10_000,
        ],
      });

      denialNotification(createDeniedInput());
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });
  });

  describe('Cooldown prevents spam (2 min)', () => {
    test('suppresses notification during cooldown', () => {
      const now = Date.now();
      // 3 denials in window + recently notified (30s ago)
      setupMocks({
        denialTimestamps: [now - 30_000, now - 20_000, now - 10_000],
        lastNotifiedAt: now - 30_000, // 30s ago (within 120s cooldown)
      });

      denialNotification(createDeniedInput());
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    test('allows notification after cooldown expires', () => {
      const now = Date.now();
      setupMocks({
        denialTimestamps: [now - 30_000, now - 20_000, now - 10_000],
        lastNotifiedAt: now - 130_000, // 130s ago (past 120s cooldown)
      });

      denialNotification(createDeniedInput());
      expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    test('handles corrupt JSONL gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation((path: unknown) => {
        const p = String(path);
        if (p.includes('.jsonl')) return 'not json\n{bad\n';
        return '{}';
      });

      const result = denialNotification(createDeniedInput());
      expect(result.continue).toBe(true);
    });

    test('handles missing log file', () => {
      setupMocks({ logExists: false });
      const result = denialNotification(createDeniedInput());
      expect(result.continue).toBe(true);
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    test('handles osascript failure gracefully', () => {
      const now = Date.now();
      setupMocks({ denialTimestamps: [now - 30_000, now - 20_000, now - 10_000] });
      mockExecFileSync.mockImplementation(() => { throw new Error('osascript not found'); });

      const result = denialNotification(createDeniedInput());
      expect(result.continue).toBe(true);
    });
  });

  describe('Always returns silent success', () => {
    test('never returns retry', () => {
      const now = Date.now();
      setupMocks({ denialTimestamps: [now - 30_000, now - 20_000, now - 10_000] });

      const result = denialNotification(createDeniedInput());
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect((result as { hookSpecificOutput?: { retry?: boolean } }).hookSpecificOutput?.retry).toBeUndefined();
    });
  });
});

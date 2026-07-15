/**
 * Unit tests for desktop notification hook
 * Tests macOS/Linux notification dispatching, message formatting, and platform detection.
 *
 * #1847: the PRIMARY path now returns an OSC 777 `terminalSequence`; the
 * osascript/notify-send spawn path is LEGACY behind ORK_NOTIFY_OSASCRIPT=1.
 * The osascript-oriented describes below set that flag in beforeEach; the
 * 'terminalSequence primary path' describe clears it.
 *
 * CC 2.1.7 Compliance: All code paths must return { continue: true, suppressOutput: true }
 *
 * Issue #257: notification hooks 0% -> 100% coverage
 *
 * Companion: desktop-spawn.test.ts covers terminal mapping + spawn behavior.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Hoisted mocks (vi.hoisted runs before vi.mock factory)
// =============================================================================

const { mockUnref, mockSpawn } = vi.hoisted(() => {
  const mockUnref = vi.fn();
  const mockSpawn = vi.fn(() => ({ unref: mockUnref }));
  return { mockUnref, mockSpawn };
});

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../../lib/common.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/common.js')>('../../lib/common.js');
  return {
    ...actual,
    logHook: vi.fn(),
    outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
    getProjectDir: vi.fn(() => '/test/projects/orchestkit'),
    getCachedBranch: vi.fn(() => 'feature/235-add-notifications'),
  };
});

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => ''),
  spawn: mockSpawn,
}));

vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path');
  return { ...actual, basename: actual.basename };
});

// =============================================================================
// Imports (after mocks)
// =============================================================================

import { desktopNotification, _resetCommandCacheForTesting } from '../../notification/desktop.js';
import { outputSilentSuccess, getProjectDir, getCachedBranch } from '../../lib/common.js';
import { execFileSync } from 'node:child_process';
import { createTestContext } from '../fixtures/test-context.js';

// =============================================================================
// Test Utilities
// =============================================================================

function createToolInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    hook_event: 'Notification',
    tool_name: 'Notification',
    session_id: 'test-session-123',
    tool_input: {},
    ...overrides,
  };
}

function createNotificationInput(
  notificationType: string,
  message = 'Test notification message',
): HookInput {
  return createToolInput({
    tool_input: { notification_type: notificationType, message },
    message,
    notification_type: notificationType,
  });
}

/** Return the script string from the first osascript spawn call */
function osascriptScript(): string {
  const calls = (mockSpawn.mock.calls as any[][]).filter((c: any[]) => c[0] === 'osascript');
  expect(calls.length).toBeGreaterThan(0);
  return (calls[0] as any[])[1][1] as string; // spawn('osascript', ['-e', script], ...)
}

// =============================================================================
// Tests
// =============================================================================

let testCtx: ReturnType<typeof createTestContext>;
describe('notification/desktop', () => {
  beforeEach(() => {
    // Legacy spawn path under test in most describes below (#1847).
    process.env.ORK_NOTIFY_OSASCRIPT = '1';
    testCtx = createTestContext({ projectDir: '/test/projects/orchestkit', branch: 'feature/235-add-notifications' });
    vi.clearAllMocks();
    _resetCommandCacheForTesting();
    // execFileSync is only used for `which` checks in hasCommand.
    // Actual notifications now go through spawn.
    vi.mocked(execFileSync).mockImplementation((cmd: unknown, args: unknown) => {
      const argStr = (args as string[])?.join(' ') ?? '';
      if (cmd === 'which' && argStr.includes('osascript')) return Buffer.from('/usr/bin/osascript');
      if (cmd === 'which' && argStr.includes('notify-send')) throw new Error('not found');
      return Buffer.from('');
    });
    mockSpawn.mockReturnValue({ unref: mockUnref });
  });

  afterEach(() => {
    delete process.env.ORK_NOTIFY_OSASCRIPT;
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // terminalSequence primary path (#1847)
  // ---------------------------------------------------------------------------

  describe('terminalSequence primary path (#1847)', () => {
    const ESC = String.fromCharCode(27);
    const BEL = String.fromCharCode(7);
    const OSC_NOTIFY_PREFIX = `${ESC}]777;notify;`;

    beforeEach(() => {
      delete process.env.ORK_NOTIFY_OSASCRIPT;
    });

    test('returns OSC 777 notify terminalSequence for permission_prompt', async () => {
      const result = await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.terminalSequence?.startsWith(OSC_NOTIFY_PREFIX)).toBe(true);
      expect(result.terminalSequence?.endsWith(BEL)).toBe(true);
    });

    test.each(['permission_prompt', 'idle_prompt', 'agent_needs_input'])(
      'returns terminalSequence for actionable type %s',
      async (notificationType) => {
        const result = await desktopNotification(createNotificationInput(notificationType), testCtx);
        expect(result.terminalSequence?.startsWith(OSC_NOTIFY_PREFIX)).toBe(true);
      },
    );

    test('spawns no process in primary mode (zero child_process usage)', async () => {
      await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect(mockSpawn).not.toHaveBeenCalled();
      expect(vi.mocked(execFileSync)).not.toHaveBeenCalled();
    });

    test('includes repo name in the OSC 777 title field', async () => {
      const result = await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect(result.terminalSequence).toContain('orchestkit needs approval');
    });

    test('strips ; from untrusted message text (OSC field delimiter)', async () => {
      const result = await desktopNotification(
        createNotificationInput('permission_prompt', 'evil;injected;field'),
        testCtx,
      );
      // ESC]777;notify;TITLE;BODY — exactly 4 ;-separated segments, no extras
      expect(result.terminalSequence?.split(';')).toHaveLength(4);
      expect(result.terminalSequence).toContain('evilinjectedfield');
    });

    test('strips control/escape chars from untrusted message text', async () => {
      const result = await desktopNotification(
        createNotificationInput('permission_prompt', 'bad\u001b]0;pwn\u0007\u0000end'),
        testCtx,
      );
      const seq = result.terminalSequence ?? '';
      // Only the leading ESC and trailing BEL of the OSC envelope remain
      expect(seq.indexOf('\u001b')).toBe(0);
      expect(seq.lastIndexOf('\u001b')).toBe(0);
      expect(seq.indexOf('\u0007')).toBe(seq.length - 1);
      expect(seq).not.toContain('\u0000');
      // Non-control text survives; the OSC field delimiter is stripped from it
      expect(seq).toContain('bad]0pwnend');
    });

    test('truncates overlong message text in the body field', async () => {
      const result = await desktopNotification(
        createNotificationInput('permission_prompt', 'A'.repeat(500)),
        testCtx,
      );
      expect(result.terminalSequence).toContain('...');
      expect(result.terminalSequence).not.toContain('A'.repeat(200));
    });

    test('non-actionable types return silent success without terminalSequence', async () => {
      const result = await desktopNotification(createNotificationInput('agent_completed'), testCtx);
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(result.terminalSequence).toBeUndefined();
    });

    test('ORK_NO_NOTIFY=1 opt-out suppresses the terminalSequence too', async () => {
      process.env.ORK_NO_NOTIFY = '1';
      try {
        const result = await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
        expect(result.terminalSequence).toBeUndefined();
      } finally {
        delete process.env.ORK_NO_NOTIFY;
      }
    });

    test('legacy flag ORK_NOTIFY_OSASCRIPT=1 spawns osascript and omits terminalSequence', async () => {
      process.env.ORK_NOTIFY_OSASCRIPT = '1';
      const result = await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect(result.terminalSequence).toBeUndefined();
      expect((mockSpawn.mock.calls as any[][]).filter((c: any[]) => c[0] === 'osascript')).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Notification type filtering
  // ---------------------------------------------------------------------------

  describe('notification type filtering', () => {
    test('triggers notification for permission_prompt', async () => {
      const input = createNotificationInput('permission_prompt');
      const result = await desktopNotification(input, testCtx);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(mockSpawn).toHaveBeenCalled();
    });

    test('triggers notification for idle_prompt', async () => {
      const input = createNotificationInput('idle_prompt');
      const result = await desktopNotification(input, testCtx);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(mockSpawn).toHaveBeenCalled();
    });

    test('triggers notification for agent_needs_input (CC 2.1.198+)', async () => {
      const input = createNotificationInput('agent_needs_input');
      const result = await desktopNotification(input, testCtx);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(mockSpawn).toHaveBeenCalled();
      expect(osascriptScript()).toContain('background agent needs input');
    });

    test.each([
      'auth_success', 'task_complete', 'error', 'info', 'warning', 'agent_completed', '',
    ])('silently passes through for notification_type=%s', async (notificationType) => {
      const input = createNotificationInput(notificationType);
      const result = await desktopNotification(input, testCtx);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('silently passes through when notification_type is missing', async () => {
      const input = createToolInput({ tool_input: { message: 'some message' } });
      const result = await desktopNotification(input, testCtx);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // AppleScript escaping
  // ---------------------------------------------------------------------------

  describe('AppleScript escaping', () => {
    test('escapes double quotes in notification message', async () => {
      const input = createNotificationInput('permission_prompt', 'Allow "rm -rf" command?');
      await desktopNotification(input, testCtx);
      const script = osascriptScript();
      expect(script).toContain('\\"');
      expect(script).not.toContain('""');
    });

    test('escapes backslashes in notification message', async () => {
      const input = createNotificationInput('permission_prompt', 'Path: C:\\Users\\test');
      await desktopNotification(input, testCtx);
      expect(osascriptScript()).toContain('\\\\');
    });

    test('handles message with both quotes and backslashes', async () => {
      const input = createNotificationInput('permission_prompt', 'Allow "write" to C:\\dir\\file?');
      await desktopNotification(input, testCtx);
      const script = osascriptScript();
      expect(script).toContain('\\"');
      expect(script).toContain('\\\\');
    });

    test('escapes newlines in notification message', async () => {
      const input = createNotificationInput('permission_prompt', 'Line1\nLine2');
      await desktopNotification(input, testCtx);
      const script = osascriptScript();
      expect(script).toContain('\\n');
      expect(script).not.toMatch(/Line1\nLine2/);
    });

    test('escapes carriage returns in notification message', async () => {
      const input = createNotificationInput('permission_prompt', 'Line1\rLine2');
      await desktopNotification(input, testCtx);
      const script = osascriptScript();
      expect(script).toContain('\\r');
      expect(script).not.toMatch(/Line1\rLine2/);
    });

    test('escapes tab characters in notification message', async () => {
      const input = createNotificationInput('permission_prompt', 'Col1\tCol2');
      await desktopNotification(input, testCtx);
      const script = osascriptScript();
      expect(script).toContain('\\t');
      expect(script).not.toMatch(/Col1\tCol2/);
    });

    test('strips control characters from notification message', async () => {
      const input = createNotificationInput('permission_prompt', 'Clean\x00Middle\x07End');
      await desktopNotification(input, testCtx);
      const script = osascriptScript();
      expect(script).not.toContain('\x00');
      expect(script).not.toContain('\x07');
      expect(script).toContain('CleanMiddleEnd');
    });
  });

  // ---------------------------------------------------------------------------
  // Issue extraction from branch name
  // ---------------------------------------------------------------------------

  describe('issue extraction from branch name', () => {
    test.each([
      ['feature/235-add-notifications', '#235'],
      ['fix/42-broken-hook', '#42'],
      ['bug/1001-critical-failure', '#1001'],
      ['issue/7-design-update', '#7'],
      ['Feature/99-upper-case', '#99'],
      ['FIX/100-uppercase-fix', '#100'],
      ['BUG/101-uppercase-bug', '#101'],
      ['ISSUE/102-uppercase-issue', '#102'],
    ])('extracts issue number from branch %s as %s', async (branch, expectedIssue) => {
      vi.mocked(getCachedBranch).mockReturnValue(branch);
      (testCtx as any).branch = branch;
      await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect(osascriptScript()).toContain(expectedIssue);
    });

    test.each([
      'main', 'develop', 'release/v2.0', 'hotfix-urgent', 'feature-no-number', 'refactor/cleanup',
    ])('returns null for branch without issue number: %s', async (branch) => {
      vi.mocked(getCachedBranch).mockReturnValue(branch);
      (testCtx as any).branch = branch;
      await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect(osascriptScript()).not.toMatch(/#\d+/);
    });
  });

  // ---------------------------------------------------------------------------
  // Subtitle building
  // ---------------------------------------------------------------------------

  describe('subtitle building', () => {
    test('includes approval title for permission_prompt', async () => {
      vi.mocked(getCachedBranch).mockReturnValue('main');
      (testCtx as any).branch = 'main';
      await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect(osascriptScript()).toContain('needs approval');
    });

    test('includes waiting title for idle_prompt', async () => {
      vi.mocked(getCachedBranch).mockReturnValue('main');
      (testCtx as any).branch = 'main';
      await desktopNotification(createNotificationInput('idle_prompt'), testCtx);
      expect(osascriptScript()).toContain('waiting for you');
    });

    test('includes issue number and branch in subtitle when available', async () => {
      vi.mocked(getCachedBranch).mockReturnValue('feature/235-foo');
      (testCtx as any).branch = 'feature/235-foo';
      await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      const script = osascriptScript();
      expect(script).toContain('#235');
      expect(script).toContain('feature/235-foo');
    });

    test('omits issue number when branch has none', async () => {
      vi.mocked(getCachedBranch).mockReturnValue('main');
      (testCtx as any).branch = 'main';
      await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      const script = osascriptScript();
      expect(script).toContain('main');
      expect(script).not.toMatch(/#\d+/);
    });
  });

  // ---------------------------------------------------------------------------
  // Message truncation
  // ---------------------------------------------------------------------------

  describe('message truncation', () => {
    test('does not truncate messages under 120 characters', async () => {
      const shortMessage = 'Allow read access to /test/file.ts?';
      await desktopNotification(createNotificationInput('permission_prompt', shortMessage), testCtx);
      const script = osascriptScript();
      expect(script).toContain(shortMessage);
      expect(script).not.toContain('...');
    });

    test('truncates messages over 120 characters with ellipsis', async () => {
      const longMessage = 'A'.repeat(200);
      await desktopNotification(createNotificationInput('permission_prompt', longMessage), testCtx);
      const script = osascriptScript();
      expect(script).toContain('...');
      expect(script).not.toContain('A'.repeat(200));
    });

    test('message of exactly 120 characters is not truncated', async () => {
      const exactMessage = 'B'.repeat(120);
      await desktopNotification(createNotificationInput('permission_prompt', exactMessage), testCtx);
      const script = osascriptScript();
      expect(script).toContain(exactMessage);
      expect(script).not.toContain('...');
    });
  });

  // ---------------------------------------------------------------------------
  // Platform detection
  // ---------------------------------------------------------------------------

  describe('platform detection', () => {
    test('sends macOS notification when osascript is available', async () => {
      vi.mocked(execFileSync).mockImplementation((cmd: unknown, args: unknown) => {
        const argStr = (args as string[])?.join(' ') ?? '';
        if (cmd === 'which' && argStr.includes('osascript')) return Buffer.from('/usr/bin/osascript');
        throw new Error('not found');
      });
      await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect((mockSpawn.mock.calls as any[][]).filter((c: any[]) => c[0] === 'osascript')).toHaveLength(1);
    });

    test('sends Linux notification when only notify-send is available', async () => {
      vi.mocked(execFileSync).mockImplementation((cmd: unknown, args: unknown) => {
        const argStr = (args as string[])?.join(' ') ?? '';
        if (cmd === 'which' && argStr.includes('osascript')) throw new Error('not found');
        if (cmd === 'which' && argStr.includes('notify-send')) return Buffer.from('/usr/bin/notify-send');
        return Buffer.from('');
      });
      await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect((mockSpawn.mock.calls as any[][]).filter((c: any[]) => c[0] === 'notify-send')).toHaveLength(1);
    });

    test('prefers osascript over notify-send when both available', async () => {
      vi.mocked(execFileSync).mockImplementation((cmd: unknown, args: unknown) => {
        const argStr = (args as string[])?.join(' ') ?? '';
        if (cmd === 'which' && argStr.includes('osascript')) return Buffer.from('/usr/bin/osascript');
        if (cmd === 'which' && argStr.includes('notify-send')) return Buffer.from('/usr/bin/notify-send');
        return Buffer.from('');
      });
      await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect((mockSpawn.mock.calls as any[][]).filter((c: any[]) => c[0] === 'osascript')).toHaveLength(1);
      expect((mockSpawn.mock.calls as any[][]).filter((c: any[]) => c[0] === 'notify-send')).toHaveLength(0);
    });

    test('no notification sent when neither osascript nor notify-send available', async () => {
      vi.mocked(execFileSync).mockImplementation(() => { throw new Error('not found'); });
      const result = await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    test('returns silentSuccess when osascript spawn throws', async () => {
      vi.mocked(execFileSync).mockImplementation((cmd: unknown, args: unknown) => {
        const argStr = (args as string[])?.join(' ') ?? '';
        if (cmd === 'which' && argStr.includes('osascript')) return Buffer.from('/usr/bin/osascript');
        throw new Error('not found');
      });
      mockSpawn.mockImplementationOnce(() => { throw new Error('spawn failed'); });
      const result = await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silentSuccess when notify-send spawn throws', async () => {
      vi.mocked(execFileSync).mockImplementation((cmd: unknown, args: unknown) => {
        const argStr = (args as string[])?.join(' ') ?? '';
        if (cmd === 'which' && argStr.includes('osascript')) throw new Error('not found');
        if (cmd === 'which' && argStr.includes('notify-send')) return Buffer.from('/usr/bin/notify-send');
        return Buffer.from('');
      });
      mockSpawn.mockImplementationOnce(() => { throw new Error('spawn failed'); });
      const result = await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles empty message gracefully', async () => {
      const result = await desktopNotification(createNotificationInput('permission_prompt', ''), testCtx);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles undefined tool_input gracefully', async () => {
      const input = createToolInput({
        tool_input: undefined as unknown as Record<string, unknown>,
      });
      await expect(desktopNotification(input)).resolves.not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test.each([
      'permission_prompt', 'idle_prompt', 'auth_success', 'task_complete', 'error', '',
    ])('always returns { continue: true, suppressOutput: true } for type=%s', async (notificationType) => {
      const result = await desktopNotification(createNotificationInput(notificationType), testCtx);
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    test('never blocks execution even on internal errors', async () => {
      vi.mocked(execFileSync).mockImplementation(() => { throw new Error('catastrophic failure'); });
      const result = await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('result has no stopReason or systemMessage', async () => {
      const result = await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect(result.stopReason).toBeUndefined();
      expect(result.systemMessage).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // No sound in osascript (sound handled by sound.ts)
  // ---------------------------------------------------------------------------

  describe('no sound in osascript', () => {
    test('osascript script does not include sound name parameter', async () => {
      await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect(osascriptScript()).not.toContain('sound name');
    });
  });

  // ---------------------------------------------------------------------------
  // Input field fallbacks
  // ---------------------------------------------------------------------------

  describe('input field fallbacks', () => {
    test('falls back to input.message when tool_input.message is absent', async () => {
      const input = createToolInput({
        tool_input: { notification_type: 'permission_prompt' },
        message: 'Fallback message from input',
        notification_type: 'permission_prompt',
      });
      await desktopNotification(input, testCtx);
      expect(osascriptScript()).toContain('Fallback message from input');
    });

    test('falls back to input.notification_type when tool_input.notification_type is absent', async () => {
      const input = createToolInput({
        tool_input: { message: 'some message' },
        notification_type: 'permission_prompt',
        message: 'some message',
      });
      await desktopNotification(input, testCtx);
      expect((mockSpawn.mock.calls as any[][]).filter((c: any[]) => c[0] === 'osascript')).toHaveLength(1);
    });

    test('prefers root-level notification_type over tool_input', async () => {
      const input = createToolInput({
        notification_type: 'permission_prompt',
        tool_input: { notification_type: 'idle_prompt' },
      });
      await desktopNotification(input, testCtx);
      expect(osascriptScript()).toContain('needs approval');
    });
  });

  // ---------------------------------------------------------------------------
  // Command cache behavior
  // ---------------------------------------------------------------------------

  describe('command cache behavior', () => {
    test('caches hasCommand result across multiple calls', async () => {
      const input = createNotificationInput('permission_prompt');
      await desktopNotification(input, testCtx);
      await desktopNotification(input, testCtx);
      const checkCalls = vi.mocked(execFileSync).mock.calls.filter(
        ([cmd, args]) => cmd === 'which' && (args as string[])?.[0] === 'osascript',
      );
      expect(checkCalls).toHaveLength(1);
    });

    test('cache is reset by _resetCommandCacheForTesting', async () => {
      const input = createNotificationInput('permission_prompt');
      await desktopNotification(input, testCtx);
      _resetCommandCacheForTesting();
      await desktopNotification(input, testCtx);
      const checkCalls = vi.mocked(execFileSync).mock.calls.filter(
        ([cmd, args]) => cmd === 'which' && (args as string[])?.[0] === 'osascript',
      );
      expect(checkCalls).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Repo name extraction
  // ---------------------------------------------------------------------------

  describe('repo name extraction', () => {
    test('uses basename of project directory as title', async () => {
      vi.mocked(getProjectDir).mockReturnValue('/Users/dev/projects/my-app');
      (testCtx as any).projectDir = '/Users/dev/projects/my-app';
      await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect(osascriptScript()).toContain('my-app');
    });

    test('falls back to "Claude Code" when getProjectDir throws', async () => {
      vi.mocked(getProjectDir).mockImplementation(() => { throw new Error('not available'); });
      await desktopNotification(createNotificationInput('permission_prompt'), testCtx);
      expect(osascriptScript()).toContain('Claude Code');
    });
  });
});

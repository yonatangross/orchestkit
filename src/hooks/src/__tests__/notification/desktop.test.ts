/**
 * Unit tests for desktop notification hook
 * Tests macOS/Linux notification dispatching, message formatting, and platform detection.
 *
 * CC 2.1.7 Compliance: All code paths must return { continue: true, suppressOutput: true }
 *
 * Issue #257: notification hooks 0% -> 100% coverage
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

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
  execSync: vi.fn(),
}));

vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path');
  return {
    ...actual,
    basename: actual.basename,
  };
});

// =============================================================================
// Imports (after mocks)
// =============================================================================

import { desktopNotification, _resetCommandCacheForTesting } from '../../notification/desktop.js';
import { outputSilentSuccess, getProjectDir, getCachedBranch } from '../../lib/common.js';
import { execSync } from 'node:child_process';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a Notification HookInput for testing
 */
function createToolInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    hook_event: 'Notification',
    tool_name: 'Notification',
    session_id: 'test-session-123',
    tool_input: {},
    ...overrides,
  };
}

/**
 * Create a Notification HookInput with specific notification_type and message
 */
function createNotificationInput(
  notificationType: string,
  message = 'Test notification message',
): HookInput {
  return createToolInput({
    tool_input: {
      notification_type: notificationType,
      message,
    },
    message,
    notification_type: notificationType,
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('notification/desktop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetCommandCacheForTesting();
    // Default: osascript available, notify-send not available
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd === 'command -v osascript') return Buffer.from('/usr/bin/osascript');
      if (cmd === 'command -v notify-send') throw new Error('not found');
      // osascript display notification calls
      if (typeof cmd === 'string' && cmd.startsWith('osascript')) return Buffer.from('');
      return Buffer.from('');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Notification type filtering
  // ---------------------------------------------------------------------------

  describe('notification type filtering', () => {
    test('triggers notification for permission_prompt', () => {
      // Arrange
      const input = createNotificationInput('permission_prompt');

      // Act
      const result = desktopNotification(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // execSync called for hasCommand('osascript') + the actual osascript call
      expect(execSync).toHaveBeenCalled();
    });

    test('triggers notification for idle_prompt', () => {
      // Arrange
      const input = createNotificationInput('idle_prompt');

      // Act
      const result = desktopNotification(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(execSync).toHaveBeenCalled();
    });

    test.each([
      'auth_success',
      'task_complete',
      'error',
      'info',
      'warning',
      '',
    ])('silently passes through for notification_type=%s', (notificationType) => {
      // Arrange
      const input = createNotificationInput(notificationType);

      // Act
      const result = desktopNotification(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('silently passes through when notification_type is missing', () => {
      // Arrange
      const input = createToolInput({
        tool_input: { message: 'some message' },
      });

      // Act
      const result = desktopNotification(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // AppleScript escaping
  // ---------------------------------------------------------------------------

  describe('AppleScript escaping', () => {
    test('escapes double quotes in notification message', () => {
      // Arrange
      const input = createNotificationInput(
        'permission_prompt',
        'Allow "rm -rf" command?',
      );

      // Act
      desktopNotification(input);

      // Assert - the osascript call should have escaped quotes
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBeGreaterThan(0);
      const osascriptCmd = osascriptCalls[0][0] as string;
      expect(osascriptCmd).toContain('\\"');
      expect(osascriptCmd).not.toContain('""');
    });

    test('escapes backslashes in notification message', () => {
      // Arrange
      const input = createNotificationInput(
        'permission_prompt',
        'Path: C:\\Users\\test',
      );

      // Act
      desktopNotification(input);

      // Assert
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBeGreaterThan(0);
      const osascriptCmd = osascriptCalls[0][0] as string;
      expect(osascriptCmd).toContain('\\\\');
    });

    test('handles message with both quotes and backslashes', () => {
      // Arrange
      const input = createNotificationInput(
        'permission_prompt',
        'Allow "write" to C:\\dir\\file?',
      );

      // Act
      desktopNotification(input);

      // Assert
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBeGreaterThan(0);
      const osascriptCmd = osascriptCalls[0][0] as string;
      // Both types of escaping should be present
      expect(osascriptCmd).toContain('\\"');   // escaped quotes
      expect(osascriptCmd).toContain('\\\\'); // escaped backslashes
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
      // Case-insensitive matching (regex /i flag)
      ['Feature/99-upper-case', '#99'],
      ['FIX/100-uppercase-fix', '#100'],
      ['BUG/101-uppercase-bug', '#101'],
      ['ISSUE/102-uppercase-issue', '#102'],
    ])('extracts issue number from branch %s as %s', (branch, expectedIssue) => {
      // Arrange
      vi.mocked(getCachedBranch).mockReturnValue(branch);
      const input = createNotificationInput('permission_prompt');

      // Act
      desktopNotification(input);

      // Assert - the osascript call should include the issue number in subtitle
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBeGreaterThan(0);
      const osascriptCmd = osascriptCalls[0][0] as string;
      expect(osascriptCmd).toContain(expectedIssue);
    });

    test.each([
      'main',
      'develop',
      'release/v2.0',
      'hotfix-urgent',
      'feature-no-number',
      'refactor/cleanup',
    ])('returns null for branch without issue number: %s', (branch) => {
      // Arrange
      vi.mocked(getCachedBranch).mockReturnValue(branch);
      const input = createNotificationInput('permission_prompt');

      // Act
      desktopNotification(input);

      // Assert - the osascript call should NOT contain a # issue reference
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBeGreaterThan(0);
      const osascriptCmd = osascriptCalls[0][0] as string;
      // Should not contain #<digits> pattern in subtitle
      expect(osascriptCmd).not.toMatch(/#\d+/);
    });
  });

  // ---------------------------------------------------------------------------
  // Subtitle building
  // ---------------------------------------------------------------------------

  describe('subtitle building', () => {
    test('includes permission label for permission_prompt', () => {
      // Arrange
      vi.mocked(getCachedBranch).mockReturnValue('main');
      const input = createNotificationInput('permission_prompt');

      // Act
      desktopNotification(input);

      // Assert
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBeGreaterThan(0);
      const osascriptCmd = osascriptCalls[0][0] as string;
      expect(osascriptCmd).toContain('Permission needed');
    });

    test('includes waiting label for idle_prompt', () => {
      // Arrange
      vi.mocked(getCachedBranch).mockReturnValue('main');
      const input = createNotificationInput('idle_prompt');

      // Act
      desktopNotification(input);

      // Assert
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBeGreaterThan(0);
      const osascriptCmd = osascriptCalls[0][0] as string;
      expect(osascriptCmd).toContain('Waiting');
    });

    test('includes issue number and branch in subtitle when available', () => {
      // Arrange
      vi.mocked(getCachedBranch).mockReturnValue('feature/235-foo');
      const input = createNotificationInput('permission_prompt');

      // Act
      desktopNotification(input);

      // Assert
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBeGreaterThan(0);
      const osascriptCmd = osascriptCalls[0][0] as string;
      expect(osascriptCmd).toContain('#235');
      expect(osascriptCmd).toContain('feature/235-foo');
    });

    test('omits issue number when branch has none', () => {
      // Arrange
      vi.mocked(getCachedBranch).mockReturnValue('main');
      const input = createNotificationInput('permission_prompt');

      // Act
      desktopNotification(input);

      // Assert
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBeGreaterThan(0);
      const osascriptCmd = osascriptCalls[0][0] as string;
      expect(osascriptCmd).toContain('main');
      expect(osascriptCmd).not.toMatch(/#\d+/);
    });
  });

  // ---------------------------------------------------------------------------
  // Message truncation
  // ---------------------------------------------------------------------------

  describe('message truncation', () => {
    test('does not truncate messages under 120 characters', () => {
      // Arrange
      const shortMessage = 'Allow read access to /test/file.ts?';
      const input = createNotificationInput('permission_prompt', shortMessage);

      // Act
      desktopNotification(input);

      // Assert
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBeGreaterThan(0);
      const osascriptCmd = osascriptCalls[0][0] as string;
      expect(osascriptCmd).toContain(shortMessage);
      expect(osascriptCmd).not.toContain('...');
    });

    test('truncates messages over 120 characters with ellipsis', () => {
      // Arrange
      const longMessage = 'A'.repeat(200);
      const input = createNotificationInput('permission_prompt', longMessage);

      // Act
      desktopNotification(input);

      // Assert
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBeGreaterThan(0);
      const osascriptCmd = osascriptCalls[0][0] as string;
      expect(osascriptCmd).toContain('...');
      // Message in the command should not contain the full 200 chars
      expect(osascriptCmd).not.toContain('A'.repeat(200));
    });

    test('message of exactly 120 characters is not truncated', () => {
      // Arrange
      const exactMessage = 'B'.repeat(120);
      const input = createNotificationInput('permission_prompt', exactMessage);

      // Act
      desktopNotification(input);

      // Assert
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBeGreaterThan(0);
      const osascriptCmd = osascriptCalls[0][0] as string;
      expect(osascriptCmd).toContain(exactMessage);
      expect(osascriptCmd).not.toContain('...');
    });
  });

  // ---------------------------------------------------------------------------
  // Platform detection
  // ---------------------------------------------------------------------------

  describe('platform detection', () => {
    test('sends macOS notification when osascript is available', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'command -v osascript') return Buffer.from('/usr/bin/osascript');
        if (typeof cmd === 'string' && cmd.startsWith('osascript')) return Buffer.from('');
        throw new Error('not found');
      });
      const input = createNotificationInput('permission_prompt');

      // Act
      desktopNotification(input);

      // Assert - osascript display notification was called
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBe(1);
    });

    test('sends Linux notification when only notify-send is available', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'command -v osascript') throw new Error('not found');
        if (cmd === 'command -v notify-send') return Buffer.from('/usr/bin/notify-send');
        if (typeof cmd === 'string' && cmd.startsWith('notify-send')) return Buffer.from('');
        return Buffer.from('');
      });
      const input = createNotificationInput('permission_prompt');

      // Act
      desktopNotification(input);

      // Assert - notify-send was called
      const notifySendCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('notify-send'),
      );
      // One for command -v check, one for the actual notification
      expect(notifySendCalls.length).toBe(2);
    });

    test('prefers osascript over notify-send when both available', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'command -v osascript') return Buffer.from('/usr/bin/osascript');
        if (cmd === 'command -v notify-send') return Buffer.from('/usr/bin/notify-send');
        if (typeof cmd === 'string' && cmd.startsWith('osascript')) return Buffer.from('');
        if (typeof cmd === 'string' && cmd.startsWith('notify-send')) return Buffer.from('');
        return Buffer.from('');
      });
      const input = createNotificationInput('permission_prompt');

      // Act
      desktopNotification(input);

      // Assert - osascript was used, not notify-send
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      const notifySendActionCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.startsWith('notify-send --'),
      );
      expect(osascriptCalls.length).toBe(1);
      expect(notifySendActionCalls.length).toBe(0);
    });

    test('no notification sent when neither osascript nor notify-send available', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'command -v osascript') throw new Error('not found');
        if (cmd === 'command -v notify-send') throw new Error('not found');
        throw new Error('not found');
      });
      const input = createNotificationInput('permission_prompt');

      // Act
      const result = desktopNotification(input);

      // Assert - still returns silentSuccess
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    test('returns silentSuccess when osascript call fails', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'command -v osascript') return Buffer.from('/usr/bin/osascript');
        if (typeof cmd === 'string' && cmd.startsWith('osascript')) {
          throw new Error('osascript execution failed');
        }
        throw new Error('not found');
      });
      const input = createNotificationInput('permission_prompt');

      // Act
      const result = desktopNotification(input);

      // Assert - must not crash, must return silentSuccess
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silentSuccess when notify-send call fails', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'command -v osascript') throw new Error('not found');
        if (cmd === 'command -v notify-send') return Buffer.from('/usr/bin/notify-send');
        if (typeof cmd === 'string' && cmd.startsWith('notify-send')) {
          throw new Error('notify-send execution failed');
        }
        throw new Error('not found');
      });
      const input = createNotificationInput('permission_prompt');

      // Act
      const result = desktopNotification(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles empty message gracefully', () => {
      // Arrange
      const input = createNotificationInput('permission_prompt', '');

      // Act
      const result = desktopNotification(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles undefined tool_input gracefully', () => {
      // Arrange
      const input = createToolInput({
        tool_input: undefined as unknown as Record<string, unknown>,
      });

      // Act & Assert - should not throw
      expect(() => desktopNotification(input)).not.toThrow();
    });

  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test.each([
      'permission_prompt',
      'idle_prompt',
      'auth_success',
      'task_complete',
      'error',
      '',
    ])('always returns { continue: true, suppressOutput: true } for type=%s', (notificationType) => {
      // Arrange
      const input = createNotificationInput(notificationType);

      // Act
      const result = desktopNotification(input);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    test('never blocks execution even on internal errors', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('catastrophic failure');
      });
      const input = createNotificationInput('permission_prompt');

      // Act
      const result = desktopNotification(input);

      // Assert - must continue even if everything fails
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('result has no stopReason or systemMessage', () => {
      // Arrange
      const input = createNotificationInput('permission_prompt');

      // Act
      const result = desktopNotification(input);

      // Assert
      expect(result.stopReason).toBeUndefined();
      expect(result.systemMessage).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // No sound in osascript (sound handled by sound.ts)
  // ---------------------------------------------------------------------------

  describe('no sound in osascript', () => {
    test('osascript command does not include sound name parameter', () => {
      // Arrange
      const input = createNotificationInput('permission_prompt');

      // Act
      desktopNotification(input);

      // Assert - sound.ts handles sound, desktop.ts should not include sound name
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBe(1);
      expect(osascriptCalls[0][0]).not.toContain('sound name');
    });
  });

  // ---------------------------------------------------------------------------
  // Input field fallbacks
  // ---------------------------------------------------------------------------

  describe('input field fallbacks', () => {
    test('falls back to input.message when tool_input.message is absent', () => {
      // Arrange - tool_input has notification_type but no message
      const input = createToolInput({
        tool_input: { notification_type: 'permission_prompt' },
        message: 'Fallback message from input',
        notification_type: 'permission_prompt',
      });

      // Act
      desktopNotification(input);

      // Assert
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBe(1);
      expect(osascriptCalls[0][0]).toContain('Fallback message from input');
    });

    test('falls back to input.notification_type when tool_input.notification_type is absent', () => {
      // Arrange - tool_input has message but no notification_type
      const input = createToolInput({
        tool_input: { message: 'some message' },
        notification_type: 'permission_prompt',
        message: 'some message',
      });

      // Act
      desktopNotification(input);

      // Assert - should have triggered because input.notification_type = 'permission_prompt'
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Command cache behavior
  // ---------------------------------------------------------------------------

  describe('command cache behavior', () => {
    test('caches hasCommand result across multiple calls', () => {
      // Arrange
      const input = createNotificationInput('permission_prompt');

      // Act - call twice
      desktopNotification(input);
      desktopNotification(input);

      // Assert - command -v osascript should only be called once (cached)
      const checkCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => cmd === 'command -v osascript',
      );
      expect(checkCalls).toHaveLength(1);
    });

    test('cache is reset by _resetCommandCacheForTesting', () => {
      // Arrange - first call caches the result
      const input = createNotificationInput('permission_prompt');
      desktopNotification(input);

      // Act - reset cache, call again
      _resetCommandCacheForTesting();
      desktopNotification(input);

      // Assert - command -v osascript called twice (once before reset, once after)
      const checkCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => cmd === 'command -v osascript',
      );
      expect(checkCalls).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Repo name extraction
  // ---------------------------------------------------------------------------

  describe('repo name extraction', () => {
    test('uses basename of project directory as title', () => {
      // Arrange
      vi.mocked(getProjectDir).mockReturnValue('/Users/dev/projects/my-app');
      const input = createNotificationInput('permission_prompt');

      // Act
      desktopNotification(input);

      // Assert
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBe(1);
      expect(osascriptCalls[0][0]).toContain('my-app');
    });

    test('falls back to "Claude Code" when getProjectDir throws', () => {
      // Arrange
      vi.mocked(getProjectDir).mockImplementation(() => {
        throw new Error('not available');
      });
      const input = createNotificationInput('permission_prompt');

      // Act
      desktopNotification(input);

      // Assert
      const osascriptCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('display notification'),
      );
      expect(osascriptCalls.length).toBe(1);
      expect(osascriptCalls[0][0]).toContain('Claude Code');
    });
  });
});

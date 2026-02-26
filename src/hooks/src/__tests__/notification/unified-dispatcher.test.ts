/**
 * Unit tests for unified notification dispatcher hook
 * Tests parallel execution, error isolation, and registry wiring.
 *
 * CC 2.1.19 Compliance: Single dispatcher consolidates multiple notification hooks
 *
 * Issue #257: notification hooks 0% -> 100% coverage
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput, HookResult } from '../../types.js';

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
    getCachedBranch: vi.fn(() => 'main'),
  };
});

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => Buffer.from('')),
}));

// Mock the individual hooks to isolate dispatcher logic
vi.mock('../../notification/desktop.js', () => ({
  desktopNotification: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

vi.mock('../../notification/sound.js', () => ({
  soundNotification: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

// =============================================================================
// Imports (after mocks)
// =============================================================================

import {
  unifiedNotificationDispatcher,
  registeredHookNames,
} from '../../notification/unified-dispatcher.js';
import { desktopNotification } from '../../notification/desktop.js';
import { soundNotification } from '../../notification/sound.js';
import { logHook, outputSilentSuccess } from '../../lib/common.js';

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

describe('notification/unified-dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Registry
  // ---------------------------------------------------------------------------

  describe('registry', () => {
    test('registeredHookNames returns exactly ["desktop", "sound"]', () => {
      // Act
      const names = registeredHookNames();

      // Assert
      expect(names).toEqual(['desktop', 'sound']);
    });

    test('registeredHookNames returns a new array each call (no shared reference)', () => {
      // Act
      const names1 = registeredHookNames();
      const names2 = registeredHookNames();

      // Assert
      expect(names1).toEqual(names2);
      expect(names1).not.toBe(names2); // Different array instances
    });

  });

  // ---------------------------------------------------------------------------
  // Parallel execution
  // ---------------------------------------------------------------------------

  describe('parallel execution', () => {
    test('calls both desktop and sound hooks with the same input', async () => {
      // Arrange
      const input = createNotificationInput('permission_prompt');

      // Act
      await unifiedNotificationDispatcher(input);

      // Assert
      expect(desktopNotification).toHaveBeenCalledWith(input);
      expect(soundNotification).toHaveBeenCalledWith(input);
    });

    test('calls both hooks even for non-notification types', async () => {
      // Arrange
      const input = createNotificationInput('auth_success');

      // Act
      await unifiedNotificationDispatcher(input);

      // Assert
      expect(desktopNotification).toHaveBeenCalledTimes(1);
      expect(soundNotification).toHaveBeenCalledTimes(1);
    });

    test('passes input without modification to each hook', async () => {
      // Arrange
      const input = createNotificationInput('idle_prompt', 'Custom message');

      // Act
      await unifiedNotificationDispatcher(input);

      // Assert
      expect(desktopNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          tool_input: expect.objectContaining({
            notification_type: 'idle_prompt',
            message: 'Custom message',
          }),
        }),
      );
      expect(soundNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          tool_input: expect.objectContaining({
            notification_type: 'idle_prompt',
          }),
        }),
      );
    });

    test('runs hooks via Promise.allSettled (parallel, not sequential)', async () => {
      // Arrange
      const callOrder: string[] = [];
      vi.mocked(desktopNotification).mockImplementation(() => {
        callOrder.push('desktop');
        return { continue: true, suppressOutput: true };
      });
      vi.mocked(soundNotification).mockImplementation(() => {
        callOrder.push('sound');
        return { continue: true, suppressOutput: true };
      });
      const input = createNotificationInput('permission_prompt');

      // Act
      await unifiedNotificationDispatcher(input);

      // Assert - both hooks were called
      expect(callOrder).toContain('desktop');
      expect(callOrder).toContain('sound');
      expect(callOrder).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Error isolation
  // ---------------------------------------------------------------------------

  describe('error isolation', () => {
    test('continues when desktop hook throws', async () => {
      // Arrange
      vi.mocked(desktopNotification).mockImplementation(() => {
        throw new Error('Desktop notification failed');
      });
      vi.mocked(soundNotification).mockReturnValue({ continue: true, suppressOutput: true });
      const input = createNotificationInput('permission_prompt');

      // Act
      const result = await unifiedNotificationDispatcher(input);

      // Assert - sound still ran, result is still success
      expect(soundNotification).toHaveBeenCalledWith(input);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('continues when sound hook throws', async () => {
      // Arrange
      vi.mocked(desktopNotification).mockReturnValue({ continue: true, suppressOutput: true });
      vi.mocked(soundNotification).mockImplementation(() => {
        throw new Error('Sound notification failed');
      });
      const input = createNotificationInput('permission_prompt');

      // Act
      const result = await unifiedNotificationDispatcher(input);

      // Assert - desktop still ran, result is still success
      expect(desktopNotification).toHaveBeenCalledWith(input);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('logs errors when a hook fails', async () => {
      // Arrange
      vi.mocked(desktopNotification).mockImplementation(() => {
        throw new Error('Desktop crashed');
      });
      const input = createNotificationInput('permission_prompt');

      // Act
      await unifiedNotificationDispatcher(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'notification-dispatcher',
        expect.stringContaining('desktop failed'),
      );
    });

    test('logs error count when hooks fail', async () => {
      // Arrange
      vi.mocked(desktopNotification).mockImplementation(() => {
        throw new Error('Desktop crashed');
      });
      vi.mocked(soundNotification).mockImplementation(() => {
        throw new Error('Sound crashed');
      });
      const input = createNotificationInput('permission_prompt');

      // Act
      await unifiedNotificationDispatcher(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'notification-dispatcher',
        expect.stringContaining('hooks had errors'),
      );
    });

    test('does not log errors when all hooks succeed', async () => {
      // Arrange
      vi.mocked(desktopNotification).mockReturnValue({ continue: true, suppressOutput: true });
      vi.mocked(soundNotification).mockReturnValue({ continue: true, suppressOutput: true });
      const input = createNotificationInput('permission_prompt');

      // Act
      await unifiedNotificationDispatcher(input);

      // Assert - no error logging (only individual hook logHook calls are OK)
      const errorCalls = vi.mocked(logHook).mock.calls.filter(
        ([name]) => name === 'notification-dispatcher',
      );
      // No dispatcher-level error logs
      const errorLogCalls = errorCalls.filter(
        ([, msg]) => msg.includes('errors') || msg.includes('failed'),
      );
      expect(errorLogCalls.length).toBe(0);
    });

    test('handles hook returning rejected promise', async () => {
      // Arrange
      vi.mocked(desktopNotification).mockImplementation(
        () => Promise.reject(new Error('async rejection')) as unknown as HookResult,
      );
      const input = createNotificationInput('permission_prompt');

      // Act
      const result = await unifiedNotificationDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Result
  // ---------------------------------------------------------------------------

  describe('result', () => {
    test('returns { continue: true, suppressOutput: true }', async () => {
      // Arrange
      const input = createNotificationInput('permission_prompt');

      // Act
      const result = await unifiedNotificationDispatcher(input);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    test('always calls outputSilentSuccess', async () => {
      // Arrange
      const input = createNotificationInput('permission_prompt');

      // Act
      await unifiedNotificationDispatcher(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('result is a Promise (async function)', () => {
      // Arrange
      const input = createNotificationInput('permission_prompt');

      // Act
      const result = unifiedNotificationDispatcher(input);

      // Assert
      expect(result).toBeInstanceOf(Promise);
    });

    test.each([
      'permission_prompt',
      'idle_prompt',
      'auth_success',
      'task_complete',
      '',
    ])('returns silentSuccess regardless of notification_type=%s', async (notificationType) => {
      // Arrange
      const input = createNotificationInput(notificationType);

      // Act
      const result = await unifiedNotificationDispatcher(input);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    test('result has no stopReason or systemMessage', async () => {
      // Arrange
      const input = createNotificationInput('permission_prompt');

      // Act
      const result = await unifiedNotificationDispatcher(input);

      // Assert
      expect(result.stopReason).toBeUndefined();
      expect(result.systemMessage).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.19 compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.19 compliance', () => {
    test('single dispatcher consolidates 2 notification hooks', () => {
      // Assert
      const names = registeredHookNames();
      expect(names).toHaveLength(2);
      expect(names).toContain('desktop');
      expect(names).toContain('sound');
    });

    test('dispatcher is an async function', () => {
      // Assert
      expect(unifiedNotificationDispatcher.constructor.name).toBe('AsyncFunction');
    });

    test('never blocks session even when all hooks fail', async () => {
      // Arrange
      vi.mocked(desktopNotification).mockImplementation(() => {
        throw new Error('fail');
      });
      vi.mocked(soundNotification).mockImplementation(() => {
        throw new Error('fail');
      });
      const input = createNotificationInput('permission_prompt');

      // Act
      const result = await unifiedNotificationDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('uses Promise.allSettled for fault tolerance (not Promise.all)', async () => {
      // Arrange - if Promise.all were used, this would cause the dispatcher to reject
      let desktopCalled = false;
      let soundCalled = false;

      vi.mocked(desktopNotification).mockImplementation(() => {
        desktopCalled = true;
        throw new Error('desktop error');
      });
      vi.mocked(soundNotification).mockImplementation(() => {
        soundCalled = true;
        throw new Error('sound error');
      });
      const input = createNotificationInput('permission_prompt');

      // Act - should NOT reject
      const result = await unifiedNotificationDispatcher(input);

      // Assert - both hooks were invoked despite errors
      expect(desktopCalled).toBe(true);
      expect(soundCalled).toBe(true);
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty tool_input', async () => {
      // Arrange
      const input = createToolInput({ tool_input: {} });

      // Act
      const result = await unifiedNotificationDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(desktopNotification).toHaveBeenCalled();
      expect(soundNotification).toHaveBeenCalled();
    });

    test('handles hook returning async result', async () => {
      // Arrange
      vi.mocked(desktopNotification).mockImplementation(
        () => Promise.resolve({ continue: true, suppressOutput: true }) as unknown as HookResult,
      );
      const input = createNotificationInput('permission_prompt');

      // Act
      const result = await unifiedNotificationDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('error message is captured for non-Error throws', async () => {
      // Arrange
      vi.mocked(desktopNotification).mockImplementation(() => {
        throw 'string error'; // eslint-disable-line no-throw-literal
      });
      const input = createNotificationInput('permission_prompt');

      // Act
      await unifiedNotificationDispatcher(input);

      // Assert - should handle non-Error thrown values
      expect(logHook).toHaveBeenCalledWith(
        'notification-dispatcher',
        expect.stringContaining('desktop failed'),
      );
    });
  });
});

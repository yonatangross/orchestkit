/**
 * Unit tests for sound notification hook
 * Tests macOS sound playback via detached afplay spawn, sound mapping, and error resilience.
 *
 * CC 2.1.7 Compliance: All code paths must return { continue: true, suppressOutput: true }
 *
 * Issue #257: notification hooks 0% -> 100% coverage
 * Fix: execSync + & replaced with spawn({ detached: true }) for reliable playback
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
  };
});

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  spawn: mockSpawn,
}));

// =============================================================================
// Imports (after mocks)
// =============================================================================

import { soundNotification } from '../../notification/sound.js';
import { outputSilentSuccess, logHook } from '../../lib/common.js';
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
 * Create a Notification HookInput with specific notification_type
 */
function createSoundInput(notificationType: string): HookInput {
  return createToolInput({
    tool_input: {
      notification_type: notificationType,
    },
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('notification/sound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: afplay is available
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd === 'command -v afplay') return Buffer.from('/usr/bin/afplay');
      return Buffer.from('');
    });
    mockSpawn.mockReturnValue({ unref: mockUnref });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Sound mapping
  // ---------------------------------------------------------------------------

  describe('sound mapping', () => {
    test('plays Sosumi for permission_prompt', () => {
      // Arrange
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'afplay',
        ['/System/Library/Sounds/Sosumi.aiff'],
        expect.objectContaining({ stdio: 'ignore', detached: true }),
      );
    });

    test('plays Ping for idle_prompt', () => {
      // Arrange
      const input = createSoundInput('idle_prompt');

      // Act
      soundNotification(input);

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'afplay',
        ['/System/Library/Sounds/Ping.aiff'],
        expect.objectContaining({ stdio: 'ignore', detached: true }),
      );
    });

    test('plays Glass for auth_success', () => {
      // Arrange
      const input = createSoundInput('auth_success');

      // Act
      soundNotification(input);

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'afplay',
        ['/System/Library/Sounds/Glass.aiff'],
        expect.objectContaining({ stdio: 'ignore', detached: true }),
      );
    });

    test.each([
      ['permission_prompt', '/System/Library/Sounds/Sosumi.aiff'],
      ['idle_prompt', '/System/Library/Sounds/Ping.aiff'],
      ['auth_success', '/System/Library/Sounds/Glass.aiff'],
    ])('maps %s to %s', (notificationType, expectedPath) => {
      // Arrange
      const input = createSoundInput(notificationType);

      // Act
      soundNotification(input);

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'afplay',
        [expectedPath],
        expect.objectContaining({ stdio: 'ignore', detached: true }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Unknown notification types
  // ---------------------------------------------------------------------------

  describe('unknown notification types', () => {
    test.each([
      'task_complete',
      'error',
      'warning',
      'info',
      'unknown_type',
      '',
    ])('does not play sound for unknown type: %s', (notificationType) => {
      // Arrange
      const input = createSoundInput(notificationType);

      // Act
      soundNotification(input);

      // Assert - spawn should not have been called
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    test('does not play sound when notification_type is missing from tool_input', () => {
      // Arrange
      const input = createToolInput({
        tool_input: { message: 'no type here' },
      });

      // Act
      soundNotification(input);

      // Assert
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // afplay availability
  // ---------------------------------------------------------------------------

  describe('afplay availability', () => {
    test('checks for afplay via command -v', () => {
      // Arrange
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert
      expect(execSync).toHaveBeenCalledWith('command -v afplay', { stdio: 'ignore' });
    });

    test('does not play sound when afplay is not available', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'command -v afplay') throw new Error('not found');
        return Buffer.from('');
      });
      const input = createSoundInput('permission_prompt');

      // Act
      const result = soundNotification(input);

      // Assert - spawn should not have been called
      expect(mockSpawn).not.toHaveBeenCalled();
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('plays sound when afplay is available', () => {
      // Arrange
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Detached process behavior (the core fix)
  // ---------------------------------------------------------------------------

  describe('detached process behavior', () => {
    test('spawns afplay with detached: true so it survives parent exit', () => {
      // Arrange
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'afplay',
        expect.any(Array),
        expect.objectContaining({ detached: true }),
      );
    });

    test('calls unref() on spawned child to allow parent process to exit', () => {
      // Arrange
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert
      expect(mockUnref).toHaveBeenCalledTimes(1);
    });

    test('passes sound file as argv argument (not shell-interpolated)', () => {
      // Arrange
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert - second arg is an array with the sound path (no shell interpolation)
      expect(mockSpawn).toHaveBeenCalledWith(
        'afplay',
        ['/System/Library/Sounds/Sosumi.aiff'],
        expect.any(Object),
      );
    });

    test('uses stdio: ignore to prevent fd leaks', () => {
      // Arrange
      const input = createSoundInput('idle_prompt');

      // Act
      soundNotification(input);

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'afplay',
        expect.any(Array),
        expect.objectContaining({ stdio: 'ignore' }),
      );
    });

    test('does not call unref when no sound is played (unmapped type)', () => {
      // Arrange
      const input = createSoundInput('unknown_type');

      // Act
      soundNotification(input);

      // Assert
      expect(mockUnref).not.toHaveBeenCalled();
    });

    test('does not call unref when afplay is unavailable', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not found');
      });
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert
      expect(mockSpawn).not.toHaveBeenCalled();
      expect(mockUnref).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    test('returns silentSuccess when spawn throws', () => {
      // Arrange
      mockSpawn.mockImplementation(() => {
        throw new Error('spawn ENOENT');
      });
      const input = createSoundInput('permission_prompt');

      // Act
      const result = soundNotification(input);

      // Assert - must not crash
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silentSuccess when unref throws', () => {
      // Arrange
      mockUnref.mockImplementation(() => {
        throw new Error('unref failed');
      });
      const input = createSoundInput('permission_prompt');

      // Act
      const result = soundNotification(input);

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
      expect(() => soundNotification(input)).not.toThrow();
    });

    test('handles null tool_input gracefully', () => {
      // Arrange
      const input = createToolInput({
        tool_input: null as unknown as Record<string, unknown>,
      });

      // Act & Assert - should not throw
      expect(() => soundNotification(input)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  describe('logging', () => {
    test('logs notification type on every invocation', () => {
      // Arrange
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'sound',
        expect.stringContaining('permission_prompt'),
      );
    });

    test('logs empty string for missing notification_type', () => {
      // Arrange
      const input = createSoundInput('');

      // Act
      soundNotification(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith('sound', expect.stringContaining('[]'));
    });
  });

  // ---------------------------------------------------------------------------
  // CC compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('always calls outputSilentSuccess', () => {
      // Arrange
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test.each([
      'permission_prompt',
      'idle_prompt',
      'auth_success',
      'task_complete',
      'unknown',
      '',
    ])('returns { continue: true, suppressOutput: true } for type=%s', (notificationType) => {
      // Arrange
      const input = createSoundInput(notificationType);

      // Act
      const result = soundNotification(input);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    test('never blocks execution', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('total failure');
      });
      const input = createSoundInput('permission_prompt');

      // Act
      const result = soundNotification(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('result has no stopReason or systemMessage', () => {
      // Arrange
      const input = createSoundInput('permission_prompt');

      // Act
      const result = soundNotification(input);

      // Assert
      expect(result.stopReason).toBeUndefined();
      expect(result.systemMessage).toBeUndefined();
    });
  });
});

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

import {
  soundNotification,
  _resetAfplayCacheForTesting,
  _resetLinuxPlayerCacheForTesting,
} from '../../notification/sound.js';
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
    _resetAfplayCacheForTesting();
    _resetLinuxPlayerCacheForTesting();
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
    test.each([
      ['permission_prompt', '/System/Library/Sounds/Sosumi.aiff'],
      ['idle_prompt', '/System/Library/Sounds/Ping.aiff'],
      ['auth_success', '/System/Library/Sounds/Glass.aiff'],
      ['task_complete', '/System/Library/Sounds/Glass.aiff'],
      ['error', '/System/Library/Sounds/Basso.aiff'],
      ['warning', '/System/Library/Sounds/Funk.aiff'],
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

    test('does not play sound when afplay is not available (and no Linux player)', () => {
      // Arrange - afplay missing AND no Linux players available
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        throw new Error(`not found: ${cmd}`);
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

    test('handles spawn returning object without unref method', () => {
      // Arrange - spawn returns object with no unref (TypeError caught by try/catch)
      mockSpawn.mockReturnValue({} as any);
      const input = createSoundInput('permission_prompt');

      // Act
      const result = soundNotification(input);

      // Assert - TypeError from missing unref is swallowed
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
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

  // ---------------------------------------------------------------------------
  // Caching behavior
  // ---------------------------------------------------------------------------

  describe('afplay availability caching', () => {
    test('caches hasAfplay result across multiple calls', () => {
      // Arrange
      const input = createSoundInput('permission_prompt');

      // Act - call twice
      soundNotification(input);
      soundNotification(input);

      // Assert - command -v afplay should only be called once (cached)
      const checkCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => cmd === 'command -v afplay',
      );
      expect(checkCalls).toHaveLength(1);
    });

    test('cache is reset by _resetAfplayCacheForTesting', () => {
      // Arrange - first call caches the result
      const input = createSoundInput('permission_prompt');
      soundNotification(input);

      // Act - reset cache, call again
      _resetAfplayCacheForTesting();
      soundNotification(input);

      // Assert - command -v afplay called twice (once before reset, once after)
      const checkCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => cmd === 'command -v afplay',
      );
      expect(checkCalls).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Field resolution order
  // ---------------------------------------------------------------------------

  describe('field resolution order', () => {
    test('prefers root-level notification_type over tool_input', () => {
      // Arrange - root-level says permission_prompt, tool_input says idle_prompt
      const input = createToolInput({
        notification_type: 'permission_prompt',
        tool_input: { notification_type: 'idle_prompt' },
      });

      // Act
      soundNotification(input);

      // Assert - Sosumi.aiff (permission_prompt) played, not Ping.aiff (idle_prompt)
      expect(mockSpawn).toHaveBeenCalledWith(
        'afplay',
        ['/System/Library/Sounds/Sosumi.aiff'],
        expect.any(Object),
      );
    });

    test('falls back to tool_input.notification_type when root-level is absent', () => {
      // Arrange - no root-level notification_type, tool_input has one
      const input = createSoundInput('idle_prompt');

      // Act
      soundNotification(input);

      // Assert - Ping.aiff (idle_prompt) played
      expect(mockSpawn).toHaveBeenCalledWith(
        'afplay',
        ['/System/Library/Sounds/Ping.aiff'],
        expect.any(Object),
      );
    });

    test('logs root-level notification_type when both are present', () => {
      // Arrange
      const input = createToolInput({
        notification_type: 'auth_success',
        tool_input: { notification_type: 'permission_prompt' },
      });

      // Act
      soundNotification(input);

      // Assert - log contains auth_success, not permission_prompt
      expect(logHook).toHaveBeenCalledWith(
        'sound',
        expect.stringContaining('auth_success'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Linux sound player support
  // ---------------------------------------------------------------------------

  describe('Linux sound player support', () => {
    beforeEach(() => {
      // Simulate non-macOS: afplay not found
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'command -v afplay') throw new Error('not found');
        if (cmd === 'command -v pw-play') return Buffer.from('/usr/bin/pw-play');
        return Buffer.from('');
      });
    });

    test('detects pw-play as preferred Linux player', () => {
      // Arrange
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert - pw-play chosen as player
      expect(mockSpawn).toHaveBeenCalledWith(
        'pw-play',
        expect.any(Array),
        expect.any(Object),
      );
    });

    test('falls back to paplay when pw-play unavailable', () => {
      // Arrange - pw-play missing, paplay available
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'command -v afplay') throw new Error('not found');
        if (cmd === 'command -v pw-play') throw new Error('not found');
        if (cmd === 'command -v paplay') return Buffer.from('/usr/bin/paplay');
        return Buffer.from('');
      });
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert - paplay chosen as player
      expect(mockSpawn).toHaveBeenCalledWith(
        'paplay',
        expect.any(Array),
        expect.any(Object),
      );
    });

    test('falls back to aplay when pw-play and paplay unavailable', () => {
      // Arrange - only aplay available
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'command -v afplay') throw new Error('not found');
        if (cmd === 'command -v pw-play') throw new Error('not found');
        if (cmd === 'command -v paplay') throw new Error('not found');
        if (cmd === 'command -v aplay') return Buffer.from('/usr/bin/aplay');
        return Buffer.from('');
      });
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert - aplay chosen as player
      expect(mockSpawn).toHaveBeenCalledWith(
        'aplay',
        expect.any(Array),
        expect.any(Object),
      );
    });

    test('plays freedesktop sound for permission_prompt on Linux', () => {
      // Arrange
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert - freedesktop .oga path used
      expect(mockSpawn).toHaveBeenCalledWith(
        'pw-play',
        ['/usr/share/sounds/freedesktop/stereo/dialog-warning.oga'],
        expect.objectContaining({ stdio: 'ignore', detached: true }),
      );
    });

    test('plays freedesktop sound for idle_prompt on Linux', () => {
      // Arrange
      const input = createSoundInput('idle_prompt');

      // Act
      soundNotification(input);

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'pw-play',
        ['/usr/share/sounds/freedesktop/stereo/message-new-instant.oga'],
        expect.objectContaining({ stdio: 'ignore', detached: true }),
      );
    });

    test('plays freedesktop sound for auth_success on Linux', () => {
      // Arrange
      const input = createSoundInput('auth_success');

      // Act
      soundNotification(input);

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'pw-play',
        ['/usr/share/sounds/freedesktop/stereo/complete.oga'],
        expect.objectContaining({ stdio: 'ignore', detached: true }),
      );
    });

    test('no sound when no Linux player available', () => {
      // Arrange - afplay AND all Linux players missing
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        throw new Error(`not found: ${cmd}`);
      });
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    test('caches Linux player result across calls', () => {
      // Arrange
      const input = createSoundInput('permission_prompt');

      // Act - call twice
      soundNotification(input);
      soundNotification(input);

      // Assert - pw-play check only happens once (cached)
      const pwPlayChecks = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => cmd === 'command -v pw-play',
      );
      expect(pwPlayChecks).toHaveLength(1);
    });

    test('cache is reset by _resetLinuxPlayerCacheForTesting', () => {
      // Arrange - first call populates the cache
      const input = createSoundInput('permission_prompt');
      soundNotification(input);

      // Act - reset and call again
      _resetLinuxPlayerCacheForTesting();
      soundNotification(input);

      // Assert - pw-play check runs twice (once before reset, once after)
      const pwPlayChecks = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => cmd === 'command -v pw-play',
      );
      expect(pwPlayChecks).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Env var sound overrides
  // ---------------------------------------------------------------------------

  describe('env var sound overrides', () => {
    afterEach(() => {
      delete process.env.ORK_SOUND_PERMISSION_PROMPT;
      delete process.env.ORK_SOUND_IDLE_PROMPT;
      delete process.env.ORK_SOUND_AUTH_SUCCESS;
    });

    test('uses ORK_SOUND_PERMISSION_PROMPT when set (macOS)', () => {
      // Arrange
      process.env.ORK_SOUND_PERMISSION_PROMPT = '/custom/alert.wav';
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert - custom path overrides default Sosumi.aiff
      expect(mockSpawn).toHaveBeenCalledWith(
        'afplay',
        ['/custom/alert.wav'],
        expect.any(Object),
      );
    });

    test('uses ORK_SOUND_IDLE_PROMPT when set (macOS)', () => {
      // Arrange
      process.env.ORK_SOUND_IDLE_PROMPT = '/custom/ping.wav';
      const input = createSoundInput('idle_prompt');

      // Act
      soundNotification(input);

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'afplay',
        ['/custom/ping.wav'],
        expect.any(Object),
      );
    });

    test('uses ORK_SOUND_AUTH_SUCCESS when set (macOS)', () => {
      // Arrange
      process.env.ORK_SOUND_AUTH_SUCCESS = '/custom/success.wav';
      const input = createSoundInput('auth_success');

      // Act
      soundNotification(input);

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'afplay',
        ['/custom/success.wav'],
        expect.any(Object),
      );
    });

    test('falls back to default path when env var not set (macOS)', () => {
      // Arrange - env vars deliberately not set
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert - default Sosumi.aiff used
      expect(mockSpawn).toHaveBeenCalledWith(
        'afplay',
        ['/System/Library/Sounds/Sosumi.aiff'],
        expect.any(Object),
      );
    });

    test('uses ORK_SOUND_PERMISSION_PROMPT on Linux', () => {
      // Arrange - afplay missing, pw-play available
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'command -v afplay') throw new Error('not found');
        if (cmd === 'command -v pw-play') return Buffer.from('/usr/bin/pw-play');
        return Buffer.from('');
      });
      process.env.ORK_SOUND_PERMISSION_PROMPT = '/custom/linux-alert.oga';
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert - custom path used with Linux player
      expect(mockSpawn).toHaveBeenCalledWith(
        'pw-play',
        ['/custom/linux-alert.oga'],
        expect.any(Object),
      );
    });
  });
});

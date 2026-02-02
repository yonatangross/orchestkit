/**
 * Unit tests for sound notification hook
 * Tests macOS sound playback via afplay, sound mapping, and error resilience.
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
  };
});

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

// =============================================================================
// Imports (after mocks)
// =============================================================================

import { soundNotification } from '../../notification/sound.js';
import { outputSilentSuccess } from '../../lib/common.js';
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
      // afplay calls succeed silently
      if (typeof cmd === 'string' && cmd.includes('afplay')) return Buffer.from('');
      return Buffer.from('');
    });
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
      const afplayCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('afplay'),
      );
      const playCall = afplayCalls.find(
        ([cmd]) => typeof cmd === 'string' && !cmd.includes('command -v'),
      );
      expect(playCall).toBeDefined();
      expect(playCall![0]).toContain('/System/Library/Sounds/Sosumi.aiff');
    });

    test('plays Ping for idle_prompt', () => {
      // Arrange
      const input = createSoundInput('idle_prompt');

      // Act
      soundNotification(input);

      // Assert
      const afplayCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('afplay') && !cmd.includes('command -v'),
      );
      expect(afplayCalls.length).toBe(1);
      expect(afplayCalls[0][0]).toContain('/System/Library/Sounds/Ping.aiff');
    });

    test('plays Glass for auth_success', () => {
      // Arrange
      const input = createSoundInput('auth_success');

      // Act
      soundNotification(input);

      // Assert
      const afplayCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('afplay') && !cmd.includes('command -v'),
      );
      expect(afplayCalls.length).toBe(1);
      expect(afplayCalls[0][0]).toContain('/System/Library/Sounds/Glass.aiff');
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
      const playCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('afplay') && !cmd.includes('command -v'),
      );
      expect(playCalls.length).toBe(1);
      expect(playCalls[0][0]).toContain(expectedPath);
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

      // Assert - only the hasAfplay check should have been called, no actual play
      const playCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('afplay') && !cmd.includes('command -v'),
      );
      expect(playCalls.length).toBe(0);
    });

    test('does not play sound when notification_type is missing from tool_input', () => {
      // Arrange
      const input = createToolInput({
        tool_input: { message: 'no type here' },
      });

      // Act
      soundNotification(input);

      // Assert
      const playCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('afplay') && !cmd.includes('command -v'),
      );
      expect(playCalls.length).toBe(0);
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

      // Assert - no afplay call made
      const playCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('afplay') && !cmd.includes('command -v'),
      );
      expect(playCalls.length).toBe(0);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('plays sound when afplay is available', () => {
      // Arrange
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert
      const playCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('afplay') && !cmd.includes('command -v'),
      );
      expect(playCalls.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    test('returns silentSuccess when afplay command fails', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'command -v afplay') return Buffer.from('/usr/bin/afplay');
        if (typeof cmd === 'string' && cmd.includes('afplay')) {
          throw new Error('afplay: failed to play sound');
        }
        return Buffer.from('');
      });
      const input = createSoundInput('permission_prompt');

      // Act
      const result = soundNotification(input);

      // Assert - must not crash
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silentSuccess when sound file does not exist', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'command -v afplay') return Buffer.from('/usr/bin/afplay');
        if (typeof cmd === 'string' && cmd.includes('afplay') && !cmd.includes('command -v')) {
          throw new Error('afplay: file not found');
        }
        return Buffer.from('');
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
  // Background playback
  // ---------------------------------------------------------------------------

  describe('background playback', () => {
    test('plays sound with background flag (&)', () => {
      // Arrange
      const input = createSoundInput('permission_prompt');

      // Act
      soundNotification(input);

      // Assert - the afplay call should include & for background execution
      const playCalls = vi.mocked(execSync).mock.calls.filter(
        ([cmd]) => typeof cmd === 'string' && cmd.includes('afplay') && !cmd.includes('command -v'),
      );
      expect(playCalls.length).toBe(1);
      expect(playCalls[0][0]).toContain('&');
    });
  });
});

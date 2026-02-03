/**
 * Tests for Session End Tracking Hook
 *
 * Tests session end event tracking.
 * Covers: calling trackSessionEnd, returning silent success,
 * and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock common utilities
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

// Mock session tracker
vi.mock('../../lib/session-tracker.js', () => ({
  trackSessionEnd: vi.fn(),
}));

import { sessionEndTracking } from '../../stop/session-end-tracking.js';
import { logHook, outputSilentSuccess } from '../../lib/common.js';
import { trackSessionEnd } from '../../lib/session-tracker.js';
import type { HookInput } from '../../types.js';

describe('Session End Tracking Hook', () => {
  const mockLogHook = vi.mocked(logHook);
  const mockOutputSilentSuccess = vi.mocked(outputSilentSuccess);
  const mockTrackSessionEnd = vi.mocked(trackSessionEnd);

  const defaultInput: HookInput = {
    hook_event: 'Stop',
    tool_name: '',
    session_id: 'test-session-001',
    tool_input: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // SECTION 1: Happy Path
  // ===========================================================================
  describe('Happy Path', () => {
    it('should call trackSessionEnd', () => {
      // Act
      sessionEndTracking(defaultInput);

      // Assert
      expect(mockTrackSessionEnd).toHaveBeenCalledTimes(1);
    });

    it('should return silent success', () => {
      // Act
      const result = sessionEndTracking(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should log debug message on success', () => {
      // Act
      sessionEndTracking(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-end-tracking',
        'Tracked session end',
        'debug'
      );
    });

    it('should call outputSilentSuccess on success', () => {
      // Act
      sessionEndTracking(defaultInput);

      // Assert
      expect(mockOutputSilentSuccess).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // SECTION 2: Error Handling
  // ===========================================================================
  describe('Error Handling', () => {
    it('should handle trackSessionEnd errors gracefully', () => {
      // Arrange
      mockTrackSessionEnd.mockImplementation(() => {
        throw new Error('Tracking failed');
      });

      // Act
      const result = sessionEndTracking(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should log warning on error', () => {
      // Arrange
      mockTrackSessionEnd.mockImplementation(() => {
        throw new Error('Tracking failed');
      });

      // Act
      sessionEndTracking(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-end-tracking',
        expect.stringContaining('Error:'),
        'warn'
      );
    });

    it('should return silent success even on error', () => {
      // Arrange
      mockTrackSessionEnd.mockImplementation(() => {
        throw new Error('Critical failure');
      });

      // Act
      const result = sessionEndTracking(defaultInput);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should handle non-Error throws gracefully', () => {
      // Arrange
      mockTrackSessionEnd.mockImplementation(() => {
        throw 'string error';
      });

      // Act
      const result = sessionEndTracking(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-end-tracking',
        expect.stringContaining('Error:'),
        'warn'
      );
    });
  });
});

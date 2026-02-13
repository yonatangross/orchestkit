/**
 * Tests for Auto-Remember Continuity Hook
 *
 * Tests session continuity prompt generation at session end.
 * Covers: return values, suppress output, logging, project dir resolution,
 * and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock node:path
vi.mock('node:path', () => ({
  basename: vi.fn((p: string) => {
    const parts = p.split('/');
    return parts[parts.length - 1] || '';
  }),
}));

// Mock common utilities
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  getProjectDir: vi.fn(() => '/test/project'),
}));

import { autoRememberContinuity } from '../../stop/auto-remember-continuity.js';
import { logHook, getProjectDir } from '../../lib/common.js';
import type { HookInput } from '../../types.js';

describe('Auto-Remember Continuity Hook', () => {
  const mockLogHook = vi.mocked(logHook);
  const mockGetProjectDir = vi.mocked(getProjectDir);

  const defaultInput: HookInput = {
    hook_event: 'Stop',
    tool_name: '',
    session_id: 'test-session-001',
    tool_input: {},
  };

  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  // ===========================================================================
  // SECTION 1: Happy Path
  // ===========================================================================
  describe('Happy Path', () => {
    it('should return silent success (continue: true, suppressOutput: true)', () => {
      // Act
      const result = autoRememberContinuity(defaultInput);

      // Assert
      expect(result).toEqual({
        continue: true,
        suppressOutput: true,
      });
    });
  });

  // ===========================================================================
  // SECTION 2: Logging
  // ===========================================================================
  describe('Logging', () => {
    it('should log hook triggered message', () => {
      // Act
      autoRememberContinuity(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'auto-remember-continuity',
        'Hook triggered'
      );
    });

    it('should log memory prompt output message', () => {
      // Act
      autoRememberContinuity(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'auto-remember-continuity',
        'Outputting memory prompt for session end'
      );
    });

    it('should log both messages in order', () => {
      // Act
      autoRememberContinuity(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledTimes(2);
      expect(mockLogHook.mock.calls[0]).toEqual([
        'auto-remember-continuity',
        'Hook triggered',
      ]);
      expect(mockLogHook.mock.calls[1]).toEqual([
        'auto-remember-continuity',
        'Outputting memory prompt for session end',
      ]);
    });
  });

  // ===========================================================================
  // SECTION 3: Project Directory Resolution
  // ===========================================================================
  describe('Project Directory Resolution', () => {
    it('should use input.project_dir when provided', () => {
      // Arrange
      const inputWithDir: HookInput = {
        ...defaultInput,
        project_dir: '/custom/my-project',
      };

      // Act
      const result = autoRememberContinuity(inputWithDir);

      // Assert - should not call getProjectDir when project_dir is provided
      expect(result.continue).toBe(true);
    });

    it('should fall back to getProjectDir when project_dir is missing', () => {
      // Act
      autoRememberContinuity(defaultInput);

      // Assert
      expect(mockGetProjectDir).toHaveBeenCalled();
    });

    it('should handle empty project dir gracefully', () => {
      // Arrange
      mockGetProjectDir.mockReturnValue('');

      // Act
      const result = autoRememberContinuity(defaultInput);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

});

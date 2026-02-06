/**
 * Tests for Cleanup Instance Hook
 *
 * Tests multi-worktree instance cleanup at session end.
 * Covers: no database skip, no instance ID skip, valid instance cleanup,
 * SQLite errors, and work claim handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PathLike } from 'node:fs';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock node:child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

// Mock common utilities
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

import { cleanupInstance } from '../../stop/cleanup-instance.js';
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { logHook, outputSilentSuccess, getProjectDir } from '../../lib/common.js';
import type { HookInput } from '../../types.js';

describe('Cleanup Instance Hook', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockExecSync = vi.mocked(execSync);
  const mockLogHook = vi.mocked(logHook);
  const mockOutputSilentSuccess = vi.mocked(outputSilentSuccess);

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
  // SECTION 1: Skip Conditions
  // ===========================================================================
  describe('Skip Conditions', () => {
    it('should skip when no coordination database exists', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      const result = cleanupInstance(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'cleanup-instance',
        'No coordination database, skipping cleanup'
      );
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should skip when no instance ID file exists', () => {
      // Arrange - db exists, but instance id file doesn't
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).endsWith('.claude.db')) return true;
        return false; // id.json doesn't exist
      });

      // Act
      const result = cleanupInstance(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'cleanup-instance',
        'No instance ID to clean up'
      );
    });

    it('should skip when instance ID is null in file', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ instance_id: null }));

      // Act
      const result = cleanupInstance(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'cleanup-instance',
        'No instance ID to clean up'
      );
    });
  });

  // ===========================================================================
  // SECTION 2: Valid Instance Cleanup
  // ===========================================================================
  describe('Valid Instance Cleanup', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ instance_id: 'inst-abc-123' }));
      mockExecSync.mockReturnValue(Buffer.from('1'));
    });

    it('should run cleanup on valid instance', () => {
      // Act
      const result = cleanupInstance(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'cleanup-instance',
        'Cleaning up instance: inst-abc-123'
      );
    });

    it('should release all locks held by instance', () => {
      // Act
      cleanupInstance(defaultInput);

      // Assert
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM file_locks WHERE instance_id = 'inst-abc-123'"),
        expect.any(Object)
      );
      expect(mockLogHook).toHaveBeenCalledWith(
        'cleanup-instance',
        'All locks released'
      );
    });

    it('should log cleanup completion message', () => {
      // Act
      cleanupInstance(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'cleanup-instance',
        'Multi-instance cleanup completed'
      );
    });

    it('should handle work_claims table when it exists', () => {
      // Arrange - table check returns '1'
      mockExecSync.mockReturnValue(Buffer.from('1'));

      // Act
      cleanupInstance(defaultInput);

      // Assert
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("work_claims"),
        expect.any(Object)
      );
    });
  });

  // ===========================================================================
  // SECTION 3: SQLite Error Handling
  // ===========================================================================
  describe('SQLite Error Handling', () => {
    it('should handle read error for instance ID file', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).endsWith('.claude.db')) return true;
        if (String(path).endsWith('id.json')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      // Act
      const result = cleanupInstance(defaultInput);

      // Assert - should treat as no instance ID
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should handle invalid JSON in instance ID file', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(Buffer.from('not json'));

      // Act
      const result = cleanupInstance(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should handle execSync errors during table checks', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ instance_id: 'inst-1' }));
      // First call is lock delete (via runSqlite, handles errors internally)
      // Second call (table check) throws
      let callCount = 0;
      mockExecSync.mockImplementation(() => {
        callCount++;
        if (callCount > 1) {
          throw new Error('SQLite error');
        }
        return Buffer.from('');
      });

      // Act - should not throw
      const result = cleanupInstance(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });

  // ===========================================================================
  // SECTION 4: Project Directory Resolution
  // ===========================================================================
  describe('Project Directory Resolution', () => {
    it('should use input.project_dir when provided', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const inputWithDir: HookInput = {
        ...defaultInput,
        project_dir: '/custom/project',
      };

      // Act
      cleanupInstance(inputWithDir);

      // Assert - should check db at custom path
      expect(mockExistsSync).toHaveBeenCalledWith(
        '/custom/project/.claude/coordination/.claude.db'
      );
    });
  });
});

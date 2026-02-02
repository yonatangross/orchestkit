/**
 * Tests for Auto-Save Context Hook
 *
 * Tests session context auto-saving at session end.
 * Covers: new state creation, existing state update, parse errors,
 * required $schema and _meta fields, directory creation, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PathLike } from 'node:fs';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock common utilities
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

import { autoSaveContext } from '../../stop/auto-save-context.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { logHook, outputSilentSuccess, getProjectDir } from '../../lib/common.js';
import type { HookInput } from '../../types.js';

describe('Auto-Save Context Hook', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockMkdirSync = vi.mocked(mkdirSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);
  const mockLogHook = vi.mocked(logHook);
  const mockOutputSilentSuccess = vi.mocked(outputSilentSuccess);
  const mockGetProjectDir = vi.mocked(getProjectDir);

  const defaultInput: HookInput = {
    hook_event: 'Stop',
    tool_name: '',
    session_id: 'test-session-001',
    tool_input: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: session dir exists, state file does not
    mockExistsSync.mockReturnValue(false);
  });

  // ===========================================================================
  // SECTION 1: Happy Path - New State Creation
  // ===========================================================================
  describe('New State Creation', () => {
    it('should create new session state when no file exists', () => {
      // Arrange - existsSync returns false for dir and file
      mockExistsSync.mockReturnValue(false);

      // Act
      const result = autoSaveContext(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(writtenContent.$schema).toBe('context://session/v1');
      expect(writtenContent._meta).toBeDefined();
      expect(writtenContent._meta.position).toBe('END');
      expect(writtenContent._meta.token_budget).toBe(500);
    });

    it('should set started and last_activity timestamps on new state', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      autoSaveContext(defaultInput);

      // Assert
      const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(writtenContent.started).toBeTruthy();
      expect(writtenContent.last_activity).toBeTruthy();
      // Both should be ISO timestamps
      expect(() => new Date(writtenContent.started)).not.toThrow();
      expect(() => new Date(writtenContent.last_activity)).not.toThrow();
    });

    it('should create session directory if it does not exist', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      autoSaveContext(defaultInput);

      // Assert
      expect(mockMkdirSync).toHaveBeenCalledWith(
        '/test/project/.claude/context/session',
        { recursive: true }
      );
    });

    it('should log new state creation message', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      autoSaveContext(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'auto-save-context',
        'Created new session state (Protocol 2.0 compliant)'
      );
    });
  });

  // ===========================================================================
  // SECTION 2: Update Existing State
  // ===========================================================================
  describe('Update Existing State', () => {
    it('should update existing state with new last_activity timestamp', () => {
      // Arrange - dir exists, state file exists
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).endsWith('state.json')) return true;
        return true; // session dir exists
      });
      const existingState = {
        $schema: 'context://session/v1',
        _meta: { position: 'END', token_budget: 500, auto_load: 'always', compress: 'on_threshold', description: 'desc' },
        session_id: 'old-session',
        started: '2026-01-01T00:00:00Z',
        last_activity: '2026-01-01T00:00:00Z',
        current_task: { description: 'Working on feature', status: 'in_progress' },
        next_steps: ['step1'],
        blockers: ['blocker1'],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(existingState));

      // Act
      autoSaveContext(defaultInput);

      // Assert
      const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(writtenContent.session_id).toBe('old-session');
      expect(writtenContent.started).toBe('2026-01-01T00:00:00Z');
      expect(writtenContent.current_task.description).toBe('Working on feature');
      expect(writtenContent.next_steps).toEqual(['step1']);
      expect(writtenContent.blockers).toEqual(['blocker1']);
      // last_activity should be updated
      expect(writtenContent.last_activity).not.toBe('2026-01-01T00:00:00Z');
    });

    it('should preserve $schema and _meta from existing state', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      const existingState = {
        $schema: 'context://session/v2',
        _meta: { position: 'START', token_budget: 1000, auto_load: 'never', compress: 'always', description: 'custom' },
        session_id: 'sess-1',
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(existingState));

      // Act
      autoSaveContext(defaultInput);

      // Assert
      const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(writtenContent.$schema).toBe('context://session/v2');
      expect(writtenContent._meta.position).toBe('START');
      expect(writtenContent._meta.token_budget).toBe(1000);
    });

    it('should supply defaults for missing $schema and _meta in existing state', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      const existingState = {
        session_id: 'sess-1',
        started: '2026-01-01T00:00:00Z',
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(existingState));

      // Act
      autoSaveContext(defaultInput);

      // Assert
      const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(writtenContent.$schema).toBe('context://session/v1');
      expect(writtenContent._meta.position).toBe('END');
      expect(writtenContent._meta.token_budget).toBe(500);
      expect(writtenContent._meta.auto_load).toBe('always');
    });

    it('should log timestamp update message', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ session_id: 'test' }));

      // Act
      autoSaveContext(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'auto-save-context',
        'Updated session state timestamp'
      );
    });
  });

  // ===========================================================================
  // SECTION 3: Error Handling
  // ===========================================================================
  describe('Error Handling', () => {
    it('should handle JSON parse errors gracefully', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('not valid json {{{');

      // Act
      const result = autoSaveContext(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'auto-save-context',
        expect.stringContaining('Error saving context:')
      );
    });

    it('should handle writeFileSync errors gracefully', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Act
      const result = autoSaveContext(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'auto-save-context',
        expect.stringContaining('Error saving context:')
      );
    });

    it('should handle directory creation errors silently', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockImplementation(() => {
        throw new Error('Cannot create directory');
      });

      // Act - should not throw
      const result = autoSaveContext(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should always return outputSilentSuccess even on errors', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      // Act
      const result = autoSaveContext(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });

  // ===========================================================================
  // SECTION 4: $schema and _meta Fields
  // ===========================================================================
  describe('$schema and _meta Fields', () => {
    it('should always include $schema in new state', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      autoSaveContext(defaultInput);

      // Assert
      const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(writtenContent).toHaveProperty('$schema');
      expect(writtenContent.$schema).toBe('context://session/v1');
    });

    it('should always include _meta with required fields in new state', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      autoSaveContext(defaultInput);

      // Assert
      const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(writtenContent._meta).toEqual({
        position: 'END',
        token_budget: 500,
        auto_load: 'always',
        compress: 'on_threshold',
        description: 'Session state and progress - ALWAYS loaded at END of context',
      });
    });

    it('should include default current_task when not present', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ session_id: 'test' }));

      // Act
      autoSaveContext(defaultInput);

      // Assert
      const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(writtenContent.current_task).toEqual({
        description: 'No active task',
        status: 'pending',
      });
    });
  });

  // ===========================================================================
  // SECTION 5: Project Directory Resolution
  // ===========================================================================
  describe('Project Directory Resolution', () => {
    it('should use input.project_dir when provided', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const inputWithDir: HookInput = {
        ...defaultInput,
        project_dir: '/custom/project/dir',
      };

      // Act
      autoSaveContext(inputWithDir);

      // Assert
      expect(mockMkdirSync).toHaveBeenCalledWith(
        '/custom/project/dir/.claude/context/session',
        { recursive: true }
      );
    });

    it('should fall back to getProjectDir when input.project_dir is missing', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      autoSaveContext(defaultInput);

      // Assert
      expect(mockGetProjectDir).toHaveBeenCalled();
      expect(mockMkdirSync).toHaveBeenCalledWith(
        '/test/project/.claude/context/session',
        { recursive: true }
      );
    });
  });
});

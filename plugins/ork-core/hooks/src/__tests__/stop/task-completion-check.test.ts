/**
 * Tests for Task Completion Check Hook
 *
 * Tests task completion verification before session stop.
 * Covers: no tasks (silent success), in-progress task warnings,
 * orphaned task detection, and parse errors.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PathLike } from 'node:fs';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock common utilities
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputWithContext: vi.fn((ctx: string) => ({ continue: true, additionalContext: ctx })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-id'),
}));

// Mock task integration
vi.mock('../../lib/task-integration.js', () => ({
  getOrphanedTasks: vi.fn(),
  formatTaskDeleteForClaude: vi.fn(),
}));

import { taskCompletionCheck } from '../../stop/task-completion-check.js';
import { existsSync, readFileSync } from 'node:fs';
import { logHook, outputSilentSuccess, outputWithContext, getProjectDir, getSessionId } from '../../lib/common.js';
import { getOrphanedTasks, formatTaskDeleteForClaude } from '../../lib/task-integration.js';
import type { HookInput } from '../../types.js';

describe('Task Completion Check Hook', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockLogHook = vi.mocked(logHook);
  const mockOutputSilentSuccess = vi.mocked(outputSilentSuccess);
  const mockOutputWithContext = vi.mocked(outputWithContext);
  const mockGetOrphanedTasks = vi.mocked(getOrphanedTasks);
  const mockFormatTaskDeleteForClaude = vi.mocked(formatTaskDeleteForClaude);

  const defaultInput: HookInput = {
    hook_event: 'Stop',
    tool_name: '',
    session_id: 'test-session-id',
    tool_input: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockGetOrphanedTasks.mockReturnValue([]);
  });

  // ===========================================================================
  // SECTION 1: No Tasks - Silent Success
  // ===========================================================================
  describe('No Tasks', () => {
    it('should return silent success when no registry file exists', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      mockGetOrphanedTasks.mockReturnValue([]);

      // Act
      const result = taskCompletionCheck(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should return silent success when no in-progress tasks', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('task-registry')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({
        tasks: [
          { status: 'completed', description: 'Done task' },
          { status: 'pending', description: 'Waiting task' },
        ],
      }));
      mockGetOrphanedTasks.mockReturnValue([]);

      // Act
      const result = taskCompletionCheck(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should return silent success when registry has empty tasks array', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('task-registry')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ tasks: [] }));
      mockGetOrphanedTasks.mockReturnValue([]);

      // Act
      const result = taskCompletionCheck(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });

  // ===========================================================================
  // SECTION 2: In-Progress Task Warnings
  // ===========================================================================
  describe('In-Progress Task Warnings', () => {
    it('should warn on in-progress orchestration tasks', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('task-registry')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({
        tasks: [
          { status: 'in_progress', description: 'Working on feature' },
          { status: 'completed', description: 'Done' },
        ],
      }));
      mockGetOrphanedTasks.mockReturnValue([]);

      // Act
      const result = taskCompletionCheck(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'task-completion-check',
        'WARNING: 1 orchestration tasks still in progress'
      );
      expect(mockOutputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('1 orchestration task(s) still in progress')
      );
    });

    it('should count multiple in-progress tasks', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('task-registry')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({
        tasks: [
          { status: 'in_progress' },
          { status: 'in_progress' },
          { status: 'in_progress' },
        ],
      }));
      mockGetOrphanedTasks.mockReturnValue([]);

      // Act
      taskCompletionCheck(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'task-completion-check',
        'WARNING: 3 orchestration tasks still in progress'
      );
    });

    it('should detect legacy in-progress tasks from /tmp file', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('claude-active-todos')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(JSON.stringify([
        { status: 'in_progress', description: 'Legacy task' },
      ]));
      mockGetOrphanedTasks.mockReturnValue([]);

      // Act
      taskCompletionCheck(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'task-completion-check',
        'WARNING: 1 legacy tasks in progress at stop'
      );
    });
  });

  // ===========================================================================
  // SECTION 3: Orphaned Tasks
  // ===========================================================================
  describe('Orphaned Tasks', () => {
    it('should detect orphaned tasks', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      mockGetOrphanedTasks.mockReturnValue([
        { taskId: 'task-1', description: 'Orphaned task' },
      ]);
      mockFormatTaskDeleteForClaude.mockReturnValue('TaskUpdate({ taskId: "task-1", status: "deleted" })');

      // Act
      const result = taskCompletionCheck(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'task-completion-check',
        'Found 1 orphaned tasks'
      );
      expect(mockOutputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('Orphaned Tasks')
      );
    });

    it('should format delete instructions for each orphan', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      mockGetOrphanedTasks.mockReturnValue([
        { taskId: 'task-1' },
        { taskId: 'task-2' },
      ]);
      mockFormatTaskDeleteForClaude.mockReturnValue('delete instruction');

      // Act
      taskCompletionCheck(defaultInput);

      // Assert
      expect(mockFormatTaskDeleteForClaude).toHaveBeenCalledTimes(2);
      expect(mockFormatTaskDeleteForClaude).toHaveBeenCalledWith('task-1', 'All blocking tasks have failed');
      expect(mockFormatTaskDeleteForClaude).toHaveBeenCalledWith('task-2', 'All blocking tasks have failed');
    });
  });

  // ===========================================================================
  // SECTION 4: Parse Errors
  // ===========================================================================
  describe('Parse Errors', () => {
    it('should handle invalid JSON in registry file', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('task-registry')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue('invalid json');
      mockGetOrphanedTasks.mockReturnValue([]);

      // Act
      const result = taskCompletionCheck(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'task-completion-check',
        expect.stringContaining('Error reading registry:')
      );
    });

    it('should handle invalid JSON in legacy todos file', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('claude-active-todos')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue('not json');
      mockGetOrphanedTasks.mockReturnValue([]);

      // Act
      const result = taskCompletionCheck(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'task-completion-check',
        expect.stringContaining('Error reading legacy todos:')
      );
    });

    it('should still return valid result when parse fails', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('task-registry')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue('bad json');
      mockGetOrphanedTasks.mockReturnValue([]);

      // Act
      const result = taskCompletionCheck(defaultInput);

      // Assert
      // No warnings were added, so should return silent success
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });

  // ===========================================================================
  // SECTION 5: Project Directory Resolution
  // ===========================================================================
  describe('Project Directory Resolution', () => {
    it('should use input.project_dir when provided', () => {
      // Arrange
      const inputWithDir: HookInput = {
        ...defaultInput,
        project_dir: '/custom/path',
      };
      mockExistsSync.mockReturnValue(false);
      mockGetOrphanedTasks.mockReturnValue([]);

      // Act
      taskCompletionCheck(inputWithDir);

      // Assert - should look for registry at custom path
      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringContaining('/custom/path/')
      );
    });
  });
});

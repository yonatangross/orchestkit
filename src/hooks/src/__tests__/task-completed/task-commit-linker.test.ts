/**
 * Unit tests for task-commit-linker TaskCompleted hook
 *
 * Tests the hook that suggests a commit when a task completes
 * and there are uncommitted (dirty) files in the working tree.
 *
 * @hook TaskCompleted
 * @since v7.2.0
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => mockCommonBasic());

vi.mock('../../lib/git.js', () => ({
  getDirtyFileCount: vi.fn(() => 0),
}));

import { taskCommitLinker } from '../../task-completed/task-commit-linker.js';
import { outputSilentSuccess, outputWithContext, getProjectDir } from '../../lib/common.js';
import { getDirtyFileCount } from '../../lib/git.js';
import type { HookInput } from '../../types.js';

// =============================================================================
// Helpers
// =============================================================================

function createTaskInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {},
    task_id: 'task-abc',
    task_subject: 'Implement feature X',
    task_status: 'completed',
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('task-commit-linker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProjectDir).mockReturnValue('/test/project');
    vi.mocked(getDirtyFileCount).mockReturnValue(0);
  });

  describe('early-exit conditions', () => {
    test('returns silent when task_status is not "completed"', () => {
      const input = createTaskInput({ task_status: 'failed' });

      const result = taskCommitLinker(input);

      expect(outputSilentSuccess).toHaveBeenCalledOnce();
      expect(outputWithContext).not.toHaveBeenCalled();
      expect(result.continue).toBe(true);
    });

    test('returns silent when task_status is "in_progress"', () => {
      const input = createTaskInput({ task_status: 'in_progress' });

      taskCommitLinker(input);

      expect(outputSilentSuccess).toHaveBeenCalledOnce();
      expect(outputWithContext).not.toHaveBeenCalled();
    });

    test('returns silent when projectDir is not available', () => {
      vi.mocked(getProjectDir).mockReturnValue('');
      const input = createTaskInput({ task_status: 'completed' });

      const result = taskCommitLinker(input);

      expect(outputSilentSuccess).toHaveBeenCalledOnce();
      expect(getDirtyFileCount).not.toHaveBeenCalled();
      expect(result.continue).toBe(true);
    });

    test('returns silent when dirty file count is 0', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(0);
      const input = createTaskInput({ task_status: 'completed' });

      taskCommitLinker(input);

      expect(outputSilentSuccess).toHaveBeenCalledOnce();
      expect(outputWithContext).not.toHaveBeenCalled();
    });
  });

  describe('commit suggestion', () => {
    test('calls outputWithContext when completed with 5 dirty files', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(5);
      const input = createTaskInput({
        task_status: 'completed',
        task_id: 'task-xyz',
        task_subject: 'Implement user auth',
      });

      taskCommitLinker(input);

      expect(outputWithContext).toHaveBeenCalledOnce();
    });

    test('additionalContext includes the task ID', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(3);
      const input = createTaskInput({
        task_status: 'completed',
        task_id: 'task-999',
        task_subject: 'Refactor payment service',
      });

      const result = taskCommitLinker(input);

      expect(result.hookSpecificOutput?.additionalContext).toContain('task-999');
    });

    test('additionalContext includes the task subject', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(2);
      const input = createTaskInput({
        task_status: 'completed',
        task_id: 'task-001',
        task_subject: 'Build notification system',
      });

      const result = taskCommitLinker(input);

      expect(result.hookSpecificOutput?.additionalContext).toContain('Build notification system');
    });

    test('additionalContext includes the dirty file count', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(7);
      const input = createTaskInput({
        task_status: 'completed',
        task_id: 'task-007',
        task_subject: 'Migrate database schema',
      });

      const result = taskCommitLinker(input);

      expect(result.hookSpecificOutput?.additionalContext).toContain('7');
    });

    test('uses "unknown" as task ID when task_id is not provided', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(1);
      const input = createTaskInput({
        task_status: 'completed',
        task_id: undefined,
        task_subject: 'Fix the thing',
      });

      const result = taskCommitLinker(input);

      expect(outputWithContext).toHaveBeenCalledOnce();
      const ctx = vi.mocked(outputWithContext).mock.calls[0][0];
      expect(ctx).toContain('unknown');
      expect(result.hookSpecificOutput?.additionalContext).toContain('unknown');
    });
  });
});

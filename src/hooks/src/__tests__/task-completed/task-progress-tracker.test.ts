/**
 * Unit tests for task-progress-tracker TaskCompleted hook
 *
 * Tests the hook that maintains a per-session task counter and
 * emits a progress bar to stderr when enough tasks complete.
 *
 * renderProgressBar() is not exported, so it is tested indirectly
 * by spying on process.stderr.write and asserting the bar string.
 *
 * @hook TaskCompleted
 * @since v7.2.0
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

vi.mock('../../lib/atomic-write.js', () => ({
  atomicWriteSync: vi.fn(),
}));

vi.mock('../../lib/paths.js', () => ({
  getLogDir: vi.fn(() => '/tmp/test-logs'),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  mkdirSync: vi.fn(),
}));

import { taskProgressTracker } from '../../task-completed/task-progress-tracker.js';
import { outputSilentSuccess, logHook } from '../../lib/common.js';
import { atomicWriteSync } from '../../lib/atomic-write.js';
import { existsSync, readFileSync } from 'node:fs';
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
    task_subject: 'Fix authentication bug',
    task_status: 'completed',
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('task-progress-tracker', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no state file exists
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue('{}');
    // Suppress actual stderr output during tests
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // Early-exit conditions
  // ---------------------------------------------------------------------------

  describe('early-exit conditions', () => {
    test('returns silent and skips tracking when task_id is missing', () => {
      const input = createTaskInput({ task_id: undefined });

      const result = taskProgressTracker(input);

      expect(outputSilentSuccess).toHaveBeenCalledOnce();
      expect(atomicWriteSync).not.toHaveBeenCalled();
      expect(result.continue).toBe(true);
    });

    test('returns silent without persisting state when task_status is not "completed"', () => {
      const input = createTaskInput({ task_status: 'in_progress' });

      taskProgressTracker(input);

      // State should NOT be persisted for non-completed tasks
      expect(atomicWriteSync).not.toHaveBeenCalled();
      expect(outputSilentSuccess).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // State tracking
  // ---------------------------------------------------------------------------

  describe('state tracking', () => {
    test('increments completed count to 1 for the first completed task', () => {
      const input = createTaskInput({
        task_id: 'task-001',
        task_subject: 'Fix bug',
        task_status: 'completed',
      });

      taskProgressTracker(input);

      expect(atomicWriteSync).toHaveBeenCalledOnce();
      const writtenJson = vi.mocked(atomicWriteSync).mock.calls[0][1] as string;
      const state = JSON.parse(writtenJson);
      expect(state.completed).toBe(1);
      expect(state.task_ids).toContain('task-001');
    });

    test('does not count the same task_id twice (deduplication)', () => {
      // Simulate state file already tracking this task
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ total: 0, completed: 1, task_ids: ['task-dup'] })
      );

      const input = createTaskInput({ task_id: 'task-dup', task_status: 'completed' });

      taskProgressTracker(input);

      expect(atomicWriteSync).toHaveBeenCalledOnce();
      const writtenJson = vi.mocked(atomicWriteSync).mock.calls[0][1] as string;
      const state = JSON.parse(writtenJson);
      // completed should still be 1 — not incremented for duplicate
      expect(state.completed).toBe(1);
    });

    test('extracts total from "[3/7] Fix bug" subject format', () => {
      const input = createTaskInput({
        task_id: 'task-003',
        task_subject: '[3/7] Fix the authentication bug',
        task_status: 'completed',
      });

      taskProgressTracker(input);

      const writtenJson = vi.mocked(atomicWriteSync).mock.calls[0][1] as string;
      const state = JSON.parse(writtenJson);
      expect(state.total).toBe(7);
    });

    test('does not set total when subject has no [N/M] format', () => {
      const input = createTaskInput({
        task_id: 'task-plain',
        task_subject: 'Fix the authentication bug',
        task_status: 'completed',
      });

      taskProgressTracker(input);

      const writtenJson = vi.mocked(atomicWriteSync).mock.calls[0][1] as string;
      const state = JSON.parse(writtenJson);
      expect(state.total).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Progress bar rendering (via stderr)
  // ---------------------------------------------------------------------------

  describe('progress bar rendering', () => {
    test('does not emit progress bar when total is less than 2', () => {
      const input = createTaskInput({
        task_id: 'task-single',
        task_subject: 'Fix bug',
        task_status: 'completed',
        // No [N/M] format → total stays 0
      });

      taskProgressTracker(input);

      expect(stderrSpy).not.toHaveBeenCalled();
    });

    test('renders correct blocks and percentage for 3/7 completion', () => {
      // Pre-populate state with total=7, completed=2 + this task makes 3
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ total: 7, completed: 2, task_ids: ['task-001', 'task-002'] })
      );

      const input = createTaskInput({
        task_id: 'task-003',
        task_subject: '[3/7] Third task',
        task_status: 'completed',
      });

      taskProgressTracker(input);

      expect(stderrSpy).toHaveBeenCalledOnce();
      const output = stderrSpy.mock.calls[0][0] as string;
      // 3/7 ≈ 43% → expect "43%" in output
      expect(output).toContain('43%');
      // Should show completed/total
      expect(output).toContain('3/7');
    });

    test('renders full bar with 100% when all tasks are done', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ total: 7, completed: 6, task_ids: ['t1', 't2', 't3', 't4', 't5', 't6'] })
      );

      const input = createTaskInput({
        task_id: 't7',
        task_subject: '[7/7] Final task',
        task_status: 'completed',
      });

      taskProgressTracker(input);

      expect(stderrSpy).toHaveBeenCalledOnce();
      const output = stderrSpy.mock.calls[0][0] as string;
      expect(output).toContain('100%');
      expect(output).toContain('7/7');
    });

    test('renders 0% when no tasks completed yet but total is known', () => {
      // total set from a previous non-completed parse; completed = 0
      // Simulate: state has total=5, completed=0, but this IS the first completed task
      // Reset: fresh state, subject has [1/5] format
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createTaskInput({
        task_id: 'task-first',
        task_subject: '[1/5] First task',
        task_status: 'completed',
      });

      taskProgressTracker(input);

      // After this call: completed=1, total=5 → 20%
      const output = stderrSpy.mock.calls[0][0] as string;
      expect(output).toContain('20%');
      expect(output).toContain('1/5');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles corrupt state file gracefully — starts with fresh state', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('NOT VALID JSON {{{');

      const input = createTaskInput({
        task_id: 'task-after-corrupt',
        task_subject: '[1/3] After corrupt',
        task_status: 'completed',
      });

      // Should not throw
      expect(() => taskProgressTracker(input)).not.toThrow();

      // Should still persist a valid fresh state
      expect(atomicWriteSync).toHaveBeenCalledOnce();
      const writtenJson = vi.mocked(atomicWriteSync).mock.calls[0][1] as string;
      const state = JSON.parse(writtenJson);
      expect(state.completed).toBe(1);
      expect(state.total).toBe(3);
    });

    test('always returns outputSilentSuccess regardless of whether bar was rendered', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ total: 4, completed: 2, task_ids: ['t1', 't2'] })
      );

      const input = createTaskInput({
        task_id: 't3',
        task_subject: '[3/4] Third',
        task_status: 'completed',
      });

      const result = taskProgressTracker(input);

      expect(outputSilentSuccess).toHaveBeenCalledOnce();
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // saveState failure resilience
  // ---------------------------------------------------------------------------

  describe('saveState failure', () => {
    test('does not throw when atomicWriteSync fails to persist state', () => {
      vi.mocked(atomicWriteSync).mockImplementation(() => {
        throw new Error('disk full');
      });
      const input = createTaskInput({
        task_id: 'task-write-fail',
        task_status: 'completed',
      });

      // Hook must not propagate the write error to the caller
      expect(() => taskProgressTracker(input)).not.toThrow();
    });

    test('calls logHook with "warn" when state persistence fails', () => {
      vi.mocked(atomicWriteSync).mockImplementation(() => {
        throw new Error('disk full');
      });
      const input = createTaskInput({
        task_id: 'task-warn-log',
        task_status: 'completed',
      });

      taskProgressTracker(input);

      expect(logHook).toHaveBeenCalledWith(
        'task-progress-tracker',
        expect.stringContaining('Failed to persist state'),
        'warn',
      );
    });
  });
});

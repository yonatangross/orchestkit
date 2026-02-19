/**
 * Unit tests for task-completer hook
 * Tests CC 2.1.16 Task Management integration for SubagentStop
 *
 * Handles agent completion for task management:
 * - Marks associated task as completed or failed
 * - Checks for newly unblocked tasks
 * - Handles pipeline progression
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput, } from '../../types.js';

// =============================================================================
// Mocks - MUST be defined BEFORE imports
// =============================================================================

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputWithContext: vi.fn((ctx: string) => ({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: ctx,
    },
  })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-123'),
}));

vi.mock('../../lib/task-integration.js', () => ({
  getTaskByAgent: vi.fn(),
  updateTaskStatus: vi.fn(),
  getPipelineTasks: vi.fn(() => []),
  completePipelineStep: vi.fn(),
  formatTaskUpdateForClaude: vi.fn((instr) => `TaskUpdate: ${instr.taskId} -> ${instr.status}`),
  getTasksBlockedBy: vi.fn(() => []),
  formatTaskDeleteForClaude: vi.fn((taskId, reason) => `TaskDelete: ${taskId} (${reason})`),
}));

vi.mock('../../lib/orchestration-state.js', () => ({
  updateAgentStatus: vi.fn(),
  removeAgent: vi.fn(),
}));

import { taskCompleter } from '../../subagent-stop/task-completer.js';
import { outputSilentSuccess, outputWithContext, logHook } from '../../lib/common.js';
import {
  getTaskByAgent,
  updateTaskStatus,
  getPipelineTasks,
  completePipelineStep,
  formatTaskUpdateForClaude,
  getTasksBlockedBy,
} from '../../lib/task-integration.js';
import { updateAgentStatus, removeAgent } from '../../lib/orchestration-state.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for SubagentStop
 */
function createSubagentStopInput(
  overrides: Partial<HookInput> = {},
): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { subagent_type: 'test-agent' },
    subagent_type: 'test-agent',
    agent_output: 'Agent completed successfully',
    ...overrides,
  };
}

/**
 * Create a mock task entry
 */
function createMockTask(overrides = {}) {
  return {
    taskId: 'task-123',
    agent: 'test-agent',
    confidence: 0.9,
    status: 'in_progress',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// =============================================================================
// Task Completer Tests
// =============================================================================

describe('task-completer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CLAUDE_PROJECT_DIR;
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('always returns continue: true for successful completion', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const input = createSubagentStopInput();

      // Act
      const result = taskCompleter(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true for failed completion', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const input = createSubagentStopInput({
        error: 'Agent encountered an error',
      });

      // Act
      const result = taskCompleter(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true when no task found', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(undefined);
      const input = createSubagentStopInput();

      // Act
      const result = taskCompleter(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('always returns continue: true when no agent type', () => {
      // Arrange
      const input = createSubagentStopInput({
        tool_input: {},
        subagent_type: undefined,
        agent_type: undefined,
      });

      // Act
      const result = taskCompleter(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Agent type resolution
  // ---------------------------------------------------------------------------

  describe('agent type resolution', () => {
    test.each([
      ['tool_input.subagent_type', { tool_input: { subagent_type: 'from-tool-input' } }],
      ['subagent_type', { subagent_type: 'from-subagent-type' }],
      ['agent_type', { agent_type: 'from-agent-type' }],
    ])('resolves agent type from %s', (_source, inputOverrides) => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const input = createSubagentStopInput({
        tool_input: {},
        subagent_type: undefined,
        agent_type: undefined,
        ...inputOverrides,
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(getTaskByAgent).toHaveBeenCalled();
    });

    test('prefers tool_input.subagent_type over other sources', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'priority-agent' },
        subagent_type: 'secondary-agent',
        agent_type: 'tertiary-agent',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(getTaskByAgent).toHaveBeenCalledWith('priority-agent');
    });
  });

  // ---------------------------------------------------------------------------
  // Successful completion handling
  // ---------------------------------------------------------------------------

  describe('successful completion', () => {
    test('updates task status to completed', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-456' });
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      const input = createSubagentStopInput();

      // Act
      taskCompleter(input);

      // Assert
      expect(updateTaskStatus).toHaveBeenCalledWith('task-456', 'completed');
    });

    test('updates agent status to completed', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'my-agent' },
        subagent_type: 'my-agent',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(updateAgentStatus).toHaveBeenCalledWith('my-agent', 'completed');
    });

    test('removes agent from tracking on success', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'cleanup-agent' },
        subagent_type: 'cleanup-agent',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(removeAgent).toHaveBeenCalledWith('cleanup-agent');
    });

    test('outputs context with completion message', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const input = createSubagentStopInput();

      // Act
      taskCompleter(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('Completed')
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Failed completion handling
  // ---------------------------------------------------------------------------

  describe('failed completion', () => {
    test('detects failure from error field', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-fail-1' });
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      const input = createSubagentStopInput({
        error: 'Something went wrong',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(updateTaskStatus).toHaveBeenCalledWith('task-fail-1', 'failed');
    });

    test('detects failure from tool_error field', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-fail-2' });
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      const input = createSubagentStopInput({
        tool_error: 'Tool execution failed',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(updateTaskStatus).toHaveBeenCalledWith('task-fail-2', 'failed');
    });

    test('detects failure from non-zero exit code', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-fail-3' });
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      const input = createSubagentStopInput({
        exit_code: 1,
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(updateTaskStatus).toHaveBeenCalledWith('task-fail-3', 'failed');
    });

    test('updates agent status to failed', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'failed-agent' },
        subagent_type: 'failed-agent',
        error: 'Error occurred',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(updateAgentStatus).toHaveBeenCalledWith('failed-agent', 'failed');
    });

    test('does not remove agent on failure (for retry potential)', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'retry-candidate' },
        subagent_type: 'retry-candidate',
        error: 'Temporary failure',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(removeAgent).not.toHaveBeenCalled();
    });

    test('includes error details in context message', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const input = createSubagentStopInput({
        error: 'Detailed error message here',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('Error Details')
      );
    });

    test('truncates long error messages', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const longError = 'E'.repeat(1000);
      const input = createSubagentStopInput({
        error: longError,
      });

      // Act
      taskCompleter(input);

      // Assert
      const contextCall = vi.mocked(outputWithContext).mock.calls[0][0];
      expect(contextCall.length).toBeLessThan(longError.length + 500);
    });
  });

  // ---------------------------------------------------------------------------
  // Pipeline handling
  // ---------------------------------------------------------------------------

  describe('pipeline handling', () => {
    test('calls completePipelineStep for pipeline tasks', () => {
      // Arrange
      const task = createMockTask({
        pipelineId: 'pipeline-001',
        pipelineStep: 1,
      });
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      vi.mocked(completePipelineStep).mockReturnValue(2);
      vi.mocked(getPipelineTasks).mockReturnValue([]);
      const input = createSubagentStopInput();

      // Act
      taskCompleter(input);

      // Assert
      expect(completePipelineStep).toHaveBeenCalledWith('pipeline-001', 1);
    });

    test('identifies next unblocked step', () => {
      // Arrange
      const task = createMockTask({
        pipelineId: 'pipeline-002',
        pipelineStep: 0,
      });
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      vi.mocked(completePipelineStep).mockReturnValue(1);
      vi.mocked(getPipelineTasks).mockReturnValue([
        { taskId: 'task-2', agent: 'next-agent', pipelineStep: 1, status: 'pending' },
      ]);
      const input = createSubagentStopInput();

      // Act
      taskCompleter(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('next-agent')
      );
    });

    test('indicates pipeline completion when no more steps', () => {
      // Arrange
      const task = createMockTask({
        pipelineId: 'pipeline-003',
        pipelineStep: 2,
      });
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      vi.mocked(completePipelineStep).mockReturnValue(null);
      const input = createSubagentStopInput();

      // Act
      taskCompleter(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('Pipeline Complete')
      );
    });

    test('does not process pipeline for non-pipeline tasks', () => {
      // Arrange
      const task = createMockTask({
        pipelineId: undefined,
        pipelineStep: undefined,
      });
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      const input = createSubagentStopInput();

      // Act
      taskCompleter(input);

      // Assert
      expect(completePipelineStep).not.toHaveBeenCalled();
    });

    test('does not advance pipeline on failure', () => {
      // Arrange
      const task = createMockTask({
        pipelineId: 'pipeline-004',
        pipelineStep: 1,
      });
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      const input = createSubagentStopInput({
        error: 'Pipeline step failed',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(completePipelineStep).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.20 Orphaned tasks handling
  // ---------------------------------------------------------------------------

  describe('orphaned tasks (CC 2.1.20)', () => {
    test('identifies tasks blocked by failed task', () => {
      // Arrange
      const task = createMockTask({ taskId: 'failed-task' });
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      vi.mocked(getTasksBlockedBy).mockReturnValue([
        { taskId: 'orphan-1', agent: 'orphan-agent', status: 'pending', blockedBy: ['failed-task'] },
      ]);
      const input = createSubagentStopInput({
        error: 'Task failed',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(getTasksBlockedBy).toHaveBeenCalledWith('failed-task');
    });

    test('marks orphaned tasks as failed', () => {
      // Arrange
      const task = createMockTask({ taskId: 'blocker-task' });
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      vi.mocked(getTasksBlockedBy).mockReturnValue([
        { taskId: 'orphan-1', agent: 'agent-1', status: 'pending', blockedBy: ['blocker-task'] },
        { taskId: 'orphan-2', agent: 'agent-2', status: 'pending', blockedBy: ['blocker-task'] },
      ]);
      const input = createSubagentStopInput({
        error: 'Parent task failed',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(updateTaskStatus).toHaveBeenCalledWith('orphan-1', 'failed');
      expect(updateTaskStatus).toHaveBeenCalledWith('orphan-2', 'failed');
    });

    test('includes orphaned tasks in context message', () => {
      // Arrange
      const task = createMockTask({ taskId: 'parent-task' });
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      vi.mocked(getTasksBlockedBy).mockReturnValue([
        { taskId: 'child-task', agent: 'child-agent', status: 'pending', blockedBy: ['parent-task'] },
      ]);
      const input = createSubagentStopInput({
        error: 'Error',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('Orphaned Tasks')
      );
    });

    test('does not check orphans on success', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const input = createSubagentStopInput();

      // Act
      taskCompleter(input);

      // Assert
      expect(getTasksBlockedBy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty agent type string', () => {
      // Arrange
      const input = createSubagentStopInput({
        tool_input: { subagent_type: '' },
        subagent_type: '',
        agent_type: '',
      });

      // Act
      const result = taskCompleter(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(getTaskByAgent).not.toHaveBeenCalled();
    });

    test('handles null error value (not failure)', () => {
      // Arrange
      const task = createMockTask();
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      const input = createSubagentStopInput({
        error: 'null',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(updateTaskStatus).toHaveBeenCalledWith(expect.any(String), 'completed');
    });

    test('handles empty error string (not failure)', () => {
      // Arrange
      const task = createMockTask();
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      const input = createSubagentStopInput({
        error: '',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(updateTaskStatus).toHaveBeenCalledWith(expect.any(String), 'completed');
    });

    test('handles exit code 0 (success)', () => {
      // Arrange
      const task = createMockTask();
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      const input = createSubagentStopInput({
        exit_code: 0,
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(updateTaskStatus).toHaveBeenCalledWith(expect.any(String), 'completed');
    });

    test('handles undefined exit code (success)', () => {
      // Arrange
      const task = createMockTask();
      vi.mocked(getTaskByAgent).mockReturnValue(task);
      const input = createSubagentStopInput({
        exit_code: undefined,
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(updateTaskStatus).toHaveBeenCalledWith(expect.any(String), 'completed');
    });

    test('cleans up agent state even when no task found', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(undefined);
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'no-task-agent' },
        subagent_type: 'no-task-agent',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(removeAgent).toHaveBeenCalledWith('no-task-agent');
    });
  });

  // ---------------------------------------------------------------------------
  // Logging verification
  // ---------------------------------------------------------------------------

  describe('logging', () => {
    test('logs processing start', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'logged-agent' },
        subagent_type: 'logged-agent',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'task-completer',
        expect.stringContaining('logged-agent')
      );
    });

    test('logs when no task found', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(undefined);
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'missing-agent' },
        subagent_type: 'missing-agent',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'task-completer',
        expect.stringContaining('No orchestration task')
      );
    });

    test('logs completion status', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask({ taskId: 'log-task' }));
      const input = createSubagentStopInput();

      // Act
      taskCompleter(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'task-completer',
        expect.stringContaining('log-task')
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Context message formatting
  // ---------------------------------------------------------------------------

  describe('context message formatting', () => {
    test('includes orchestration header', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const input = createSubagentStopInput();

      // Act
      taskCompleter(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('## Orchestration')
      );
    });

    test('includes agent name in message', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'named-agent' },
        subagent_type: 'named-agent',
      });

      // Act
      taskCompleter(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('named-agent')
      );
    });

    test('includes task update instructions', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(createMockTask());
      const input = createSubagentStopInput();

      // Act
      taskCompleter(input);

      // Assert
      expect(formatTaskUpdateForClaude).toHaveBeenCalled();
    });
  });
});

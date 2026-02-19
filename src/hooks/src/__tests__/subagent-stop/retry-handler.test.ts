/**
 * Unit tests for retry-handler hook
 * Tests intelligent retry decisions for failed agents in SubagentStop
 *
 * Issue #197: Agent Orchestration Layer
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext
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

vi.mock('../../lib/retry-manager.js', () => ({
  makeRetryDecision: vi.fn(() => ({
    shouldRetry: true,
    retryCount: 1,
    maxRetries: 3,
    delayMs: 1000,
    reason: 'Retrying after transient error',
  })),
  formatRetryDecision: vi.fn((decision, agent) =>
    decision.shouldRetry
      ? `Retry Scheduled: ${agent} will retry`
      : `Retry Not Recommended: ${agent}`
  ),
  createAttempt: vi.fn((agent, num, taskId) => ({
    agent,
    taskId,
    attemptNumber: num,
    startedAt: new Date().toISOString(),
  })),
  completeAttempt: vi.fn((attempt, outcome, error) => ({
    ...attempt,
    completedAt: new Date().toISOString(),
    outcome,
    error,
  })),
}));

vi.mock('../../lib/orchestration-state.js', () => ({
  loadConfig: vi.fn(() => ({
    maxRetries: 3,
    retryDelayBaseMs: 1000,
  })),
  loadState: vi.fn(() => ({
    activeAgents: [],
  })),
  updateAgentStatus: vi.fn(),
}));

vi.mock('../../lib/task-integration.js', () => ({
  updateTaskStatus: vi.fn(),
  getTaskByAgent: vi.fn(),
}));

import { retryHandler } from '../../subagent-stop/retry-handler.js';
import { outputSilentSuccess, outputWithContext, logHook } from '../../lib/common.js';
import {
  makeRetryDecision,
  formatRetryDecision,
  createAttempt,
  completeAttempt,
} from '../../lib/retry-manager.js';
import { loadConfig, loadState, updateAgentStatus } from '../../lib/orchestration-state.js';
import { updateTaskStatus, getTaskByAgent } from '../../lib/task-integration.js';

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

// =============================================================================
// Retry Handler Tests
// =============================================================================

describe('retry-handler', () => {
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
    test('always returns continue: true for successful agent', () => {
      // Arrange
      const input = createSubagentStopInput();

      // Act
      const result = retryHandler(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true for failed agent', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: 'Agent encountered an error',
      });

      // Act
      const result = retryHandler(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true when no agent type', () => {
      // Arrange
      const input = createSubagentStopInput({
        tool_input: {},
        subagent_type: undefined,
        agent_type: undefined,
      });

      // Act
      const result = retryHandler(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('always returns continue: true with valid retry decision', () => {
      // Arrange
      vi.mocked(makeRetryDecision).mockReturnValue({
        shouldRetry: true,
        retryCount: 1,
        maxRetries: 3,
        delayMs: 1000,
        reason: 'Will retry',
      });
      const input = createSubagentStopInput({
        error: 'Some error',
      });

      // Act
      const result = retryHandler(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Skip retry logic for success
  // ---------------------------------------------------------------------------

  describe('successful completion', () => {
    test('returns silent success for successful agent', () => {
      // Arrange
      const input = createSubagentStopInput();

      // Act
      const _result = retryHandler(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('does not make retry decision for success', () => {
      // Arrange
      const input = createSubagentStopInput();

      // Act
      retryHandler(input);

      // Assert
      expect(makeRetryDecision).not.toHaveBeenCalled();
    });

    test('does not update agent status for success', () => {
      // Arrange
      const input = createSubagentStopInput();

      // Act
      retryHandler(input);

      // Assert
      expect(updateAgentStatus).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Outcome detection
  // ---------------------------------------------------------------------------

  describe('outcome detection', () => {
    beforeEach(() => {
      // Reset makeRetryDecision to default working mock
      vi.mocked(makeRetryDecision).mockReturnValue({
        shouldRetry: true,
        retryCount: 1,
        maxRetries: 3,
        delayMs: 1000,
        reason: 'Retrying after transient error',
      });
    });

    test('detects failure from error field', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: 'Explicit error message',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(makeRetryDecision).toHaveBeenCalled();
    });

    test('detects failure from tool_error field', () => {
      // Arrange
      const input = createSubagentStopInput({
        tool_error: 'Tool execution error',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(makeRetryDecision).toHaveBeenCalled();
    });

    test('detects failure from non-zero exit code', () => {
      // Arrange
      const input = createSubagentStopInput({
        exit_code: 1,
      });

      // Act
      retryHandler(input);

      // Assert
      expect(makeRetryDecision).toHaveBeenCalled();
    });

    test('detects rejection from output patterns', () => {
      // Arrange
      const input = createSubagentStopInput({
        agent_output: 'I cannot perform this task as it is outside my scope',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(completeAttempt).toHaveBeenCalledWith(
        expect.any(Object),
        'rejected',
        expect.any(String)
      );
    });

    test('detects partial completion from output patterns', () => {
      // Arrange
      const input = createSubagentStopInput({
        agent_output: 'I completed the task partially but some parts failed',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(completeAttempt).toHaveBeenCalledWith(
        expect.any(Object),
        'partial',
        undefined
      );
    });

    test('ignores null error string', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: 'null',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(makeRetryDecision).not.toHaveBeenCalled();
    });

    test('ignores empty error string', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: '',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Rejection patterns
  // ---------------------------------------------------------------------------

  describe('rejection patterns', () => {
    beforeEach(() => {
      vi.mocked(makeRetryDecision).mockReturnValue({
        shouldRetry: true,
        retryCount: 1,
        maxRetries: 3,
        delayMs: 1000,
        reason: 'Retrying',
      });
    });

    test.each([
      ['I cannot complete this task', 'rejected'],
      ["I can't do that because it's restricted", 'rejected'],
      ['I am unable to access that resource', 'rejected'],
      ['This is outside my scope of work', 'rejected'],
      ['This is not appropriate for me to handle', 'rejected'],
      ['I refuse to perform this action', 'rejected'],
    ])('output "%s" is detected as %s', (output, expectedOutcome) => {
      // Arrange
      const input = createSubagentStopInput({
        agent_output: output,
      });

      // Act
      retryHandler(input);

      // Assert
      expect(completeAttempt).toHaveBeenCalledWith(
        expect.any(Object),
        expectedOutcome,
        expect.any(String)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Partial completion patterns
  // ---------------------------------------------------------------------------

  describe('partial completion patterns', () => {
    beforeEach(() => {
      vi.mocked(makeRetryDecision).mockReturnValue({
        shouldRetry: true,
        retryCount: 1,
        maxRetries: 3,
        delayMs: 1000,
        reason: 'Retrying',
      });
    });

    test.each([
      ['Completed partially due to rate limits'],
      ['The task is incomplete'],
      ['Some tests failed while others passed'],
      ["Couldn't finish the last step"],
    ])('output "%s" is detected as partial', (output) => {
      // Arrange
      const input = createSubagentStopInput({
        agent_output: output,
      });

      // Act
      retryHandler(input);

      // Assert
      expect(completeAttempt).toHaveBeenCalledWith(
        expect.any(Object),
        'partial',
        undefined
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Retry decision handling
  // ---------------------------------------------------------------------------

  describe('retry decision handling', () => {
    beforeEach(() => {
      vi.mocked(makeRetryDecision).mockReturnValue({
        shouldRetry: true,
        retryCount: 1,
        maxRetries: 3,
        delayMs: 1000,
        reason: 'Retrying',
      });
    });

    test('calls makeRetryDecision with correct parameters', () => {
      // Arrange
      vi.mocked(loadState).mockReturnValue({
        activeAgents: [
          { agent: 'failed-agent', retryCount: 1 },
        ],
      } as any);
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'failed-agent' },
        subagent_type: 'failed-agent',
        error: 'Connection timeout',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(makeRetryDecision).toHaveBeenCalledWith(
        'failed-agent',
        2, // retryCount + 1
        'Connection timeout',
        expect.any(Array),
        3 // maxRetries from config
      );
    });

    test('uses config maxRetries', () => {
      // Arrange
      vi.mocked(loadConfig).mockReturnValue({
        maxRetries: 5,
        retryDelayBaseMs: 2000,
      });
      const input = createSubagentStopInput({
        error: 'Error',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(makeRetryDecision).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.any(String),
        expect.any(Array),
        5
      );
    });

    test('updates agent status to retrying when shouldRetry is true', () => {
      // Arrange
      vi.mocked(makeRetryDecision).mockReturnValue({
        shouldRetry: true,
        retryCount: 1,
        maxRetries: 3,
        delayMs: 1000,
        reason: 'Will retry',
      });
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'retry-agent' },
        subagent_type: 'retry-agent',
        error: 'Transient error',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(updateAgentStatus).toHaveBeenCalledWith('retry-agent', 'retrying');
    });

    test('updates agent status to failed when shouldRetry is false', () => {
      // Arrange
      vi.mocked(makeRetryDecision).mockReturnValue({
        shouldRetry: false,
        retryCount: 3,
        maxRetries: 3,
        reason: 'Max retries exceeded',
      });
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'exhausted-agent' },
        subagent_type: 'exhausted-agent',
        error: 'Persistent error',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(updateAgentStatus).toHaveBeenCalledWith('exhausted-agent', 'failed');
    });
  });

  // ---------------------------------------------------------------------------
  // Task status updates
  // ---------------------------------------------------------------------------

  describe('task status updates', () => {
    test('updates task status to failed when retry not recommended', () => {
      // Arrange
      vi.mocked(makeRetryDecision).mockReturnValue({
        shouldRetry: false,
        retryCount: 3,
        maxRetries: 3,
        reason: 'Exceeded',
      });
      vi.mocked(getTaskByAgent).mockReturnValue({
        taskId: 'task-123',
        agent: 'failed-agent',
      } as any);
      const input = createSubagentStopInput({
        error: 'Fatal error',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(updateTaskStatus).toHaveBeenCalledWith('task-123', 'failed');
    });

    test('does not update task status when retry is recommended', () => {
      // Arrange
      vi.mocked(makeRetryDecision).mockReturnValue({
        shouldRetry: true,
        retryCount: 1,
        maxRetries: 3,
        delayMs: 1000,
        reason: 'Retrying',
      });
      vi.mocked(getTaskByAgent).mockReturnValue({
        taskId: 'task-456',
        agent: 'retry-agent',
      } as any);
      const input = createSubagentStopInput({
        error: 'Transient error',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(updateTaskStatus).not.toHaveBeenCalled();
    });

    test('does not error when no task found', () => {
      // Arrange
      vi.mocked(makeRetryDecision).mockReturnValue({
        shouldRetry: false,
        retryCount: 3,
        maxRetries: 3,
        reason: 'Failed',
      });
      vi.mocked(getTaskByAgent).mockReturnValue(undefined);
      const input = createSubagentStopInput({
        error: 'Error',
      });

      // Act & Assert
      expect(() => retryHandler(input)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Attempt history tracking
  // ---------------------------------------------------------------------------

  describe('attempt history tracking', () => {
    beforeEach(() => {
      vi.mocked(makeRetryDecision).mockReturnValue({
        shouldRetry: true,
        retryCount: 1,
        maxRetries: 3,
        delayMs: 1000,
        reason: 'Retrying',
      });
    });

    test('creates attempt record', () => {
      // Arrange
      vi.mocked(loadState).mockReturnValue({
        activeAgents: [
          { agent: 'tracked-agent', retryCount: 2, taskId: 'task-789' },
        ],
      } as any);
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'tracked-agent' },
        subagent_type: 'tracked-agent',
        error: 'Error for tracking',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(createAttempt).toHaveBeenCalledWith(
        'tracked-agent',
        3, // retryCount + 1
        'task-789'
      );
    });

    test('completes attempt with outcome and error', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: 'Specific error message',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(completeAttempt).toHaveBeenCalledWith(
        expect.any(Object),
        'failure',
        'Specific error message'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Context message formatting
  // ---------------------------------------------------------------------------

  describe('context message formatting', () => {
    test('calls formatRetryDecision for context message', () => {
      // Arrange
      const input = createSubagentStopInput({
        subagent_type: 'format-agent',
        error: 'Error',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(formatRetryDecision).toHaveBeenCalled();
    });

    test('outputs formatted message with context', () => {
      // Arrange
      vi.mocked(formatRetryDecision).mockReturnValue('## Retry Scheduled\nDetails here');
      const input = createSubagentStopInput({
        error: 'Error',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('Retry')
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Agent type resolution
  // ---------------------------------------------------------------------------

  describe('agent type resolution', () => {
    test.each([
      ['tool_input.subagent_type', { tool_input: { subagent_type: 'from-tool' }, subagent_type: undefined }],
      ['subagent_type', { subagent_type: 'from-subagent' }],
      ['agent_type', { subagent_type: undefined, agent_type: 'from-agent' }],
    ])('resolves agent type from %s', (_source, overrides) => {
      // Arrange
      const input = createSubagentStopInput({
        error: 'Error to trigger processing',
        ...overrides,
      });

      // Act
      retryHandler(input);

      // Assert
      expect(makeRetryDecision).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    beforeEach(() => {
      vi.mocked(makeRetryDecision).mockReturnValue({
        shouldRetry: true,
        retryCount: 1,
        maxRetries: 3,
        delayMs: 1000,
        reason: 'Retrying',
      });
    });

    test('handles empty agent type string', () => {
      // Arrange
      const input = createSubagentStopInput({
        tool_input: { subagent_type: '' },
        subagent_type: '',
        agent_type: '',
      });

      // Act
      const result = retryHandler(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('handles missing dispatched agent in state', () => {
      // Arrange
      vi.mocked(loadState).mockReturnValue({
        activeAgents: [],
      } as any);
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'new-agent' },
        subagent_type: 'new-agent',
        error: 'Error',
      });

      // Act
      retryHandler(input);

      // Assert
      // Should use default retry count of 0
      expect(makeRetryDecision).toHaveBeenCalledWith(
        'new-agent',
        1, // 0 + 1
        'Error',
        expect.any(Array),
        expect.any(Number)
      );
    });

    test('handles exit code 0 as success', () => {
      // Arrange
      const input = createSubagentStopInput({
        exit_code: 0,
      });

      // Act
      retryHandler(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(makeRetryDecision).not.toHaveBeenCalled();
    });

    test('limits output check to first 500 chars', () => {
      // Arrange
      const input = createSubagentStopInput({
        agent_output: `${'A'.repeat(400)}I cannot do this${'B'.repeat(200)}`,
      });

      // Act
      retryHandler(input);

      // Assert
      // Pattern at char 400 should be detected (within 500 limit)
      expect(completeAttempt).toHaveBeenCalledWith(
        expect.any(Object),
        'rejected',
        expect.any(String)
      );
    });

    test('pattern after 500 chars is not detected', () => {
      // Arrange
      const input = createSubagentStopInput({
        agent_output: `${'A'.repeat(501)}I cannot do this`,
      });

      // Act
      retryHandler(input);

      // Assert
      // Pattern after 500 chars should be ignored - returns success
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Logging verification
  // ---------------------------------------------------------------------------

  describe('logging', () => {
    beforeEach(() => {
      vi.mocked(makeRetryDecision).mockReturnValue({
        shouldRetry: true,
        retryCount: 1,
        maxRetries: 3,
        delayMs: 1000,
        reason: 'Retrying',
      });
    });

    test('logs outcome detection', () => {
      // Arrange
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'logged-agent' },
        subagent_type: 'logged-agent',
        error: 'Logged error',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'retry-handler',
        expect.stringContaining('logged-agent')
      );
    });

    test('logs retry decision', () => {
      // Arrange
      vi.mocked(makeRetryDecision).mockReturnValue({
        shouldRetry: true,
        retryCount: 1,
        maxRetries: 3,
        delayMs: 1000,
        alternativeAgent: 'alt-agent',
        reason: 'Will retry',
      });
      const input = createSubagentStopInput({
        error: 'Error',
      });

      // Act
      retryHandler(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'retry-handler',
        expect.stringContaining('shouldRetry=true')
      );
    });
  });
});

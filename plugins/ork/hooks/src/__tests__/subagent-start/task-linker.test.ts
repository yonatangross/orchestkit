/**
 * Unit tests for task-linker SubagentStart hook
 *
 * Tests the task linker that:
 * - Looks up orchestration tasks by agent type
 * - Updates task status to in_progress when found
 * - Updates agent tracking state
 * - Returns context message with task details
 *
 * Issue #260: subagent-start coverage 33% -> 100%
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// ---------------------------------------------------------------------------
// Mock dependencies at module level before any hook imports
// ---------------------------------------------------------------------------
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ size: 100 }),
  renameSync: vi.fn(),
  readSync: vi.fn().mockReturnValue(0),
  readdirSync: vi.fn().mockReturnValue([]),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue('main\n'),
  spawn: vi.fn().mockReturnValue({
    unref: vi.fn(),
    on: vi.fn(),
    stderr: { on: vi.fn() },
    stdout: { on: vi.fn() },
    pid: 12345,
  }),
}));

// Mock task-integration module
const mockGetTaskByAgent = vi.fn();
const mockUpdateTaskStatus = vi.fn();
const mockFormatTaskUpdateForClaude = vi.fn();

vi.mock('../../lib/task-integration.js', () => ({
  getTaskByAgent: (...args: unknown[]) => mockGetTaskByAgent(...args),
  updateTaskStatus: (...args: unknown[]) => mockUpdateTaskStatus(...args),
  formatTaskUpdateForClaude: (...args: unknown[]) => mockFormatTaskUpdateForClaude(...args),
}));

// Mock orchestration-state module
const mockUpdateAgentStatus = vi.fn();

vi.mock('../../lib/orchestration-state.js', () => ({
  updateAgentStatus: (...args: unknown[]) => mockUpdateAgentStatus(...args),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------
import { taskLinker } from '../../subagent-start/task-linker.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal HookInput for SubagentStart */
function createToolInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'test-session-linker-001',
    tool_input: {
      subagent_type: 'test-generator',
      description: 'Generate tests',
      ...((overrides.tool_input as Record<string, unknown>) || {}),
    },
    ...overrides,
  };
}

/** Create a mock task entry */
function createMockTask(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    taskId: 'task-001',
    agent: 'test-generator',
    confidence: 85,
    createdAt: new Date().toISOString(),
    status: 'pending',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('taskLinker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no task found
    mockGetTaskByAgent.mockReturnValue(null);
    mockUpdateTaskStatus.mockImplementation(() => {});
    mockFormatTaskUpdateForClaude.mockReturnValue('```\nTaskUpdate:\n  taskId: "task-001"\n  status: "in_progress"\n```');
    mockUpdateAgentStatus.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. No agent type
  // -----------------------------------------------------------------------

  describe('no agent type', () => {
    test('returns silentSuccess when tool_input has no subagent_type', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {
          description: 'Some task without agent type',
        },
      };

      // Act
      const result = taskLinker(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    test('returns silentSuccess when subagent_type is empty string', () => {
      // Arrange
      const input = createToolInput({
        tool_input: {
          subagent_type: '',
          description: 'Task',
        },
      });

      // Act
      const result = taskLinker(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('does not call getTaskByAgent when no agent type', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
      };

      // Act
      taskLinker(input);

      // Assert
      expect(mockGetTaskByAgent).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 2. No task found
  // -----------------------------------------------------------------------

  describe('no task found for agent', () => {
    test('returns silentSuccess when getTaskByAgent returns null', () => {
      // Arrange
      mockGetTaskByAgent.mockReturnValue(null);
      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
        },
      });

      // Act
      const result = taskLinker(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(mockGetTaskByAgent).toHaveBeenCalledWith('test-generator');
    });

    test('returns silentSuccess when getTaskByAgent returns undefined', () => {
      // Arrange
      mockGetTaskByAgent.mockReturnValue(undefined);
      const input = createToolInput({
        tool_input: {
          subagent_type: 'security-auditor',
          description: 'Audit security',
        },
      });

      // Act
      const result = taskLinker(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('does not call updateTaskStatus when no task found', () => {
      // Arrange
      mockGetTaskByAgent.mockReturnValue(null);
      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
        },
      });

      // Act
      taskLinker(input);

      // Assert
      expect(mockUpdateTaskStatus).not.toHaveBeenCalled();
      expect(mockUpdateAgentStatus).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 3. Task found - returns context
  // -----------------------------------------------------------------------

  describe('task found for agent', () => {
    test('returns outputWithContext when task is found', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-042', agent: 'test-generator' });
      mockGetTaskByAgent.mockReturnValue(task);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests for auth module',
        },
      });

      // Act
      const result = taskLinker(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toContain('task-042');
      expect(result.hookSpecificOutput!.additionalContext).toContain('test-generator');
    });

    test('context message includes task ID', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-abc-123' });
      mockGetTaskByAgent.mockReturnValue(task);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
        },
      });

      // Act
      const result = taskLinker(input);

      // Assert
      expect(result.hookSpecificOutput!.additionalContext).toContain('task-abc-123');
    });

    test('context message includes in_progress status', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-100' });
      mockGetTaskByAgent.mockReturnValue(task);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Test task',
        },
      });

      // Act
      const result = taskLinker(input);

      // Assert
      expect(result.hookSpecificOutput!.additionalContext).toContain('in_progress');
    });
  });

  // -----------------------------------------------------------------------
  // 4. Status updates
  // -----------------------------------------------------------------------

  describe('status updates', () => {
    test('calls updateTaskStatus with in_progress', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-200' });
      mockGetTaskByAgent.mockReturnValue(task);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
        },
      });

      // Act
      taskLinker(input);

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith('task-200', 'in_progress');
    });

    test('updateTaskStatus is called exactly once', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-300' });
      mockGetTaskByAgent.mockReturnValue(task);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'backend-system-architect',
          description: 'Design backend',
        },
      });

      // Act
      taskLinker(input);

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Agent status update
  // -----------------------------------------------------------------------

  describe('agent status update', () => {
    test('calls updateAgentStatus with agent type and task ID', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-400' });
      mockGetTaskByAgent.mockReturnValue(task);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'security-auditor',
          description: 'Audit the API',
        },
      });

      // Act
      taskLinker(input);

      // Assert
      expect(mockUpdateAgentStatus).toHaveBeenCalledWith(
        'security-auditor',
        'in_progress',
        'task-400'
      );
    });

    test('updateAgentStatus is called exactly once', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-500' });
      mockGetTaskByAgent.mockReturnValue(task);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
        },
      });

      // Act
      taskLinker(input);

      // Assert
      expect(mockUpdateAgentStatus).toHaveBeenCalledTimes(1);
    });

    test('does not call updateAgentStatus when no task found', () => {
      // Arrange
      mockGetTaskByAgent.mockReturnValue(null);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
        },
      });

      // Act
      taskLinker(input);

      // Assert
      expect(mockUpdateAgentStatus).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 6. Context message format
  // -----------------------------------------------------------------------

  describe('context message format', () => {
    test('contains Orchestration header', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-600' });
      mockGetTaskByAgent.mockReturnValue(task);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
        },
      });

      // Act
      const result = taskLinker(input);

      // Assert
      expect(result.hookSpecificOutput!.additionalContext).toContain('Orchestration');
      expect(result.hookSpecificOutput!.additionalContext).toContain('Task Linked');
    });

    test('contains agent type in backticks', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-700' });
      mockGetTaskByAgent.mockReturnValue(task);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'workflow-architect',
          description: 'Design workflow',
        },
      });

      // Act
      const result = taskLinker(input);

      // Assert
      expect(result.hookSpecificOutput!.additionalContext).toContain('`workflow-architect`');
    });

    test('contains task ID in bold', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-800' });
      mockGetTaskByAgent.mockReturnValue(task);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
        },
      });

      // Act
      const result = taskLinker(input);

      // Assert
      expect(result.hookSpecificOutput!.additionalContext).toContain('**task-800**');
    });

    test('includes formatTaskUpdateForClaude output', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-900' });
      mockGetTaskByAgent.mockReturnValue(task);
      mockFormatTaskUpdateForClaude.mockReturnValue('### Update Task\n\nCustom formatted content');

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
        },
      });

      // Act
      const result = taskLinker(input);

      // Assert
      expect(result.hookSpecificOutput!.additionalContext).toContain('Custom formatted content');
      expect(mockFormatTaskUpdateForClaude).toHaveBeenCalledWith({
        taskId: 'task-900',
        status: 'in_progress',
      });
    });
  });

  // -----------------------------------------------------------------------
  // 7. Multiple agent type fields
  // -----------------------------------------------------------------------

  describe('agent type field resolution', () => {
    test('reads from tool_input.subagent_type first', () => {
      // Arrange
      mockGetTaskByAgent.mockReturnValue(null);

      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {
          subagent_type: 'from-tool-input',
        },
        subagent_type: 'from-input-root',
        agent_type: 'from-agent-type',
      };

      // Act
      taskLinker(input);

      // Assert
      expect(mockGetTaskByAgent).toHaveBeenCalledWith('from-tool-input');
    });

    test('falls back to input.subagent_type when tool_input lacks it', () => {
      // Arrange
      mockGetTaskByAgent.mockReturnValue(null);

      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
        subagent_type: 'from-input-root',
        agent_type: 'from-agent-type',
      };

      // Act
      taskLinker(input);

      // Assert
      expect(mockGetTaskByAgent).toHaveBeenCalledWith('from-input-root');
    });

    test('falls back to input.agent_type as last resort', () => {
      // Arrange
      mockGetTaskByAgent.mockReturnValue(null);

      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
        agent_type: 'from-agent-type',
      };

      // Act
      taskLinker(input);

      // Assert
      expect(mockGetTaskByAgent).toHaveBeenCalledWith('from-agent-type');
    });

    test('returns silentSuccess when all agent type fields are empty', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
      };

      // Act
      const result = taskLinker(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(mockGetTaskByAgent).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 8. CC compliance
  // -----------------------------------------------------------------------

  describe('CC compliance', () => {
    test('all code paths return continue: true', () => {
      // Path 1: no agent type
      const result1 = taskLinker({
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
      });
      expect(result1.continue).toBe(true);

      // Path 2: no task found
      vi.clearAllMocks();
      mockGetTaskByAgent.mockReturnValue(null);
      const result2 = taskLinker(createToolInput({
        tool_input: { subagent_type: 'test-generator', description: 'Test' },
      }));
      expect(result2.continue).toBe(true);

      // Path 3: task found
      vi.clearAllMocks();
      mockGetTaskByAgent.mockReturnValue(createMockTask());
      mockFormatTaskUpdateForClaude.mockReturnValue('formatted');
      const result3 = taskLinker(createToolInput({
        tool_input: { subagent_type: 'test-generator', description: 'Test' },
      }));
      expect(result3.continue).toBe(true);
    });

    test('outputWithContext result has correct CC 2.1.9 shape', () => {
      // Arrange
      const task = createMockTask({ taskId: 'task-compliance' });
      mockGetTaskByAgent.mockReturnValue(task);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
        },
      });

      // Act
      const result = taskLinker(input);

      // Assert - CC 2.1.9 compliant shape
      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('suppressOutput', true);
      expect(result).toHaveProperty('hookSpecificOutput');
      expect(result.hookSpecificOutput).toHaveProperty('hookEventName', 'PostToolUse');
      expect(result.hookSpecificOutput).toHaveProperty('additionalContext');
      expect(typeof result.hookSpecificOutput!.additionalContext).toBe('string');
    });

    test('silentSuccess result has correct shape', () => {
      // Arrange
      mockGetTaskByAgent.mockReturnValue(null);
      const input = createToolInput({
        tool_input: { subagent_type: 'test-generator', description: 'Test' },
      });

      // Act
      const result = taskLinker(input);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });
});

/**
 * Unit tests for context-publisher hook
 * Tests context publication to Context Protocol 2.0 files for SubagentStop
 *
 * Non-blocking hook: Must always return continue: true, even on errors
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput, HookResult } from '../../types.js';

// =============================================================================
// Mocks - MUST be defined BEFORE imports
// =============================================================================

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(() => '{}'),
}));

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-123'),
}));

import { contextPublisher } from '../../subagent-stop/context-publisher.js';
import { outputSilentSuccess, getProjectDir } from '../../lib/common.js';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';

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
    tool_input: {},
    agent_output: 'Agent completed successfully with results',
    subagent_type: 'test-agent',
    ...overrides,
  };
}

// =============================================================================
// Context Publisher Tests
// =============================================================================

describe('context-publisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
    process.env.CLAUDE_AGENT_NAME = 'test-agent';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CLAUDE_PROJECT_DIR;
    delete process.env.CLAUDE_AGENT_NAME;
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance - Non-blocking hook must always continue
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('always returns continue: true for basic input', () => {
      // Arrange
      const input = createSubagentStopInput();

      // Act
      const result = contextPublisher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true even when files do not exist', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput();

      // Act
      const result = contextPublisher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true even when writeFileSync throws', () => {
      // Arrange
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error('Disk full');
      });
      const input = createSubagentStopInput();

      // Act
      const result = contextPublisher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true even when readFileSync throws', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('File corrupted');
      });
      const input = createSubagentStopInput();

      // Act
      const result = contextPublisher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns suppressOutput: true for silent operation', () => {
      // Arrange
      const input = createSubagentStopInput();

      // Act
      const result = contextPublisher(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Decisions file updates (Context Protocol 2.0)
  // ---------------------------------------------------------------------------

  describe('decisions file updates', () => {
    test('creates decisions directory if not exists', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput();

      // Act
      contextPublisher(input);

      // Assert
      expect(mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('decisions'),
        { recursive: true }
      );
    });

    test('writes decision entry with agent name', () => {
      // Arrange
      process.env.CLAUDE_AGENT_NAME = 'backend-system-architect';
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput({ agent_output: 'Implemented API' });

      // Act
      contextPublisher(input);

      // Assert
      const writeCalls = vi.mocked(writeFileSync).mock.calls;
      const decisionsCall = writeCalls.find(call =>
        (call[0] as string).includes('decisions/active.json')
      );
      expect(decisionsCall).toBeDefined();

      const writtenData = JSON.parse(decisionsCall![1] as string);
      expect(writtenData.decisions.backend_system_architect).toBeDefined();
      expect(writtenData.decisions.backend_system_architect.agent).toBe('backend-system-architect');
      expect(writtenData.decisions.backend_system_architect.status).toBe('completed');
    });

    test('reads existing decisions file and preserves other entries', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        schema_version: '2.0.0',
        decisions: {
          other_agent: {
            timestamp: '2024-01-01T00:00:00.000Z',
            agent: 'other-agent',
            summary: 'Previous decision',
            status: 'completed',
          },
        },
      }));

      process.env.CLAUDE_AGENT_NAME = 'new-agent';
      const input = createSubagentStopInput({ agent_output: 'New result' });

      // Act
      contextPublisher(input);

      // Assert
      const writeCalls = vi.mocked(writeFileSync).mock.calls;
      const decisionsCall = writeCalls.find(call =>
        (call[0] as string).includes('decisions/active.json')
      );
      expect(decisionsCall).toBeDefined();

      const writtenData = JSON.parse(decisionsCall![1] as string);
      expect(writtenData.decisions.other_agent).toBeDefined();
      expect(writtenData.decisions.new_agent).toBeDefined();
    });

    test('truncates summary to 200 characters with ellipsis', () => {
      // Arrange
      const longOutput = 'A'.repeat(300);
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput({ agent_output: longOutput });

      // Act
      contextPublisher(input);

      // Assert
      const writeCalls = vi.mocked(writeFileSync).mock.calls;
      const decisionsCall = writeCalls.find(call =>
        (call[0] as string).includes('decisions/active.json')
      );
      expect(decisionsCall).toBeDefined();

      const writtenData = JSON.parse(decisionsCall![1] as string);
      const agentKey = Object.keys(writtenData.decisions)[0];
      expect(writtenData.decisions[agentKey].summary.length).toBe(203); // 200 + '...'
      expect(writtenData.decisions[agentKey].summary.endsWith('...')).toBe(true);
    });

    test('replaces hyphens with underscores in agent key', () => {
      // Arrange
      process.env.CLAUDE_AGENT_NAME = 'my-special-agent';
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput();

      // Act
      contextPublisher(input);

      // Assert
      const writeCalls = vi.mocked(writeFileSync).mock.calls;
      const decisionsCall = writeCalls.find(call =>
        (call[0] as string).includes('decisions/active.json')
      );
      expect(decisionsCall).toBeDefined();

      const writtenData = JSON.parse(decisionsCall![1] as string);
      expect(writtenData.decisions.my_special_agent).toBeDefined();
      expect(writtenData.decisions['my-special-agent']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Session state updates (Context Protocol 2.0)
  // ---------------------------------------------------------------------------

  describe('session state updates', () => {
    test('creates session directory if not exists', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput();

      // Act
      contextPublisher(input);

      // Assert
      expect(mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('session'),
        { recursive: true }
      );
    });

    test('appends task to tasks_completed array', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path) => {
        if ((path as string).includes('state.json')) {
          return JSON.stringify({
            schema_version: '2.0.0',
            session_id: 'test-session',
            started_at: '2024-01-01T00:00:00.000Z',
            last_activity: '2024-01-01T00:00:00.000Z',
            active_agent: 'test-agent',
            tasks_pending: [],
            tasks_completed: [],
          });
        }
        return '{}';
      });

      process.env.CLAUDE_AGENT_NAME = 'test-agent';
      const input = createSubagentStopInput({ agent_output: 'Task done' });

      // Act
      contextPublisher(input);

      // Assert
      const writeCalls = vi.mocked(writeFileSync).mock.calls;
      const stateCall = writeCalls.find(call =>
        (call[0] as string).includes('state.json')
      );
      expect(stateCall).toBeDefined();

      const writtenData = JSON.parse(stateCall![1] as string);
      expect(writtenData.tasks_completed).toHaveLength(1);
      expect(writtenData.tasks_completed[0].agent).toBe('test-agent');
    });

    test('clears active_agent on completion', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path) => {
        if ((path as string).includes('state.json')) {
          return JSON.stringify({
            schema_version: '2.0.0',
            session_id: 'test-session',
            active_agent: 'test-agent',
            tasks_pending: [],
            tasks_completed: [],
          });
        }
        return '{}';
      });
      const input = createSubagentStopInput();

      // Act
      contextPublisher(input);

      // Assert
      const writeCalls = vi.mocked(writeFileSync).mock.calls;
      const stateCall = writeCalls.find(call =>
        (call[0] as string).includes('state.json')
      );
      expect(stateCall).toBeDefined();

      const writtenData = JSON.parse(stateCall![1] as string);
      expect(writtenData.active_agent).toBeNull();
    });

    test('updates last_activity timestamp', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path) => {
        if ((path as string).includes('state.json')) {
          return JSON.stringify({
            schema_version: '2.0.0',
            last_activity: '2024-01-01T00:00:00.000Z',
            tasks_pending: [],
            tasks_completed: [],
          });
        }
        return '{}';
      });
      const input = createSubagentStopInput();

      // Act
      contextPublisher(input);

      // Assert
      const writeCalls = vi.mocked(writeFileSync).mock.calls;
      const stateCall = writeCalls.find(call =>
        (call[0] as string).includes('state.json')
      );
      expect(stateCall).toBeDefined();

      const writtenData = JSON.parse(stateCall![1] as string);
      expect(writtenData.last_activity).not.toBe('2024-01-01T00:00:00.000Z');
    });
  });

  // ---------------------------------------------------------------------------
  // Logging behavior
  // ---------------------------------------------------------------------------

  describe('logging', () => {
    test('writes log file to agent-context directory', () => {
      // Arrange
      const input = createSubagentStopInput({ agent_output: 'Test output' });

      // Act
      contextPublisher(input);

      // Assert
      const writeCalls = vi.mocked(writeFileSync).mock.calls;
      const logCall = writeCalls.find(call =>
        (call[0] as string).includes('logs/agent-context/')
      );
      expect(logCall).toBeDefined();
    });

    test('log content includes agent name', () => {
      // Arrange
      process.env.CLAUDE_AGENT_NAME = 'my-agent';
      const input = createSubagentStopInput({ agent_output: 'Output text' });

      // Act
      contextPublisher(input);

      // Assert
      const writeCalls = vi.mocked(writeFileSync).mock.calls;
      const logCall = writeCalls.find(call =>
        (call[0] as string).includes('logs/agent-context/')
      );
      expect(logCall).toBeDefined();
      expect(logCall![1]).toContain('my-agent');
    });

    test('log content includes agent output', () => {
      // Arrange
      const input = createSubagentStopInput({ agent_output: 'Detailed results here' });

      // Act
      contextPublisher(input);

      // Assert
      const writeCalls = vi.mocked(writeFileSync).mock.calls;
      const logCall = writeCalls.find(call =>
        (call[0] as string).includes('logs/agent-context/')
      );
      expect(logCall).toBeDefined();
      expect(logCall![1]).toContain('Detailed results here');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty agent_output', () => {
      // Arrange
      const input = createSubagentStopInput({ agent_output: '' });

      // Act
      const result = contextPublisher(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('handles undefined agent_output by using output field', () => {
      // Arrange
      const input = createSubagentStopInput({
        agent_output: undefined,
        output: 'Fallback output',
      });

      // Act
      const result = contextPublisher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles missing CLAUDE_AGENT_NAME by using unknown', () => {
      // Arrange
      delete process.env.CLAUDE_AGENT_NAME;
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput();

      // Act
      contextPublisher(input);

      // Assert
      const writeCalls = vi.mocked(writeFileSync).mock.calls;
      const decisionsCall = writeCalls.find(call =>
        (call[0] as string).includes('decisions/active.json')
      );
      expect(decisionsCall).toBeDefined();

      const writtenData = JSON.parse(decisionsCall![1] as string);
      expect(writtenData.decisions.unknown).toBeDefined();
    });

    test('handles malformed JSON in existing decisions file', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('not valid json {{{');
      const input = createSubagentStopInput();

      // Act
      const result = contextPublisher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles missing decisions object in existing file', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        schema_version: '1.0.0',
        // no decisions field
      }));
      const input = createSubagentStopInput();

      // Act
      const result = contextPublisher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles missing tasks_completed array in session state', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path) => {
        if ((path as string).includes('state.json')) {
          return JSON.stringify({
            schema_version: '2.0.0',
            // no tasks_completed array
          });
        }
        return '{}';
      });
      const input = createSubagentStopInput();

      // Act
      const result = contextPublisher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles mkdirSync failure gracefully', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });
      const input = createSubagentStopInput();

      // Act
      const result = contextPublisher(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Parametric tests for agent name normalization
  // ---------------------------------------------------------------------------

  describe('agent name normalization', () => {
    test.each([
      ['simple-agent', 'simple_agent'],
      ['multi-word-agent-name', 'multi_word_agent_name'],
      ['agent', 'agent'],
      ['a-b-c-d', 'a_b_c_d'],
      ['backend-system-architect', 'backend_system_architect'],
    ])('normalizes agent name %s to key %s', (agentName, expectedKey) => {
      // Arrange
      process.env.CLAUDE_AGENT_NAME = agentName;
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput();

      // Act
      contextPublisher(input);

      // Assert
      const writeCalls = vi.mocked(writeFileSync).mock.calls;
      const decisionsCall = writeCalls.find(call =>
        (call[0] as string).includes('decisions/active.json')
      );
      expect(decisionsCall).toBeDefined();

      const writtenData = JSON.parse(decisionsCall![1] as string);
      expect(writtenData.decisions[expectedKey]).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Output summary truncation tests
  // ---------------------------------------------------------------------------

  describe('output summary truncation', () => {
    test.each([
      [50, 50, false],
      [100, 100, false],
      [200, 200, false],
      [201, 203, true],
      [300, 203, true],
      [1000, 203, true],
    ])('output length %d results in summary length %d (truncated: %s)', (inputLen, expectedLen, truncated) => {
      // Arrange
      const output = 'X'.repeat(inputLen);
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput({ agent_output: output });

      // Act
      contextPublisher(input);

      // Assert
      const writeCalls = vi.mocked(writeFileSync).mock.calls;
      const decisionsCall = writeCalls.find(call =>
        (call[0] as string).includes('decisions/active.json')
      );
      expect(decisionsCall).toBeDefined();

      const writtenData = JSON.parse(decisionsCall![1] as string);
      const agentKey = Object.keys(writtenData.decisions)[0];
      expect(writtenData.decisions[agentKey].summary.length).toBe(expectedLen);
      if (truncated) {
        expect(writtenData.decisions[agentKey].summary.endsWith('...')).toBe(true);
      }
    });
  });
});

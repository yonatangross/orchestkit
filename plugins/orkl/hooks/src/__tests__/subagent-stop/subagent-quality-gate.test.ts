/**
 * Unit tests for subagent-quality-gate hook
 * Tests validation of subagent output quality for SubagentStop
 *
 * CC 2.1.7 Compliant: includes continue field in all outputs
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
  readFileSync: vi.fn(() => JSON.stringify({ errors: 0 })),
}));

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputWarning: vi.fn((message: string) => ({
    continue: true,
    systemMessage: `\u26a0 ${message}`,
  })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-123'),
}));

import { subagentQualityGate } from '../../subagent-stop/subagent-quality-gate.js';
import { outputSilentSuccess, outputWarning, logHook } from '../../lib/common.js';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';

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
    agent_id: 'agent-123',
    subagent_type: 'test-agent',
    agent_output: 'Agent completed successfully',
    ...overrides,
  };
}

// =============================================================================
// Subagent Quality Gate Tests
// =============================================================================

describe('subagent-quality-gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CLAUDE_PROJECT_DIR;
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance - Non-blocking hook must always continue
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('always returns continue: true for successful agent', () => {
      // Arrange
      const input = createSubagentStopInput();

      // Act
      const result = subagentQualityGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true for failed agent', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: 'Agent encountered a fatal error',
      });

      // Act
      const result = subagentQualityGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true even when metrics file operations fail', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Cannot read file');
      });
      const input = createSubagentStopInput({
        error: 'Some error',
      });

      // Act
      const result = subagentQualityGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true when writeFileSync throws', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ errors: 5 }));
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error('Disk full');
      });
      const input = createSubagentStopInput({
        error: 'Error',
      });

      // Act
      const result = subagentQualityGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns suppressOutput: true for successful agent', () => {
      // Arrange
      const input = createSubagentStopInput();

      // Act
      const result = subagentQualityGate(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Success path
  // ---------------------------------------------------------------------------

  describe('successful agent completion', () => {
    test('returns silent success for agent without error', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: undefined,
      });

      // Act
      const result = subagentQualityGate(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success for empty error string', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: '',
      });

      // Act
      const result = subagentQualityGate(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success for null error string', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: 'null',
      });

      // Act
      const result = subagentQualityGate(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('does not increment error count for success', () => {
      // Arrange
      const input = createSubagentStopInput();

      // Act
      subagentQualityGate(input);

      // Assert
      expect(writeFileSync).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Error detection
  // ---------------------------------------------------------------------------

  describe('error detection', () => {
    test('detects error from error field', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: 'Agent failed with exception',
      });

      // Act
      subagentQualityGate(input);

      // Assert
      expect(outputWarning).toHaveBeenCalled();
    });

    test('warning includes subagent type', () => {
      // Arrange
      const input = createSubagentStopInput({
        subagent_type: 'backend-architect',
        error: 'Connection failed',
      });

      // Act
      subagentQualityGate(input);

      // Assert
      expect(outputWarning).toHaveBeenCalledWith(
        expect.stringContaining('backend-architect')
      );
    });

    test('warning includes error message', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: 'Timeout while processing',
      });

      // Act
      subagentQualityGate(input);

      // Assert
      expect(outputWarning).toHaveBeenCalledWith(
        expect.stringContaining('Timeout while processing')
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Metrics tracking
  // ---------------------------------------------------------------------------

  describe('metrics tracking', () => {
    test('increments error count when metrics file exists', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ errors: 5 }));
      const input = createSubagentStopInput({
        error: 'Error occurred',
      });

      // Act
      subagentQualityGate(input);

      // Assert
      expect(writeFileSync).toHaveBeenCalledWith(
        '/tmp/claude-session-metrics.json',
        expect.stringContaining('"errors": 6')
      );
    });

    test('initializes error count to 1 when metrics.errors is undefined', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({}));
      const input = createSubagentStopInput({
        error: 'First error',
      });

      // Act
      subagentQualityGate(input);

      // Assert
      expect(writeFileSync).toHaveBeenCalledWith(
        '/tmp/claude-session-metrics.json',
        expect.stringContaining('"errors": 1')
      );
    });

    test('does not update metrics when file does not exist', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput({
        error: 'Error',
      });

      // Act
      subagentQualityGate(input);

      // Assert
      expect(readFileSync).not.toHaveBeenCalled();
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    test('preserves other metrics fields when incrementing errors', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        errors: 3,
        successes: 10,
        totalDuration: 50000,
      }));
      const input = createSubagentStopInput({
        error: 'Error',
      });

      // Act
      subagentQualityGate(input);

      // Assert
      const writeCall = vi.mocked(writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData.errors).toBe(4);
      expect(writtenData.successes).toBe(10);
      expect(writtenData.totalDuration).toBe(50000);
    });
  });

  // ---------------------------------------------------------------------------
  // Logging behavior
  // ---------------------------------------------------------------------------

  describe('logging', () => {
    test('logs quality gate check for all agents', () => {
      // Arrange
      const input = createSubagentStopInput({
        subagent_type: 'logged-agent',
        agent_id: 'agent-xyz',
      });

      // Act
      subagentQualityGate(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'subagent-quality-gate',
        expect.stringContaining('logged-agent')
      );
    });

    test('logs agent_id in quality gate check', () => {
      // Arrange
      const input = createSubagentStopInput({
        agent_id: 'specific-agent-id',
      });

      // Act
      subagentQualityGate(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'subagent-quality-gate',
        expect.stringContaining('specific-agent-id')
      );
    });

    test('logs ERROR prefix for failed agents', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: 'Something went wrong',
      });

      // Act
      subagentQualityGate(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'subagent-quality-gate',
        expect.stringContaining('ERROR')
      );
    });

    test('logs error message for failed agents', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: 'Detailed error information',
      });

      // Act
      subagentQualityGate(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'subagent-quality-gate',
        expect.stringContaining('Detailed error information')
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty agent_id', () => {
      // Arrange
      const input = createSubagentStopInput({
        agent_id: '',
      });

      // Act
      const result = subagentQualityGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles undefined agent_id', () => {
      // Arrange
      const input = createSubagentStopInput({
        agent_id: undefined,
      });

      // Act
      const result = subagentQualityGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles empty subagent_type', () => {
      // Arrange
      const input = createSubagentStopInput({
        subagent_type: '',
        error: 'Error',
      });

      // Act
      subagentQualityGate(input);

      // Assert
      expect(outputWarning).toHaveBeenCalledWith(
        expect.stringContaining('failed')
      );
    });

    test('handles undefined subagent_type', () => {
      // Arrange
      const input = createSubagentStopInput({
        subagent_type: undefined,
        error: 'Error',
      });

      // Act
      subagentQualityGate(input);

      // Assert
      expect(outputWarning).toHaveBeenCalled();
    });

    test('handles malformed JSON in metrics file', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('not valid json {{{');
      const input = createSubagentStopInput({
        error: 'Error',
      });

      // Act
      const result = subagentQualityGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles very long error messages', () => {
      // Arrange
      const longError = 'E'.repeat(10000);
      const input = createSubagentStopInput({
        error: longError,
      });

      // Act
      const result = subagentQualityGate(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputWarning).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Parametric tests for error detection
  // ---------------------------------------------------------------------------

  describe('error string variations', () => {
    test.each([
      ['actual error message', true],
      ['null', false],
      ['', false],
      ['   ', true], // Whitespace-only is treated as error
      ['error with spaces', true],
      ['undefined', true], // String "undefined" is an error
    ])('error string "%s" is detected as error: %s', (errorValue, isError) => {
      // Arrange
      const input = createSubagentStopInput({
        error: errorValue,
      });

      // Act
      subagentQualityGate(input);

      // Assert
      if (isError) {
        expect(outputWarning).toHaveBeenCalled();
      } else {
        expect(outputSilentSuccess).toHaveBeenCalled();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Return value structure
  // ---------------------------------------------------------------------------

  describe('return value structure', () => {
    test('success returns correct HookResult structure', () => {
      // Arrange
      const input = createSubagentStopInput();

      // Act
      const result = subagentQualityGate(input);

      // Assert
      expect(result).toMatchObject({
        continue: true,
        suppressOutput: true,
      });
    });

    test('warning returns correct HookResult structure', () => {
      // Arrange
      vi.mocked(outputWarning).mockReturnValue({
        continue: true,
        systemMessage: '\u26a0 Test warning',
      });
      const input = createSubagentStopInput({
        error: 'Error message',
      });

      // Act
      const result = subagentQualityGate(input);

      // Assert
      expect(result).toMatchObject({
        continue: true,
        systemMessage: expect.stringContaining('\u26a0'),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Integration with metrics file path
  // ---------------------------------------------------------------------------

  describe('metrics file path', () => {
    test('uses /tmp/claude-session-metrics.json path', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ errors: 0 }));
      const input = createSubagentStopInput({
        error: 'Error',
      });

      // Act
      subagentQualityGate(input);

      // Assert
      expect(existsSync).toHaveBeenCalledWith('/tmp/claude-session-metrics.json');
    });
  });

  // ---------------------------------------------------------------------------
  // Warning message format
  // ---------------------------------------------------------------------------

  describe('warning message format', () => {
    test('warning message format: Subagent {type} failed: {error}', () => {
      // Arrange
      const input = createSubagentStopInput({
        subagent_type: 'test-agent',
        error: 'Connection refused',
      });

      // Act
      subagentQualityGate(input);

      // Assert
      expect(outputWarning).toHaveBeenCalledWith(
        'Subagent test-agent failed: Connection refused'
      );
    });
  });
});

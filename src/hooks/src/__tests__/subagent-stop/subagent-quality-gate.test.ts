/**
 * Unit tests for subagent-quality-gate hook
 * Tests validation of subagent output quality for SubagentStop
 *
 * CC 2.1.7 Compliant: includes continue field in all outputs
 * Non-blocking hook: Must always return continue: true, even on errors
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HookInput, } from '../../types.js';
import { mockCommonBasic } from '../fixtures/mock-common.js';

const METRICS_FILE = join(tmpdir(), 'claude-session-metrics.json');

// =============================================================================
// Hoisted mocks — shared between node:fs and atomic-write mocks
// =============================================================================
const { mockWriteFileSync } = vi.hoisted(() => ({
  mockWriteFileSync: vi.fn(),
}));

// =============================================================================
// Mocks - MUST be defined BEFORE imports
// =============================================================================

vi.mock('node:os', () => ({
  tmpdir: vi.fn(() => '/tmp'),
  homedir: vi.fn(() => '/home/test'),
  default: { tmpdir: () => '/tmp', homedir: () => '/home/test' },
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  writeFileSync: mockWriteFileSync,
  readFileSync: vi.fn(() => JSON.stringify({ errors: 0 })),
}));

vi.mock('../../lib/atomic-write.js', () => ({
  atomicWriteSync: (path: string, content: string) => mockWriteFileSync(path, content),
}));

vi.mock('../../lib/common.js', () => mockCommonBasic());

import { subagentQualityGate } from '../../subagent-stop/subagent-quality-gate.js';
import { outputSilentSuccess, outputWarning, outputBlock } from '../../lib/common.js';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { createTestContext } from '../fixtures/test-context.js';

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

let testCtx: ReturnType<typeof createTestContext>;
describe('subagent-quality-gate', () => {
  beforeEach(() => {
    testCtx = createTestContext();
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
      const result = subagentQualityGate(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true for failed agent', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: 'Agent encountered a fatal error',
      });

      // Act
      const result = subagentQualityGate(input, testCtx);

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
      const result = subagentQualityGate(input, testCtx);

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
      const result = subagentQualityGate(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns suppressOutput: true for successful agent', () => {
      // Arrange
      const input = createSubagentStopInput();

      // Act
      const result = subagentQualityGate(input, testCtx);

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
      const _result = subagentQualityGate(input, testCtx);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success for empty error string', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: '',
      });

      // Act
      const _result = subagentQualityGate(input, testCtx);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success for null error string', () => {
      // Arrange
      const input = createSubagentStopInput({
        error: 'null',
      });

      // Act
      const _result = subagentQualityGate(input, testCtx);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('does not increment error count for success', () => {
      // Arrange
      const input = createSubagentStopInput();

      // Act
      subagentQualityGate(input, testCtx);

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
      subagentQualityGate(input, testCtx);

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
      subagentQualityGate(input, testCtx);

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
      subagentQualityGate(input, testCtx);

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
      subagentQualityGate(input, testCtx);

      // Assert
      expect(writeFileSync).toHaveBeenCalledWith(
        METRICS_FILE,
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
      subagentQualityGate(input, testCtx);

      // Assert
      expect(writeFileSync).toHaveBeenCalledWith(
        METRICS_FILE,
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
      subagentQualityGate(input, testCtx);

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
      subagentQualityGate(input, testCtx);

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
      subagentQualityGate(input, testCtx);

      // Assert
      expect(testCtx.log).toHaveBeenCalledWith(
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
      subagentQualityGate(input, testCtx);

      // Assert
      expect(testCtx.log).toHaveBeenCalledWith(
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
      subagentQualityGate(input, testCtx);

      // Assert
      expect(testCtx.log).toHaveBeenCalledWith(
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
      subagentQualityGate(input, testCtx);

      // Assert
      expect(testCtx.log).toHaveBeenCalledWith(
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
      const result = subagentQualityGate(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles undefined agent_id', () => {
      // Arrange
      const input = createSubagentStopInput({
        agent_id: undefined,
      });

      // Act
      const result = subagentQualityGate(input, testCtx);

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
      subagentQualityGate(input, testCtx);

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
      subagentQualityGate(input, testCtx);

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
      const result = subagentQualityGate(input, testCtx);

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
      const result = subagentQualityGate(input, testCtx);

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
      subagentQualityGate(input, testCtx);

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
      const result = subagentQualityGate(input, testCtx);

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
      const result = subagentQualityGate(input, testCtx);

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
    test('uses platform-appropriate metrics file path', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ errors: 0 }));
      const input = createSubagentStopInput({
        error: 'Error',
      });

      // Act
      subagentQualityGate(input, testCtx);

      // Assert
      expect(existsSync).toHaveBeenCalledWith(METRICS_FILE);
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
      subagentQualityGate(input, testCtx);

      // Assert
      expect(outputWarning).toHaveBeenCalledWith(
        'Subagent test-agent failed: Connection refused'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Score threshold validation
  // ---------------------------------------------------------------------------

  describe('score threshold validation', () => {
    test('returns silent success for scores above threshold', () => {
      const input = createSubagentStopInput({
        agent_output: 'Code quality: 8/10\nSecurity: 9/10',
      });

      subagentQualityGate(input, testCtx);

      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(outputWarning).not.toHaveBeenCalled();
      expect(outputBlock).not.toHaveBeenCalled();
    });

    test('warns for non-security score below threshold', () => {
      const input = createSubagentStopInput({
        agent_output: 'Code quality: 2/10',
      });

      subagentQualityGate(input, testCtx);

      expect(outputWarning).toHaveBeenCalledWith(
        expect.stringContaining('code quality')
      );
      expect(outputBlock).not.toHaveBeenCalled();
    });

    test('BLOCKS for security score below threshold', () => {
      const input = createSubagentStopInput({
        agent_output: 'Security: 3/10',
      });

      const result = subagentQualityGate(input, testCtx);

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('Security gate BLOCKED')
      );
    });

    test('BLOCKS for vulnerability score below threshold', () => {
      // Note: "Vulnerability: 2/10" (no bold) — bold wrapping colon (**Vulnerability:**)
      // doesn't match the current score extractor regex
      const input = createSubagentStopInput({
        agent_output: 'Vulnerability: 2/10',
      });

      const result = subagentQualityGate(input, testCtx);

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('Security gate BLOCKED')
      );
    });

    test('BLOCKS for OWASP score below threshold', () => {
      const input = createSubagentStopInput({
        agent_output: 'OWASP compliance: 1/10',
      });

      const result = subagentQualityGate(input, testCtx);

      expect(result.continue).toBe(false);
    });

    test('does NOT block non-security dimensions even when low', () => {
      const input = createSubagentStopInput({
        agent_output: 'Performance: 1/10\nMaintainability: 2/10',
      });

      subagentQualityGate(input, testCtx);

      expect(outputBlock).not.toHaveBeenCalled();
      expect(outputWarning).toHaveBeenCalled();
    });

    test('security at exactly threshold (5.0) passes', () => {
      const input = createSubagentStopInput({
        agent_output: 'Security: 5/10',
      });

      subagentQualityGate(input, testCtx);

      expect(outputBlock).not.toHaveBeenCalled();
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('security at 4.9 (just below threshold) blocks', () => {
      const input = createSubagentStopInput({
        agent_output: 'Security: 4.9/10',
      });

      const result = subagentQualityGate(input, testCtx);

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalled();
    });

    test('block message includes the actual score', () => {
      const input = createSubagentStopInput({
        agent_output: 'Security: 3/10',
      });

      subagentQualityGate(input, testCtx);

      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('3/10')
      );
    });

    test('block message includes minimum threshold', () => {
      const input = createSubagentStopInput({
        agent_output: 'Security: 2/10',
      });

      subagentQualityGate(input, testCtx);

      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('5/10')
      );
    });

    test('extracts JSON-style scores', () => {
      const input = createSubagentStopInput({
        agent_output: '{"security_score": 2, "quality_score": 8}',
      });

      const result = subagentQualityGate(input, testCtx);

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalled();
    });

    test('handles output with no scores gracefully', () => {
      const input = createSubagentStopInput({
        agent_output: 'The implementation looks good. No major issues found.',
      });

      subagentQualityGate(input, testCtx);

      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('respects custom policy thresholds', () => {
      // Arrange: policy file exists with custom security_minimum of 7.0
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path === 'string' && path.includes('verification-policy.json')) return true;
        return false;
      });
      vi.mocked(readFileSync).mockImplementation((path) => {
        if (typeof path === 'string' && path.includes('verification-policy.json')) {
          return JSON.stringify({
            thresholds: { security_minimum: 7.0 },
          });
        }
        return JSON.stringify({});
      });

      const input = createSubagentStopInput({
        agent_output: 'Security: 6/10',
      });

      const result = subagentQualityGate(input, testCtx);

      // 6/10 is below custom threshold of 7.0
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalled();
    });

    test('updates metrics on threshold failure', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        errors: 0,
        quality_checks: 5,
        threshold_failures: 2,
      }));

      const input = createSubagentStopInput({
        agent_output: 'Security: 2/10',
      });

      subagentQualityGate(input, testCtx);

      expect(writeFileSync).toHaveBeenCalledWith(
        METRICS_FILE,
        expect.stringContaining('"threshold_failures": 3')
      );
    });
  });
});

/**
 * Output Validator - SubagentStop Hook Test Suite
 *
 * Tests the output-validator hook which validates agent output quality
 * and completeness. Checks for:
 * - Empty output (error)
 * - Minimum length (warning)
 * - Error patterns (warning)
 * - JSON structure for backend-system-architect (warning)
 *
 * CC 2.1.7 Compliant: Returns continue: false only for validation failures
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST be before imports
// =============================================================================

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ size: 500 }),
  renameSync: vi.fn(),
  readSync: vi.fn().mockReturnValue(0),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue('main\n'),
}));

// =============================================================================
// Import under test (after mocks)
// =============================================================================

import { outputValidator } from '../../subagent-stop/output-validator.js';
import { writeFileSync, mkdirSync } from 'node:fs';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for SubagentStop events
 */
function createSubagentStopInput(
  agentOutput: string = '',
  overrides: Partial<HookInput> = {},
): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'test-session-ov',
    tool_input: {},
    agent_output: agentOutput,
    subagent_type: 'test-agent',
    ...overrides,
  };
}

// =============================================================================
// Output Validator Tests
// =============================================================================

describe('output-validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Arrange: Set project dir for predictable paths
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: false for empty output (validation failure)', () => {
      // Arrange
      const input = createSubagentStopInput('');

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.systemMessage).toContain('failed');
    });

    test('returns continue: true for valid output', () => {
      // Arrange
      const validOutput = 'A'.repeat(100);
      const input = createSubagentStopInput(validOutput);

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns continue: true with warnings (non-blocking)', () => {
      // Arrange
      const shortOutput = 'Short';
      const input = createSubagentStopInput(shortOutput);

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Warnings');
    });

    test('has hookSpecificOutput for SubagentStop on failure', () => {
      // Arrange
      const input = createSubagentStopInput('');

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput?.hookEventName).toBe('SubagentStop');
    });
  });

  // ---------------------------------------------------------------------------
  // Check 1: Empty output validation
  // ---------------------------------------------------------------------------

  describe('check 1: empty output', () => {
    test('fails validation for empty string', () => {
      // Arrange
      const input = createSubagentStopInput('');

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.systemMessage).toContain('empty output');
    });

    test('fails validation for undefined output', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
      };

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('fails validation for null-ish output', () => {
      // Arrange
      const input = createSubagentStopInput(undefined as any);

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Check 2: Minimum length warning
  // ---------------------------------------------------------------------------

  describe('check 2: minimum length', () => {
    test('warns for output less than 50 chars', () => {
      // Arrange
      const shortOutput = 'A'.repeat(30);
      const input = createSubagentStopInput(shortOutput);

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('very short');
      expect(result.systemMessage).toContain('30 chars');
    });

    test('no warning for output >= 50 chars', () => {
      // Arrange
      const longEnoughOutput = 'A'.repeat(60);
      const input = createSubagentStopInput(longEnoughOutput);

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).not.toContain('very short');
    });

    test('passes at exactly 50 chars', () => {
      // Arrange
      const exactOutput = 'A'.repeat(50);
      const input = createSubagentStopInput(exactOutput);

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Check 3: Error pattern detection
  // ---------------------------------------------------------------------------

  describe('check 3: error patterns', () => {
    test.each([
      ['error', 'Found an error in the code'],
      ['Error', 'TypeError occurred'],
      ['ERROR', 'ERROR: Something went wrong'],
      ['failed', 'Test failed'],
      ['Failed', 'Operation Failed'],
      ['FAILED', 'BUILD FAILED'],
      ['exception', 'Caught exception'],
      ['Exception', 'NullPointerException'],
      ['EXCEPTION', 'EXCEPTION THROWN'],
    ])('warns for pattern "%s"', (_, output) => {
      // Arrange
      const input = createSubagentStopInput(output);

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('error-related keywords');
    });

    test('does not warn for normal output', () => {
      // Arrange
      const normalOutput = 'A'.repeat(100) + ' completed successfully';
      const input = createSubagentStopInput(normalOutput);

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Check 4: JSON validation for backend-system-architect
  // ---------------------------------------------------------------------------

  describe('check 4: JSON validation (backend-system-architect)', () => {
    test('warns for malformed JSON in output', () => {
      // Arrange
      const badJson = 'A'.repeat(60) + ' {"name": "test" invalid}';
      const input = createSubagentStopInput(badJson, { subagent_type: 'backend-system-architect' });

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('JSON structure may be malformed');
    });

    test('no warning for valid JSON', () => {
      // Arrange
      const validJson = 'A'.repeat(60) + ' {"name": "test"}';
      const input = createSubagentStopInput(validJson, { subagent_type: 'backend-system-architect' });

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).not.toContain('JSON');
    });

    test('no JSON check for non-backend agents', () => {
      // Arrange
      const badJson = 'A'.repeat(60) + ' {"name": "test" invalid}';
      const input = createSubagentStopInput(badJson, { subagent_type: 'test-generator' });

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).not.toContain('JSON');
    });

    test('no JSON check when no braces in output', () => {
      // Arrange
      const noJson = 'A'.repeat(100) + ' API design complete';
      const input = createSubagentStopInput(noJson, { subagent_type: 'backend-system-architect' });

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // System message format
  // ---------------------------------------------------------------------------

  describe('system message format', () => {
    test('includes validation status', () => {
      // Arrange
      const input = createSubagentStopInput('Valid output here'.repeat(5));

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.systemMessage).toContain('[passed]');
    });

    test('includes agent name', () => {
      // Arrange
      const input = createSubagentStopInput('A'.repeat(100), { subagent_type: 'my-agent' });

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.systemMessage).toContain('my-agent');
    });

    test('includes timestamp', () => {
      // Arrange
      const input = createSubagentStopInput('A'.repeat(100));

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.systemMessage).toContain('Timestamp');
    });

    test('includes output length', () => {
      // Arrange
      const input = createSubagentStopInput('A'.repeat(150));

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.systemMessage).toContain('150 chars');
    });

    test('lists errors when present', () => {
      // Arrange
      const input = createSubagentStopInput('');

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.systemMessage).toContain('Errors:');
    });

    test('lists warnings when present', () => {
      // Arrange
      const input = createSubagentStopInput('Short');

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.systemMessage).toContain('Warnings:');
    });

    test('multiple warnings joined with semicolon', () => {
      // Arrange
      const input = createSubagentStopInput('error short');

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.systemMessage).toMatch(/very short.*error-related|error-related.*very short/);
    });
  });

  // ---------------------------------------------------------------------------
  // Log file creation
  // ---------------------------------------------------------------------------

  describe('log file creation', () => {
    test('writes log file with validation results', () => {
      // Arrange
      const input = createSubagentStopInput('Valid output'.repeat(10));

      // Act
      outputValidator(input);

      // Assert
      expect(writeFileSync).toHaveBeenCalled();
      const calls = vi.mocked(writeFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('agent-validation')
      );
      expect(logCall).toBeDefined();
    });

    test('log file includes validation section', () => {
      // Arrange
      const input = createSubagentStopInput('Test output here'.repeat(5));

      // Act
      outputValidator(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('agent-validation')
      );
      const logContent = logCall![1] as string;
      expect(logContent).toContain('OUTPUT VALIDATION');
    });

    test('log file includes agent output section', () => {
      // Arrange
      const testOutput = 'My test agent output';
      const input = createSubagentStopInput(testOutput.repeat(5));

      // Act
      outputValidator(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('agent-validation')
      );
      const logContent = logCall![1] as string;
      expect(logContent).toContain('AGENT OUTPUT');
      expect(logContent).toContain(testOutput);
    });

    test('log file path includes agent name', () => {
      // Arrange
      const input = createSubagentStopInput('A'.repeat(100), { subagent_type: 'custom-agent' });

      // Act
      outputValidator(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('custom-agent')
      );
      expect(logCall).toBeDefined();
    });

    test('log file path includes timestamp', () => {
      // Arrange
      const input = createSubagentStopInput('A'.repeat(100));

      // Act
      outputValidator(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('agent-validation')
      );
      // Format: YYYYMMDDTHHmmss (15 chars including T)
      expect(logCall![0]).toMatch(/_\d{8}T\d{6}\.log$/);
    });
  });

  // ---------------------------------------------------------------------------
  // Directory creation
  // ---------------------------------------------------------------------------

  describe('directory creation', () => {
    test('creates logs directory if needed', () => {
      // Arrange
      const input = createSubagentStopInput('A'.repeat(100));

      // Act
      outputValidator(input);

      // Assert
      const calls = vi.mocked(mkdirSync).mock.calls;
      const logDirCall = calls.find(([path]) =>
        (path as string).includes('agent-validation')
      );
      expect(logDirCall).toBeDefined();
      expect(logDirCall![1]).toEqual({ recursive: true });
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles unknown agent name', () => {
      // Arrange
      const input = createSubagentStopInput('A'.repeat(100), { subagent_type: undefined });

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('unknown');
    });

    test('uses output field as fallback', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
        output: 'Fallback output'.repeat(5),
      };

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles whitespace-only output', () => {
      // Arrange
      const input = createSubagentStopInput('   \n\t   ');

      // Act
      const result = outputValidator(input);

      // Assert
      // Whitespace still has length > 0, so it passes empty check
      // but will have short length warning
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('very short');
    });

    test('handles very long output', () => {
      // Arrange
      const longOutput = 'A'.repeat(100000);
      const input = createSubagentStopInput(longOutput);

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('100000 chars');
    });

    test('handles special characters in output', () => {
      // Arrange
      const specialOutput = '<script>alert("xss")</script>' + 'A'.repeat(50);
      const input = createSubagentStopInput(specialOutput);

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Validation precedence
  // ---------------------------------------------------------------------------

  describe('validation precedence', () => {
    test('errors take precedence over warnings', () => {
      // Arrange
      const input = createSubagentStopInput('');

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.systemMessage).toContain('failed');
      expect(result.systemMessage).toContain('Errors:');
    });

    test('passed status when only warnings', () => {
      // Arrange
      const input = createSubagentStopInput('error occurred');

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('passed');
    });

    test('multiple warnings are accumulated', () => {
      // Arrange
      // Need output with: short length + error keyword + malformed JSON
      // The regex /\{[^}]*\}/ requires { content } pattern
      const input = createSubagentStopInput('error {bad json}', { subagent_type: 'backend-system-architect' });

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      // Should have: short, error keyword, and JSON warning
      expect(result.systemMessage).toContain('very short');
      expect(result.systemMessage).toContain('error-related');
      expect(result.systemMessage).toContain('JSON');
    });
  });

  // ---------------------------------------------------------------------------
  // Pass scenarios
  // ---------------------------------------------------------------------------

  describe('pass scenarios', () => {
    test('clean pass with suppressOutput', () => {
      // Arrange
      const cleanOutput = 'Successfully completed all tasks.'.repeat(3);
      const input = createSubagentStopInput(cleanOutput);

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.systemMessage).toContain('passed');
    });

    test('pass with warnings still has suppressOutput true', () => {
      // Arrange
      const warningOutput = 'Short';
      const input = createSubagentStopInput(warningOutput);

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      // Hook always sets suppressOutput: true for passed validation
      expect(result.suppressOutput).toBe(true);
      // But systemMessage still contains warnings
      expect(result.systemMessage).toContain('Warnings');
    });
  });
});

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
 * Operator decision (follow-up to #4199): on a pass, warnings are log-only.
 * They appear in the log record, never in systemMessage. The failure path
 * keeps its current behaviour.
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
  execSync: vi.fn(),
  execFileSync: vi.fn(() => '').mockReturnValue('main\n'),
}));

// =============================================================================
// Import under test (after mocks)
// =============================================================================

import { outputValidator } from '../../subagent-stop/output-validator.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createTestContext } from '../fixtures/test-context.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * The log record the hook writes (the M2 file): the content argument of the
 * writeFileSync call, read from the mock at the top of this file. The hook
 * writes exactly one log record per invocation. Undefined if it wrote none.
 */
function lastLogRecord(): string | undefined {
  const calls = vi.mocked(writeFileSync).mock.calls;
  return calls.length > 0 ? (calls[calls.length - 1][1] as string) : undefined;
}

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

let testCtx: ReturnType<typeof createTestContext>;
describe('output-validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testCtx = createTestContext({ logDir: '/test/project/.claude/logs/agent-validation' });
    // Arrange: Set project dir for predictable paths
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    // GH-4158: the shared reader skips empty strings, so an empty legacy
    // agent_output is indistinguishable from an absent result and must never
    // block (#3200). The old assertion here (continue: false) was the bug
    // shape written down.
    test('treats an empty legacy agent_output as not delivered (no failure)', () => {
      // Arrange
      const input = createSubagentStopInput('');

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).not.toBe(false);
      expect(result.systemMessage ?? '').not.toContain('Errors:');
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

    // Operator decision (follow-up to #4199): pass warnings are log-only.
    test('returns continue: true with warnings, which are log-only', () => {
      // Arrange
      const shortOutput = 'Short';
      const input = createSubagentStopInput(shortOutput);

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage ?? '').not.toContain('Warnings');
      expect(lastLogRecord()).toContain('Warnings: Output seems very short');
    });

    test('has no failure shape for an empty legacy agent_output', () => {
      // Arrange
      const input = createSubagentStopInput('');

      // Act
      const result = outputValidator(input);

      // Assert: the SubagentStop failure shape (hookSpecificOutput) is only
      // for validation errors, and an absent/empty result is not one.
      expect(result.continue).not.toBe(false);
      expect(result.hookSpecificOutput).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Check 1: Empty output validation
  // ---------------------------------------------------------------------------

  describe('check 1: empty output', () => {
    // GH-4158: the reader skips empty strings, so Check 1 can no longer fire
    // on any payload: a delivered-empty legacy field collapses into
    // not-delivered, and a non-empty reader return is never empty. Kept as a
    // guard that empty text never becomes an error.
    test('does not fail validation for an empty legacy string', () => {
      // Arrange
      const input = createSubagentStopInput('');

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).not.toBe(false);
      expect(result.systemMessage ?? '').not.toContain('empty output');
    });

    // #3200: this previously asserted `continue === false` for an ABSENT field.
    // That assertion was the bug written down. Claude Code delivers neither
    // `agent_output` nor `output` at SubagentStop (0 of 11,319 captured rows,
    // recorded at subagent-stop/unified-dispatcher.ts, #3034), so the old
    // contract made this hook block on 100% of real events — and because
    // sync-subagent-stop-dispatcher short-circuits on `continue: false`, it
    // starved the 5 hooks behind it (incl. retry-handler, which is functional)
    // for two months. An absent payload field is not an agent defect: the hook
    // has nothing to validate and must stay out of the way.
    test('does NOT fail validation when the field was never delivered', () => {
      // Arrange: the real CC payload — no agent_output key at all.
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
      };

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).not.toBe(false);
      expect(result.systemMessage ?? '').not.toContain('empty output');
    });

    // #3200: this test claimed to cover a null-ish field but did not. Passing
    // `undefined` to `createSubagentStopInput` triggers JS default-parameter
    // substitution, so `agentOutput` became '' and this was a duplicate of
    // 'fails validation for empty string' above. Build the input explicitly.
    test('an explicitly undefined agent_output is treated as not delivered', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
        agent_output: undefined,
      } as HookInput;

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).not.toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // GH-4158: the result arrives as last_assistant_message (CC 2.1.272)
  // ---------------------------------------------------------------------------

  describe('GH-4158: last_assistant_message payloads (CC 2.1.272)', () => {
    // Key-for-key the SubagentStop shape measured live on CC 2.1.272
    // (GH-4158; fixture of record: src/__tests__/lib/subagent-result.test.ts,
    // CC_2_1_272_PAYLOAD): carries last_assistant_message and NO agent_output,
    // output, summary or result key.
    function createMeasuredShapeInput(lastAssistantMessage?: string): HookInput {
      const input: Record<string, unknown> = {
        session_id: 'test-session-ov-4158',
        transcript_path: '/tmp/transcript.jsonl',
        cwd: '/test/project',
        prompt_id: 'prompt-01J8ZK3M',
        permission_mode: 'acceptEdits',
        agent_id: 'a1b2c3d4e5f6789011',
        agent_type: 'code-quality-reviewer',
        effort: 'high',
        hook_event_name: 'SubagentStop',
        stop_hook_active: false,
        agent_transcript_path: '/tmp/subagents/a1b2c3d4.jsonl',
        background_tasks: [],
        session_crons: [],
      };
      if (lastAssistantMessage !== undefined) {
        input.last_assistant_message = lastAssistantMessage;
      }
      return input as unknown as HookInput;
    }

    test('T1: short last_assistant_message logs the length warning with the real length', () => {
      // Arrange
      const input = createMeasuredShapeInput('Done.');

      // Act
      const result = outputValidator(input);

      // Assert: the warning is log-only (operator decision, follow-up to
      // #4199), so the log record carries it and systemMessage does not.
      expect(result.continue).toBe(true);
      expect(result.systemMessage ?? '').not.toContain('very short');
      expect(lastLogRecord()).toContain('very short (5 chars)');
    });

    test('T2: no result field at all: no error, no length warning, continue not false', () => {
      // Arrange
      const input = createMeasuredShapeInput();

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).not.toBe(false);
      expect(result.systemMessage ?? '').not.toContain('empty output');
      expect(result.systemMessage ?? '').not.toContain('very short');
      expect(result.systemMessage ?? '').not.toContain('Errors:');
    });

    test('T3: legacy agent_output is still read through the shared reader', () => {
      // Arrange: legacy payload shape, no last_assistant_message.
      const input = createMeasuredShapeInput() as unknown as Record<string, unknown>;
      input.agent_output = `${'A'.repeat(60)} completed`;

      // Act
      const result = outputValidator(input as unknown as HookInput);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Output length: 70 chars');
      expect(result.systemMessage ?? '').not.toContain('very short');
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

      // Assert: log-only (operator decision, follow-up to #4199)
      expect(result.continue).toBe(true);
      expect(result.systemMessage ?? '').not.toContain('very short');
      expect(lastLogRecord()).toContain('very short (30 chars)');
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

      // Assert: log-only (operator decision, follow-up to #4199)
      expect(result.continue).toBe(true);
      expect(result.systemMessage ?? '').not.toContain('error-related keywords');
      expect(lastLogRecord()).toContain('error-related keywords');
    });

    test('does not warn for normal output', () => {
      // Arrange
      const normalOutput = `${'A'.repeat(100)} completed successfully`;
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
      const badJson = `${'A'.repeat(60)} {"name": "test" invalid}`;
      const input = createSubagentStopInput(badJson, { subagent_type: 'backend-system-architect' });

      // Act
      const result = outputValidator(input);

      // Assert: log-only (operator decision, follow-up to #4199)
      expect(result.continue).toBe(true);
      expect(result.systemMessage ?? '').not.toContain('JSON structure may be malformed');
      expect(lastLogRecord()).toContain('JSON structure may be malformed');
    });

    test('no warning for valid JSON', () => {
      // Arrange
      const validJson = `${'A'.repeat(60)} {"name": "test"}`;
      const input = createSubagentStopInput(validJson, { subagent_type: 'backend-system-architect' });

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).not.toContain('JSON');
    });

    test('no JSON check for non-backend agents', () => {
      // Arrange
      const badJson = `${'A'.repeat(60)} {"name": "test" invalid}`;
      const input = createSubagentStopInput(badJson, { subagent_type: 'test-generator' });

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).not.toContain('JSON');
    });

    test('no JSON check when no braces in output', () => {
      // Arrange
      const noJson = `${'A'.repeat(100)} API design complete`;
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

    test('lists no errors when the result was never delivered', () => {
      // Arrange
      const input = createSubagentStopInput('');

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.systemMessage ?? '').not.toContain('Errors:');
    });

    // Operator decision (follow-up to #4199): on a pass, the Warnings list
    // lives only in the log record.
    test('lists warnings in the log record when present', () => {
      // Arrange
      const input = createSubagentStopInput('Short');

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.systemMessage ?? '').not.toContain('Warnings:');
      expect(lastLogRecord()).toContain('Warnings:');
    });

    test('multiple warnings joined with semicolon in the log record', () => {
      // Arrange
      const input = createSubagentStopInput('error short');

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.systemMessage ?? '').not.toContain('Warnings:');
      expect(lastLogRecord()).toMatch(/very short.*error-related|error-related.*very short/);
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
      outputValidator(input, testCtx);

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
      outputValidator(input, testCtx);

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
      outputValidator(input, testCtx);

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
      outputValidator(input, testCtx);

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
      outputValidator(input, testCtx);

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
      // but gets the short length warning, which is log-only
      expect(result.continue).toBe(true);
      expect(result.systemMessage ?? '').not.toContain('very short');
      expect(lastLogRecord()).toContain('very short');
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
      const specialOutput = `<script>alert("xss")</script>${'A'.repeat(50)}`;
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
    // GH-4158: validation errors can no longer be produced by an absent or
    // empty result field (the reader skips empty strings), so the old
    // errors-over-warnings assertion on agent_output: '' asserted the #3200
    // bug shape. Kept as a guard: an empty legacy field yields a pass.
    test('empty legacy agent_output yields a pass, never an error', () => {
      // Arrange
      const input = createSubagentStopInput('');

      // Act
      const result = outputValidator(input);

      // Assert
      expect(result.continue).not.toBe(false);
      expect(result.systemMessage).toContain('passed');
      expect(result.systemMessage ?? '').not.toContain('Errors:');
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
      // Should have: short, error keyword, and JSON warning, all log-only
      expect(result.systemMessage ?? '').not.toContain('Warnings:');
      const record = lastLogRecord();
      expect(record).toContain('very short');
      expect(record).toContain('error-related');
      expect(record).toContain('JSON');
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
      // Warnings are log-only (operator decision, follow-up to #4199)
      expect(result.systemMessage ?? '').not.toContain('Warnings');
      expect(lastLogRecord()).toContain('Warnings:');
    });
  });

  // ---------------------------------------------------------------------------
  // Operator decision, follow-up to #4199: pass warnings are log-only
  // ---------------------------------------------------------------------------

  describe('pass warnings are log-only (operator decision, follow-up to #4199)', () => {
    // The measured CC 2.1.272 SubagentStop shape (fixture of record:
    // CC_2_1_272_PAYLOAD in src/__tests__/lib/subagent-result.test.ts): the
    // result arrives as last_assistant_message and no other field. Since
    // #4199 the hook reads it, so the short-output and error-keyword
    // warnings fire on ordinary stops; the operator decided they are
    // log-only and never reach the user through systemMessage.
    function createLogOnlyInput(lastAssistantMessage: string): HookInput {
      const input: Record<string, unknown> = {
        session_id: 'test-session-ov-logonly',
        transcript_path: '/tmp/transcript.jsonl',
        cwd: '/test/project',
        prompt_id: 'prompt-01J8ZK3M',
        permission_mode: 'acceptEdits',
        agent_id: 'a1b2c3d4e5f6789011',
        agent_type: 'code-quality-reviewer',
        effort: 'high',
        hook_event_name: 'SubagentStop',
        stop_hook_active: false,
        agent_transcript_path: '/tmp/subagents/a1b2c3d4.jsonl',
        background_tasks: [],
        session_crons: [],
      };
      input.last_assistant_message = lastAssistantMessage;
      return input as unknown as HookInput;
    }

    test('T-a: short result: continue true, warning in the log record, not in systemMessage', () => {
      // Arrange: last_assistant_message under 50 chars
      const input = createLogOnlyInput('Done.');

      // Act
      const result = outputValidator(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage ?? '').not.toContain('very short');
      expect(result.systemMessage ?? '').not.toContain('Warnings:');
      const record = lastLogRecord();
      expect(record).toContain('very short (5 chars)');
      expect(record).toContain('Warnings:');
    });

    test('T-b: result containing "failed": keyword warning in the log record, not in systemMessage', () => {
      // Arrange: 80 chars, over the length threshold, so exactly the
      // keyword warning fires.
      const input = createLogOnlyInput(`${'A'.repeat(60)} but one test failed`);

      // Act
      const result = outputValidator(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage ?? '').not.toContain('error-related keywords');
      expect(result.systemMessage ?? '').not.toContain('Warnings:');
      expect(lastLogRecord()).toContain('error-related keywords');
    });

    // T-c (failure path unchanged): nothing reaches it, so there is nothing
    // to pin. validationErrors is pushed only by Check 1, whose condition
    // `outputDelivered && !output` is a contradiction: outputDelivered is
    // defined as output.length > 0, and the shared reader
    // (getSubagentResult) skips empty strings and non-strings, so no
    // payload can produce a non-empty validationErrors. Skipped per brief:
    // "if nothing can, say so and skip".
  });
});

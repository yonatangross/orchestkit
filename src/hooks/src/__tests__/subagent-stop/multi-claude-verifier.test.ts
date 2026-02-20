/**
 * Multi-Claude Verifier - SubagentStop Hook Test Suite
 *
 * Tests the multi-claude-verifier hook which auto-spawns verification
 * agents after specific agent completions:
 * - test-generator -> code-quality-reviewer
 * - frontend with auth/forms -> security-auditor
 * - backend with API -> security-auditor
 * - sensitive files -> security-auditor
 * - database-engineer -> code-quality-reviewer
 * - workflow-architect -> security-layer-auditor
 *
 * CC 2.1.7 Compliant: All paths return continue: true (non-blocking)
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

vi.mock('../../lib/analytics-buffer.js', async () => {
  const fsMock = await vi.importMock<typeof import('node:fs')>('node:fs');
  return {
    bufferWrite: vi.fn((filePath: string, content: string) => {
      fsMock.appendFileSync(filePath, content);
    }),
    flush: vi.fn(),
    pendingCount: vi.fn(() => 0),
    _resetForTesting: vi.fn(),
  };
});

vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  logHook: vi.fn(),
  getProjectDir: vi.fn(() => process.env.CLAUDE_PROJECT_DIR || '/test/project'),
  lineContainsAll: vi.fn((content: string, ...terms: string[]) =>
    terms.every(t => content.includes(t))
  ),
  lineContainsAllCI: vi.fn((content: string, ...terms: string[]) =>
    terms.every(t => content.toLowerCase().includes(t.toLowerCase()))
  ),
}));

// =============================================================================
// Import under test (after mocks)
// =============================================================================

import { multiClaudeVerifier } from '../../subagent-stop/multi-claude-verifier.js';
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for SubagentStop events
 */
function createSubagentStopInput(
  agentType: string,
  agentOutput: string = '',
  overrides: Partial<HookInput> = {},
): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'test-session-mcv',
    tool_input: {
      subagent_type: agentType,
    },
    subagent_type: agentType,
    agent_output: agentOutput,
    ...overrides,
  };
}

// =============================================================================
// Multi-Claude Verifier Tests
// =============================================================================

describe('multi-claude-verifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Arrange: Set project dir for predictable paths
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance: Non-blocking hook
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('always returns continue: true when verification triggered', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Tests complete');

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true with systemMessage when triggered', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Tests done');

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Multi-Claude Verification Triggered');
    });

    test('returns continue: true with suppressOutput when no triggers', () => {
      // Arrange
      const input = createSubagentStopInput('debug-investigator', 'Bug found');

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns continue: true for unknown agent', () => {
      // Arrange
      const input = createSubagentStopInput('unknown', 'Output');

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 1: test-generator -> code-quality-reviewer
  // ---------------------------------------------------------------------------

  describe('rule 1: test-generator -> code-quality-reviewer', () => {
    test('triggers code-quality-reviewer after test-generator', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Created 25 tests');

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('code-quality-reviewer');
      expect(result.systemMessage).toContain('quality review recommended');
    });

    test('creates verification queue file', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Tests done');

      // Act
      multiClaudeVerifier(input);

      // Assert
      expect(writeFileSync).toHaveBeenCalled();
      const calls = vi.mocked(writeFileSync).mock.calls;
      const queueCall = calls.find(([path]) =>
        (path as string).includes('verification-queue')
      );
      expect(queueCall).toBeDefined();
    });

    test('verification queue has correct structure', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Tests complete');

      // Act
      multiClaudeVerifier(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const queueCall = calls.find(([path]) =>
        (path as string).includes('verification-queue')
      );
      const queue = JSON.parse(queueCall![1] as string);

      expect(queue.triggered_by).toBe('test-generator');
      expect(queue.timestamp).toBeDefined();
      expect(queue.verifications).toHaveLength(1);
      expect(queue.verifications[0].agent).toBe('code-quality-reviewer');
      expect(queue.verifications[0].status).toBe('pending');
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 2: frontend-ui-developer with auth/form -> security-auditor
  // ---------------------------------------------------------------------------

  describe('rule 2: frontend auth/forms -> security-auditor', () => {
    test.each([
      ['form', 'Built login form component'],
      ['input', 'Added input validation'],
      ['validation', 'Implemented validation schema'],
      ['submit', 'Added submit handler'],
      ['auth', 'Created auth context'],
      ['login', 'Built login page'],
    ])('triggers security-auditor for frontend with "%s"', (_keyword, output) => {
      // Arrange
      const input = createSubagentStopInput('frontend-ui-developer', output);

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('security-auditor');
      expect(result.systemMessage).toContain('Frontend auth/form components');
    });

    test('does not trigger for non-auth frontend work', () => {
      // Arrange
      const input = createSubagentStopInput(
        'frontend-ui-developer',
        'Built dashboard with charts and graphs'
      );

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('case insensitive pattern matching', () => {
      // Arrange
      const input = createSubagentStopInput(
        'frontend-ui-developer',
        'Added LOGIN button with FORM handler'
      );

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.systemMessage).toContain('security-auditor');
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 3: backend-system-architect with API -> security-auditor
  // ---------------------------------------------------------------------------

  describe('rule 3: backend API -> security-auditor', () => {
    test.each([
      ['endpoint', 'Created /api/users endpoint'],
      ['route', 'Added route handlers'],
      ['api', 'Designed API structure'],
      ['auth', 'Implemented auth middleware'],
      ['jwt', 'Added JWT verification'],
      ['session', 'Configured session management'],
    ])('triggers security-auditor for backend with "%s"', (_keyword, output) => {
      // Arrange
      const input = createSubagentStopInput('backend-system-architect', output);

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('security-auditor');
      expect(result.systemMessage).toContain('Backend API endpoints');
    });

    test('does not trigger for non-API backend work', () => {
      // Arrange
      const input = createSubagentStopInput(
        'backend-system-architect',
        'Designed database schema and models'
      );

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 4: Sensitive files -> security-auditor
  // ---------------------------------------------------------------------------

  describe('rule 4: sensitive files -> security-auditor', () => {
    test.each([
      ['.env', 'Modified .env file'],
      ['auth', 'Updated auth config'],
      ['secret', 'Added secret handling'],
      ['credential', 'Changed credentials'],
      ['password', 'Updated password rules'],
      ['token', 'Added token logic'],
      ['api_key', 'Configured api_key'],
      ['apikey', 'Set apikey value'],
      ['api-key', 'Used api-key file'],
      ['jwt', 'Implemented jwt tokens'],
      ['session', 'Modified session config'],
      ['oauth', 'Added oauth integration'],
      ['permission', 'Set permission rules'],
      ['.pem', 'Generated server.pem'],
      ['.key', 'Created private.key'],
      ['config.*prod', 'Updated config.prod.json'],
    ])('triggers security-auditor for sensitive pattern "%s"', (_pattern, output) => {
      // Arrange
      const input = createSubagentStopInput('data-pipeline-engineer', output);

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('security-auditor');
      expect(result.systemMessage).toContain('Sensitive files modified');
    });

    test('avoids duplicate security-auditor from multiple triggers', () => {
      // Arrange - backend with API + sensitive files
      const input = createSubagentStopInput(
        'backend-system-architect',
        'Added JWT auth endpoint with .env config'
      );

      // Act
      const _result = multiClaudeVerifier(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const queueCall = calls.find(([path]) =>
        (path as string).includes('verification-queue')
      );
      const queue = JSON.parse(queueCall![1] as string);

      // Should only have one security-auditor entry
      const securityEntries = queue.verifications.filter(
        (v: any) => v.agent === 'security-auditor'
      );
      expect(securityEntries.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 5: database-engineer -> code-quality-reviewer
  // ---------------------------------------------------------------------------

  describe('rule 5: database-engineer -> code-quality-reviewer', () => {
    test('triggers code-quality-reviewer after database-engineer', () => {
      // Arrange
      const input = createSubagentStopInput(
        'database-engineer',
        'Created schema migrations'
      );

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('code-quality-reviewer');
      expect(result.systemMessage).toContain('Database schema changes');
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 6: workflow-architect -> security-layer-auditor
  // ---------------------------------------------------------------------------

  describe('rule 6: workflow-architect -> security-layer-auditor', () => {
    test('triggers security-layer-auditor after workflow-architect', () => {
      // Arrange
      const input = createSubagentStopInput(
        'workflow-architect',
        'Designed LangGraph state machine'
      );

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('security-layer-auditor');
      expect(result.systemMessage).toContain('LangGraph workflow');
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple verification triggers
  // ---------------------------------------------------------------------------

  describe('multiple verification triggers', () => {
    test('accumulates multiple verifications', () => {
      // Arrange - test-generator (rule 1) + sensitive files (rule 4)
      const input = createSubagentStopInput(
        'test-generator',
        'Created tests for .env handling'
      );

      // Act
      const _result = multiClaudeVerifier(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const queueCall = calls.find(([path]) =>
        (path as string).includes('verification-queue')
      );
      const queue = JSON.parse(queueCall![1] as string);

      expect(queue.verifications.length).toBe(2);
      const agents = queue.verifications.map((v: any) => v.agent);
      expect(agents).toContain('code-quality-reviewer');
      expect(agents).toContain('security-auditor');
    });

    test('system message lists all triggered verifications', () => {
      // Arrange
      const input = createSubagentStopInput(
        'test-generator',
        'Added tests for password validation'
      );

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.systemMessage).toContain('code-quality-reviewer');
      expect(result.systemMessage).toContain('security-auditor');
    });
  });

  // ---------------------------------------------------------------------------
  // No triggers
  // ---------------------------------------------------------------------------

  describe('no triggers', () => {
    test.each([
      ['debug-investigator', 'Found root cause'],
      ['ux-researcher', 'Completed user research'],
      ['product-strategist', 'Strategy defined'],
      ['metrics-architect', 'Metrics framework done'],
    ])('does not trigger for %s', (agent, output) => {
      // Arrange
      const input = createSubagentStopInput(agent, output);

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(writeFileSync).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty agent type', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
        subagent_type: '',
        agent_output: 'Some output',
      };

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles undefined tool_input gracefully', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: undefined as any,
        subagent_type: 'test-generator',
        agent_output: 'Tests done',
      };

      // Act & Assert
      expect(() => multiClaudeVerifier(input)).not.toThrow();
    });

    test('handles empty output gracefully', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', '');

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.continue).toBe(true);
      // test-generator still triggers even with empty output
      expect(result.systemMessage).toContain('code-quality-reviewer');
    });

    test('handles output field as fallback', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: { subagent_type: 'frontend-ui-developer' },
        output: 'Built login form',
      };

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.systemMessage).toContain('security-auditor');
    });

    test('reads subagent_type from tool_input', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {
          subagent_type: 'database-engineer',
        },
        agent_output: 'Schema done',
      };

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.systemMessage).toContain('code-quality-reviewer');
    });

    test('reads agent_type as fallback', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
        agent_type: 'workflow-architect',
        agent_output: 'Workflow done',
      };

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.systemMessage).toContain('security-layer-auditor');
    });
  });

  // ---------------------------------------------------------------------------
  // Directory creation
  // ---------------------------------------------------------------------------

  describe('directory creation', () => {
    test('creates verification-queue directory if needed', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Tests done');

      // Act
      multiClaudeVerifier(input);

      // Assert
      const calls = vi.mocked(mkdirSync).mock.calls;
      const queueDirCall = calls.find(([path]) =>
        (path as string).includes('verification-queue')
      );
      expect(queueDirCall).toBeDefined();
      expect(queueDirCall![1]).toEqual({ recursive: true });
    });

    test('creates log directory if needed', () => {
      // Arrange
      const input = createSubagentStopInput('database-engineer', 'Schema done');

      // Act
      multiClaudeVerifier(input);

      // Assert
      const calls = vi.mocked(mkdirSync).mock.calls;
      const logDirCall = calls.find(([path]) =>
        (path as string).includes('multi-claude')
      );
      expect(logDirCall).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  describe('logging', () => {
    test('logs trigger action', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Tests done');

      // Act
      multiClaudeVerifier(input);

      // Assert
      expect(appendFileSync).toHaveBeenCalled();
      const calls = vi.mocked(appendFileSync).mock.calls;
      const triggerLog = calls.find(
        ([_, content]) => (content as string).includes('TRIGGER')
      );
      expect(triggerLog).toBeDefined();
    });

    test('logs skip action when no triggers', () => {
      // Arrange
      const input = createSubagentStopInput('debug-investigator', 'Done');

      // Act
      multiClaudeVerifier(input);

      // Assert
      expect(appendFileSync).toHaveBeenCalled();
      const calls = vi.mocked(appendFileSync).mock.calls;
      const skipLog = calls.find(
        ([_, content]) => (content as string).includes('SKIP')
      );
      expect(skipLog).toBeDefined();
    });

    test('logs queue creation', () => {
      // Arrange
      const input = createSubagentStopInput('workflow-architect', 'Workflow done');

      // Act
      multiClaudeVerifier(input);

      // Assert
      const calls = vi.mocked(appendFileSync).mock.calls;
      const queueLog = calls.find(
        ([_, content]) => (content as string).includes('QUEUE')
      );
      expect(queueLog).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Queue file naming
  // ---------------------------------------------------------------------------

  describe('queue file naming', () => {
    test('queue file includes timestamp', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Done');

      // Act
      multiClaudeVerifier(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const queueCall = calls.find(([path]) =>
        (path as string).includes('verification-queue')
      );
      // Format: pending_YYYYMMDDTHHmmss_ (15 chars including T)
      expect(queueCall![0]).toMatch(/pending_\d{8}T\d{6}_/);
    });

    test('queue file includes agent name', () => {
      // Arrange
      const input = createSubagentStopInput('database-engineer', 'Done');

      // Act
      multiClaudeVerifier(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const queueCall = calls.find(([path]) =>
        (path as string).includes('verification-queue')
      );
      expect(queueCall![0]).toContain('database-engineer');
    });
  });

  // ---------------------------------------------------------------------------
  // System message format
  // ---------------------------------------------------------------------------

  describe('system message format', () => {
    test('includes agent and reason in message', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Tests complete');

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.systemMessage).toMatch(
        /code-quality-reviewer.*quality review/
      );
    });

    test('separates multiple verifications with semicolon', () => {
      // Arrange
      const input = createSubagentStopInput(
        'test-generator',
        'Tests for .env file'
      );

      // Act
      const result = multiClaudeVerifier(input);

      // Assert
      expect(result.systemMessage).toContain(';');
    });
  });
});

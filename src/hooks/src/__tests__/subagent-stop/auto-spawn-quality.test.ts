/**
 * Auto Spawn Quality - SubagentStop Hook Test Suite
 *
 * Tests the auto-spawn-quality hook which auto-spawns quality agents
 * after specific agent completions:
 * - test-generator -> code-quality-reviewer
 * - sensitive file changes -> security-auditor
 * - code-quality-reviewer -> security-auditor
 * - backend-system-architect with auth -> security-layer-auditor
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
  readFileSync: vi.fn().mockReturnValue('{"schema_version":"1.0.0","queue":[]}'),
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

import { autoSpawnQuality } from '../../subagent-stop/auto-spawn-quality.js';
import { writeFileSync, mkdirSync, appendFileSync, existsSync, readFileSync } from 'node:fs';

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
    session_id: 'test-session-asq',
    tool_input: {
      subagent_type: agentType,
    },
    subagent_type: agentType,
    agent_output: agentOutput,
    ...overrides,
  };
}

// =============================================================================
// Auto Spawn Quality Tests
// =============================================================================

describe('auto-spawn-quality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Arrange: Set project dir for predictable paths
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance: Non-blocking hook
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('always returns continue: true for valid agent', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Tests completed successfully');

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true when spawn is queued', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'All tests pass');

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Auto-spawn queued');
    });

    test('returns continue: true when no conditions match', () => {
      // Arrange
      const input = createSubagentStopInput('debug-investigator', 'Bug investigation complete');

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns continue: true even on error', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', '', {
        error: 'Agent crashed unexpectedly',
      });

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 1: test-generator -> code-quality-reviewer
  // ---------------------------------------------------------------------------

  describe('rule: test-generator -> code-quality-reviewer', () => {
    test('queues code-quality-reviewer after test-generator completes', () => {
      // Arrange
      const input = createSubagentStopInput(
        'test-generator',
        'Generated 15 tests with 100% coverage'
      );

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('code-quality-reviewer');
      expect(result.systemMessage).toContain('high priority');
      expect(writeFileSync).toHaveBeenCalled();
    });

    test('creates spawn queue file with correct structure', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput('test-generator', 'Tests done');

      // Act
      autoSpawnQuality(input);

      // Assert
      expect(writeFileSync).toHaveBeenCalled();
      const calls = vi.mocked(writeFileSync).mock.calls;
      const queueCall = calls.find(([path]) =>
        (path as string).includes('spawn-queue.json')
      );
      expect(queueCall).toBeDefined();

      const queueContent = JSON.parse(queueCall![1] as string);
      expect(queueContent.queue).toBeDefined();
      expect(queueContent.queue.length).toBeGreaterThan(0);
      expect(queueContent.queue[0].target_agent).toBe('code-quality-reviewer');
    });

    test('creates handoff suggestion file', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Tests complete');

      // Act
      autoSpawnQuality(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('auto_spawn_code-quality-reviewer')
      );
      expect(handoffCall).toBeDefined();
    });

    test('does not queue if test-generator had errors', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Test run failed', {
        error: 'Tests failed with exit code 1',
      });

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.systemMessage).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 2: Sensitive file changes -> security-auditor
  // ---------------------------------------------------------------------------

  describe('rule: sensitive files -> security-auditor', () => {
    test.each([
      ['.env', 'Modified .env file for production'],
      ['credentials', 'Updated credentials.json'],
      ['secret', 'Added secret key handling'],
      ['auth', 'Implemented auth middleware'],
      ['password', 'Changed password hashing algorithm'],
      ['token', 'Added token refresh logic'],
      ['api.key', 'Configured api.key for third party'],
      ['private.key', 'Generated private.key for JWT'],
      ['.pem', 'Added server.pem certificate'],
      ['oauth', 'Integrated oauth2 flow'],
      ['jwt', 'Implemented jwt verification'],
      ['session', 'Added session storage'],
      ['cookie', 'Set cookie security flags'],
      ['encryption', 'Added encryption layer'],
      ['crypto', 'Used crypto for hashing'],
    ])('detects sensitive pattern "%s" and queues security-auditor', (pattern, output) => {
      // Arrange
      const input = createSubagentStopInput('frontend-ui-developer', output);

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('security-auditor');
      expect(result.systemMessage).toContain('critical priority');
    });

    test('does not queue for security-auditor itself (avoid loop)', () => {
      // Arrange
      const input = createSubagentStopInput(
        'security-auditor',
        'Reviewed .env files and found no issues'
      );

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // Should not spawn itself
      expect(result.systemMessage).toBeUndefined();
    });

    test('does not queue for security-layer-auditor (avoid loop)', () => {
      // Arrange
      const input = createSubagentStopInput(
        'security-layer-auditor',
        'Audited authentication layer'
      );

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 3: code-quality-reviewer -> security-auditor
  // ---------------------------------------------------------------------------

  describe('rule: code-quality-reviewer -> security-auditor', () => {
    test('queues security-auditor after code-quality-reviewer', () => {
      // Arrange
      const input = createSubagentStopInput(
        'code-quality-reviewer',
        'Code review complete. All patterns follow best practices.'
      );

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('security-auditor');
      expect(result.systemMessage).toContain('high priority');
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 4: backend-system-architect with auth -> security-layer-auditor
  // ---------------------------------------------------------------------------

  describe('rule: backend-system-architect auth -> security-layer-auditor', () => {
    // Note: 'authentication' and 'authorization' contain 'auth' which is in SENSITIVE_PATTERNS
    // So those trigger security-auditor (Rule 2) before reaching Rule 4
    // Only patterns that don't match SENSITIVE_PATTERNS will trigger security-layer-auditor

    test.each([
      ['access control', 'Configured access control for endpoints'],
      ['rbac', 'Implemented RBAC with 3 roles'],
      ['acl', 'Set up ACL for resource permissions'],
    ])('detects "%s" pattern and queues security-layer-auditor', (pattern, output) => {
      // Arrange
      const input = createSubagentStopInput('backend-system-architect', output);

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('security-layer-auditor');
      expect(result.systemMessage).toContain('high priority');
    });

    test.each([
      ['authentication', 'Designed authentication flow using JWT'],
      ['authorization', 'Implemented authorization checks'],
    ])('"%s" triggers security-auditor (Rule 2 priority - contains "auth")', (pattern, output) => {
      // Arrange - these contain 'auth' which matches SENSITIVE_PATTERNS
      const input = createSubagentStopInput('backend-system-architect', output);

      // Act
      const result = autoSpawnQuality(input);

      // Assert - Rule 2 takes precedence
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('security-auditor');
      expect(result.systemMessage).toContain('critical priority');
    });

    test('"security" pattern triggers security-layer-auditor (Rule 4)', () => {
      // Arrange - "security" matches Rule 4 regex but doesn't contain SENSITIVE_PATTERNS
      // SENSITIVE_PATTERNS has 'secret' not 'security'
      const input = createSubagentStopInput(
        'backend-system-architect',
        'Added security middleware layer'
      );

      // Act
      const result = autoSpawnQuality(input);

      // Assert - Rule 4 triggers (no sensitive pattern match)
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('security-layer-auditor');
      expect(result.systemMessage).toContain('high priority');
    });

    test('does not queue for non-auth backend work', () => {
      // Arrange
      const input = createSubagentStopInput(
        'backend-system-architect',
        'Designed REST API for user profiles and data retrieval'
      );

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles unknown agent type gracefully', () => {
      // Arrange
      const input = createSubagentStopInput('unknown', 'Some output');

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

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
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles missing agent_output gracefully', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', '');

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('code-quality-reviewer');
    });

    test('handles undefined tool_input gracefully', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: undefined as any,
        subagent_type: 'test-generator',
        agent_output: 'Output here',
      };

      // Act & Assert
      expect(() => autoSpawnQuality(input)).not.toThrow();
      const result = autoSpawnQuality(input);
      expect(result.continue).toBe(true);
    });

    test('case insensitive detection for sensitive patterns', () => {
      // Arrange
      const input = createSubagentStopInput(
        'frontend-ui-developer',
        'Modified the PASSWORD_HASH constant'
      );

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('security-auditor');
    });

    test('appends to existing spawn queue', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        schema_version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
        queue: [{ spawn_id: 'SPAWN-001', target_agent: 'existing' }],
      }));
      const input = createSubagentStopInput('test-generator', 'Tests done');

      // Act
      autoSpawnQuality(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const queueCall = calls.find(([path]) =>
        (path as string).includes('spawn-queue.json')
      );
      const queueContent = JSON.parse(queueCall![1] as string);
      expect(queueContent.queue.length).toBe(2);
    });

    test('error null is treated as no error', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Done', {
        error: 'null',
      });

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      // error='null' is string, but hook checks error && error !== 'null'
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('code-quality-reviewer');
    });
  });

  // ---------------------------------------------------------------------------
  // Spawn queue structure validation
  // ---------------------------------------------------------------------------

  describe('spawn queue structure', () => {
    test('spawn request has required fields', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput('test-generator', 'Tests passed');

      // Act
      autoSpawnQuality(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const queueCall = calls.find(([path]) =>
        (path as string).includes('spawn-queue.json')
      );
      const queueContent = JSON.parse(queueCall![1] as string);
      const request = queueContent.queue[0];

      expect(request.spawn_id).toMatch(/^SPAWN-\d+-\d+$/);
      expect(request.target_agent).toBe('code-quality-reviewer');
      expect(request.trigger_agent).toBe('test-generator');
      expect(request.trigger_reason).toBeDefined();
      expect(request.priority).toBe('high');
      expect(request.timestamp).toBeDefined();
      expect(request.session_id).toBe('test-session-asq');
      expect(request.status).toBe('queued');
    });

    test('spawn suggestion has required fields', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Done');

      // Act
      autoSpawnQuality(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('auto_spawn_')
      );
      const suggestion = JSON.parse(handoffCall![1] as string);

      expect(suggestion.type).toBe('auto_spawn_suggestion');
      expect(suggestion.from_agent).toBe('test-generator');
      expect(suggestion.to_agent).toBe('code-quality-reviewer');
      expect(suggestion.priority).toBe('high');
      expect(suggestion.auto_triggered).toBe(true);
      expect(suggestion.status).toBe('suggested');
    });
  });

  // ---------------------------------------------------------------------------
  // Directory creation
  // ---------------------------------------------------------------------------

  describe('directory creation', () => {
    test('creates log directory if needed', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Output');

      // Act
      autoSpawnQuality(input);

      // Assert
      expect(mkdirSync).toHaveBeenCalled();
    });

    test('creates handoff directory if needed', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Output');

      // Act
      autoSpawnQuality(input);

      // Assert
      const calls = vi.mocked(mkdirSync).mock.calls;
      const handoffDirCall = calls.find(([path]) =>
        (path as string).includes('handoffs')
      );
      expect(handoffDirCall).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  describe('logging', () => {
    test('logs spawn action to file', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Tests complete');

      // Act
      autoSpawnQuality(input);

      // Assert
      expect(appendFileSync).toHaveBeenCalled();
      const calls = vi.mocked(appendFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('auto-spawn-quality.log')
      );
      expect(logCall).toBeDefined();
    });

    test('logs when no conditions match', () => {
      // Arrange
      const input = createSubagentStopInput('debug-investigator', 'Done');

      // Act
      autoSpawnQuality(input);

      // Assert
      expect(appendFileSync).toHaveBeenCalled();
      const calls = vi.mocked(appendFileSync).mock.calls;
      const logEntry = calls.find(
        ([_, content]) => (content as string).includes('No auto-spawn conditions matched')
      );
      expect(logEntry).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Priority assignment
  // ---------------------------------------------------------------------------

  describe('priority assignment', () => {
    test('sensitive files trigger critical priority', () => {
      // Arrange
      const input = createSubagentStopInput(
        'backend-system-architect',
        'Modified .env.production'
      );

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.systemMessage).toContain('critical priority');
    });

    test('test-generator triggers high priority', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Done');

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.systemMessage).toContain('high priority');
    });

    test('code-quality-reviewer triggers high priority', () => {
      // Arrange
      const input = createSubagentStopInput('code-quality-reviewer', 'Review done');

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.systemMessage).toContain('high priority');
    });
  });

  // ---------------------------------------------------------------------------
  // Alternative field names
  // ---------------------------------------------------------------------------

  describe('alternative field names', () => {
    test('reads subagent_type from tool_input', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {
          subagent_type: 'test-generator',
        },
        agent_output: 'Tests done',
      };

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('code-quality-reviewer');
    });

    test('reads agent_type as fallback', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
        agent_type: 'test-generator',
        agent_output: 'Tests done',
      };

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('code-quality-reviewer');
    });

    test('reads output field as fallback for agent_output', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: { subagent_type: 'frontend-ui-developer' },
        output: 'Added authentication logic',
      };

      // Act
      const result = autoSpawnQuality(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('security-auditor');
    });
  });
});

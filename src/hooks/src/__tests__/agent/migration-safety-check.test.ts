/**
 * Unit tests for migration-safety-check hook
 * Tests enforcement of database safety patterns for the database-engineer agent
 *
 * Security Focus: Validates that destructive database operations are blocked,
 * non-Bash tools pass through, and safe SQL commands are allowed
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputDeny: vi.fn((reason: string) => ({
    continue: false,
    stopReason: reason,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  })),
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

import { migrationSafetyCheck } from '../../agent/migration-safety-check.js';
import { outputSilentSuccess, outputDeny } from '../../lib/common.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for any tool
 */
function createToolInput(
  toolName: string,
  toolInput: Record<string, unknown> = {},
  overrides: Partial<HookInput> = {},
): HookInput {
  return {
    tool_name: toolName,
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: toolInput,
    ...overrides,
  };
}

// =============================================================================
// Migration Safety Check Tests
// =============================================================================

describe('migration-safety-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Non-Bash tools pass through
  // ---------------------------------------------------------------------------

  describe('non-Bash tools pass through', () => {
    test.each([
      ['Write'],
      ['Edit'],
      ['Read'],
      ['Glob'],
      ['Grep'],
      ['MultiEdit'],
      ['NotebookEdit'],
      ['Task'],
    ])('returns silent success for tool_name=%s', (toolName) => {
      // Arrange
      const input = createToolInput(toolName, {
        command: 'DROP TABLE users', // dangerous command, but not Bash tool
      });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
      expect(outputDeny).not.toHaveBeenCalled();
    });

    test('only processes Bash tool (case sensitive)', () => {
      // Arrange - lowercase 'bash' should pass through
      const input = createToolInput('bash', {
        command: 'DROP TABLE users',
      });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Dangerous SQL patterns blocked
  // ---------------------------------------------------------------------------

  describe('dangerous SQL patterns blocked', () => {
    test.each([
      ['DROP TABLE users', 'DROP TABLE'],
      ['DROP TABLE IF EXISTS orders', 'DROP TABLE'],
      ['drop table products', 'DROP TABLE'],
      ['DROP DATABASE mydb', 'DROP DATABASE'],
      ['DROP DATABASE IF EXISTS testdb', 'DROP DATABASE'],
      ['drop database production', 'DROP DATABASE'],
      ['TRUNCATE orders', 'TRUNCATE'],
      ['TRUNCATE TABLE sessions', 'TRUNCATE'],
      ['truncate logs', 'TRUNCATE'],
      ['DELETE FROM users WHERE 1=1', 'DELETE FROM...WHERE 1'],
      ['DELETE FROM orders WHERE 1 = 1', 'DELETE FROM...WHERE 1'],
    ])('blocks dangerous SQL: %s', (command, _expectedPattern) => {
      // Arrange
      const input = createToolInput('Bash', { command });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputDeny).toHaveBeenCalledTimes(1);
      expect(outputSilentSuccess).not.toHaveBeenCalled();
    });

    test('blocks DELETE FROM without WHERE clause', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'DELETE FROM users' });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputDeny).toHaveBeenCalledTimes(1);
    });

    test('blocks DELETE FROM with table name only (no WHERE)', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'psql -c "DELETE FROM sessions"',
      });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Migration commands blocked
  // ---------------------------------------------------------------------------

  describe('migration commands blocked', () => {
    test('blocks alembic downgrade', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'alembic downgrade -1',
      });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputDeny).toHaveBeenCalledTimes(1);
    });

    test('blocks alembic downgrade to base', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'alembic downgrade base',
      });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('blocks --force flag', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'prisma migrate reset --force',
      });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('blocks standalone --force flag', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'migrate --force',
      });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Safe SQL commands allowed
  // ---------------------------------------------------------------------------

  describe('safe SQL commands allowed', () => {
    test.each([
      ['SELECT * FROM users'],
      ['SELECT id, name FROM users WHERE active = true'],
      ['INSERT INTO users (name, email) VALUES (\'test\', \'test@test.com\')'],
      ['UPDATE users SET name = \'new\' WHERE id = 1'],
      ['alembic upgrade head'],
      ['alembic upgrade +1'],
      ['prisma migrate dev'],
      ['prisma migrate deploy'],
      ['npm run migrate'],
      ['DELETE FROM users WHERE id = 42'], // has proper WHERE clause
    ])('allows safe command: %s', (command) => {
      // Arrange
      const input = createToolInput('Bash', { command });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
      expect(outputDeny).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Deny output format
  // ---------------------------------------------------------------------------

  describe('deny output format', () => {
    test('deny output contains BLOCKED keyword', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'DROP TABLE users' });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.stopReason).toContain('BLOCKED');
    });

    test('deny output mentions destructive database command', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'TRUNCATE orders',
      });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.stopReason).toContain('destructive database command');
    });

    test('deny output contains matched pattern source', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'DROP DATABASE mydb' });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.stopReason).toContain('Pattern:');
      expect(result.stopReason).toContain('DROP DATABASE');
    });

    test('deny output asks for confirmation', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'TRUNCATE sessions' });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.stopReason).toContain('confirm this operation');
    });

    test('deny result has proper CC 2.1.7 structure', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'DROP TABLE users' });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result).toMatchObject({
        continue: false,
        stopReason: expect.any(String),
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: expect.stringContaining('BLOCKED'),
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty command string', () => {
      // Arrange
      const input = createToolInput('Bash', { command: '' });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });

    test('handles missing command field', () => {
      // Arrange
      const input = createToolInput('Bash', {});

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });

    test('handles undefined command gracefully', () => {
      // Arrange
      const input = createToolInput('Bash', { command: undefined });

      // Act & Assert
      expect(() => migrationSafetyCheck(input)).not.toThrow();
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });

    test('case insensitive matching for drop table', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'drop table users' });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('case insensitive matching for DROP TABLE', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'DROP TABLE users' });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('case insensitive matching for Drop Table', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'Drop Table users' });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('case insensitive matching for truncate', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'truncate orders' });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('first matching dangerous pattern is reported', () => {
      // Arrange - multiple patterns in one command
      const input = createToolInput('Bash', {
        command: 'DROP TABLE users; TRUNCATE orders',
      });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert - first pattern match triggers deny
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('DROP TABLE');
    });

    test('embedded SQL in psql command is still caught', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'psql -h localhost -d mydb -c "DROP TABLE users"',
      });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('embedded SQL in docker exec is still caught', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'docker exec postgres psql -c "TRUNCATE sessions"',
      });

      // Act
      const result = migrationSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Pattern completeness
  // ---------------------------------------------------------------------------

  describe('pattern completeness', () => {
    test('all 7 dangerous patterns are enforced', () => {
      // Arrange - one representative command per pattern
      const dangerousCommands = [
        'DROP TABLE users',
        'DROP DATABASE mydb',
        'TRUNCATE orders',
        'DELETE FROM users WHERE 1=1',
        'DELETE FROM sessions',       // DELETE without WHERE
        'migrate --force',
        'alembic downgrade -1',
      ];

      // Act & Assert
      for (const cmd of dangerousCommands) {
        vi.clearAllMocks();
        const input = createToolInput('Bash', { command: cmd });
        const result = migrationSafetyCheck(input);
        expect(result.continue).toBe(false);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Tool filtering
  // ---------------------------------------------------------------------------

  describe('tool filtering', () => {
    test('only Bash tool is checked, even with dangerous commands', () => {
      // Arrange - dangerous SQL in a non-Bash tool
      const tools = ['Write', 'Edit', 'Read', 'Glob', 'Grep'];

      // Act & Assert
      for (const toolName of tools) {
        vi.clearAllMocks();
        const input = createToolInput(toolName, { command: 'DROP TABLE users' });
        const result = migrationSafetyCheck(input);
        expect(result.continue).toBe(true);
        expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
        expect(outputDeny).not.toHaveBeenCalled();
      }
    });
  });
});

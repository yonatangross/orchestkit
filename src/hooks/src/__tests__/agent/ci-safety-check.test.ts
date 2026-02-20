/**
 * Unit tests for ci-safety-check hook
 * Tests enforcement of CI/CD safety patterns for the ci-cd-engineer agent
 *
 * Security Focus: Validates that dangerous CI/CD operations are blocked,
 * deployment commands trigger warnings, and safe commands pass through
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
  lineContainsAll: (content: string, ...terms: string[]) =>
    content.split('\n').some((line) => terms.every((t) => line.includes(t))),
  lineContainsAllCI: (content: string, ...terms: string[]) =>
    content.split('\n').some((line) => {
      const lower = line.toLowerCase();
      return terms.every((t) => lower.includes(t.toLowerCase()));
    }),
}));

import { ciSafetyCheck } from '../../agent/ci-safety-check.js';
import { outputSilentSuccess, outputDeny, outputWithContext } from '../../lib/common.js';

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
// CI Safety Check Tests
// =============================================================================

describe('ci-safety-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Dangerous CI patterns blocked
  // ---------------------------------------------------------------------------

  describe('dangerous CI patterns blocked', () => {
    test.each([
      ['git push --force origin main', 'push.*--force'],
      ['git push --force-with-lease', '--force-with-lease'],
      ['force push origin main', 'force.*push'],
      ['gh api workflow_dispatch', 'workflow_dispatch'],
      ['gh secret delete MY_SECRET', 'gh\\s+secret\\s+delete'],
      ['gh variable delete MY_VAR', 'gh\\s+variable\\s+delete'],
      ['rm -rf .github/workflows', 'rm.*-rf.*\\.github'],
      ['delete workflow run 12345', 'delete.*workflow'],
    ])('blocks dangerous command: %s', (command, _expectedPattern) => {
      // Arrange
      const input = createToolInput('Bash', { command });

      // Act
      const result = ciSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputDeny).toHaveBeenCalledTimes(1);
      expect(outputSilentSuccess).not.toHaveBeenCalled();
    });

    test('blocks force push with additional arguments', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'git push --force origin feature-branch',
      });

      // Act
      const result = ciSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('BLOCKED');
    });

    test('blocks compound commands containing dangerous patterns', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'echo "deploying" && git push --force origin main',
      });

      // Act
      const result = ciSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Deployment warnings (not blocks)
  // ---------------------------------------------------------------------------

  describe('deployment warnings', () => {
    test.each([
      ['npm run deploy', 'deploy'],
      ['gh release create v1.0.0', 'release'],
      ['npm publish', 'publish'],
      ['npm run deploy:staging', 'deploy'],
      ['gh release create --draft', 'release'],
      ['npm publish --tag beta', 'publish'],
    ])('warns (not blocks) on deployment command: %s', (command, _keyword) => {
      // Arrange
      const input = createToolInput('Bash', { command });

      // Act
      const result = ciSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputWithContext).toHaveBeenCalledTimes(1);
      expect(outputDeny).not.toHaveBeenCalled();
    });

    test('deployment warning contains CI/CD Safety context', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'npm run deploy' });

      // Act
      ciSafetyCheck(input);

      // Assert
      const contextArg = vi.mocked(outputWithContext).mock.calls[0][0];
      expect(contextArg).toContain('CI/CD Safety');
    });

    test('deployment warning mentions verification', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'npm publish' });

      // Act
      ciSafetyCheck(input);

      // Assert
      const contextArg = vi.mocked(outputWithContext).mock.calls[0][0];
      expect(contextArg).toContain('Deployment commands detected');
    });
  });

  // ---------------------------------------------------------------------------
  // Safe commands allowed
  // ---------------------------------------------------------------------------

  describe('safe commands allowed', () => {
    test.each([
      ['git status'],
      ['npm test'],
      ['npm run lint'],
      ['gh pr list'],
      ['gh pr view 123'],
      ['docker build -t myapp .'],
      ['docker compose up'],
      ['echo "hello world"'],
      ['ls -la'],
      ['cat package.json'],
      ['node scripts/test.js'],
    ])('allows safe command: %s', (command) => {
      // Arrange
      const input = createToolInput('Bash', { command });

      // Act
      const result = ciSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
      expect(outputDeny).not.toHaveBeenCalled();
      expect(outputWithContext).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Deny output format
  // ---------------------------------------------------------------------------

  describe('deny output format', () => {
    test('deny output contains BLOCKED keyword', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'git push --force' });

      // Act
      const result = ciSafetyCheck(input);

      // Assert
      expect(result.stopReason).toContain('BLOCKED');
    });

    test('deny output contains the matched pattern source', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'gh secret delete TOKEN' });

      // Act
      const result = ciSafetyCheck(input);

      // Assert
      expect(result.stopReason).toContain('Pattern:');
      expect(result.stopReason).toContain('gh secret delete');
    });

    test('deny output mentions user approval', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'rm -rf .github' });

      // Act
      const result = ciSafetyCheck(input);

      // Assert
      expect(result.stopReason).toContain('explicit user approval');
    });

    test('deny result has proper CC 2.1.7 structure', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'git push --force origin main',
      });

      // Act
      const result = ciSafetyCheck(input);

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
  // Context output format
  // ---------------------------------------------------------------------------

  describe('context output format', () => {
    test('context output mentions CI/CD Safety', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'gh release create v2.0' });

      // Act
      ciSafetyCheck(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('CI/CD Safety'),
      );
    });

    test('context result has proper CC 2.1.9 structure', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'npm run deploy' });

      // Act
      const result = ciSafetyCheck(input);

      // Assert
      expect(result).toMatchObject({
        continue: true,
        suppressOutput: true,
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: expect.any(String),
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
      const result = ciSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });

    test('handles missing command field', () => {
      // Arrange
      const input = createToolInput('Bash', {});

      // Act
      const result = ciSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });

    test('handles undefined command gracefully', () => {
      // Arrange
      const input = createToolInput('Bash', { command: undefined });

      // Act & Assert
      expect(() => ciSafetyCheck(input)).not.toThrow();
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });

    test('case insensitive pattern matching for workflow_dispatch', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'WORKFLOW_DISPATCH event',
      });

      // Act
      const result = ciSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('case insensitive pattern matching for force push', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'FORCE PUSH origin main',
      });

      // Act
      const result = ciSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('dangerous patterns are checked before deployment warnings', () => {
      // Arrange - command matches BOTH dangerous AND deployment patterns
      const input = createToolInput('Bash', {
        command: 'git push --force && npm run deploy',
      });

      // Act
      const result = ciSafetyCheck(input);

      // Assert - dangerous pattern should take precedence (deny, not warn)
      expect(result.continue).toBe(false);
      expect(outputDeny).toHaveBeenCalledTimes(1);
      expect(outputWithContext).not.toHaveBeenCalled();
    });

    test('first matching dangerous pattern is reported', () => {
      // Arrange - command with multiple dangerous patterns
      const input = createToolInput('Bash', {
        command: 'gh secret delete KEY && rm -rf .github',
      });

      // Act
      const result = ciSafetyCheck(input);

      // Assert - first match (gh secret delete) triggers deny
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('gh secret delete');
    });
  });

  // ---------------------------------------------------------------------------
  // Pattern completeness
  // ---------------------------------------------------------------------------

  describe('pattern completeness', () => {
    test('all 8 dangerous patterns are enforced', () => {
      // Arrange - one representative command per pattern
      const dangerousCommands = [
        'force push to main',
        'git push --force origin main',
        'git push --force-with-lease',
        'trigger workflow_dispatch',
        'delete workflow run',
        'gh secret delete TOKEN',
        'gh variable delete VAR',
        'rm -rf .github',
      ];

      // Act & Assert
      for (const cmd of dangerousCommands) {
        const input = createToolInput('Bash', { command: cmd });
        const result = ciSafetyCheck(input);
        expect(result.continue).toBe(false);
      }
    });
  });
});

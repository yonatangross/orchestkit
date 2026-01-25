/**
 * Unit tests for block-writes hook
 * Tests enforcement of read-only boundaries for investigation/review agents
 *
 * Security Focus: Validates that read-only agents cannot perform Write/Edit operations
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';
import { blockWrites } from '../../agent/block-writes.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for any tool
 */
function createToolInput(toolName: string, toolInput: Record<string, unknown> = {}, overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: toolName,
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: toolInput,
    ...overrides,
  };
}

/**
 * Store original environment for cleanup
 */
let originalAgentId: string | undefined;

// =============================================================================
// Block Writes Tests
// =============================================================================

describe('block-writes', () => {
  beforeEach(() => {
    // Save original environment
    originalAgentId = process.env.CLAUDE_AGENT_ID;
  });

  afterEach(() => {
    // Restore original environment
    if (originalAgentId !== undefined) {
      process.env.CLAUDE_AGENT_ID = originalAgentId;
    } else {
      delete process.env.CLAUDE_AGENT_ID;
    }
  });

  describe('write operations are blocked', () => {
    test('blocks Write tool', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'debug-investigator';
      const input = createToolInput('Write', {
        file_path: '/src/app.ts',
        content: 'new content',
      });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('BLOCKED');
      expect(result.stopReason).toContain('debug-investigator');
      expect(result.stopReason).toContain('read-only');
    });

    test('blocks Edit tool', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'code-quality-reviewer';
      const input = createToolInput('Edit', {
        file_path: '/src/app.ts',
        old_string: 'old',
        new_string: 'new',
      });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('BLOCKED');
      expect(result.stopReason).toContain('code-quality-reviewer');
    });

    test('blocks MultiEdit tool', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'ux-researcher';
      const input = createToolInput('MultiEdit', {
        edits: [{ file_path: '/a.ts', old: 'x', new: 'y' }],
      });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('BLOCKED');
    });

    test('blocks NotebookEdit tool', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'market-intelligence';
      const input = createToolInput('NotebookEdit', {
        notebook_path: '/notebooks/analysis.ipynb',
      });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('BLOCKED');
    });
  });

  describe('read operations are allowed', () => {
    test('allows Read tool', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'debug-investigator';
      const input = createToolInput('Read', {
        file_path: '/src/app.ts',
      });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('allows Glob tool', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'code-quality-reviewer';
      const input = createToolInput('Glob', {
        pattern: '**/*.ts',
      });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows Grep tool', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'system-design-reviewer';
      const input = createToolInput('Grep', {
        pattern: 'TODO',
        path: '/src',
      });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows Bash tool', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'debug-investigator';
      const input = createToolInput('Bash', {
        command: 'git status',
      });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('agent identification', () => {
    test('uses CLAUDE_AGENT_ID from environment', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'custom-investigator';
      const input = createToolInput('Write', { file_path: '/test.ts', content: '' });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result.stopReason).toContain('custom-investigator');
    });

    test('shows unknown when CLAUDE_AGENT_ID not set', () => {
      // Arrange
      delete process.env.CLAUDE_AGENT_ID;
      const input = createToolInput('Write', { file_path: '/test.ts', content: '' });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result.stopReason).toContain('unknown');
    });

    test('handles empty CLAUDE_AGENT_ID', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = '';
      const input = createToolInput('Write', { file_path: '/test.ts', content: '' });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  describe('read-only agent use cases', () => {
    const readOnlyAgents = [
      'debug-investigator',
      'code-quality-reviewer',
      'ux-researcher',
      'market-intelligence',
      'system-design-reviewer',
    ];

    test.each(readOnlyAgents)('%s cannot write files', (agentId) => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = agentId;
      const input = createToolInput('Write', {
        file_path: '/src/app.ts',
        content: 'should not write',
      });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('BLOCKED');
      expect(result.stopReason).toContain(agentId);
    });

    test.each(readOnlyAgents)('%s can read files', (agentId) => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = agentId;
      const input = createToolInput('Read', {
        file_path: '/src/app.ts',
      });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles case-sensitive tool names', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'debug-investigator';

      // Tool names are case-sensitive in Claude Code
      const writeInput = createToolInput('write', { file_path: '/test.ts', content: '' });
      const WriteInput = createToolInput('Write', { file_path: '/test.ts', content: '' });

      // Act
      const writeResult = blockWrites(writeInput);
      const WriteResult = blockWrites(WriteInput);

      // Assert - lowercase 'write' is not in the blocklist
      expect(writeResult.continue).toBe(true);
      expect(WriteResult.continue).toBe(false);
    });

    test('handles empty tool name', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'debug-investigator';
      const input = createToolInput('', {});

      // Act
      const result = blockWrites(input);

      // Assert - empty string not in blocklist
      expect(result.continue).toBe(true);
    });

    test('handles undefined tool_name gracefully', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'debug-investigator';
      const input: HookInput = {
        tool_name: undefined as unknown as string,
        session_id: 'test',
        project_dir: '/test',
        tool_input: {},
      };

      // Act & Assert - should not throw
      expect(() => blockWrites(input)).not.toThrow();
    });
  });

  describe('output format compliance (CC 2.1.7)', () => {
    test('blocked write returns proper deny structure', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'debug-investigator';
      const input = createToolInput('Write', { file_path: '/test.ts', content: '' });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result).toMatchObject({
        continue: false,
        stopReason: expect.stringContaining('BLOCKED'),
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: expect.stringContaining('read-only'),
        },
      });
    });

    test('allowed operation returns proper silent success structure', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'debug-investigator';
      const input = createToolInput('Read', { file_path: '/test.ts' });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result).toEqual({
        continue: true,
        suppressOutput: true,
      });
    });

    test('error message explains agent boundaries', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'debug-investigator';
      const input = createToolInput('Write', { file_path: '/test.ts', content: '' });

      // Act
      const result = blockWrites(input);

      // Assert
      expect(result.stopReason).toContain('investigates and reports');
      expect(result.stopReason).toContain('does not modify code');
    });
  });

  describe('tool blocklist coverage', () => {
    test('all write tools are in the blocklist', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'debug-investigator';
      const writeTools = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];

      // Act & Assert
      for (const tool of writeTools) {
        const input = createToolInput(tool, {});
        const result = blockWrites(input);
        expect(result.continue).toBe(false);
      }
    });

    test('common read tools are not blocked', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'debug-investigator';
      const readTools = ['Read', 'Glob', 'Grep', 'Bash', 'Task', 'TaskList', 'TaskGet'];

      // Act & Assert
      for (const tool of readTools) {
        const input = createToolInput(tool, {});
        const result = blockWrites(input);
        expect(result.continue).toBe(true);
      }
    });
  });

  describe('concurrent agent scenarios', () => {
    test('different agents can have different permissions in sequence', () => {
      // Arrange & Act & Assert - Agent 1 is blocked
      process.env.CLAUDE_AGENT_ID = 'debug-investigator';
      const input1 = createToolInput('Write', { file_path: '/test.ts', content: '' });
      expect(blockWrites(input1).continue).toBe(false);

      // Agent 2 is also blocked (this hook blocks ALL agents)
      process.env.CLAUDE_AGENT_ID = 'backend-system-architect';
      const input2 = createToolInput('Write', { file_path: '/test.ts', content: '' });
      expect(blockWrites(input2).continue).toBe(false);
    });
  });
});

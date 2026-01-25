/**
 * Unit tests for session-context-loader lifecycle hook
 * Tests context loading at session start with Protocol 2.0 compliance
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import type { HookInput } from '../../types.js';
import { sessionContextLoader } from '../../lifecycle/session-context-loader.js';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = '/tmp/session-context-loader-test';

/**
 * Create realistic HookInput for testing
 */
function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: 'test-session-123',
    project_dir: TEST_PROJECT_DIR,
    tool_input: {},
    ...overrides,
  };
}

/**
 * Create test context files
 */
function createContextFiles(options: {
  sessionState?: boolean;
  identity?: boolean;
  knowledgeIndex?: boolean;
  statusDoc?: boolean;
  agentConfig?: string;
  invalidJson?: boolean;
} = {}): void {
  // Create session state
  if (options.sessionState) {
    const sessionDir = `${TEST_PROJECT_DIR}/.claude/context/session`;
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(
      `${sessionDir}/state.json`,
      options.invalidJson ? 'invalid json {' : JSON.stringify({ current_task: { description: 'Test task' } })
    );
  }

  // Create identity
  if (options.identity) {
    const contextDir = `${TEST_PROJECT_DIR}/.claude/context`;
    mkdirSync(contextDir, { recursive: true });
    writeFileSync(
      `${contextDir}/identity.json`,
      options.invalidJson ? 'invalid json {' : JSON.stringify({ name: 'Test Project' })
    );
  }

  // Create knowledge index
  if (options.knowledgeIndex) {
    const knowledgeDir = `${TEST_PROJECT_DIR}/.claude/context/knowledge`;
    mkdirSync(knowledgeDir, { recursive: true });
    writeFileSync(
      `${knowledgeDir}/index.json`,
      options.invalidJson ? 'invalid json {' : JSON.stringify({ entries: [] })
    );
  }

  // Create status document
  if (options.statusDoc) {
    const docsDir = `${TEST_PROJECT_DIR}/docs`;
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(`${docsDir}/CURRENT_STATUS.md`, '# Current Status\n\nProject is active.');
  }

  // Create agent config
  if (options.agentConfig) {
    const agentsDir = `${TEST_PROJECT_DIR}/.claude/agents`;
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(`${agentsDir}/${options.agentConfig}.md`, `# ${options.agentConfig}\n\nAgent config.`);
  }
}

beforeEach(() => {
  // Create test directory
  mkdirSync(TEST_PROJECT_DIR, { recursive: true });
});

afterEach(() => {
  // Clean up test directory
  if (existsSync(TEST_PROJECT_DIR)) {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }
  // Clean up environment
  delete process.env.AGENT_TYPE;
});

// =============================================================================
// Tests
// =============================================================================

describe('session-context-loader', () => {
  describe('basic behavior', () => {
    test('returns silent success when no context files exist', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = sessionContextLoader(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success when all context files exist', () => {
      // Arrange
      createContextFiles({
        sessionState: true,
        identity: true,
        knowledgeIndex: true,
      });
      const input = createHookInput();

      // Act
      const result = sessionContextLoader(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles missing project_dir by using default', () => {
      // Arrange
      const input = createHookInput({ project_dir: undefined });

      // Act
      const result = sessionContextLoader(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('Protocol 2.0 context loading', () => {
    test('loads session state when file exists', () => {
      // Arrange
      createContextFiles({ sessionState: true });
      const input = createHookInput();

      // Act
      const result = sessionContextLoader(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('loads identity when file exists', () => {
      // Arrange
      createContextFiles({ identity: true });
      const input = createHookInput();

      // Act
      const result = sessionContextLoader(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('loads knowledge index when file exists', () => {
      // Arrange
      createContextFiles({ knowledgeIndex: true });
      const input = createHookInput();

      // Act
      const result = sessionContextLoader(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects CURRENT_STATUS.md when present', () => {
      // Arrange
      createContextFiles({ statusDoc: true });
      const input = createHookInput();

      // Act
      const result = sessionContextLoader(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('agent-type aware loading (CC 2.1.6)', () => {
    test('loads agent-specific configuration when AGENT_TYPE is set', () => {
      // Arrange
      process.env.AGENT_TYPE = 'backend-system-architect';
      createContextFiles({ agentConfig: 'backend-system-architect' });
      const input = createHookInput();

      // Act
      const result = sessionContextLoader(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles missing agent configuration gracefully', () => {
      // Arrange
      process.env.AGENT_TYPE = 'non-existent-agent';
      const input = createHookInput();

      // Act
      const result = sessionContextLoader(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips agent-specific loading when AGENT_TYPE is empty', () => {
      // Arrange
      process.env.AGENT_TYPE = '';
      const input = createHookInput();

      // Act
      const result = sessionContextLoader(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips agent-specific loading when AGENT_TYPE is not set', () => {
      // Arrange - AGENT_TYPE is deleted in afterEach
      const input = createHookInput();

      // Act
      const result = sessionContextLoader(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('error handling', () => {
    test('handles invalid JSON in session state gracefully', () => {
      // Arrange
      const sessionDir = `${TEST_PROJECT_DIR}/.claude/context/session`;
      mkdirSync(sessionDir, { recursive: true });
      writeFileSync(`${sessionDir}/state.json`, 'invalid json {');
      const input = createHookInput();

      // Act
      const result = sessionContextLoader(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles invalid JSON in identity file gracefully', () => {
      // Arrange
      const contextDir = `${TEST_PROJECT_DIR}/.claude/context`;
      mkdirSync(contextDir, { recursive: true });
      writeFileSync(`${contextDir}/identity.json`, '{ broken json');
      const input = createHookInput();

      // Act
      const result = sessionContextLoader(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles invalid JSON in knowledge index gracefully', () => {
      // Arrange
      const knowledgeDir = `${TEST_PROJECT_DIR}/.claude/context/knowledge`;
      mkdirSync(knowledgeDir, { recursive: true });
      writeFileSync(`${knowledgeDir}/index.json`, 'not valid json');
      const input = createHookInput();

      // Act
      const result = sessionContextLoader(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles non-existent project directory gracefully', () => {
      // Arrange
      const input = createHookInput({ project_dir: '/non/existent/path' });

      // Act
      const result = sessionContextLoader(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = sessionContextLoader(input);

      // Assert - SessionStart hooks don't support additionalContext
      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('suppressOutput', true);
      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });

    test('never blocks session start', () => {
      // Arrange - create a problematic environment
      const input = createHookInput({ project_dir: '/non/existent/path' });

      // Act
      const result = sessionContextLoader(input);

      // Assert - should always continue
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });
  });
});

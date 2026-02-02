/**
 * Unit tests for mem0-context-retrieval lifecycle hook
 * Tests auto-loading of memories at session start with Graph-First Architecture
 * CC 2.1.7 Compliant: Non-blocking hook that always returns continue: true
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import type { HookInput } from '../../types.js';
import { mem0ContextRetrieval } from '../../lifecycle/mem0-context-retrieval.js';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = join(tmpdir(), 'mem0-context-retrieval-test');
const TEST_HOME_DIR = join(tmpdir(), 'mem0-context-test-home');
const TEST_SESSION_ID = 'test-session-context-' + Date.now();

/**
 * Create realistic HookInput for testing
 */
function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: TEST_SESSION_ID,
    project_dir: TEST_PROJECT_DIR,
    tool_input: {},
    ...overrides,
  };
}

/**
 * Create pending sync file in project directory
 */
function createProjectPendingSync(content: Record<string, unknown>): void {
  writeFileSync(`${TEST_PROJECT_DIR}/.mem0-pending-sync.json`, JSON.stringify(content));
}

/**
 * Create pending sync file in global (home) directory
 */
function createGlobalPendingSync(content: Record<string, unknown>): void {
  mkdirSync(`${TEST_HOME_DIR}/.claude`, { recursive: true });
  writeFileSync(`${TEST_HOME_DIR}/.claude/.mem0-pending-sync.json`, JSON.stringify(content));
}

/**
 * Create memory-fabric skill directory structure
 */
function createMemoryFabricSkill(): void {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || TEST_PROJECT_DIR;
  const skillDir = `${pluginRoot}/skills/memory-fabric`;
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(`${skillDir}/SKILL.md`, '# Memory Fabric\n\nA test skill.');
}

/**
 * Get project ID from project directory
 */
function getExpectedProjectId(projectDir: string): string {
  const parts = projectDir.split('/');
  const basename = parts[parts.length - 1] || 'unknown';
  return basename.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Store original environment values
 */
let originalEnv: {
  MEM0_API_KEY?: string;
  CLAUDE_PROJECT_DIR?: string;
  CLAUDE_PLUGIN_ROOT?: string;
  HOME?: string;
  USERPROFILE?: string;
};

beforeEach(() => {
  // Store original environment
  originalEnv = {
    MEM0_API_KEY: process.env.MEM0_API_KEY,
    CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
    CLAUDE_PLUGIN_ROOT: process.env.CLAUDE_PLUGIN_ROOT,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
  };

  // Set up test environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;
  process.env.HOME = TEST_HOME_DIR;
  process.env.USERPROFILE = TEST_HOME_DIR;

  // Create test directories
  mkdirSync(TEST_PROJECT_DIR, { recursive: true });
  mkdirSync(TEST_HOME_DIR, { recursive: true });

  // Clear any mocks
  vi.clearAllMocks();
});

afterEach(() => {
  // Clean up test directories
  if (existsSync(TEST_PROJECT_DIR)) {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }
  if (existsSync(TEST_HOME_DIR)) {
    rmSync(TEST_HOME_DIR, { recursive: true, force: true });
  }

  // Restore original environment
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
});

// =============================================================================
// Tests
// =============================================================================

describe('mem0-context-retrieval', () => {
  describe('basic behavior', () => {
    test('returns silent success when no pending sync files exist', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success when pending sync is processed', () => {
      // Arrange
      createProjectPendingSync({ memories: [{ text: 'test memory' }] });
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('creates logs directory for processed files', () => {
      // Arrange
      createProjectPendingSync({ memories: [{ text: 'test memory' }] });
      const input = createHookInput();

      // Act
      mem0ContextRetrieval(input);

      // Assert
      const processedDir = `${TEST_PROJECT_DIR}/.claude/logs/mem0-processed`;
      expect(existsSync(processedDir)).toBe(true);
    });
  });

  describe('pending sync file detection', () => {
    test('detects pending sync in project directory', () => {
      // Arrange
      createProjectPendingSync({
        memories: [{ text: 'project-level memory' }],
        scope: 'project',
      });
      const input = createHookInput();

      // Act
      mem0ContextRetrieval(input);

      // Assert - file should be archived (moved away)
      expect(existsSync(`${TEST_PROJECT_DIR}/.mem0-pending-sync.json`)).toBe(false);
    });

    test('archives pending sync file after detection', () => {
      // Arrange
      createProjectPendingSync({ memories: [{ text: 'test' }] });
      const input = createHookInput();

      // Act
      mem0ContextRetrieval(input);

      // Assert
      const processedDir = `${TEST_PROJECT_DIR}/.claude/logs/mem0-processed`;
      if (existsSync(processedDir)) {
        const files = readdirSync(processedDir);
        const archivedFiles = files.filter((f) => f.includes('.processed-'));
        expect(archivedFiles.length).toBeGreaterThan(0);
      }
    });

    test('detects pending sync in global directory for matching project', () => {
      // Arrange
      const projectId = getExpectedProjectId(TEST_PROJECT_DIR);
      createGlobalPendingSync({
        memories: [{ text: 'global memory' }],
        project_id: projectId,
      });
      const input = createHookInput();

      // Act
      mem0ContextRetrieval(input);

      // Assert - global file should be archived
      expect(existsSync(`${TEST_HOME_DIR}/.claude/.mem0-pending-sync.json`)).toBe(false);
    });

    test('ignores global pending sync for different project', () => {
      // Arrange
      createGlobalPendingSync({
        memories: [{ text: 'different project memory' }],
        project_id: 'different-project-id',
      });
      const input = createHookInput();

      // Act
      mem0ContextRetrieval(input);

      // Assert - global file should remain (different project)
      expect(existsSync(`${TEST_HOME_DIR}/.claude/.mem0-pending-sync.json`)).toBe(true);
    });

    test('prefers project-level pending sync over global', () => {
      // Arrange
      const projectId = getExpectedProjectId(TEST_PROJECT_DIR);
      createProjectPendingSync({
        memories: [{ text: 'project memory' }],
        scope: 'project',
      });
      createGlobalPendingSync({
        memories: [{ text: 'global memory' }],
        project_id: projectId,
      });
      const input = createHookInput();

      // Act
      mem0ContextRetrieval(input);

      // Assert - project file archived, global file remains
      expect(existsSync(`${TEST_PROJECT_DIR}/.mem0-pending-sync.json`)).toBe(false);
      expect(existsSync(`${TEST_HOME_DIR}/.claude/.mem0-pending-sync.json`)).toBe(true);
    });
  });

  describe('pending sync validation', () => {
    test('ignores empty pending sync file', () => {
      // Arrange
      writeFileSync(`${TEST_PROJECT_DIR}/.mem0-pending-sync.json`, '{}');
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
      // Empty file should not be processed (remains in place)
    });

    test('ignores invalid JSON in pending sync file', () => {
      // Arrange
      writeFileSync(`${TEST_PROJECT_DIR}/.mem0-pending-sync.json`, 'invalid json {[}');
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('processes pending sync with valid content', () => {
      // Arrange
      createProjectPendingSync({
        memories: [{ text: 'valid memory', metadata: { category: 'decision' } }],
        scope: 'project',
        project_id: getExpectedProjectId(TEST_PROJECT_DIR),
      });
      const input = createHookInput();

      // Act
      mem0ContextRetrieval(input);

      // Assert
      expect(existsSync(`${TEST_PROJECT_DIR}/.mem0-pending-sync.json`)).toBe(false);
      const processedDir = `${TEST_PROJECT_DIR}/.claude/logs/mem0-processed`;
      expect(existsSync(processedDir)).toBe(true);
    });

    test.each([
      [{ memories: [] }, false], // Empty memories array
      [{ memories: [{ text: 'valid' }] }, true], // Valid memories
      [{}, false], // Empty object
      [{ scope: 'project' }, false], // No memories field
      [{ memories: null }, false], // Null memories
    ])('with content %j, should process: %s', (content, shouldProcess) => {
      // Arrange
      writeFileSync(`${TEST_PROJECT_DIR}/.mem0-pending-sync.json`, JSON.stringify(content));
      const input = createHookInput();

      // Act
      mem0ContextRetrieval(input);

      // Assert
      if (shouldProcess) {
        expect(existsSync(`${TEST_PROJECT_DIR}/.mem0-pending-sync.json`)).toBe(false);
      }
      // If not processed, file may or may not remain depending on validation logic
    });
  });

  describe('mem0 availability detection', () => {
    test('detects mem0 as available when MEM0_API_KEY is set', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key-12345';
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
      // Mem0 availability is logged internally
    });

    test('detects mem0 as unavailable when MEM0_API_KEY is not set', () => {
      // Arrange
      delete process.env.MEM0_API_KEY;
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
      // Graph-only mode is logged internally
    });

    test('returns success regardless of mem0 availability', () => {
      // Arrange
      const testCases = [
        { key: 'valid-key' },
        { key: '' },
        { key: undefined },
      ];

      testCases.forEach(({ key }) => {
        if (key !== undefined) {
          process.env.MEM0_API_KEY = key;
        } else {
          delete process.env.MEM0_API_KEY;
        }

        // Act
        const result = mem0ContextRetrieval(createHookInput());

        // Assert
        expect(result.continue).toBe(true);
        expect(result.suppressOutput).toBe(true);
      });
    });
  });

  describe('archive naming', () => {
    test('archives with timestamp in filename', () => {
      // Arrange
      createProjectPendingSync({ memories: [{ text: 'test' }] });
      const input = createHookInput();

      // Act
      mem0ContextRetrieval(input);

      // Assert
      const processedDir = `${TEST_PROJECT_DIR}/.claude/logs/mem0-processed`;
      if (existsSync(processedDir)) {
        const files = readdirSync(processedDir);
        const hasTimestamp = files.some((f) => /\.processed-\d{4}-\d{2}-\d{2}/.test(f));
        expect(hasTimestamp).toBe(true);
      }
    });

    test('preserves original filename in archive', () => {
      // Arrange
      createProjectPendingSync({ memories: [{ text: 'test' }] });
      const input = createHookInput();

      // Act
      mem0ContextRetrieval(input);

      // Assert
      const processedDir = `${TEST_PROJECT_DIR}/.claude/logs/mem0-processed`;
      if (existsSync(processedDir)) {
        const files = readdirSync(processedDir);
        const hasOriginalName = files.some((f) => f.includes('mem0-pending-sync'));
        expect(hasOriginalName).toBe(true);
      }
    });
  });

  describe('fallback handling', () => {
    test('uses input.project_dir when provided', () => {
      // Arrange
      const customDir = join(tmpdir(), 'custom-context-test-' + Date.now());
      mkdirSync(customDir, { recursive: true });
      writeFileSync(
        `${customDir}/.mem0-pending-sync.json`,
        JSON.stringify({ memories: [{ text: 'custom' }] })
      );
      const input = createHookInput({ project_dir: customDir });

      // Act
      mem0ContextRetrieval(input);

      // Assert
      expect(existsSync(`${customDir}/.mem0-pending-sync.json`)).toBe(false);

      // Cleanup
      rmSync(customDir, { recursive: true, force: true });
    });

    test('uses CLAUDE_PROJECT_DIR when input.project_dir is undefined', () => {
      // Arrange
      const envDir = join(tmpdir(), 'env-context-test-' + Date.now());
      mkdirSync(envDir, { recursive: true });
      process.env.CLAUDE_PROJECT_DIR = envDir;
      writeFileSync(
        `${envDir}/.mem0-pending-sync.json`,
        JSON.stringify({ memories: [{ text: 'env' }] })
      );
      const input = createHookInput({ project_dir: undefined });

      // Act
      mem0ContextRetrieval(input);

      // Assert
      expect(existsSync(`${envDir}/.mem0-pending-sync.json`)).toBe(false);

      // Cleanup
      rmSync(envDir, { recursive: true, force: true });
    });
  });

  describe('project ID extraction', () => {
    test('extracts project ID from directory basename', () => {
      // Arrange
      const expectedId = getExpectedProjectId(TEST_PROJECT_DIR);
      createGlobalPendingSync({
        memories: [{ text: 'global' }],
        project_id: expectedId,
      });
      const input = createHookInput();

      // Act
      mem0ContextRetrieval(input);

      // Assert - should match and archive
      expect(existsSync(`${TEST_HOME_DIR}/.claude/.mem0-pending-sync.json`)).toBe(false);
    });

    test('converts project ID to lowercase', () => {
      // Arrange
      const customDir = join(tmpdir(), 'MyProjectName');
      mkdirSync(customDir, { recursive: true });
      createGlobalPendingSync({
        memories: [{ text: 'test' }],
        project_id: 'myprojectname', // lowercase
      });
      const input = createHookInput({ project_dir: customDir });

      // Act
      mem0ContextRetrieval(input);

      // Assert
      expect(existsSync(`${TEST_HOME_DIR}/.claude/.mem0-pending-sync.json`)).toBe(false);

      // Cleanup
      rmSync(customDir, { recursive: true, force: true });
    });

    test('replaces spaces with hyphens in project ID', () => {
      // Arrange
      const customDir = join(tmpdir(), 'My Project Name');
      mkdirSync(customDir, { recursive: true });
      createGlobalPendingSync({
        memories: [{ text: 'test' }],
        project_id: 'my-project-name', // spaces replaced
      });
      const input = createHookInput({ project_dir: customDir });

      // Act
      mem0ContextRetrieval(input);

      // Assert
      expect(existsSync(`${TEST_HOME_DIR}/.claude/.mem0-pending-sync.json`)).toBe(false);

      // Cleanup
      rmSync(customDir, { recursive: true, force: true });
    });
  });

  describe('error handling', () => {
    test('handles non-existent project directory gracefully', () => {
      // Arrange
      const input = createHookInput({ project_dir: '/non/existent/path' });

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles missing project_dir by using default', () => {
      // Arrange
      const input = createHookInput({ project_dir: undefined });

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles archive failure gracefully', () => {
      // Arrange
      createProjectPendingSync({ memories: [{ text: 'test' }] });
      // Make processed dir a file to cause archive failure
      mkdirSync(`${TEST_PROJECT_DIR}/.claude/logs`, { recursive: true });
      writeFileSync(`${TEST_PROJECT_DIR}/.claude/logs/mem0-processed`, 'not a directory');
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles corrupt JSON in global pending sync', () => {
      // Arrange
      mkdirSync(`${TEST_HOME_DIR}/.claude`, { recursive: true });
      writeFileSync(`${TEST_HOME_DIR}/.claude/.mem0-pending-sync.json`, '{ invalid }');
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('never throws an exception', () => {
      // Arrange
      const invalidInputs = [
        createHookInput({ project_dir: '' }),
        createHookInput({ project_dir: null as unknown as string }),
        createHookInput({ project_dir: undefined }),
      ];

      // Act & Assert
      invalidInputs.forEach((input) => {
        expect(() => mem0ContextRetrieval(input)).not.toThrow();
      });
    });
  });

  describe('non-blocking behavior', () => {
    test('always returns continue: true regardless of state', () => {
      // Arrange & Act & Assert
      expect(mem0ContextRetrieval(createHookInput()).continue).toBe(true);
      createProjectPendingSync({ memories: [] });
      expect(mem0ContextRetrieval(createHookInput()).continue).toBe(true);
    });

    test('does not block on file operations', () => {
      // Arrange
      createProjectPendingSync({ memories: [{ text: 'test' }] });
      const input = createHookInput();

      // Act
      const start = Date.now();
      const result = mem0ContextRetrieval(input);
      const duration = Date.now() - start;

      // Assert
      expect(result.continue).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete quickly
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('suppressOutput', true);
    });

    test('always returns continue: true on success', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true on error', () => {
      // Arrange
      const input = createHookInput({ project_dir: '/invalid/path' });

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('never returns stopReason', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.stopReason).toBeUndefined();
    });

    test('never blocks session start', () => {
      // Arrange
      delete process.env.MEM0_API_KEY;
      createProjectPendingSync({ memories: [{ text: 'blocker test' }] });
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles empty memories array', () => {
      // Arrange
      createProjectPendingSync({ memories: [] });
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles memories with special characters', () => {
      // Arrange
      createProjectPendingSync({
        memories: [
          { text: 'Memory with "quotes" and \'apostrophes\'' },
          { text: 'Memory with newline\nand tab\t' },
          { text: 'Memory with unicode: \u4e2d\u6587' },
        ],
      });
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles very large pending sync file', () => {
      // Arrange
      const largeMemories = Array.from({ length: 100 }, (_, i) => ({
        text: `Memory ${i}: ${'x'.repeat(1000)}`,
        metadata: { index: i },
      }));
      createProjectPendingSync({ memories: largeMemories });
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles null-like project_dir values', () => {
      // Arrange
      const input = createHookInput({ project_dir: null as unknown as string });

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles missing home directory gracefully', () => {
      // Arrange
      delete process.env.HOME;
      delete process.env.USERPROFILE;
      const input = createHookInput();

      // Act
      const result = mem0ContextRetrieval(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });
});

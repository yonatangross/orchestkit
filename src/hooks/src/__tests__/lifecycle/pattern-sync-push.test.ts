/**
 * Unit tests for pattern-sync-push lifecycle hook
 * Tests pushing project patterns to global at session end
 * CC 2.1.7 Compliant: Non-blocking - always returns continue: true
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { HookInput } from '../../types.js';
import { patternSyncPush } from '../../lifecycle/pattern-sync-push.js';

// =============================================================================
// Mock Setup - BEFORE imports
// =============================================================================

const mockHomeDir = join(tmpdir(), 'pattern-sync-push-home-' + Date.now());

vi.mock('../../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/common.js')>();
  return {
    ...actual,
    logHook: vi.fn(),
    getProjectDir: vi.fn(() => process.env.CLAUDE_PROJECT_DIR || '/test/project'),
    outputSilentSuccess: actual.outputSilentSuccess,
  };
});

vi.mock('../../lib/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/paths.js')>();
  return {
    ...actual,
    getHomeDir: vi.fn(() => mockHomeDir),
  };
});

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = join(tmpdir(), 'pattern-sync-push-test-' + Date.now());
const TEST_SESSION_ID = 'test-session-push-' + Date.now();

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
 * Create project patterns file
 */
function createProjectPatterns(patterns: Array<{ text: string; [key: string]: unknown }>): void {
  const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
  mkdirSync(feedbackDir, { recursive: true });
  writeFileSync(
    `${feedbackDir}/learned-patterns.json`,
    JSON.stringify({ version: '1.0', patterns }, null, 2)
  );
}

/**
 * Create global patterns file
 */
function createGlobalPatterns(patterns: Array<{ text: string; [key: string]: unknown }>): void {
  const globalDir = `${mockHomeDir}/.claude`;
  mkdirSync(globalDir, { recursive: true });
  writeFileSync(
    `${globalDir}/global-patterns.json`,
    JSON.stringify({ version: '1.0', patterns, updated: new Date().toISOString() }, null, 2)
  );
}

/**
 * Create sync config file
 */
function createSyncConfig(config: { sync_enabled?: boolean }): void {
  const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
  mkdirSync(feedbackDir, { recursive: true });
  writeFileSync(`${feedbackDir}/sync-config.json`, JSON.stringify(config, null, 2));
}

/**
 * Read global patterns file
 */
function readGlobalPatterns(): Array<{ text: string; [key: string]: unknown }> {
  const patternsFile = `${mockHomeDir}/.claude/global-patterns.json`;
  if (!existsSync(patternsFile)) {
    return [];
  }
  const content = JSON.parse(readFileSync(patternsFile, 'utf-8'));
  return content.patterns || [];
}

/**
 * Read global patterns metadata
 */
function readGlobalPatternsFile(): { patterns?: unknown[]; updated?: string; version?: string } {
  const patternsFile = `${mockHomeDir}/.claude/global-patterns.json`;
  if (!existsSync(patternsFile)) {
    return {};
  }
  return JSON.parse(readFileSync(patternsFile, 'utf-8'));
}

beforeEach(() => {
  vi.clearAllMocks();

  // Set environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;

  // Create test directories
  mkdirSync(TEST_PROJECT_DIR, { recursive: true });
  mkdirSync(mockHomeDir, { recursive: true });
});

afterEach(() => {
  // Clean up test directories
  if (existsSync(TEST_PROJECT_DIR)) {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }
  if (existsSync(mockHomeDir)) {
    rmSync(mockHomeDir, { recursive: true, force: true });
  }

  // Clean up environment
  delete process.env.CLAUDE_PROJECT_DIR;
});

// =============================================================================
// Tests
// =============================================================================

describe('pattern-sync-push', () => {
  describe('skip conditions', () => {
    test('skips when sync is disabled in config', () => {
      // Arrange
      createSyncConfig({ sync_enabled: false });
      createProjectPatterns([{ text: 'pattern1' }]);
      const input = createHookInput();

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(readGlobalPatterns()).toHaveLength(0);
    });

    test('skips when no project patterns file exists', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips when project patterns file is empty', () => {
      // Arrange
      createProjectPatterns([]);
      const input = createHookInput();

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('sync enabled by default', () => {
    test('sync is enabled when no config file exists', () => {
      // Arrange
      createProjectPatterns([{ text: 'pattern1' }]);
      const input = createHookInput();

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(readGlobalPatterns()).toHaveLength(1);
    });

    test('sync is enabled when config has sync_enabled: true', () => {
      // Arrange
      createSyncConfig({ sync_enabled: true });
      createProjectPatterns([{ text: 'pattern1' }]);
      const input = createHookInput();

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(readGlobalPatterns()).toHaveLength(1);
    });
  });

  describe('pattern pushing', () => {
    test('pushes new patterns from project to global', () => {
      // Arrange
      createProjectPatterns([
        { text: 'project-pattern-1' },
        { text: 'project-pattern-2' },
      ]);
      const input = createHookInput();

      // Act
      patternSyncPush(input);

      // Assert
      const globalPatterns = readGlobalPatterns();
      expect(globalPatterns).toHaveLength(2);
      expect(globalPatterns[0].text).toBe('project-pattern-1');
      expect(globalPatterns[1].text).toBe('project-pattern-2');
    });

    test('avoids duplicate patterns by text', () => {
      // Arrange
      createGlobalPatterns([{ text: 'existing-pattern' }]);
      createProjectPatterns([
        { text: 'existing-pattern' }, // Duplicate
        { text: 'new-pattern' },
      ]);
      const input = createHookInput();

      // Act
      patternSyncPush(input);

      // Assert
      const globalPatterns = readGlobalPatterns();
      expect(globalPatterns).toHaveLength(2);
      expect(globalPatterns.filter((p) => p.text === 'existing-pattern')).toHaveLength(1);
    });

    test('preserves existing global patterns', () => {
      // Arrange
      createGlobalPatterns([
        { text: 'global-pattern-1', source: 'global' },
        { text: 'global-pattern-2', source: 'global' },
      ]);
      createProjectPatterns([{ text: 'project-pattern' }]);
      const input = createHookInput();

      // Act
      patternSyncPush(input);

      // Assert
      const globalPatterns = readGlobalPatterns();
      expect(globalPatterns).toHaveLength(3);
      expect(globalPatterns[0].source).toBe('global');
      expect(globalPatterns[1].source).toBe('global');
    });

    test('preserves all fields from project patterns', () => {
      // Arrange
      createProjectPatterns([
        {
          text: 'detailed-pattern',
          category: 'api',
          success_count: 10,
          metadata: { project: 'test' },
        },
      ]);
      const input = createHookInput();

      // Act
      patternSyncPush(input);

      // Assert
      const globalPatterns = readGlobalPatterns();
      expect(globalPatterns[0].category).toBe('api');
      expect(globalPatterns[0].success_count).toBe(10);
      expect(globalPatterns[0].metadata).toEqual({ project: 'test' });
    });

    test('does not modify when all patterns already exist', () => {
      // Arrange
      createGlobalPatterns([
        { text: 'pattern-1' },
        { text: 'pattern-2' },
      ]);
      createProjectPatterns([
        { text: 'pattern-1' },
        { text: 'pattern-2' },
      ]);
      const input = createHookInput();

      // Act
      patternSyncPush(input);

      // Assert
      const globalPatterns = readGlobalPatterns();
      expect(globalPatterns).toHaveLength(2);
    });

    test('updates timestamp on global patterns file', () => {
      // Arrange
      const oldTimestamp = '2020-01-01T00:00:00.000Z';
      createGlobalPatterns([{ text: 'existing' }]);
      const globalDir = `${mockHomeDir}/.claude`;
      writeFileSync(
        `${globalDir}/global-patterns.json`,
        JSON.stringify({
          version: '1.0',
          patterns: [{ text: 'existing' }],
          updated: oldTimestamp,
        })
      );
      createProjectPatterns([{ text: 'new-pattern' }]);
      const input = createHookInput();

      // Act
      const beforePush = Date.now();
      patternSyncPush(input);
      const afterPush = Date.now();

      // Assert
      const globalFile = readGlobalPatternsFile();
      const updatedTime = new Date(globalFile.updated || '').getTime();
      expect(updatedTime).toBeGreaterThanOrEqual(beforePush);
      expect(updatedTime).toBeLessThanOrEqual(afterPush);
    });
  });

  describe('error handling', () => {
    test('handles corrupted project patterns JSON', () => {
      // Arrange
      const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
      mkdirSync(feedbackDir, { recursive: true });
      writeFileSync(`${feedbackDir}/learned-patterns.json`, 'not valid json');
      const input = createHookInput();

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles corrupted global patterns JSON', () => {
      // Arrange
      const globalDir = `${mockHomeDir}/.claude`;
      mkdirSync(globalDir, { recursive: true });
      writeFileSync(`${globalDir}/global-patterns.json`, 'not valid json');
      createProjectPatterns([{ text: 'pattern1' }]);
      const input = createHookInput();

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles corrupted sync config JSON', () => {
      // Arrange
      const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
      mkdirSync(feedbackDir, { recursive: true });
      writeFileSync(`${feedbackDir}/sync-config.json`, 'invalid json');
      createProjectPatterns([{ text: 'pattern1' }]);
      const input = createHookInput();

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(result.continue).toBe(true);
      // Default is enabled, so pattern should be pushed
    });

    test('handles non-existent project directory', () => {
      // Arrange
      const input = createHookInput({ project_dir: '/non/existent/path' });

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles undefined project_dir', () => {
      // Arrange
      const input = createHookInput({ project_dir: undefined });

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('creates global .claude directory if it does not exist', () => {
      // Arrange
      createProjectPatterns([{ text: 'pattern1' }]);
      const globalDir = `${mockHomeDir}/.claude`;
      if (existsSync(globalDir)) {
        rmSync(globalDir, { recursive: true });
      }
      const input = createHookInput();

      // Act
      patternSyncPush(input);

      // Assert
      expect(existsSync(globalDir)).toBe(true);
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(result).toHaveProperty('continue');
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('never blocks session end', () => {
      // Arrange
      createProjectPatterns([{ text: 'pattern1' }]);
      const input = createHookInput();

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });

    test.each([
      ['no project patterns', () => {}],
      ['empty project patterns', () => createProjectPatterns([])],
      ['sync disabled', () => {
        createSyncConfig({ sync_enabled: false });
        createProjectPatterns([{ text: 'pattern1' }]);
      }],
      ['successful sync', () => createProjectPatterns([{ text: 'pattern1' }])],
    ])('always returns continue: true for %s', (_, setup) => {
      // Arrange
      setup();
      const input = createHookInput();

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('global patterns file initialization', () => {
    test('creates new global patterns file if none exists', () => {
      // Arrange
      createProjectPatterns([{ text: 'pattern1' }]);
      const globalFile = `${mockHomeDir}/.claude/global-patterns.json`;
      expect(existsSync(globalFile)).toBe(false);
      const input = createHookInput();

      // Act
      patternSyncPush(input);

      // Assert
      expect(existsSync(globalFile)).toBe(true);
      const content = readGlobalPatternsFile();
      expect(content.version).toBe('1.0');
      expect(content.patterns).toHaveLength(1);
      expect(content.updated).toBeDefined();
    });

    test('initializes empty patterns array for new global file', () => {
      // Arrange
      createProjectPatterns([{ text: 'first-pattern' }]);
      const input = createHookInput();

      // Act
      patternSyncPush(input);

      // Assert
      const globalPatterns = readGlobalPatterns();
      expect(globalPatterns).toHaveLength(1);
      expect(globalPatterns[0].text).toBe('first-pattern');
    });
  });

  describe('edge cases', () => {
    test('handles patterns without text field', () => {
      // Arrange
      const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
      mkdirSync(feedbackDir, { recursive: true });
      writeFileSync(
        `${feedbackDir}/learned-patterns.json`,
        JSON.stringify({
          version: '1.0',
          patterns: [{ category: 'test' }, { text: 'valid' }],
        })
      );
      const input = createHookInput();

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles null patterns array in project', () => {
      // Arrange
      const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
      mkdirSync(feedbackDir, { recursive: true });
      writeFileSync(
        `${feedbackDir}/learned-patterns.json`,
        JSON.stringify({ version: '1.0', patterns: null })
      );
      const input = createHookInput();

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles project patterns without patterns field', () => {
      // Arrange
      const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
      mkdirSync(feedbackDir, { recursive: true });
      writeFileSync(
        `${feedbackDir}/learned-patterns.json`,
        JSON.stringify({ version: '1.0' })
      );
      const input = createHookInput();

      // Act
      const result = patternSyncPush(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles patterns with empty text', () => {
      // Arrange
      createProjectPatterns([{ text: '' }, { text: 'valid' }]);
      const input = createHookInput();

      // Act
      patternSyncPush(input);

      // Assert
      const globalPatterns = readGlobalPatterns();
      // Both patterns should be pushed (empty text is still valid)
      expect(globalPatterns.length).toBeGreaterThanOrEqual(1);
    });

    test('handles rapid consecutive calls', () => {
      // Arrange
      createProjectPatterns([{ text: 'pattern1' }]);
      const input = createHookInput();

      // Act
      const results = [
        patternSyncPush(input),
        patternSyncPush(input),
        patternSyncPush(input),
      ];

      // Assert
      results.forEach((result) => {
        expect(result.continue).toBe(true);
      });
    });

    test('handles special characters in pattern text', () => {
      // Arrange
      createProjectPatterns([
        { text: 'Pattern with "quotes"' },
        { text: "Pattern with 'apostrophe'" },
        { text: 'Pattern with\nnewline' },
        { text: 'Pattern with\ttab' },
        { text: 'Pattern with unicode: ' },
      ]);
      const input = createHookInput();

      // Act
      patternSyncPush(input);

      // Assert
      const globalPatterns = readGlobalPatterns();
      expect(globalPatterns).toHaveLength(5);
    });

    test('handles very long pattern text', () => {
      // Arrange
      const longText = 'x'.repeat(10000);
      createProjectPatterns([{ text: longText }]);
      const input = createHookInput();

      // Act
      patternSyncPush(input);

      // Assert
      const globalPatterns = readGlobalPatterns();
      expect(globalPatterns[0].text).toBe(longText);
    });

    test('handles many patterns', () => {
      // Arrange
      const patterns = Array.from({ length: 100 }, (_, i) => ({
        text: `pattern-${i}`,
        index: i,
      }));
      createProjectPatterns(patterns);
      const input = createHookInput();

      // Act
      patternSyncPush(input);

      // Assert
      const globalPatterns = readGlobalPatterns();
      expect(globalPatterns).toHaveLength(100);
    });
  });

  describe('merge behavior', () => {
    test('appends new patterns to end of global list', () => {
      // Arrange
      createGlobalPatterns([{ text: 'global-1' }, { text: 'global-2' }]);
      createProjectPatterns([{ text: 'project-1' }]);
      const input = createHookInput();

      // Act
      patternSyncPush(input);

      // Assert
      const globalPatterns = readGlobalPatterns();
      expect(globalPatterns[0].text).toBe('global-1');
      expect(globalPatterns[1].text).toBe('global-2');
      expect(globalPatterns[2].text).toBe('project-1');
    });

    test('case-sensitive duplicate detection', () => {
      // Arrange
      createGlobalPatterns([{ text: 'Pattern' }]);
      createProjectPatterns([{ text: 'pattern' }]); // Different case
      const input = createHookInput();

      // Act
      patternSyncPush(input);

      // Assert
      const globalPatterns = readGlobalPatterns();
      // Both should exist since they differ in case
      expect(globalPatterns).toHaveLength(2);
    });
  });
});

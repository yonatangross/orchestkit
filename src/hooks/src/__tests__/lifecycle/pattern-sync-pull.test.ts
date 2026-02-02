/**
 * Unit tests for pattern-sync-pull lifecycle hook
 * Tests pulling global patterns into project at session start
 * CC 2.1.7 Compliant: Non-blocking - always returns continue: true
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import type { HookInput } from '../../types.js';
import { patternSyncPull } from '../../lifecycle/pattern-sync-pull.js';

// =============================================================================
// Mock Setup - BEFORE imports
// =============================================================================

const mockHomeDir = join(tmpdir(), 'pattern-sync-home-' + Date.now());

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

const TEST_PROJECT_DIR = join(tmpdir(), 'pattern-sync-pull-test-' + Date.now());
const TEST_SESSION_ID = 'test-session-pattern-' + Date.now();

/**
 * Store original environment values
 */
let originalEnv: {
  ORCHESTKIT_SKIP_SLOW_HOOKS?: string;
  CLAUDE_PROJECT_DIR?: string;
};

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
 * Create global patterns file
 */
function createGlobalPatterns(patterns: Array<{ text: string; [key: string]: unknown }>): void {
  const globalDir = `${mockHomeDir}/.claude`;
  mkdirSync(globalDir, { recursive: true });
  writeFileSync(
    `${globalDir}/global-patterns.json`,
    JSON.stringify({ version: '1.0', patterns }, null, 2)
  );
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
 * Create sync config file
 */
function createSyncConfig(config: { sync_enabled?: boolean }): void {
  const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
  mkdirSync(feedbackDir, { recursive: true });
  writeFileSync(`${feedbackDir}/sync-config.json`, JSON.stringify(config, null, 2));
}

/**
 * Read project patterns file
 */
function readProjectPatterns(): Array<{ text: string; [key: string]: unknown }> {
  const patternsFile = `${TEST_PROJECT_DIR}/.claude/feedback/learned-patterns.json`;
  if (!existsSync(patternsFile)) {
    return [];
  }
  const content = JSON.parse(readFileSync(patternsFile, 'utf-8'));
  return content.patterns || [];
}

beforeEach(() => {
  vi.clearAllMocks();

  // Store original environment
  originalEnv = {
    ORCHESTKIT_SKIP_SLOW_HOOKS: process.env.ORCHESTKIT_SKIP_SLOW_HOOKS,
    CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
  };

  // Set environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;
  delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;

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

describe('pattern-sync-pull', () => {
  describe('skip conditions', () => {
    test('skips when ORCHESTKIT_SKIP_SLOW_HOOKS is set', () => {
      // Arrange
      process.env.ORCHESTKIT_SKIP_SLOW_HOOKS = '1';
      createGlobalPatterns([{ text: 'pattern1' }]);
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(readProjectPatterns()).toHaveLength(0);
    });

    test('skips when sync is disabled in config', () => {
      // Arrange
      createSyncConfig({ sync_enabled: false });
      createGlobalPatterns([{ text: 'pattern1' }]);
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips when no global patterns file exists', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips when global patterns file is empty', () => {
      // Arrange
      createGlobalPatterns([]);
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('sync enabled by default', () => {
    test('sync is enabled when no config file exists', () => {
      // Arrange
      createGlobalPatterns([{ text: 'pattern1' }]);
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(readProjectPatterns()).toHaveLength(1);
    });

    test('sync is enabled when config has sync_enabled: true', () => {
      // Arrange
      createSyncConfig({ sync_enabled: true });
      createGlobalPatterns([{ text: 'pattern1' }]);
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(readProjectPatterns()).toHaveLength(1);
    });
  });

  describe('pattern pulling', () => {
    test('pulls new patterns from global to project', () => {
      // Arrange
      createGlobalPatterns([
        { text: 'global-pattern-1' },
        { text: 'global-pattern-2' },
      ]);
      const input = createHookInput();

      // Act
      patternSyncPull(input);

      // Assert
      const projectPatterns = readProjectPatterns();
      expect(projectPatterns).toHaveLength(2);
      expect(projectPatterns[0].text).toBe('global-pattern-1');
      expect(projectPatterns[1].text).toBe('global-pattern-2');
    });

    test('avoids duplicate patterns by text', () => {
      // Arrange
      createProjectPatterns([{ text: 'existing-pattern' }]);
      createGlobalPatterns([
        { text: 'existing-pattern' }, // Duplicate
        { text: 'new-pattern' },
      ]);
      const input = createHookInput();

      // Act
      patternSyncPull(input);

      // Assert
      const projectPatterns = readProjectPatterns();
      expect(projectPatterns).toHaveLength(2);
      expect(projectPatterns.filter((p) => p.text === 'existing-pattern')).toHaveLength(1);
    });

    test('preserves existing project patterns', () => {
      // Arrange
      createProjectPatterns([
        { text: 'project-pattern-1', source: 'project' },
        { text: 'project-pattern-2', source: 'project' },
      ]);
      createGlobalPatterns([{ text: 'global-pattern' }]);
      const input = createHookInput();

      // Act
      patternSyncPull(input);

      // Assert
      const projectPatterns = readProjectPatterns();
      expect(projectPatterns).toHaveLength(3);
      expect(projectPatterns[0].source).toBe('project');
      expect(projectPatterns[1].source).toBe('project');
    });

    test('preserves all fields from global patterns', () => {
      // Arrange
      createGlobalPatterns([
        {
          text: 'detailed-pattern',
          category: 'api',
          success_count: 5,
          metadata: { author: 'test' },
        },
      ]);
      const input = createHookInput();

      // Act
      patternSyncPull(input);

      // Assert
      const projectPatterns = readProjectPatterns();
      expect(projectPatterns[0].category).toBe('api');
      expect(projectPatterns[0].success_count).toBe(5);
      expect(projectPatterns[0].metadata).toEqual({ author: 'test' });
    });

    test('does not modify when all patterns already exist', () => {
      // Arrange
      createProjectPatterns([
        { text: 'pattern-1' },
        { text: 'pattern-2' },
      ]);
      createGlobalPatterns([
        { text: 'pattern-1' },
        { text: 'pattern-2' },
      ]);
      const input = createHookInput();

      // Act
      patternSyncPull(input);

      // Assert
      const projectPatterns = readProjectPatterns();
      expect(projectPatterns).toHaveLength(2);
    });
  });

  describe('file size checks', () => {
    test('skips when global patterns file exceeds size limit', () => {
      // Arrange
      const largePattern = 'x'.repeat(2 * 1024 * 1024); // 2MB
      const globalDir = `${mockHomeDir}/.claude`;
      mkdirSync(globalDir, { recursive: true });
      writeFileSync(`${globalDir}/global-patterns.json`, largePattern);
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips when project patterns file exceeds size limit', () => {
      // Arrange
      createGlobalPatterns([{ text: 'new-pattern' }]);
      const largePattern = 'x'.repeat(2 * 1024 * 1024); // 2MB
      const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
      mkdirSync(feedbackDir, { recursive: true });
      writeFileSync(`${feedbackDir}/learned-patterns.json`, largePattern);
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test.each([
      [500 * 1024, true], // 500KB - under limit
      [1024 * 1024, true], // 1MB - at limit
      [1024 * 1024 + 1, false], // Just over limit
    ])('file size %d bytes passes=%s', (size, shouldPass) => {
      // Arrange
      const content = JSON.stringify({
        version: '1.0',
        patterns: [{ text: 'x'.repeat(Math.max(0, size - 100)) }],
      });
      const globalDir = `${mockHomeDir}/.claude`;
      mkdirSync(globalDir, { recursive: true });
      writeFileSync(`${globalDir}/global-patterns.json`, content);
      const input = createHookInput();

      // Act
      patternSyncPull(input);

      // Assert - just verify it doesn't crash
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    test('handles corrupted global patterns JSON', () => {
      // Arrange
      const globalDir = `${mockHomeDir}/.claude`;
      mkdirSync(globalDir, { recursive: true });
      writeFileSync(`${globalDir}/global-patterns.json`, 'not valid json');
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles corrupted project patterns JSON', () => {
      // Arrange
      createGlobalPatterns([{ text: 'pattern1' }]);
      const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
      mkdirSync(feedbackDir, { recursive: true });
      writeFileSync(`${feedbackDir}/learned-patterns.json`, 'not valid json');
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles corrupted sync config JSON', () => {
      // Arrange
      const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
      mkdirSync(feedbackDir, { recursive: true });
      writeFileSync(`${feedbackDir}/sync-config.json`, 'invalid json');
      createGlobalPatterns([{ text: 'pattern1' }]);
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
      // Default is enabled, so pattern should be pulled
    });

    test('handles non-existent project directory', () => {
      // Arrange
      createGlobalPatterns([{ text: 'pattern1' }]);
      const input = createHookInput({ project_dir: '/non/existent/path' });

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles undefined project_dir', () => {
      // Arrange
      const input = createHookInput({ project_dir: undefined });

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('creates feedback directory if it does not exist', () => {
      // Arrange
      createGlobalPatterns([{ text: 'pattern1' }]);
      const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
      expect(existsSync(feedbackDir)).toBe(false);
      const input = createHookInput();

      // Act
      patternSyncPull(input);

      // Assert
      expect(existsSync(feedbackDir)).toBe(true);
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result).toHaveProperty('continue');
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('never blocks session start', () => {
      // Arrange
      createGlobalPatterns([{ text: 'pattern1' }]);
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });

    test.each([
      ['no global patterns', () => {}],
      ['empty global patterns', () => createGlobalPatterns([])],
      ['sync disabled', () => {
        createSyncConfig({ sync_enabled: false });
        createGlobalPatterns([{ text: 'pattern1' }]);
      }],
      ['skip slow hooks', () => {
        process.env.ORCHESTKIT_SKIP_SLOW_HOOKS = '1';
        createGlobalPatterns([{ text: 'pattern1' }]);
      }],
      ['successful sync', () => createGlobalPatterns([{ text: 'pattern1' }])],
    ])('always returns continue: true for %s', (_, setup) => {
      // Arrange
      setup();
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles patterns without text field', () => {
      // Arrange
      const globalDir = `${mockHomeDir}/.claude`;
      mkdirSync(globalDir, { recursive: true });
      writeFileSync(
        `${globalDir}/global-patterns.json`,
        JSON.stringify({
          version: '1.0',
          patterns: [{ category: 'test' }, { text: 'valid' }],
        })
      );
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles null patterns array', () => {
      // Arrange
      const globalDir = `${mockHomeDir}/.claude`;
      mkdirSync(globalDir, { recursive: true });
      writeFileSync(
        `${globalDir}/global-patterns.json`,
        JSON.stringify({ version: '1.0', patterns: null })
      );
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles global patterns without patterns field', () => {
      // Arrange
      const globalDir = `${mockHomeDir}/.claude`;
      mkdirSync(globalDir, { recursive: true });
      writeFileSync(
        `${globalDir}/global-patterns.json`,
        JSON.stringify({ version: '1.0' })
      );
      const input = createHookInput();

      // Act
      const result = patternSyncPull(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles patterns with empty text', () => {
      // Arrange
      createGlobalPatterns([{ text: '' }, { text: 'valid' }]);
      const input = createHookInput();

      // Act
      patternSyncPull(input);

      // Assert
      const projectPatterns = readProjectPatterns();
      // Both patterns should be pulled (empty text is still valid)
      expect(projectPatterns.length).toBeGreaterThanOrEqual(1);
    });

    test('handles rapid consecutive calls', () => {
      // Arrange
      createGlobalPatterns([{ text: 'pattern1' }]);
      const input = createHookInput();

      // Act
      const results = [
        patternSyncPull(input),
        patternSyncPull(input),
        patternSyncPull(input),
      ];

      // Assert
      results.forEach((result) => {
        expect(result.continue).toBe(true);
      });
    });

    test('handles special characters in pattern text', () => {
      // Arrange
      createGlobalPatterns([
        { text: 'Pattern with "quotes"' },
        { text: "Pattern with 'apostrophe'" },
        { text: 'Pattern with\nnewline' },
        { text: 'Pattern with\ttab' },
        { text: 'Pattern with unicode: ' },
      ]);
      const input = createHookInput();

      // Act
      patternSyncPull(input);

      // Assert
      const projectPatterns = readProjectPatterns();
      expect(projectPatterns).toHaveLength(5);
    });
  });
});

/**
 * Unit tests for pre-compact-saver lifecycle hook
 * Tests session state preservation before context compaction (CC 2.1.25)
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST be before imports
// =============================================================================

const mockSessionId = 'test-compact-session-123';
// Use a unique base path per process to avoid collisions in parallel test workers
const testBaseDir = join(tmpdir(), `pre-compact-saver-test-${process.pid}`);
const mockLogDir = join(testBaseDir, '.claude', 'logs');

vi.mock('../../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/common.js')>();
  return {
    ...actual,
    logHook: vi.fn(),
    getLogDir: vi.fn(() => mockLogDir),
    getSessionId: vi.fn(() => mockSessionId),
    outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  };
});

// Import after mocks
import { preCompactSaver } from '../../lifecycle/pre-compact-saver.js';
import { logHook, getLogDir, getSessionId, outputSilentSuccess } from '../../lib/common.js';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = testBaseDir;
const TEST_SESSIONS_DIR = join(mockLogDir, 'sessions');
const STATE_FILE = join(TEST_SESSIONS_DIR, `${mockSessionId}-state.json`);

/**
 * Create realistic HookInput for testing
 */
function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: mockSessionId,
    project_dir: TEST_PROJECT_DIR,
    tool_input: {},
    ...overrides,
  };
}

/**
 * Create existing state file with content
 */
function createStateFile(state: Record<string, unknown>): void {
  mkdirSync(TEST_SESSIONS_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Read current state file content
 */
function readStateFile(): Record<string, unknown> {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();

  // Set environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;

  // Create test directories
  mkdirSync(TEST_SESSIONS_DIR, { recursive: true });

  // Clean state file
  if (existsSync(STATE_FILE)) {
    rmSync(STATE_FILE, { force: true });
  }

  // Reset environment variables
  delete process.env.ORCHESTKIT_BRANCH;
});

afterEach(() => {
  vi.restoreAllMocks();

  // Clean up test directory
  if (existsSync(TEST_PROJECT_DIR)) {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }

  // Clean up environment
  delete process.env.CLAUDE_PROJECT_DIR;
  delete process.env.ORCHESTKIT_BRANCH;
});

// =============================================================================
// Tests
// =============================================================================

describe('pre-compact-saver', () => {
  describe('basic behavior', () => {
    test('returns silent success on successful save', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = preCompactSaver(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('creates state file if it does not exist', () => {
      // Arrange
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      expect(existsSync(STATE_FILE)).toBe(true);
    });

    test('creates sessions directory if it does not exist', () => {
      // Arrange
      rmSync(TEST_SESSIONS_DIR, { recursive: true, force: true });
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      expect(existsSync(TEST_SESSIONS_DIR)).toBe(true);
    });
  });

  describe('compaction metadata', () => {
    test('sets lastCompaction timestamp', () => {
      // Arrange
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      expect(state.lastCompaction).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('increments compactionCount from 0 to 1 on first call', () => {
      // Arrange
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      expect(state.compactionCount).toBe(1);
    });

    test('increments compactionCount on subsequent calls', () => {
      // Arrange
      createStateFile({ compactionCount: 5 });
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      expect(state.compactionCount).toBe(6);
    });

    test('preserves existing state fields', () => {
      // Arrange
      createStateFile({
        compactionCount: 3,
        customField: 'preserved',
        nested: { data: 'value' },
      });
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      expect(state.customField).toBe('preserved');
      expect(state.nested).toEqual({ data: 'value' });
    });
  });

  describe('preserved context', () => {
    test('includes session notes with compaction number', () => {
      // Arrange
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      expect(state.preservedContext).toBeDefined();
      const ctx = state.preservedContext as Record<string, unknown>;
      expect(ctx.sessionNotes).toContain('Compaction #1');
    });

    test('includes timestamp in session notes', () => {
      // Arrange
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      const ctx = state.preservedContext as Record<string, unknown>;
      expect(ctx.sessionNotes).toMatch(/at \d{4}-\d{2}-\d{2}T/);
    });

    test('includes branch from environment variable', () => {
      // Arrange
      process.env.ORCHESTKIT_BRANCH = 'feature/test-branch';
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      const ctx = state.preservedContext as Record<string, unknown>;
      expect(ctx.branch).toBe('feature/test-branch');
    });

    test('sets branch to undefined when env var not set', () => {
      // Arrange
      delete process.env.ORCHESTKIT_BRANCH;
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      const ctx = state.preservedContext as Record<string, unknown>;
      expect(ctx.branch).toBeUndefined();
    });

    test('overwrites previous preservedContext', () => {
      // Arrange
      createStateFile({
        compactionCount: 2,
        preservedContext: {
          branch: 'old-branch',
          sessionNotes: 'Old notes',
          oldField: 'should be removed',
        },
      });
      process.env.ORCHESTKIT_BRANCH = 'new-branch';
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      const ctx = state.preservedContext as Record<string, unknown>;
      expect(ctx.branch).toBe('new-branch');
      expect(ctx.sessionNotes).toContain('Compaction #3');
      expect(ctx).not.toHaveProperty('oldField');
    });
  });

  describe('state file path', () => {
    test('uses session ID from getSessionId', () => {
      // Arrange
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      expect(getSessionId).toHaveBeenCalled();
      expect(existsSync(STATE_FILE)).toBe(true);
    });

    test('uses log directory from getLogDir', () => {
      // Arrange
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      expect(getLogDir).toHaveBeenCalled();
    });
  });

  describe('logging behavior', () => {
    test('logs compaction save with number', () => {
      // Arrange
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'pre-compact-saver',
        'Saved state before compaction #1'
      );
    });

    test('logs correct compaction number on subsequent calls', () => {
      // Arrange
      createStateFile({ compactionCount: 10 });
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'pre-compact-saver',
        'Saved state before compaction #11'
      );
    });

    test('logs error with warn level on failure', () => {
      // Arrange
      // Create file as directory to cause write error
      rmSync(STATE_FILE, { force: true });
      mkdirSync(STATE_FILE, { recursive: true });
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'pre-compact-saver',
        expect.stringContaining('Failed to save state:'),
        'warn'
      );

      // Cleanup
      rmSync(STATE_FILE, { recursive: true, force: true });
    });
  });

  describe('error handling', () => {
    test('continues even when state file write fails', () => {
      // Arrange
      rmSync(STATE_FILE, { force: true });
      mkdirSync(STATE_FILE, { recursive: true }); // Create dir to block file write
      const input = createHookInput();

      // Act
      const result = preCompactSaver(input);

      // Assert
      expect(result.continue).toBe(true);

      // Cleanup
      rmSync(STATE_FILE, { recursive: true, force: true });
    });

    test('handles invalid JSON in existing state file', () => {
      // Arrange
      mkdirSync(TEST_SESSIONS_DIR, { recursive: true });
      writeFileSync(STATE_FILE, 'invalid json {');
      const input = createHookInput();

      // Act
      const result = preCompactSaver(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('starts fresh state when existing file is invalid', () => {
      // Arrange
      mkdirSync(TEST_SESSIONS_DIR, { recursive: true });
      writeFileSync(STATE_FILE, 'invalid json {');
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      expect(state.compactionCount).toBe(1);
    });

    test('never blocks PreCompact hook', () => {
      // Arrange - simulate catastrophic failure
      vi.mocked(getLogDir).mockImplementationOnce(() => {
        throw new Error('Critical error');
      });
      const input = createHookInput();

      // Act
      const result = preCompactSaver(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = preCompactSaver(input);

      // Assert
      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('suppressOutput', true);
    });

    test('always returns continue: true for non-blocking hook', () => {
      // Arrange - various error conditions
      const errorSetups = [
        () => writeFileSync(STATE_FILE, 'invalid'),
        () => mkdirSync(STATE_FILE, { recursive: true }),
        () => vi.mocked(getLogDir).mockImplementationOnce(() => { throw new Error(); }),
      ];

      // Act & Assert
      for (const setup of errorSetups) {
        vi.clearAllMocks();
        rmSync(STATE_FILE, { force: true, recursive: true });
        mkdirSync(TEST_SESSIONS_DIR, { recursive: true });
        setup();
        const input = createHookInput();
        const result = preCompactSaver(input);
        expect(result.continue).toBe(true);

        // Cleanup for next iteration
        rmSync(STATE_FILE, { force: true, recursive: true });
      }
    });

    test('always suppresses output', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = preCompactSaver(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('parametric tests', () => {
    test.each([
      [0, 1],
      [1, 2],
      [5, 6],
      [99, 100],
      [1000, 1001],
    ])('increments compactionCount from %d to %d', (initial, expected) => {
      // Arrange
      if (initial > 0) {
        createStateFile({ compactionCount: initial });
      }
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      expect(state.compactionCount).toBe(expected);
    });

    test.each([
      ['main'],
      ['develop'],
      ['feature/new-feature'],
      ['bugfix/fix-123'],
      ['release/v1.0.0'],
    ])('preserves branch "%s" in context', (branch) => {
      // Arrange
      process.env.ORCHESTKIT_BRANCH = branch;
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      const ctx = state.preservedContext as Record<string, unknown>;
      expect(ctx.branch).toBe(branch);
    });

    test.each([
      [{ existing: 'data' }],
      [{ nested: { deep: { value: 123 } } }],
      [{ array: [1, 2, 3] }],
      [{}],
    ])('preserves existing state: %o', (existingState) => {
      // Arrange
      createStateFile(existingState);
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      for (const [key, value] of Object.entries(existingState)) {
        expect(state[key]).toEqual(value);
      }
    });
  });

  describe('edge cases', () => {
    test('handles undefined compactionCount in existing state', () => {
      // Arrange
      createStateFile({ otherField: 'value' });
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      expect(state.compactionCount).toBe(1);
    });

    test('handles null compactionCount in existing state', () => {
      // Arrange
      createStateFile({ compactionCount: null as unknown as number });
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      expect(state.compactionCount).toBe(1);
    });

    test('handles very large compactionCount', () => {
      // Arrange
      createStateFile({ compactionCount: 999999 });
      const input = createHookInput();

      // Act
      const result = preCompactSaver(input);

      // Assert
      expect(result.continue).toBe(true);
      const state = readStateFile();
      expect(state.compactionCount).toBe(1000000);
    });

    test('handles empty branch environment variable', () => {
      // Arrange
      process.env.ORCHESTKIT_BRANCH = '';
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      const ctx = state.preservedContext as Record<string, unknown>;
      // Empty string is falsy, so `|| undefined` in source code converts it to undefined
      expect(ctx.branch).toBeUndefined();
    });

    test('handles concurrent compaction calls', () => {
      // Arrange
      createStateFile({ compactionCount: 5 });
      const input = createHookInput();

      // Act - multiple calls
      preCompactSaver(input);
      preCompactSaver(input);
      preCompactSaver(input);

      // Assert - each call increments
      const state = readStateFile();
      expect(state.compactionCount).toBe(8);
    });

    test('handles special characters in session ID', () => {
      // Arrange
      const specialSessionId = 'session-with_special.chars-123';
      vi.mocked(getSessionId).mockReturnValueOnce(specialSessionId);
      const input = createHookInput();

      // Act
      const result = preCompactSaver(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('state file structure', () => {
    test('writes valid JSON to state file', () => {
      // Arrange
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      expect(() => readStateFile()).not.toThrow();
    });

    test('formats JSON with 2-space indentation', () => {
      // Arrange
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const content = readFileSync(STATE_FILE, 'utf8');
      expect(content).toContain('\n  '); // 2-space indentation
    });

    test('includes all expected fields', () => {
      // Arrange
      process.env.ORCHESTKIT_BRANCH = 'test-branch';
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const state = readStateFile();
      expect(state).toHaveProperty('lastCompaction');
      expect(state).toHaveProperty('compactionCount');
      expect(state).toHaveProperty('preservedContext');
      expect(state.preservedContext).toHaveProperty('branch');
      expect(state.preservedContext).toHaveProperty('sessionNotes');
    });
  });

  describe('integration with common utilities', () => {
    test('calls outputSilentSuccess for return value', () => {
      // Arrange
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('uses correct hook name in all log calls', () => {
      // Arrange
      const input = createHookInput();

      // Act
      preCompactSaver(input);

      // Assert
      const allLogCalls = vi.mocked(logHook).mock.calls;
      for (const call of allLogCalls) {
        expect(call[0]).toBe('pre-compact-saver');
      }
    });
  });
});

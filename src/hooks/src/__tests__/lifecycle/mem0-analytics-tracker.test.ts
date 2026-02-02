/**
 * Unit tests for mem0-analytics-tracker lifecycle hook
 * Tests tracking of mem0 usage patterns and session analytics
 * CC 2.1.7 Compliant: Non-blocking hook that always returns continue: true
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { HookInput } from '../../types.js';
import { mem0AnalyticsTracker } from '../../lifecycle/mem0-analytics-tracker.js';

// =============================================================================
// Test Setup
// =============================================================================

// Use per-test unique directories to avoid cross-test contamination
let TEST_PROJECT_DIR: string;
let TEST_SESSION_ID: string;

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
 * Read analytics log file content
 */
function readAnalyticsLog(): string | null {
  const analyticsFile = `${TEST_PROJECT_DIR}/.claude/logs/mem0-analytics.jsonl`;
  if (!existsSync(analyticsFile)) {
    return null;
  }
  return readFileSync(analyticsFile, 'utf-8');
}

/**
 * Parse JSONL analytics entries
 */
function parseAnalyticsEntries(): Array<{
  session_id: string;
  timestamp: string;
  event: string;
  mem0_available: boolean;
}> {
  const content = readAnalyticsLog();
  if (!content) return [];

  return content
    .trim()
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/**
 * Store original environment values
 */
let originalEnv: {
  MEM0_API_KEY?: string;
  CLAUDE_PROJECT_DIR?: string;
  CLAUDE_SESSION_ID?: string;
};

beforeEach(() => {
  // Generate unique paths per test to prevent cross-test contamination
  const unique = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  TEST_PROJECT_DIR = join(tmpdir(), `mem0-analytics-tracker-test-${unique}`);
  TEST_SESSION_ID = `test-session-analytics-${unique}`;

  // Store original environment
  originalEnv = {
    MEM0_API_KEY: process.env.MEM0_API_KEY,
    CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
    CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID,
  };

  // Set up test environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;
  process.env.CLAUDE_SESSION_ID = TEST_SESSION_ID;

  // Create test directory
  mkdirSync(TEST_PROJECT_DIR, { recursive: true });

  // Clear any mocks
  vi.clearAllMocks();
});

afterEach(() => {
  // Clean up test directory
  if (existsSync(TEST_PROJECT_DIR)) {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }

  // Restore original environment
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }

  vi.restoreAllMocks();
});

// =============================================================================
// Tests
// =============================================================================

describe('mem0-analytics-tracker', () => {
  describe('basic behavior', () => {
    test('returns silent success on successful tracking', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = mem0AnalyticsTracker(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('creates analytics log file when it does not exist', () => {
      // Arrange
      const input = createHookInput();

      // Act
      mem0AnalyticsTracker(input);

      // Assert
      const analyticsFile = `${TEST_PROJECT_DIR}/.claude/logs/mem0-analytics.jsonl`;
      expect(existsSync(analyticsFile)).toBe(true);
    });

    test('creates logs directory if it does not exist', () => {
      // Arrange
      const input = createHookInput();

      // Act
      mem0AnalyticsTracker(input);

      // Assert
      const logsDir = `${TEST_PROJECT_DIR}/.claude/logs`;
      expect(existsSync(logsDir)).toBe(true);
    });
  });

  describe('analytics entry structure', () => {
    test('writes session_id to analytics entry', () => {
      // Arrange
      const input = createHookInput({ session_id: 'specific-session-id-123' });

      // Act
      mem0AnalyticsTracker(input);

      // Assert
      const entries = parseAnalyticsEntries();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[entries.length - 1].session_id).toBe('specific-session-id-123');
    });

    test('writes timestamp to analytics entry', () => {
      // Arrange
      const input = createHookInput();
      const beforeTime = new Date().toISOString();

      // Act
      mem0AnalyticsTracker(input);

      // Assert
      const afterTime = new Date().toISOString();
      const entries = parseAnalyticsEntries();
      expect(entries.length).toBeGreaterThan(0);
      const entryTimestamp = entries[entries.length - 1].timestamp;
      expect(entryTimestamp >= beforeTime).toBe(true);
      expect(entryTimestamp <= afterTime).toBe(true);
    });

    test('writes event type as session_start', () => {
      // Arrange
      const input = createHookInput();

      // Act
      mem0AnalyticsTracker(input);

      // Assert
      const entries = parseAnalyticsEntries();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[entries.length - 1].event).toBe('session_start');
    });

    test('writes valid JSON lines format', () => {
      // Arrange
      const input = createHookInput();

      // Act
      mem0AnalyticsTracker(input);
      mem0AnalyticsTracker(input); // Second call to test multi-line

      // Assert
      const content = readAnalyticsLog();
      expect(content).toBeTruthy();
      const lines = content!.trim().split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(2);
      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });
  });

  describe('mem0 availability detection', () => {
    test('tracks mem0_available as true when MEM0_API_KEY is set', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key-12345';
      const input = createHookInput();

      // Act
      mem0AnalyticsTracker(input);

      // Assert
      const entries = parseAnalyticsEntries();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[entries.length - 1].mem0_available).toBe(true);
    });

    test('tracks mem0_available as false when MEM0_API_KEY is not set', () => {
      // Arrange
      delete process.env.MEM0_API_KEY;
      const input = createHookInput();

      // Act
      mem0AnalyticsTracker(input);

      // Assert
      const entries = parseAnalyticsEntries();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[entries.length - 1].mem0_available).toBe(false);
    });

    test('tracks mem0_available as false when MEM0_API_KEY is empty string', () => {
      // Arrange
      process.env.MEM0_API_KEY = '';
      const input = createHookInput();

      // Act
      mem0AnalyticsTracker(input);

      // Assert
      const entries = parseAnalyticsEntries();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[entries.length - 1].mem0_available).toBe(false);
    });

    test.each([
      ['valid-key-123', true],
      ['m0_abc123', true],
      ['', false],
      [undefined, false],
    ])('with MEM0_API_KEY=%s, mem0_available should be %s', (apiKey, expected) => {
      // Arrange
      if (apiKey !== undefined) {
        process.env.MEM0_API_KEY = apiKey;
      } else {
        delete process.env.MEM0_API_KEY;
      }
      const input = createHookInput();

      // Act
      mem0AnalyticsTracker(input);

      // Assert
      const entries = parseAnalyticsEntries();
      expect(entries[entries.length - 1].mem0_available).toBe(expected);
    });
  });

  describe('fallback handling', () => {
    test('uses input.project_dir when provided', () => {
      // Arrange
      const customDir = join(tmpdir(), 'custom-analytics-test-' + Date.now());
      mkdirSync(customDir, { recursive: true });
      const input = createHookInput({ project_dir: customDir });

      // Act
      mem0AnalyticsTracker(input);

      // Assert
      const analyticsFile = `${customDir}/.claude/logs/mem0-analytics.jsonl`;
      expect(existsSync(analyticsFile)).toBe(true);

      // Cleanup
      rmSync(customDir, { recursive: true, force: true });
    });

    test('uses CLAUDE_PROJECT_DIR when input.project_dir is undefined', () => {
      // Arrange
      const envDir = join(tmpdir(), 'env-analytics-test-' + Date.now());
      mkdirSync(envDir, { recursive: true });
      process.env.CLAUDE_PROJECT_DIR = envDir;
      const input = createHookInput({ project_dir: undefined });

      // Act
      mem0AnalyticsTracker(input);

      // Assert
      const analyticsFile = `${envDir}/.claude/logs/mem0-analytics.jsonl`;
      expect(existsSync(analyticsFile)).toBe(true);

      // Cleanup
      rmSync(envDir, { recursive: true, force: true });
    });

    test('uses input.session_id when provided', () => {
      // Arrange
      const customSessionId = 'custom-session-' + Date.now();
      const input = createHookInput({ session_id: customSessionId });

      // Act
      mem0AnalyticsTracker(input);

      // Assert
      const entries = parseAnalyticsEntries();
      expect(entries[entries.length - 1].session_id).toBe(customSessionId);
    });

    test('generates session_id when input.session_id is undefined', () => {
      // Arrange
      const input = createHookInput({ session_id: undefined as unknown as string });

      // Act
      mem0AnalyticsTracker(input);

      // Assert
      const entries = parseAnalyticsEntries();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[entries.length - 1].session_id).toBeTruthy();
    });
  });

  describe('appending behavior', () => {
    test('appends to existing analytics file', () => {
      // Arrange
      const logsDir = `${TEST_PROJECT_DIR}/.claude/logs`;
      mkdirSync(logsDir, { recursive: true });
      const analyticsFile = `${logsDir}/mem0-analytics.jsonl`;
      const existingEntry = JSON.stringify({
        session_id: 'previous-session',
        timestamp: new Date().toISOString(),
        event: 'session_start',
        mem0_available: false,
      });
      writeFileSync(analyticsFile, existingEntry + '\n');
      const input = createHookInput();

      // Act
      mem0AnalyticsTracker(input);

      // Assert
      const entries = parseAnalyticsEntries();
      expect(entries.length).toBe(2);
      expect(entries[0].session_id).toBe('previous-session');
      expect(entries[1].session_id).toBe(TEST_SESSION_ID);
    });

    test('handles concurrent writes gracefully', async () => {
      // Arrange
      const input1 = createHookInput({ session_id: 'concurrent-1' });
      const input2 = createHookInput({ session_id: 'concurrent-2' });
      const input3 = createHookInput({ session_id: 'concurrent-3' });

      // Act - simulate concurrent calls
      mem0AnalyticsTracker(input1);
      mem0AnalyticsTracker(input2);
      mem0AnalyticsTracker(input3);

      // Assert
      const entries = parseAnalyticsEntries();
      expect(entries.length).toBe(3);
      const sessionIds = entries.map((e) => e.session_id);
      expect(sessionIds).toContain('concurrent-1');
      expect(sessionIds).toContain('concurrent-2');
      expect(sessionIds).toContain('concurrent-3');
    });
  });

  describe('error handling', () => {
    test('returns silent success when write fails', () => {
      // Arrange - use a path that should fail
      const input = createHookInput({ project_dir: '/invalid/readonly/path' });

      // Act
      const result = mem0AnalyticsTracker(input);

      // Assert - should still return success (graceful degradation)
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles non-existent project directory gracefully', () => {
      // Arrange
      const input = createHookInput({ project_dir: '/non/existent/path/deep/nested' });

      // Act
      const result = mem0AnalyticsTracker(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles empty input gracefully', () => {
      // Arrange
      const input: HookInput = {
        tool_name: '',
        session_id: '',
        tool_input: {},
      };

      // Act
      const result = mem0AnalyticsTracker(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('never throws an exception', () => {
      // Arrange
      const invalidInputs = [
        createHookInput({ project_dir: '' }),
        createHookInput({ project_dir: undefined }),
        createHookInput({ session_id: '' }),
        createHookInput({ session_id: undefined as unknown as string }),
      ];

      // Act & Assert
      invalidInputs.forEach((input) => {
        expect(() => mem0AnalyticsTracker(input)).not.toThrow();
      });
    });
  });

  describe('non-blocking behavior', () => {
    test('always returns continue: true regardless of environment', () => {
      // Arrange
      const testCases = [
        { MEM0_API_KEY: 'key' },
        { MEM0_API_KEY: '' },
        { MEM0_API_KEY: undefined },
      ];

      testCases.forEach(({ MEM0_API_KEY }) => {
        if (MEM0_API_KEY !== undefined) {
          process.env.MEM0_API_KEY = MEM0_API_KEY;
        } else {
          delete process.env.MEM0_API_KEY;
        }

        // Act
        const result = mem0AnalyticsTracker(createHookInput());

        // Assert
        expect(result.continue).toBe(true);
      });
    });

    test('does not block on write errors', () => {
      // Arrange
      const input = createHookInput({ project_dir: '/root/readonly' });

      // Act
      const start = Date.now();
      const result = mem0AnalyticsTracker(input);
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
      const result = mem0AnalyticsTracker(input);

      // Assert
      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('suppressOutput', true);
    });

    test('always returns continue: true on success', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = mem0AnalyticsTracker(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true on error', () => {
      // Arrange
      const input = createHookInput({ project_dir: '/invalid/path' });

      // Act
      const result = mem0AnalyticsTracker(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('never returns stopReason', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = mem0AnalyticsTracker(input);

      // Assert
      expect(result.stopReason).toBeUndefined();
    });

    test('never blocks session start', () => {
      // Arrange
      delete process.env.MEM0_API_KEY;
      const input = createHookInput();

      // Act
      const result = mem0AnalyticsTracker(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles very long session IDs', () => {
      // Arrange
      const longSessionId = 'session-' + 'x'.repeat(1000);
      const input = createHookInput({ session_id: longSessionId });

      // Act
      const result = mem0AnalyticsTracker(input);

      // Assert
      expect(result.continue).toBe(true);
      const entries = parseAnalyticsEntries();
      expect(entries[entries.length - 1].session_id).toBe(longSessionId);
    });

    test('handles special characters in session ID', () => {
      // Arrange
      const specialSessionId = 'session-!@#$%^&*()_+-=[]{}|;:,.<>?';
      const input = createHookInput({ session_id: specialSessionId });

      // Act
      const result = mem0AnalyticsTracker(input);

      // Assert
      expect(result.continue).toBe(true);
      const entries = parseAnalyticsEntries();
      expect(entries[entries.length - 1].session_id).toBe(specialSessionId);
    });

    test('handles unicode in session ID', () => {
      // Arrange
      const unicodeSessionId = 'session-\u4e2d\u6587-\u65e5\u672c\u8a9e-\ud83d\ude00';
      const input = createHookInput({ session_id: unicodeSessionId });

      // Act
      const result = mem0AnalyticsTracker(input);

      // Assert
      expect(result.continue).toBe(true);
      const entries = parseAnalyticsEntries();
      expect(entries[entries.length - 1].session_id).toBe(unicodeSessionId);
    });

    test('handles null-like project_dir values', () => {
      // Arrange
      const input = createHookInput({ project_dir: null as unknown as string });

      // Act
      const result = mem0AnalyticsTracker(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });
});

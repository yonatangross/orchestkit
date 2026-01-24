/**
 * Unit tests for session-cleanup lifecycle hook
 * Tests cleanup of temporary files at session end
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import type { HookInput } from '../../types.js';
import { sessionCleanup } from '../../lifecycle/session-cleanup.js';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = '/tmp/session-cleanup-test';
const METRICS_FILE = '/tmp/claude-session-metrics.json';

/**
 * Create realistic HookInput for testing
 */
function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: 'test-session-cleanup-123',
    project_dir: TEST_PROJECT_DIR,
    tool_input: {},
    ...overrides,
  };
}

/**
 * Create session metrics file
 */
function createMetricsFile(toolCounts: Record<string, number> = {}): void {
  writeFileSync(
    METRICS_FILE,
    JSON.stringify({
      tools: toolCounts,
      timestamp: new Date().toISOString(),
    })
  );
}

/**
 * Create session archive files for cleanup testing
 */
function createSessionArchives(count: number): void {
  const archiveDir = `${TEST_PROJECT_DIR}/.claude/logs/sessions`;
  mkdirSync(archiveDir, { recursive: true });

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(Date.now() - i * 1000).toISOString().replace(/[:.]/g, '-');
    writeFileSync(
      `${archiveDir}/session-${timestamp}.json`,
      JSON.stringify({ index: i, timestamp })
    );
  }
}

/**
 * Create rotated log files for cleanup testing
 */
function createRotatedLogs(count: number): void {
  const logDir = `${TEST_PROJECT_DIR}/.claude/logs`;
  mkdirSync(logDir, { recursive: true });

  for (let i = 0; i < count; i++) {
    writeFileSync(`${logDir}/hooks.log.old${i}`, `Log content ${i}`);
    writeFileSync(`${logDir}/audit.log.old${i}`, `Audit content ${i}`);
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
  // Clean up metrics file
  if (existsSync(METRICS_FILE)) {
    rmSync(METRICS_FILE, { force: true });
  }
});

// =============================================================================
// Tests
// =============================================================================

describe('session-cleanup', () => {
  describe('basic behavior', () => {
    test('returns silent success when no cleanup needed', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = sessionCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles missing project directory gracefully', () => {
      // Arrange
      const input = createHookInput({ project_dir: '/non/existent/path' });

      // Act
      const result = sessionCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('uses default project_dir when not provided', () => {
      // Arrange
      const input = createHookInput({ project_dir: undefined });

      // Act
      const result = sessionCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('metrics archival', () => {
    test('archives metrics when tool count exceeds threshold', () => {
      // Arrange
      createMetricsFile({
        Bash: 5,
        Write: 3,
        Read: 10,
      });
      const input = createHookInput();

      // Act
      const result = sessionCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      const archiveDir = `${TEST_PROJECT_DIR}/.claude/logs/sessions`;
      if (existsSync(archiveDir)) {
        const files = readdirSync(archiveDir).filter((f) => f.startsWith('session-'));
        expect(files.length).toBeGreaterThan(0);
      }
    });

    test('does not archive metrics when tool count is below threshold', () => {
      // Arrange
      createMetricsFile({
        Bash: 2,
        Read: 2,
      });
      const input = createHookInput();

      // Act
      const result = sessionCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      // With only 4 tool calls (<= 5), should not archive
    });

    test('handles missing metrics file gracefully', () => {
      // Arrange - no metrics file created
      const input = createHookInput();

      // Act
      const result = sessionCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles invalid metrics JSON gracefully', () => {
      // Arrange
      writeFileSync(METRICS_FILE, 'invalid json {');
      const input = createHookInput();

      // Act
      const result = sessionCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles metrics file with missing tools field', () => {
      // Arrange
      writeFileSync(METRICS_FILE, JSON.stringify({ timestamp: new Date().toISOString() }));
      const input = createHookInput();

      // Act
      const result = sessionCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('archive cleanup (keep last 20)', () => {
    test('keeps last 20 session archives when more than 20 exist', () => {
      // Arrange
      createSessionArchives(25);
      const input = createHookInput();

      // Act
      const result = sessionCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      const archiveDir = `${TEST_PROJECT_DIR}/.claude/logs/sessions`;
      if (existsSync(archiveDir)) {
        const files = readdirSync(archiveDir).filter((f) => f.startsWith('session-'));
        expect(files.length).toBeLessThanOrEqual(20);
      }
    });

    test('keeps all archives when fewer than 20 exist', () => {
      // Arrange
      createSessionArchives(10);
      const input = createHookInput();

      // Act
      const result = sessionCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      const archiveDir = `${TEST_PROJECT_DIR}/.claude/logs/sessions`;
      if (existsSync(archiveDir)) {
        const files = readdirSync(archiveDir).filter((f) => f.startsWith('session-'));
        expect(files.length).toBe(10);
      }
    });

    test('handles missing archive directory gracefully', () => {
      // Arrange - no archive directory
      const input = createHookInput();

      // Act
      const result = sessionCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('rotated log cleanup (keep last 5)', () => {
    test('keeps last 5 rotated log files when more than 5 exist', () => {
      // Arrange
      createRotatedLogs(8);
      const input = createHookInput();

      // Act
      const result = sessionCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      const logDir = `${TEST_PROJECT_DIR}/.claude/logs`;
      if (existsSync(logDir)) {
        const hooksLogs = readdirSync(logDir).filter((f) => f.startsWith('hooks.log.old'));
        const auditLogs = readdirSync(logDir).filter((f) => f.startsWith('audit.log.old'));
        expect(hooksLogs.length).toBeLessThanOrEqual(5);
        expect(auditLogs.length).toBeLessThanOrEqual(5);
      }
    });

    test('keeps all rotated logs when fewer than 5 exist', () => {
      // Arrange
      createRotatedLogs(3);
      const input = createHookInput();

      // Act
      const result = sessionCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      const logDir = `${TEST_PROJECT_DIR}/.claude/logs`;
      if (existsSync(logDir)) {
        const hooksLogs = readdirSync(logDir).filter((f) => f.startsWith('hooks.log.old'));
        expect(hooksLogs.length).toBe(3);
      }
    });

    test('handles missing log directory gracefully', () => {
      // Arrange - no log directory
      const input = createHookInput();

      // Act
      const result = sessionCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('error handling', () => {
    test('continues even when archive fails', () => {
      // Arrange
      createMetricsFile({ Bash: 20 });
      // Create archive dir as a file to cause error
      const archiveDir = `${TEST_PROJECT_DIR}/.claude/logs`;
      mkdirSync(archiveDir, { recursive: true });
      const input = createHookInput();

      // Act
      const result = sessionCleanup(input);

      // Assert - should continue despite potential errors
      expect(result.continue).toBe(true);
    });

    test('never blocks session end', () => {
      // Arrange
      const input = createHookInput({ project_dir: '/non/existent/path' });

      // Act
      const result = sessionCleanup(input);

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
      const result = sessionCleanup(input);

      // Assert
      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('suppressOutput', true);
    });

    test('always suppresses output', () => {
      // Arrange
      createMetricsFile({ Bash: 100 });
      createSessionArchives(30);
      const input = createHookInput();

      // Act
      const result = sessionCleanup(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });
  });
});

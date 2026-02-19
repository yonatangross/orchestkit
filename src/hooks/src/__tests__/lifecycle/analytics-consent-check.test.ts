/**
 * Unit tests for analytics-consent-check lifecycle hook
 * Tests consent status checking and reminder display
 * CC 2.1.7 Compliant: Non-blocking - always returns continue: true
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { HookInput } from '../../types.js';
import { analyticsConsentCheck } from '../../lifecycle/analytics-consent-check.js';

// =============================================================================
// Mock Setup - BEFORE imports
// =============================================================================

vi.mock('../../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/common.js')>();
  return {
    ...actual,
    logHook: vi.fn(),
    getProjectDir: vi.fn(() => process.env.CLAUDE_PROJECT_DIR || '/test/project'),
    outputSilentSuccess: actual.outputSilentSuccess,
  };
});

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = join(tmpdir(), `analytics-consent-test-${Date.now()}`);
const TEST_SESSION_ID = `test-session-consent-${Date.now()}`;

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
 * Create consent status file
 */
function createConsentStatus(status: { consented?: boolean; asked?: boolean }): void {
  const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
  mkdirSync(feedbackDir, { recursive: true });
  writeFileSync(`${feedbackDir}/consent-status.json`, JSON.stringify(status, null, 2));
}

/**
 * Create consent log file
 */
function createConsentLog(events: Array<{ action: string; timestamp: string }>): void {
  const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
  mkdirSync(feedbackDir, { recursive: true });
  writeFileSync(`${feedbackDir}/consent-log.json`, JSON.stringify({ events }, null, 2));
}

/**
 * Get timestamp from days ago
 */
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

beforeEach(() => {
  vi.clearAllMocks();

  // Set environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;

  // Create test directory
  mkdirSync(TEST_PROJECT_DIR, { recursive: true });
});

afterEach(() => {
  // Clean up test directory
  if (existsSync(TEST_PROJECT_DIR)) {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }

  // Clean up environment
  delete process.env.CLAUDE_PROJECT_DIR;
});

// =============================================================================
// Tests
// =============================================================================

describe('analytics-consent-check', () => {
  describe('first-time user (no consent status)', () => {
    test('shows brief notice for first-time user', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('OrchestKit collects local usage metrics');
      expect(result.systemMessage).toContain('/ork:feedback opt-in');
    });

    test('does not block on first-time notice', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });
  });

  describe('user already consented', () => {
    test('returns silent success when user has consented', () => {
      // Arrange
      createConsentStatus({ consented: true, asked: true });
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.systemMessage).toBeUndefined();
    });

    test('does not show any message when consented', () => {
      // Arrange
      createConsentStatus({ consented: true, asked: true });
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.systemMessage).toBeUndefined();
    });
  });

  describe('user declined recently', () => {
    test('does not show reminder if declined within 30 days', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      createConsentLog([{ action: 'declined', timestamp: daysAgo(15) }]);
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.systemMessage).toBeUndefined();
    });

    test('does not show reminder if declined yesterday', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      createConsentLog([{ action: 'declined', timestamp: daysAgo(1) }]);
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('30-day reminder behavior', () => {
    test('shows reminder if declined over 30 days ago', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      createConsentLog([{ action: 'declined', timestamp: daysAgo(31) }]);
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Reminder');
      expect(result.systemMessage).toContain('/ork:feedback opt-in');
    });

    test('shows reminder if revoked over 30 days ago', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      createConsentLog([{ action: 'revoked', timestamp: daysAgo(45) }]);
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Reminder');
    });

    test.each([
      [29, false],
      [30, true],
      [31, true],
      [60, true],
      [90, true],
    ])('declined %d days ago shows reminder=%s', (days, showsReminder) => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      createConsentLog([{ action: 'declined', timestamp: daysAgo(days) }]);
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      if (showsReminder) {
        expect(result.systemMessage).toContain('Reminder');
      } else {
        expect(result.suppressOutput).toBe(true);
      }
    });
  });

  describe('consent log handling', () => {
    test('handles missing consent log gracefully', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      // No consent log file
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles empty consent log', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      createConsentLog([]);
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('uses most recent consent event', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      createConsentLog([
        { action: 'declined', timestamp: daysAgo(60) }, // Old
        { action: 'consented', timestamp: daysAgo(45) }, // Consented then
        { action: 'declined', timestamp: daysAgo(10) }, // Recent decline
      ]);
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      // Recent decline (10 days ago) should suppress the reminder
      expect(result.suppressOutput).toBe(true);
    });

    test('handles corrupted consent log JSON', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
      mkdirSync(feedbackDir, { recursive: true });
      writeFileSync(`${feedbackDir}/consent-log.json`, 'not valid json');
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles consent log with missing events array', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
      mkdirSync(feedbackDir, { recursive: true });
      writeFileSync(`${feedbackDir}/consent-log.json`, JSON.stringify({ version: '1.0' }));
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('consent status file handling', () => {
    test('handles missing consent status file', () => {
      // Arrange - no files created
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
    });

    test('handles corrupted consent status JSON', () => {
      // Arrange
      const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
      mkdirSync(feedbackDir, { recursive: true });
      writeFileSync(`${feedbackDir}/consent-status.json`, 'invalid json');
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles consent status with missing fields', () => {
      // Arrange
      createConsentStatus({});
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test.each([
      [{ consented: true }, true], // Consented
      [{ consented: false, asked: false }, false], // First time
      [{ consented: false, asked: true }, true], // Declined
      [{}, false], // Empty
    ])('consent status %j returns suppressOutput=%s appropriately', (status, expectSilent) => {
      // Arrange
      createConsentStatus(status);
      if (status.asked && !status.consented) {
        createConsentLog([{ action: 'declined', timestamp: daysAgo(5) }]);
      }
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      if (expectSilent) {
        expect(result.suppressOutput).toBe(true);
      }
    });
  });

  describe('error handling', () => {
    test('handles non-existent project directory gracefully', () => {
      // Arrange
      const input = createHookInput({ project_dir: '/non/existent/path' });

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles undefined project_dir by using default', () => {
      // Arrange
      const input = createHookInput({ project_dir: undefined });

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles invalid timestamp in consent log', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      createConsentLog([{ action: 'declined', timestamp: 'not-a-date' }]);
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result).toHaveProperty('continue');
      expect(result.continue).toBe(true);
    });

    test('never blocks session start', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });

    test.each([
      ['first-time user', () => {}],
      ['consented user', () => createConsentStatus({ consented: true })],
      ['recently declined', () => {
        createConsentStatus({ consented: false, asked: true });
        createConsentLog([{ action: 'declined', timestamp: daysAgo(5) }]);
      }],
      ['30-day reminder', () => {
        createConsentStatus({ consented: false, asked: true });
        createConsentLog([{ action: 'declined', timestamp: daysAgo(35) }]);
      }],
    ])('always returns continue: true for %s', (_, setup) => {
      // Arrange
      setup();
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('uses systemMessage for user communication (not blocking)', () => {
      // Arrange - first time user
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      if (result.systemMessage) {
        expect(result.continue).toBe(true); // Not blocking
        expect(result.stopReason).toBeUndefined();
      }
    });
  });

  describe('message content validation', () => {
    test('first-time notice mentions local metrics', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.systemMessage).toContain('local usage metrics');
    });

    test('first-time notice mentions opt-in command', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.systemMessage).toContain('/ork:feedback opt-in');
    });

    test('reminder message is clearly labeled', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      createConsentLog([{ action: 'declined', timestamp: daysAgo(31) }]);
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.systemMessage).toContain('Reminder');
    });

    test('reminder mentions anonymous analytics', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      createConsentLog([{ action: 'declined', timestamp: daysAgo(31) }]);
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.systemMessage).toContain('Anonymous analytics');
    });
  });

  describe('edge cases', () => {
    test('handles asked=true but no log file', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      // No consent log
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles very old timestamps', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      createConsentLog([{ action: 'declined', timestamp: '2020-01-01T00:00:00Z' }]);
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Reminder');
    });

    test('handles future timestamps gracefully', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      createConsentLog([{ action: 'declined', timestamp: futureDate }]);
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles consent log with other action types', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      createConsentLog([
        { action: 'prompted', timestamp: daysAgo(40) },
        { action: 'viewed', timestamp: daysAgo(35) },
      ]);
      const input = createHookInput();

      // Act
      const result = analyticsConsentCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles rapid consecutive calls', () => {
      // Arrange
      createConsentStatus({ consented: false, asked: true });
      createConsentLog([{ action: 'declined', timestamp: daysAgo(31) }]);
      const input = createHookInput();

      // Act
      const results = [
        analyticsConsentCheck(input),
        analyticsConsentCheck(input),
        analyticsConsentCheck(input),
      ];

      // Assert
      results.forEach((result) => {
        expect(result.continue).toBe(true);
      });
    });
  });
});

/**
 * Unit tests for review-summary-generator hook
 * Tests code review summary generation on skill stop event
 *
 * Focus: Log file creation, content format, error handling
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST come BEFORE imports
// =============================================================================

const { mockAppendFileSync } = vi.hoisted(() => ({
  mockAppendFileSync: vi.fn(),
}));

vi.mock('../../lib/analytics-buffer.js', () => ({
  bufferWrite: vi.fn((filePath: string, content: string) => {
    mockAppendFileSync(filePath, content);
  }),
  flush: vi.fn(),
  pendingCount: vi.fn(() => 0),
  _resetForTesting: vi.fn(),
}));

vi.mock('node:fs', () => ({
  appendFileSync: mockAppendFileSync,
  mkdirSync: vi.fn(),
}));

vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getLogDir: vi.fn(() => '/test/logs'),
}));

import { reviewSummaryGenerator } from '../../skill/review-summary-generator.js';
import { outputSilentSuccess, getLogDir } from '../../lib/common.js';
import { appendFileSync, mkdirSync } from 'node:fs';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for skill stop event
 */
function createStopInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Stop',
    session_id: 'test-session-123',
    tool_input: {},
    hook_event: 'Stop',
    ...overrides,
  };
}

// =============================================================================
// Review Summary Generator Tests
// =============================================================================

describe('review-summary-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:30:45.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance - All paths return continue: true
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true on successful execution', () => {
      // Arrange
      const input = createStopInput();

      // Act
      const result = reviewSummaryGenerator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true when mkdirSync fails', () => {
      // Arrange
      const input = createStopInput();
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Act
      const result = reviewSummaryGenerator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true when appendFileSync fails', () => {
      // Arrange
      const input = createStopInput();
      vi.mocked(appendFileSync).mockImplementation(() => {
        throw new Error('Disk full');
      });

      // Act
      const result = reviewSummaryGenerator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns suppressOutput: true for silent operation', () => {
      // Arrange
      const input = createStopInput();

      // Act
      const result = reviewSummaryGenerator(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });

    test('always returns outputSilentSuccess result', () => {
      // Arrange
      const input = createStopInput();

      // Act
      reviewSummaryGenerator(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Directory creation
  // ---------------------------------------------------------------------------

  describe('directory creation', () => {
    test('creates log directory with recursive option', () => {
      // Arrange
      const input = createStopInput();

      // Act
      reviewSummaryGenerator(input);

      // Assert
      expect(mkdirSync).toHaveBeenCalledWith('/test/logs', { recursive: true });
    });

    test('uses log directory from getLogDir', () => {
      // Arrange
      const input = createStopInput();
      vi.mocked(getLogDir).mockReturnValue('/custom/log/path');

      // Act
      reviewSummaryGenerator(input);

      // Assert
      expect(mkdirSync).toHaveBeenCalledWith('/custom/log/path', { recursive: true });
    });

    test('continues execution when directory already exists', () => {
      // Arrange
      const input = createStopInput();
      vi.mocked(mkdirSync).mockImplementation(() => {
        const err = new Error('EEXIST');
        (err as NodeJS.ErrnoException).code = 'EEXIST';
        throw err;
      });

      // Act
      const result = reviewSummaryGenerator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(appendFileSync).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Log file writing
  // ---------------------------------------------------------------------------

  describe('log file writing', () => {
    test('writes to review-summary.log file in log directory', () => {
      // Arrange
      const input = createStopInput();

      // Act
      reviewSummaryGenerator(input);

      // Assert
      const calls = vi.mocked(appendFileSync).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0]).toContain('review-summary.log');
    });

    test('appends newline to log content', () => {
      // Arrange
      const input = createStopInput();

      // Act
      reviewSummaryGenerator(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent.endsWith('\n')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Log content format
  // ---------------------------------------------------------------------------

  describe('log content format', () => {
    test('includes formatted timestamp', () => {
      // Arrange
      const input = createStopInput();

      // Act
      reviewSummaryGenerator(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('[2024-01-15 10:30:45]');
    });

    test('includes Code Review Summary header', () => {
      // Arrange
      const input = createStopInput();

      // Act
      reviewSummaryGenerator(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('Code Review Summary');
    });

    test('includes review checklist items', () => {
      // Arrange
      const input = createStopInput();

      // Act
      reviewSummaryGenerator(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('All blocking issues addressed');
      expect(writtenContent).toContain('Non-blocking suggestions noted');
      expect(writtenContent).toContain('Tests pass');
      expect(writtenContent).toContain('No security concerns');
      expect(writtenContent).toContain('Documentation updated if needed');
    });

    test('includes conventional comment prefixes', () => {
      // Arrange
      const input = createStopInput();

      // Act
      reviewSummaryGenerator(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('blocking:');
      expect(writtenContent).toContain('suggestion:');
      expect(writtenContent).toContain('nitpick:');
      expect(writtenContent).toContain('question:');
      expect(writtenContent).toContain('praise:');
    });

    test('includes checkbox format for checklist', () => {
      // Arrange
      const input = createStopInput();

      // Act
      reviewSummaryGenerator(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('[ ]');
    });
  });

  // ---------------------------------------------------------------------------
  // Timestamp formatting
  // ---------------------------------------------------------------------------

  describe('timestamp formatting', () => {
    test.each([
      ['2024-01-01T00:00:00.000Z', '2024-01-01 00:00:00'],
      ['2024-12-31T23:59:59.999Z', '2024-12-31 23:59:59'],
      ['2024-06-15T12:30:45.123Z', '2024-06-15 12:30:45'],
    ])('formats timestamp %s as %s', (isoTime, expected) => {
      // Arrange
      vi.setSystemTime(new Date(isoTime));
      const input = createStopInput();

      // Act
      reviewSummaryGenerator(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain(`[${expected}]`);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    test('silently ignores mkdirSync errors', () => {
      // Arrange
      const input = createStopInput();
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Act & Assert
      expect(() => reviewSummaryGenerator(input)).not.toThrow();
    });

    test('silently ignores appendFileSync errors', () => {
      // Arrange
      const input = createStopInput();
      vi.mocked(appendFileSync).mockImplementation(() => {
        throw new Error('Disk full');
      });

      // Act & Assert
      expect(() => reviewSummaryGenerator(input)).not.toThrow();
    });

    test('attempts to write log even if mkdir fails', () => {
      // Arrange
      const input = createStopInput();
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Act
      reviewSummaryGenerator(input);

      // Assert
      expect(appendFileSync).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty input', () => {
      // Arrange
      const input = createStopInput({});

      // Act
      const result = reviewSummaryGenerator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles undefined hook_event', () => {
      // Arrange
      const input = createStopInput({ hook_event: undefined });

      // Act
      const result = reviewSummaryGenerator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles missing session_id', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Stop',
        session_id: '',
        tool_input: {},
      };

      // Act
      const result = reviewSummaryGenerator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles various log directory paths', () => {
      // Arrange
      const paths = [
        '/var/log/orchestkit',
        '/tmp/logs',
        '/home/user/.claude/logs',
        'C:\\Users\\test\\logs',
      ];

      for (const path of paths) {
        vi.mocked(getLogDir).mockReturnValue(path);
        vi.clearAllMocks();
        const input = createStopInput();

        // Act
        reviewSummaryGenerator(input);

        // Assert
        expect(mkdirSync).toHaveBeenCalledWith(path, { recursive: true });
        expect(appendFileSync).toHaveBeenCalledWith(
          `${path}/review-summary.log`,
          expect.any(String),
        );
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Hook integration
  // ---------------------------------------------------------------------------

  describe('hook integration', () => {
    test('input parameter is used (via _input)', () => {
      // Arrange
      const input = createStopInput({
        session_id: 'custom-session-456',
        project_dir: '/my/project',
      });

      // Act
      const result = reviewSummaryGenerator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('result matches HookResult interface', () => {
      // Arrange
      const input = createStopInput();

      // Act
      const result = reviewSummaryGenerator(input);

      // Assert
      expect(result).toHaveProperty('continue');
      expect(typeof result.continue).toBe('boolean');
    });
  });
});

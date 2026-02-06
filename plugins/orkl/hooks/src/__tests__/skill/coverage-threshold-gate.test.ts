/**
 * Unit tests for coverage-threshold-gate hook
 * Tests BLOCKING coverage threshold enforcement
 *
 * Coverage Focus: Validates coverage file detection, parsing of various
 * coverage formats, threshold comparison, and blocking behavior
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST come before imports
// =============================================================================

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputBlock: vi.fn((reason: string) => ({
    continue: false,
    stopReason: reason,
    hookSpecificOutput: {
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-123'),
}));

import { coverageThresholdGate } from '../../skill/coverage-threshold-gate.js';
import { outputSilentSuccess, outputBlock, getProjectDir } from '../../lib/common.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput
 */
function createInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {},
    ...overrides,
  };
}

// =============================================================================
// Coverage Threshold Gate Tests
// =============================================================================

describe('coverage-threshold-gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.COVERAGE_THRESHOLD;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true when no coverage file exists', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true when coverage meets threshold', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          total: { lines: { pct: 85 } },
        }),
      );
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: false when coverage below threshold', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          total: { lines: { pct: 70 } },
        }),
      );
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('BLOCKED');
    });

    test('returns valid HookResult structure on block', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: 50 } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(typeof result.continue).toBe('boolean');
      expect(typeof result.stopReason).toBe('string');
      expect(result.hookSpecificOutput).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Coverage file detection
  // ---------------------------------------------------------------------------

  describe('coverage file detection', () => {
    test.each([
      ['coverage/coverage-summary.json', 'Jest/Vitest summary'],
      ['coverage/coverage-final.json', 'Jest/Vitest final'],
      ['.vitest/coverage/coverage-summary.json', 'Vitest directory'],
      ['coverage.json', 'Python coverage.py'],
      ['.coverage.json', 'Python hidden coverage'],
      ['htmlcov/status.json', 'Python htmlcov'],
    ])('detects %s (%s)', (path, _description) => {
      // Arrange
      mockExistsSync.mockImplementation((checkPath: string) => {
        return checkPath === `/test/project/${path}`;
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: 90 } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(mockReadFileSync).toHaveBeenCalledWith(`/test/project/${path}`, 'utf8');
      expect(result.continue).toBe(true);
    });

    test('checks coverage files in priority order', () => {
      // Arrange
      const checkedPaths: string[] = [];
      mockExistsSync.mockImplementation((path: string) => {
        checkedPaths.push(path);
        return false;
      });
      const input = createInput();

      // Act
      coverageThresholdGate(input);

      // Assert
      expect(checkedPaths[0]).toContain('coverage-summary.json');
    });

    test('uses first existing coverage file', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        // Both exist, but should use first one
        return (
          path === '/test/project/coverage/coverage-summary.json' ||
          path === '/test/project/coverage.json'
        );
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: 85 } } }));
      const input = createInput();

      // Act
      coverageThresholdGate(input);

      // Assert
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
      expect(mockReadFileSync).toHaveBeenCalledWith(
        '/test/project/coverage/coverage-summary.json',
        'utf8',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Coverage format parsing
  // ---------------------------------------------------------------------------

  describe('coverage format parsing', () => {
    test('parses Jest/Vitest coverage-summary.json (lines.pct)', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          total: {
            lines: { total: 100, covered: 85, skipped: 0, pct: 85 },
            statements: { total: 120, covered: 100, skipped: 0, pct: 83.33 },
            functions: { total: 20, covered: 18, skipped: 0, pct: 90 },
            branches: { total: 30, covered: 25, skipped: 0, pct: 83.33 },
          },
        }),
      );
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('falls back to statements.pct when lines.pct missing', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          total: {
            statements: { pct: 75 },
          },
        }),
      );
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('parses Python coverage.json (totals.percent_covered)', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage.json';
      });
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          totals: {
            covered_lines: 850,
            num_statements: 1000,
            percent_covered: 85.0,
          },
        }),
      );
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('parses generic total.pct format', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          total: { pct: 82 },
        }),
      );
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Threshold comparison
  // ---------------------------------------------------------------------------

  describe('threshold comparison', () => {
    test('uses default threshold of 80%', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: 79 } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('79%');
      expect(result.stopReason).toContain('80%');
    });

    test('uses custom threshold from environment', () => {
      // Arrange
      process.env.COVERAGE_THRESHOLD = '90';
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: 85 } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('85%');
      expect(result.stopReason).toContain('90%');
    });

    test('passes when coverage equals threshold', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: 80 } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('passes when coverage exceeds threshold', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: 95 } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('uses floor for coverage comparison', () => {
      // Arrange - 79.9% should floor to 79, which is below 80
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: 79.9 } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Error message format
  // ---------------------------------------------------------------------------

  describe('error message format', () => {
    test('includes BLOCKED keyword', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: 60 } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.stopReason).toContain('BLOCKED');
    });

    test('includes coverage file path', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: 60 } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.stopReason).toContain('coverage-summary.json');
    });

    test('includes action items', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: 60 } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.stopReason).toContain('Actions required');
      expect(result.stopReason).toContain('uncovered code paths');
    });

    test('includes TypeScript and Python commands', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: 60 } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.stopReason).toContain('npm test');
      expect(result.stopReason).toContain('pytest');
    });

    test('includes testing tips', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: 60 } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.stopReason).toContain('Tip');
      expect(result.stopReason).toContain('Business logic');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles no coverage files gracefully', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('handles file read error gracefully', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      });
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles invalid JSON gracefully', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue('not valid json {{{');
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles empty JSON object', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue('{}');
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles null coverage value', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: null } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles undefined total', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ files: {} }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles 0% coverage', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: 0 } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('0%');
    });

    test('handles 100% coverage', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: 100 } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Project directory resolution
  // ---------------------------------------------------------------------------

  describe('project directory resolution', () => {
    test('uses getProjectDir for coverage file paths', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createInput();

      // Act
      coverageThresholdGate(input);

      // Assert
      expect(getProjectDir).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Boundary value testing
  // ---------------------------------------------------------------------------

  describe('boundary value testing', () => {
    test.each([
      [79, false, 'just below threshold'],
      [80, true, 'at threshold'],
      [81, true, 'just above threshold'],
    ])('coverage %d%% returns continue: %s (%s)', (coverage, expected, _description) => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ total: { lines: { pct: coverage } } }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // Coverage skipping logic
  // ---------------------------------------------------------------------------

  describe('coverage skipping logic', () => {
    test('skips when coverageFile is empty string', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });

    test('skips when coverageContent is empty', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue('');
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('skips when coverage parsing returns null', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage/coverage-summary.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ unrelated: 'data' }));
      const input = createInput();

      // Act
      const result = coverageThresholdGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });
});

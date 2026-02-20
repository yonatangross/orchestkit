/**
 * Unit tests for coverage-check hook
 * Tests coverage threshold checking on Stop event
 *
 * Coverage Focus: Validates Python coverage detection, JS/TS coverage detection,
 * threshold comparison, and log file handling
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST come before imports
// =============================================================================

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockAppendFileSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockExecSync = vi.fn();

vi.mock('../../lib/analytics-buffer.js', () => ({
  bufferWrite: vi.fn((filePath: string, content: string) => {
    mockAppendFileSync(filePath, content);
  }),
  flush: vi.fn(),
  pendingCount: vi.fn(() => 0),
  _resetForTesting: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  appendFileSync: (...args: unknown[]) => mockAppendFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getLogDir: vi.fn(() => '/test/.claude/logs'),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-123'),
}));

import { coverageCheck } from '../../skill/coverage-check.js';
import { outputSilentSuccess, getLogDir, getProjectDir } from '../../lib/common.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for Stop event
 */
function createStopInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {},
    hook_event: 'Stop',
    ...overrides,
  };
}

// =============================================================================
// Coverage Check Tests
// =============================================================================

describe('coverage-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    delete process.env.COVERAGE_THRESHOLD;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('always returns continue: true (non-blocking)', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      const result = coverageCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns valid HookResult structure', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      const result = coverageCheck(input);

      // Assert
      expect(typeof result.continue).toBe('boolean');
      expect(result.suppressOutput).toBe(true);
    });

    test('returns outputSilentSuccess for all paths', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Python coverage detection
  // ---------------------------------------------------------------------------

  describe('Python coverage detection', () => {
    test('detects .coverage file', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.coverage';
      });
      mockExecSync.mockReturnValue('Name    Stmts   Miss  Cover\nTOTAL      100     15    85%');
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockExecSync).toHaveBeenCalledWith(
        'coverage report --fail-under=0',
        expect.objectContaining({ cwd: '/test/project' }),
      );
    });

    test('detects coverage.xml file', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/coverage.xml';
      });
      mockExecSync.mockReturnValue('TOTAL      200     20    90%');
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockExecSync).toHaveBeenCalled();
    });

    test('parses coverage percentage from report', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.coverage';
      });
      mockExecSync.mockReturnValue(`
Name                      Stmts   Miss  Cover
---------------------------------------------
app/__init__.py              10      0   100%
app/main.py                  50     10    80%
app/services/user.py         30      5    83%
---------------------------------------------
TOTAL                        90     15    83%
`);
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Python coverage: 83%'),
      );
    });

    test('handles coverage command failure gracefully', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.coverage';
      });
      mockExecSync.mockImplementation(() => {
        throw new Error('coverage: command not found');
      });
      const input = createStopInput();

      // Act
      const result = coverageCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // JavaScript/TypeScript coverage detection
  // ---------------------------------------------------------------------------

  describe('JavaScript/TypeScript coverage detection', () => {
    test('detects coverage directory', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        if (path === '/test/project/coverage') return true;
        if (path === '/test/project/coverage/coverage-summary.json') return true;
        return false;
      });
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('JavaScript/TypeScript coverage report found'),
      );
    });

    test('logs reference to lcov report', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        if (path === '/test/project/coverage') return true;
        if (path === '/test/project/coverage/coverage-summary.json') return true;
        return false;
      });
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('coverage/lcov-report/index.html'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Threshold comparison
  // ---------------------------------------------------------------------------

  describe('threshold comparison', () => {
    test('uses default threshold of 80%', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.coverage';
      });
      mockExecSync.mockReturnValue('TOTAL      100     25    75%');
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('WARNING: Coverage 75% is below threshold 80%'),
      );
    });

    test('uses custom threshold from environment', () => {
      // Arrange
      process.env.COVERAGE_THRESHOLD = '90';
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.coverage';
      });
      mockExecSync.mockReturnValue('TOTAL      100     15    85%');
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('WARNING: Coverage 85% is below threshold 90%'),
      );
    });

    test('logs success when coverage meets threshold', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.coverage';
      });
      mockExecSync.mockReturnValue('TOTAL      100     10    90%');
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Coverage meets threshold'),
      );
    });

    test('logs success when coverage equals threshold', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.coverage';
      });
      mockExecSync.mockReturnValue('TOTAL      100     20    80%');
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Coverage meets threshold'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Log file handling
  // ---------------------------------------------------------------------------

  describe('log file handling', () => {
    test('creates log directory if not exists', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockMkdirSync).toHaveBeenCalledWith('/test/.claude/logs', { recursive: true });
    });

    test('writes to coverage-check.log file', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/test/.claude/logs/coverage-check.log',
        expect.any(String),
      );
    });

    test('includes timestamp in log', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/),
      );
    });

    test('handles mkdir failure gracefully', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });
      const input = createStopInput();

      // Act
      const result = coverageCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles appendFile failure gracefully', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      mockAppendFileSync.mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });
      const input = createStopInput();

      // Act
      const result = coverageCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles no coverage files', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      const result = coverageCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    test('handles malformed coverage output', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.coverage';
      });
      mockExecSync.mockReturnValue('Some unexpected output format');
      const input = createStopInput();

      // Act
      const result = coverageCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles TOTAL line without percentage', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.coverage';
      });
      mockExecSync.mockReturnValue('TOTAL      100     N/A    N/A');
      const input = createStopInput();

      // Act
      const result = coverageCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles empty coverage output', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.coverage';
      });
      mockExecSync.mockReturnValue('');
      const input = createStopInput();

      // Act
      const result = coverageCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles non-numeric threshold environment variable', () => {
      // Arrange
      process.env.COVERAGE_THRESHOLD = 'invalid';
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.coverage';
      });
      mockExecSync.mockReturnValue('TOTAL      100     20    80%');
      const input = createStopInput();

      // Act
      const result = coverageCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      // NaN comparison should not throw
    });

    test('handles timeout in coverage command', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.coverage';
      });
      mockExecSync.mockImplementation(() => {
        const error = new Error('Timed out') as NodeJS.ErrnoException;
        error.code = 'ETIMEDOUT';
        throw error;
      });
      const input = createStopInput();

      // Act
      const result = coverageCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Coverage report parsing
  // ---------------------------------------------------------------------------

  describe('coverage report parsing', () => {
    test.each([
      ['85%', 85],
      ['100%', 100],
      ['0%', 0],
      ['99%', 99],
      ['  75%  ', 75],
    ])('parses coverage percentage: %s -> %d', (percentStr, expected) => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.coverage';
      });
      mockExecSync.mockReturnValue(`TOTAL      100     10    ${percentStr}`);
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(`Python coverage: ${expected}%`),
      );
    });

    test('finds TOTAL line in complex report', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.coverage';
      });
      mockExecSync.mockReturnValue(`
Name                                    Stmts   Miss Branch BrPart  Cover
-------------------------------------------------------------------------
src/__init__.py                             0      0      0      0   100%
src/main.py                                50     10     20      5    75%
src/utils/helpers.py                       30      5     10      2    80%
src/services/user_service.py               40      8     15      3    77%
-------------------------------------------------------------------------
TOTAL                                     120     23     45     10    78%
`);
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Python coverage: 78%'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Both Python and JS coverage
  // ---------------------------------------------------------------------------

  describe('both Python and JS coverage', () => {
    test('reports both coverage types', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        if (path === '/test/project/.coverage') return true;
        if (path === '/test/project/coverage') return true;
        if (path === '/test/project/coverage/coverage-summary.json') return true;
        return false;
      });
      mockExecSync.mockReturnValue('TOTAL      100     15    85%');
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Python coverage: 85%'),
      );
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('JavaScript/TypeScript coverage report found'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Project directory resolution
  // ---------------------------------------------------------------------------

  describe('project directory resolution', () => {
    test('uses getProjectDir for coverage file paths', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(getProjectDir).toHaveBeenCalled();
    });

    test('uses getLogDir for log file paths', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(getLogDir).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Command execution options
  // ---------------------------------------------------------------------------

  describe('command execution options', () => {
    test('executes coverage command with correct options', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.coverage';
      });
      mockExecSync.mockReturnValue('TOTAL 100 10 90%');
      const input = createStopInput();

      // Act
      coverageCheck(input);

      // Assert
      expect(mockExecSync).toHaveBeenCalledWith(
        'coverage report --fail-under=0',
        expect.objectContaining({
          cwd: '/test/project',
          encoding: 'utf8',
          timeout: 30000,
          stdio: ['pipe', 'pipe', 'pipe'],
        }),
      );
    });
  });
});

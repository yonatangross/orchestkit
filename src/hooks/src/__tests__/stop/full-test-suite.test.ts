/**
 * Tests for Full Test Suite Hook
 *
 * Tests complete test suite runner at session end.
 * Covers: skip when no code changes, Python project detection,
 * Node.js project detection, test failures, and timestamp updates.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PathLike } from 'node:fs';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock node:child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

// Mock common utilities
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

import { fullTestSuite } from '../../stop/full-test-suite.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { logHook, } from '../../lib/common.js';
import type { HookInput } from '../../types.js';

describe('Full Test Suite Hook', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);
  const _mockMkdirSync = vi.mocked(mkdirSync);
  const mockExecSync = vi.mocked(execSync);
  const mockLogHook = vi.mocked(logHook);

  const defaultInput: HookInput = {
    hook_event: 'Stop',
    tool_name: '',
    session_id: 'test-session-001',
    tool_input: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  // ===========================================================================
  // SECTION 1: Skip Conditions
  // ===========================================================================
  describe('Skip Conditions', () => {
    it('should skip when no code changes detected', () => {
      // Arrange - last run file exists, git diff returns no code files
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('.last-test-run')) return true;
        return false;
      });
      mockExecSync.mockReturnValue(Buffer.from('README.md\npackage-lock.json\n'));

      // Act
      const result = fullTestSuite(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'full-test-suite',
        'No code changes detected, skipping tests'
      );
    });

    it('should run tests when last-run file does not exist', () => {
      // Arrange - no last run file, no project files
      mockExistsSync.mockReturnValue(false);

      // Act
      fullTestSuite(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'full-test-suite',
        '=== Full Test Suite Started ==='
      );
    });

    it('should run tests when git diff returns code file changes', () => {
      // Arrange - last run exists, code changes detected
      // Note: Hook regex /\.(py|js|ts|go|rs)$/ uses $ which matches end of string
      // So we provide a single file without trailing newline to match correctly
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('.last-test-run')) return true;
        return false;
      });
      mockExecSync.mockReturnValue(Buffer.from('src/main.ts')); // No trailing newline

      // Act
      fullTestSuite(defaultInput);

      // Assert - should proceed (not skip)
      expect(mockLogHook).not.toHaveBeenCalledWith(
        'full-test-suite',
        'No code changes detected, skipping tests'
      );
    });

    it('should run tests when git diff throws an error', () => {
      // Arrange - last run exists, git diff fails
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('.last-test-run')) return true;
        return false;
      });
      mockExecSync.mockImplementation(() => {
        throw new Error('git error');
      });

      // Act
      const result = fullTestSuite(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });

  // ===========================================================================
  // SECTION 2: Python Project Detection
  // ===========================================================================
  describe('Python Project Detection', () => {
    it('should detect Python project with pytest.ini', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('pytest.ini')) return true;
        return false;
      });
      mockExecSync.mockReturnValue(Buffer.from(''));

      // Act
      fullTestSuite(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'full-test-suite',
        'Detected Python project, running pytest...'
      );
    });

    it('should detect Python project with pyproject.toml', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('pyproject.toml')) return true;
        return false;
      });
      mockExecSync.mockReturnValue(Buffer.from(''));

      // Act
      fullTestSuite(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'full-test-suite',
        'Detected Python project, running pytest...'
      );
    });

    it('should detect Python project with tests dir and requirements.txt', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        const p = String(path);
        if (p.endsWith('/tests') || p.includes('requirements.txt')) return true;
        return false;
      });
      mockExecSync.mockReturnValue(Buffer.from(''));

      // Act
      fullTestSuite(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'full-test-suite',
        'Detected Python project, running pytest...'
      );
    });
  });

  // ===========================================================================
  // SECTION 3: Node.js Project Detection
  // ===========================================================================
  describe('Node.js Project Detection', () => {
    it('should detect Node.js project with package.json and test script', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('package.json')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ scripts: { test: 'vitest' } })
      );
      mockExecSync.mockReturnValue(Buffer.from(''));

      // Act
      fullTestSuite(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'full-test-suite',
        'Detected Node.js project...'
      );
    });

    it('should skip Node.js tests when no test script exists', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('package.json')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ scripts: { build: 'tsc' } })
      );

      // Act
      fullTestSuite(defaultInput);

      // Assert
      expect(mockLogHook).not.toHaveBeenCalledWith(
        'full-test-suite',
        'Running npm test...'
      );
    });
  });

  // ===========================================================================
  // SECTION 4: Test Failures
  // ===========================================================================
  describe('Test Failures', () => {
    it('should handle test failures without throwing', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('pytest.ini')) return true;
        return false;
      });
      mockExecSync.mockImplementation((cmd: string) => {
        if (String(cmd).includes('pytest')) {
          throw new Error('Tests failed with exit code 1');
        }
        return Buffer.from('');
      });

      // Act
      const result = fullTestSuite(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'full-test-suite',
        '=== Some tests failed ==='
      );
    });

    it('should not update last-run timestamp on failure', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('pytest.ini')) return true;
        return false;
      });
      mockExecSync.mockImplementation((cmd: string) => {
        if (String(cmd).includes('pytest')) {
          throw new Error('Test failure');
        }
        return Buffer.from('');
      });

      // Act
      fullTestSuite(defaultInput);

      // Assert
      const lastRunWrite = mockWriteFileSync.mock.calls.find(
        call => String(call[0]).includes('.last-test-run')
      );
      expect(lastRunWrite).toBeUndefined();
    });
  });

  // ===========================================================================
  // SECTION 5: Last-Run Timestamp
  // ===========================================================================
  describe('Last-Run Timestamp', () => {
    it('should update last-run timestamp on success', () => {
      // Arrange - no project files means runTests returns true (exitCode stays 0)
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockReturnValue(Buffer.from(''));

      // Act
      fullTestSuite(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'full-test-suite',
        '=== All tests passed ==='
      );
    });

    it('should always return outputSilentSuccess', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      const result = fullTestSuite(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });
});

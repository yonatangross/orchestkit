/**
 * Unit tests for session-tracking lifecycle hook
 * Tests session start event tracking with context
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST be before imports
// =============================================================================

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => 'feature-branch'),
}));

vi.mock('../../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/common.js')>();
  return {
    ...actual,
    logHook: vi.fn(),
    getProjectDir: vi.fn(() => process.env.CLAUDE_PROJECT_DIR || '/test/project'),
    outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  };
});

vi.mock('../../lib/session-tracker.js', () => ({
  trackSessionStart: vi.fn(),
}));

// Import after mocks
import { sessionTracking } from '../../lifecycle/session-tracking.js';
import { execSync } from 'node:child_process';
import { logHook, getProjectDir, outputSilentSuccess } from '../../lib/common.js';
import { trackSessionStart } from '../../lib/session-tracker.js';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = join(tmpdir(), 'session-tracking-test');

/**
 * Create realistic HookInput for testing
 */
function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: 'test-session-tracking-123',
    project_dir: TEST_PROJECT_DIR,
    tool_input: {},
    ...overrides,
  };
}

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();

  // Set environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;
});

afterEach(() => {
  // Clean up environment
  delete process.env.CLAUDE_PROJECT_DIR;
});

// =============================================================================
// Tests
// =============================================================================

describe('session-tracking', () => {
  describe('basic behavior', () => {
    test('returns silent success on successful tracking', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = sessionTracking(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('calls trackSessionStart with context', () => {
      // Arrange
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(trackSessionStart).toHaveBeenCalledWith({
        project_dir: TEST_PROJECT_DIR,
        git_branch: 'feature-branch',
        added_dirs_count: 0,
      });
    });

    test('uses default project_dir when not provided', () => {
      // Arrange
      const input = createHookInput({ project_dir: undefined });

      // Act
      sessionTracking(input);

      // Assert
      expect(getProjectDir).toHaveBeenCalled();
    });
  });

  describe('git branch detection', () => {
    test('detects git branch from project directory', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce('main\n');
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(trackSessionStart).toHaveBeenCalledWith(
        expect.objectContaining({
          git_branch: 'main',
        })
      );
    });

    test('trims whitespace from branch name', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce('  dev  \n');
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(trackSessionStart).toHaveBeenCalledWith(
        expect.objectContaining({
          git_branch: 'dev',
        })
      );
    });

    test('passes undefined branch when git command fails', () => {
      // Arrange
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('Not a git repository');
      });
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(trackSessionStart).toHaveBeenCalledWith(
        expect.objectContaining({
          git_branch: undefined,
        })
      );
    });

    test('passes undefined branch when git returns empty string', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce('');
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(trackSessionStart).toHaveBeenCalledWith(
        expect.objectContaining({
          git_branch: undefined,
        })
      );
    });

    test('uses correct git command with timeout', () => {
      // Arrange
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(execSync).toHaveBeenCalledWith(
        'git rev-parse --abbrev-ref HEAD',
        expect.objectContaining({
          cwd: TEST_PROJECT_DIR,
          encoding: 'utf8',
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );
    });

    test('handles git timeout gracefully', () => {
      // Arrange
      vi.mocked(execSync).mockImplementationOnce(() => {
        const error = new Error('Command timed out');
        (error as NodeJS.ErrnoException).code = 'ETIMEDOUT';
        throw error;
      });
      const input = createHookInput();

      // Act
      const result = sessionTracking(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('context passing', () => {
    test('passes project_dir from input', () => {
      // Arrange
      const input = createHookInput({ project_dir: '/custom/project' });

      // Act
      sessionTracking(input);

      // Assert
      expect(trackSessionStart).toHaveBeenCalledWith(
        expect.objectContaining({
          project_dir: '/custom/project',
        })
      );
    });

    test('uses environment variable when project_dir not in input', () => {
      // Arrange
      process.env.CLAUDE_PROJECT_DIR = '/env/project';
      vi.mocked(getProjectDir).mockReturnValueOnce('/env/project');
      const input = createHookInput({ project_dir: undefined });

      // Act
      sessionTracking(input);

      // Assert
      expect(trackSessionStart).toHaveBeenCalledWith(
        expect.objectContaining({
          project_dir: '/env/project',
        })
      );
    });
  });

  describe('logging behavior', () => {
    test('logs session start with branch name', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce('develop');
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-tracking',
        'Tracked session start: branch=develop',
        'debug'
      );
    });

    test('logs "unknown" when branch not detected', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce('');
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-tracking',
        'Tracked session start: branch=unknown',
        'debug'
      );
    });

    test('logs error with warn level on tracking failure', () => {
      // Arrange
      vi.mocked(trackSessionStart).mockImplementationOnce(() => {
        throw new Error('Tracking failed');
      });
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-tracking',
        expect.stringContaining('Error:'),
        'warn'
      );
    });
  });

  describe('error handling', () => {
    test('continues even when trackSessionStart throws', () => {
      // Arrange
      vi.mocked(trackSessionStart).mockImplementationOnce(() => {
        throw new Error('Tracking failed');
      });
      const input = createHookInput();

      // Act
      const result = sessionTracking(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('continues even when git command throws', () => {
      // Arrange
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('Git error');
      });
      const input = createHookInput();

      // Act
      const result = sessionTracking(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('never blocks session start', () => {
      // Arrange
      vi.mocked(trackSessionStart).mockImplementationOnce(() => {
        throw new Error('Critical error');
      });
      const input = createHookInput();

      // Act
      const result = sessionTracking(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });

    test('still calls trackSessionStart even if git fails', () => {
      // Arrange
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('Git error');
      });
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(trackSessionStart).toHaveBeenCalledWith(
        expect.objectContaining({
          project_dir: TEST_PROJECT_DIR,
          git_branch: undefined,
        })
      );
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = sessionTracking(input);

      // Assert
      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('suppressOutput', true);
    });

    test('always returns continue: true for non-blocking hook', () => {
      // Arrange - various error conditions
      const errorScenarios = [
        () => vi.mocked(execSync).mockImplementationOnce(() => { throw new Error(); }),
        () => vi.mocked(trackSessionStart).mockImplementationOnce(() => { throw new Error(); }),
      ];

      // Act & Assert
      for (const setupError of errorScenarios) {
        vi.clearAllMocks();
        setupError();
        const input = createHookInput();
        const result = sessionTracking(input);
        expect(result.continue).toBe(true);
      }
    });

    test('always suppresses output', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = sessionTracking(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('parametric tests', () => {
    test.each([
      ['main', 'main'],
      ['develop', 'develop'],
      ['feature/new-feature', 'feature/new-feature'],
      ['bugfix/fix-123', 'bugfix/fix-123'],
      ['release/v1.0.0', 'release/v1.0.0'],
      ['HEAD', 'HEAD'],
    ])('handles branch name "%s"', (gitOutput, expectedBranch) => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(gitOutput);
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(trackSessionStart).toHaveBeenCalledWith(
        expect.objectContaining({
          git_branch: expectedBranch,
        })
      );
    });

    test.each([
      ['', undefined],
      ['  ', undefined],
      ['\n', undefined],
      ['\t\n', undefined],
    ])('handles empty git output "%s"', (gitOutput, expectedBranch) => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(gitOutput);
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(trackSessionStart).toHaveBeenCalledWith(
        expect.objectContaining({
          git_branch: expectedBranch,
        })
      );
    });

    test.each([
      ['/project/one', '/project/one'],
      ['/home/user/project', '/home/user/project'],
      ['/tmp/test', '/tmp/test'],
    ])('uses project_dir "%s" correctly', (projectDir, expectedDir) => {
      // Arrange
      const input = createHookInput({ project_dir: projectDir });

      // Act
      sessionTracking(input);

      // Assert
      expect(trackSessionStart).toHaveBeenCalledWith(
        expect.objectContaining({
          project_dir: expectedDir,
        })
      );
    });
  });

  describe('edge cases', () => {
    test('handles very long branch names', () => {
      // Arrange
      const longBranch = `feature/${'a'.repeat(200)}`;
      vi.mocked(execSync).mockReturnValueOnce(longBranch);
      const input = createHookInput();

      // Act
      const result = sessionTracking(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(trackSessionStart).toHaveBeenCalledWith(
        expect.objectContaining({
          git_branch: longBranch,
        })
      );
    });

    test('handles branch names with special characters', () => {
      // Arrange
      const specialBranch = 'feature/test-branch_v1.0';
      vi.mocked(execSync).mockReturnValueOnce(specialBranch);
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(trackSessionStart).toHaveBeenCalledWith(
        expect.objectContaining({
          git_branch: specialBranch,
        })
      );
    });

    test('handles detached HEAD state', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce('HEAD');
      const input = createHookInput();

      // Act
      const result = sessionTracking(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(trackSessionStart).toHaveBeenCalledWith(
        expect.objectContaining({
          git_branch: 'HEAD',
        })
      );
    });

    test('handles paths with spaces', () => {
      // Arrange
      const pathWithSpaces = '/home/user/my project';
      const input = createHookInput({ project_dir: pathWithSpaces });

      // Act
      const result = sessionTracking(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cwd: pathWithSpaces,
        })
      );
    });

    test('handles undefined input gracefully', () => {
      // Arrange
      const input = createHookInput({
        project_dir: undefined,
        session_id: undefined as unknown as string,
      });

      // Act
      const result = sessionTracking(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('integration with session-tracker', () => {
    test('calls trackSessionStart exactly once', () => {
      // Arrange
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(trackSessionStart).toHaveBeenCalledTimes(1);
    });

    test('passes complete context object to trackSessionStart', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce('develop');
      const input = createHookInput({ project_dir: '/custom/path' });

      // Act
      sessionTracking(input);

      // Assert
      expect(trackSessionStart).toHaveBeenCalledWith({
        project_dir: '/custom/path',
        git_branch: 'develop',
        added_dirs_count: 0,
      });
    });
  });

  describe('outputSilentSuccess usage', () => {
    test('calls outputSilentSuccess on success', () => {
      // Arrange
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('calls outputSilentSuccess on error', () => {
      // Arrange
      vi.mocked(trackSessionStart).mockImplementationOnce(() => {
        throw new Error('Error');
      });
      const input = createHookInput();

      // Act
      sessionTracking(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });
});

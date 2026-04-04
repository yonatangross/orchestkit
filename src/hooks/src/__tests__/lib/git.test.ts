/**
 * Unit tests for lib/git.ts shared utilities
 *
 * Tests getDirtyFileCount (used by commit-nudge and task-commit-linker),
 * plus other git helpers.
 *
 * @since v7.2.0
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => mockCommonBasic());

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => ''),
  execFileSync: vi.fn(() => ''),
}));

import {
  getDirtyFileCount,
  getCurrentBranch,
  isProtectedBranch,
  getProtectedBranches,
  isGitRepo,
  extractIssueNumber,
  getStagedFiles,
  validateBranchName,
  getRepoRoot,
  getDefaultBranch,
  getGitStatus,
  hasUncommittedChanges,
} from '../../lib/git.js';
import { execFileSync } from 'node:child_process';
import { createTestContext } from '../fixtures/test-context.js';

// =============================================================================
// Tests
// =============================================================================

let testCtx: ReturnType<typeof createTestContext>;
describe('lib/git', () => {
  beforeEach(() => {
    testCtx = createTestContext();
    vi.clearAllMocks();
    delete process.env.ORCHESTKIT_PROTECTED_BRANCHES;
  });

  // ---------------------------------------------------------------------------
  // getDirtyFileCount
  // ---------------------------------------------------------------------------

  describe('getDirtyFileCount', () => {
    test('returns 0 for clean repo', () => {
      vi.mocked(execFileSync).mockReturnValue('');

      expect(getDirtyFileCount('/test/project')).toBe(0);
    });

    test('counts modified files correctly', () => {
      vi.mocked(execFileSync).mockReturnValue(
        ' M src/index.ts\n M src/app.ts\n?? untracked.txt\n'
      );

      expect(getDirtyFileCount('/test/project')).toBe(3);
    });

    test('filters empty lines from porcelain output', () => {
      vi.mocked(execFileSync).mockReturnValue(' M file.ts\n\n\n M other.ts\n');

      expect(getDirtyFileCount('/test/project')).toBe(2);
    });

    test('returns 0 when git command throws (not a git repo)', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      expect(getDirtyFileCount('/not/a/repo')).toBe(0);
    });

    test('passes cwd and timeout to execFileSync', () => {
      vi.mocked(execFileSync).mockReturnValue('');

      getDirtyFileCount('/my/project');

      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['status', '--porcelain'],
        expect.objectContaining({
          cwd: '/my/project',
          timeout: 3000,
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getCurrentBranch
  // ---------------------------------------------------------------------------

  describe('getCurrentBranch', () => {
    test('returns branch name from git', () => {
      vi.mocked(execFileSync).mockReturnValue('feat/my-feature\n');

      expect(getCurrentBranch('/test/project')).toBe('feat/my-feature');
    });

    test('returns "unknown" when git command fails', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('detached HEAD');
      });

      expect(getCurrentBranch('/test/project')).toBe('unknown');
    });
  });

  // ---------------------------------------------------------------------------
  // getProtectedBranches
  // ---------------------------------------------------------------------------

  describe('getProtectedBranches', () => {
    test('returns default ["main", "master"] when env is not set', () => {
      expect(getProtectedBranches()).toEqual(['main', 'master']);
    });

    test('parses comma-separated env var', () => {
      process.env.ORCHESTKIT_PROTECTED_BRANCHES = 'main,dev,staging';

      expect(getProtectedBranches()).toEqual(['main', 'dev', 'staging']);
    });

    test('trims whitespace from entries', () => {
      process.env.ORCHESTKIT_PROTECTED_BRANCHES = ' main , dev ';

      expect(getProtectedBranches()).toEqual(['main', 'dev']);
    });

    test('filters empty entries', () => {
      process.env.ORCHESTKIT_PROTECTED_BRANCHES = 'main,,dev,';

      expect(getProtectedBranches()).toEqual(['main', 'dev']);
    });
  });

  // ---------------------------------------------------------------------------
  // isProtectedBranch
  // ---------------------------------------------------------------------------

  describe('isProtectedBranch', () => {
    test('returns true for "main"', () => {
      expect(isProtectedBranch('main')).toBe(true);
    });

    test('returns true for "master"', () => {
      expect(isProtectedBranch('master')).toBe(true);
    });

    test('returns false for feature branch', () => {
      expect(isProtectedBranch('feat/my-feature')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // isGitRepo
  // ---------------------------------------------------------------------------

  describe('isGitRepo', () => {
    test('returns true when git rev-parse succeeds', () => {
      vi.mocked(execFileSync).mockReturnValue('.git\n');

      expect(isGitRepo('/test/project')).toBe(true);
    });

    test('returns false when git rev-parse fails', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      expect(isGitRepo('/not/a/repo')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // extractIssueNumber
  // ---------------------------------------------------------------------------

  describe('extractIssueNumber', () => {
    test('extracts from issue/123-description', () => {
      expect(extractIssueNumber('issue/123-fix-login')).toBe(123);
    });

    test('extracts from feature/456', () => {
      expect(extractIssueNumber('feature/456')).toBe(456);
    });

    test('extracts from fix/789', () => {
      expect(extractIssueNumber('fix/789')).toBe(789);
    });

    test('extracts from feat/42-add-auth', () => {
      expect(extractIssueNumber('feat/42-add-auth')).toBe(42);
    });

    test('returns null when no issue number found', () => {
      expect(extractIssueNumber('chore/update-deps')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getStagedFiles
  // ---------------------------------------------------------------------------

  describe('getStagedFiles', () => {
    test('returns array of staged file paths', () => {
      vi.mocked(execFileSync).mockReturnValue('src/index.ts\nsrc/app.ts\n');

      expect(getStagedFiles('/test/project')).toEqual(['src/index.ts', 'src/app.ts']);
    });

    test('returns empty array when nothing is staged', () => {
      vi.mocked(execFileSync).mockReturnValue('');

      expect(getStagedFiles('/test/project')).toEqual([]);
    });

    test('returns empty array when git command fails', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('not a git repo');
      });

      expect(getStagedFiles('/test/project')).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // validateBranchName
  // ---------------------------------------------------------------------------

  describe('validateBranchName', () => {
    test('returns null for valid feature branch', () => {
      expect(validateBranchName('feature/123-add-login')).toBeNull();
    });

    test('returns null for protected branches (skips validation)', () => {
      expect(validateBranchName('main')).toBeNull();
    });

    test('returns error for invalid prefix', () => {
      const result = validateBranchName('random-branch-name');
      expect(result).toContain('valid prefix');
    });

    test('returns error for issue/ branch without number', () => {
      const result = validateBranchName('issue/fix-something');
      expect(result).toContain('issue number');
    });
  });

  // ---------------------------------------------------------------------------
  // getRepoRoot
  // ---------------------------------------------------------------------------

  describe('getRepoRoot', () => {
    test('returns trimmed path when git command succeeds', () => {
      // Arrange
      vi.mocked(execFileSync).mockReturnValue('/home/user/my-project\n');

      // Act
      const result = getRepoRoot('/test/project');

      // Assert
      expect(result).toBe('/home/user/my-project');
      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--show-toplevel'],
        expect.objectContaining({ cwd: '/test/project' }),
      );
    });

    test('trims whitespace from returned path', () => {
      vi.mocked(execFileSync).mockReturnValue('  /some/path  \n');

      const result = getRepoRoot('/test/project');

      expect(result).toBe('/some/path');
    });

    test('returns the projectDir as fallback when git command fails', () => {
      // Arrange
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      // Act — passing an explicit dir
      const result = getRepoRoot('/my/fallback');

      // Assert — falls back to the cwd argument
      expect(result).toBe('/my/fallback');
    });
  });

  // ---------------------------------------------------------------------------
  // getDefaultBranch
  // ---------------------------------------------------------------------------

  describe('getDefaultBranch', () => {
    test('returns "main" when main branch exists', () => {
      // Arrange: first execFileSync succeeds
      vi.mocked(execFileSync).mockReturnValue('main\n');

      // Act
      const result = getDefaultBranch('/test/project');

      // Assert
      expect(result).toBe('main');
      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--verify', 'main'],
        expect.objectContaining({ cwd: '/test/project' }),
      );
    });

    test('returns "master" when main fails but master exists', () => {
      // Arrange: first call throws (main not found), second succeeds (master found)
      vi.mocked(execFileSync)
        .mockImplementationOnce(() => { throw new Error('fatal: ambiguous argument'); })
        .mockReturnValueOnce('master\n');

      // Act
      const result = getDefaultBranch('/test/project');

      // Assert
      expect(result).toBe('master');
      expect(execFileSync).toHaveBeenCalledTimes(2);
    });

    test('returns "main" as default when both main and master are absent', () => {
      // Arrange: both calls throw
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('fatal: ambiguous argument');
      });

      // Act
      const result = getDefaultBranch('/test/project');

      // Assert — the hardcoded fallback is "main"
      expect(result).toBe('main');
      expect(execFileSync).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getGitStatus
  // ---------------------------------------------------------------------------

  describe('getGitStatus', () => {
    test('returns trimmed status string on success', () => {
      // Arrange
      vi.mocked(execFileSync).mockReturnValue(' M src/lib/git.ts\n?? newfile.ts\n');

      // Act
      const result = getGitStatus('/test/project');

      // Assert — result is trimmed
      expect(result).toBe('M src/lib/git.ts\n?? newfile.ts');
      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['status', '--short'],
        expect.objectContaining({ cwd: '/test/project' }),
      );
    });

    test('returns empty string for a clean working tree', () => {
      vi.mocked(execFileSync).mockReturnValue('');

      const result = getGitStatus('/test/project');

      expect(result).toBe('');
    });

    test('returns empty string when git command throws', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = getGitStatus('/test/project');

      expect(result).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // hasUncommittedChanges
  // ---------------------------------------------------------------------------

  describe('hasUncommittedChanges', () => {
    test('returns true when there are modified files', () => {
      // Arrange — non-empty status means dirty
      vi.mocked(execFileSync).mockReturnValue(' M src/file.ts\n');

      // Act
      const result = hasUncommittedChanges('/test/project');

      // Assert
      expect(result).toBe(true);
    });

    test('returns false for a clean working tree', () => {
      // Arrange — empty status means clean
      vi.mocked(execFileSync).mockReturnValue('');

      // Act
      const result = hasUncommittedChanges('/test/project');

      // Assert
      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // extractIssueNumber — additional patterns
  // ---------------------------------------------------------------------------

  describe('extractIssueNumber additional patterns', () => {
    test('extracts from bug/ prefix', () => {
      expect(extractIssueNumber('bug/456-segfault-on-startup')).toBe(456);
    });

    test('extracts from branch name starting with digits (N-description)', () => {
      expect(extractIssueNumber('123-fix-thing')).toBe(123);
    });

    test('extracts from branch name ending with digits (description-N)', () => {
      expect(extractIssueNumber('fix-thing-456')).toBe(456);
    });

    test('extracts from # notation in branch name', () => {
      expect(extractIssueNumber('fix-#789-crash')).toBe(789);
    });
  });
});

/**
 * Unit tests for lib/git.ts shared utilities
 *
 * Tests getDirtyFileCount (used by commit-nudge and task-commit-linker),
 * plus other git helpers.
 *
 * @since v7.2.0
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => ({
  getProjectDir: vi.fn(() => '/test/project'),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => ''),
}));

import {
  getDirtyFileCount,
  getCurrentBranch,
  isProtectedBranch,
  getProtectedBranches,
  isGitRepo,
  extractIssueNumber,
  getStagedFiles,
  analyzeStagedChanges,
  validateBranchName,
} from '../../lib/git.js';
import { execSync } from 'node:child_process';

// =============================================================================
// Tests
// =============================================================================

describe('lib/git', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ORCHESTKIT_PROTECTED_BRANCHES;
  });

  // ---------------------------------------------------------------------------
  // getDirtyFileCount
  // ---------------------------------------------------------------------------

  describe('getDirtyFileCount', () => {
    test('returns 0 for clean repo', () => {
      vi.mocked(execSync).mockReturnValue('');

      expect(getDirtyFileCount('/test/project')).toBe(0);
    });

    test('counts modified files correctly', () => {
      vi.mocked(execSync).mockReturnValue(
        ' M src/index.ts\n M src/app.ts\n?? untracked.txt\n'
      );

      expect(getDirtyFileCount('/test/project')).toBe(3);
    });

    test('filters empty lines from porcelain output', () => {
      vi.mocked(execSync).mockReturnValue(' M file.ts\n\n\n M other.ts\n');

      expect(getDirtyFileCount('/test/project')).toBe(2);
    });

    test('returns 0 when git command throws (not a git repo)', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      expect(getDirtyFileCount('/not/a/repo')).toBe(0);
    });

    test('passes cwd and timeout to execSync', () => {
      vi.mocked(execSync).mockReturnValue('');

      getDirtyFileCount('/my/project');

      expect(execSync).toHaveBeenCalledWith(
        'git status --porcelain',
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
      vi.mocked(execSync).mockReturnValue('feat/my-feature\n');

      expect(getCurrentBranch('/test/project')).toBe('feat/my-feature');
    });

    test('returns "unknown" when git command fails', () => {
      vi.mocked(execSync).mockImplementation(() => {
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
      vi.mocked(execSync).mockReturnValue('.git\n');

      expect(isGitRepo('/test/project')).toBe(true);
    });

    test('returns false when git rev-parse fails', () => {
      vi.mocked(execSync).mockImplementation(() => {
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
      vi.mocked(execSync).mockReturnValue('src/index.ts\nsrc/app.ts\n');

      expect(getStagedFiles('/test/project')).toEqual(['src/index.ts', 'src/app.ts']);
    });

    test('returns empty array when nothing is staged', () => {
      vi.mocked(execSync).mockReturnValue('');

      expect(getStagedFiles('/test/project')).toEqual([]);
    });

    test('returns empty array when git command fails', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repo');
      });

      expect(getStagedFiles('/test/project')).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // analyzeStagedChanges
  // ---------------------------------------------------------------------------

  describe('analyzeStagedChanges', () => {
    test('classifies test files correctly', () => {
      vi.mocked(execSync).mockReturnValue('src/index.test.ts\ntests/unit.ts\nsrc/__tests__/foo.ts\n');

      const result = analyzeStagedChanges('/test/project');

      expect(result.hasTests).toBe(true);
      expect(result.hasSource).toBe(false);
      expect(result.files).toHaveLength(3);
    });

    test('classifies config files correctly', () => {
      vi.mocked(execSync).mockReturnValue('package.json\ntsconfig.json\n.env\nconfig/app.yml\n');

      const result = analyzeStagedChanges('/test/project');

      expect(result.hasConfig).toBe(true);
      expect(result.hasSource).toBe(false);
    });

    test('classifies docs correctly', () => {
      vi.mocked(execSync).mockReturnValue('README.md\ndocs/setup.md\nnotes.txt\n');

      const result = analyzeStagedChanges('/test/project');

      expect(result.hasDocs).toBe(true);
      expect(result.hasSource).toBe(false);
    });

    test('classifies source files as hasSource', () => {
      vi.mocked(execSync).mockReturnValue('src/index.ts\nsrc/app.tsx\n');

      const result = analyzeStagedChanges('/test/project');

      expect(result.hasSource).toBe(true);
      expect(result.hasTests).toBe(false);
      expect(result.hasConfig).toBe(false);
      expect(result.hasDocs).toBe(false);
    });

    test('detects mixed change types', () => {
      vi.mocked(execSync).mockReturnValue('src/index.ts\nsrc/index.test.ts\npackage.json\nREADME.md\n');

      const result = analyzeStagedChanges('/test/project');

      expect(result.hasSource).toBe(true);
      expect(result.hasTests).toBe(true);
      expect(result.hasConfig).toBe(true);
      expect(result.hasDocs).toBe(true);
    });

    test('tracks top-level and second-level directories', () => {
      vi.mocked(execSync).mockReturnValue('src/hooks/index.ts\nlib/utils.ts\n');

      const result = analyzeStagedChanges('/test/project');

      expect(result.directories.has('src')).toBe(true);
      expect(result.directories.has('src/hooks')).toBe(true);
      expect(result.directories.has('lib')).toBe(true);
    });

    test('tracks file extensions', () => {
      vi.mocked(execSync).mockReturnValue('src/index.ts\nsrc/style.css\nREADME.md\n');

      const result = analyzeStagedChanges('/test/project');

      expect(result.extensions.has('ts')).toBe(true);
      expect(result.extensions.has('css')).toBe(true);
      expect(result.extensions.has('md')).toBe(true);
    });

    test('returns empty results when no staged files', () => {
      vi.mocked(execSync).mockReturnValue('');

      const result = analyzeStagedChanges('/test/project');

      expect(result.files).toEqual([]);
      expect(result.directories.size).toBe(0);
      expect(result.hasSource).toBe(false);
      expect(result.hasTests).toBe(false);
      expect(result.hasConfig).toBe(false);
      expect(result.hasDocs).toBe(false);
    });

    test('handles root-level files (no directory)', () => {
      vi.mocked(execSync).mockReturnValue('.gitignore\n');

      const result = analyzeStagedChanges('/test/project');

      expect(result.directories.size).toBe(0);
      expect(result.files).toEqual(['.gitignore']);
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
});

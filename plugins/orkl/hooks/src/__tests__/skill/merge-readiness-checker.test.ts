/**
 * Unit tests for merge-readiness-checker hook
 * Tests comprehensive merge readiness checks for worktree branches
 *
 * BLOCKING HOOK: Can return continue: false when blockers detected
 * CC 2.1.7 Compliant
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST come BEFORE imports
// =============================================================================

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

vi.mock('../../lib/git.js', () => ({
  getRepoRoot: vi.fn(() => '/test/project'),
  getCurrentBranch: vi.fn(() => 'feature-branch'),
  getDefaultBranch: vi.fn(() => 'main'),
  hasUncommittedChanges: vi.fn(() => false),
}));

import { mergeReadinessChecker } from '../../skill/merge-readiness-checker.js';
import { outputSilentSuccess, getProjectDir } from '../../lib/common.js';
import { getRepoRoot, getCurrentBranch, getDefaultBranch, hasUncommittedChanges } from '../../lib/git.js';
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for Bash tool
 */
function createBashInput(
  command: string,
  overrides: Partial<HookInput> = {}
): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {
      command: command,
    },
    ...overrides,
  };
}

/**
 * Mock execSync to return specific outputs for git commands
 */
function mockGitCommands(overrides: Record<string, string | Error> = {}): void {
  vi.mocked(execSync).mockImplementation((cmd: string) => {
    const command = cmd as string;

    // Check for specific overrides first
    for (const [pattern, result] of Object.entries(overrides)) {
      if (command.includes(pattern)) {
        if (result instanceof Error) throw result;
        return result;
      }
    }

    // Default responses
    if (command.includes('git status --short')) return '';
    if (command.includes('git fetch')) return '';
    if (command.includes('rev-list --count')) return '0\n';
    if (command.includes('git merge --no-commit')) return '';
    if (command.includes('git merge --abort')) return '';
    if (command.includes('git merge-base')) return 'abc123\n';
    if (command.includes('git diff --name-only')) return '';
    return '';
  });
}

// =============================================================================
// Merge Readiness Checker Tests
// =============================================================================

describe('merge-readiness-checker', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mockGitCommands();
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(hasUncommittedChanges).mockReturnValue(false);
    vi.mocked(getCurrentBranch).mockReturnValue('feature-branch');
    vi.mocked(getDefaultBranch).mockReturnValue('main');
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true for non-merge commands', () => {
      // Arrange
      const input = createBashInput('git status');

      // Act
      const result = mergeReadinessChecker(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true when all checks pass', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');

      // Act
      const result = mergeReadinessChecker(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: false when blockers detected', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      mockGitCommands({
        'origin/main..feature-branch': '5\n',
        'feature-branch..origin/main': '25\n', // Significantly behind
      });

      // Act
      const result = mergeReadinessChecker(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('blockers');
    });
  });

  // ---------------------------------------------------------------------------
  // Command matching
  // ---------------------------------------------------------------------------

  describe('command matching', () => {
    test.each([
      ['gh pr merge 123'],
      ['gh pr merge --squash'],
      ['git merge main'],
      ['git merge feature-branch'],
      ['git rebase main'],
      ['git rebase -i main'],
    ])('triggers for merge command: %s', (command) => {
      // Arrange
      const input = createBashInput(command);

      // Act
      mergeReadinessChecker(input);

      // Assert
      expect(stderrSpy).toHaveBeenCalled();
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Checking merge readiness');
    });

    test.each([
      ['git status'],
      ['git log'],
      ['git push'],
      ['npm test'],
      ['echo merge'],
      ['cat merge.txt'],
    ])('does not trigger for non-merge command: %s', (command) => {
      // Arrange
      const input = createBashInput(command);

      // Act
      const result = mergeReadinessChecker(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('command matching is case insensitive', () => {
      // Arrange
      const input = createBashInput('GIT MERGE main');

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Checking merge readiness');
    });
  });

  // ---------------------------------------------------------------------------
  // Branch checks
  // ---------------------------------------------------------------------------

  describe('branch checks', () => {
    test('skips check when already on target branch', () => {
      // Arrange
      const input = createBashInput('git merge main');
      vi.mocked(getCurrentBranch).mockReturnValue('main');

      // Act
      const result = mergeReadinessChecker(input);

      // Assert
      expect(result.continue).toBe(true);
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Already on target branch');
    });

    test('uses target_branch from tool_input if provided', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Bash',
        session_id: 'test-session-123',
        project_dir: '/test/project',
        tool_input: {
          command: 'gh pr merge',
          target_branch: 'develop',
        },
      };
      vi.mocked(getCurrentBranch).mockReturnValue('feature');

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('feature -> develop');
    });
  });

  // ---------------------------------------------------------------------------
  // Check 1: Uncommitted changes
  // ---------------------------------------------------------------------------

  describe('uncommitted changes check', () => {
    test('passes when no uncommitted changes', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      vi.mocked(hasUncommittedChanges).mockReturnValue(false);

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('No uncommitted changes');
    });

    test('blocks when uncommitted changes detected', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      vi.mocked(hasUncommittedChanges).mockReturnValue(true);
      mockGitCommands({
        'git status --short': 'M  file.ts\n?? new.ts\n',
      });

      // Act
      const result = mergeReadinessChecker(input);

      // Assert
      expect(result.continue).toBe(false);
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Uncommitted changes detected');
    });

    test('shows up to 10 changed files in error', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      vi.mocked(hasUncommittedChanges).mockReturnValue(true);
      const files = Array.from({ length: 15 }, (_, i) => `M  file${i}.ts`).join('\n');
      mockGitCommands({
        'git status --short': files,
      });

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('file0.ts');
      expect(stderrOutput).toContain('file9.ts');
      // Should only show first 10
    });
  });

  // ---------------------------------------------------------------------------
  // Check 2: Branch divergence
  // ---------------------------------------------------------------------------

  describe('branch divergence check', () => {
    test('passes when close to target branch', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      mockGitCommands({
        'origin/main..feature-branch': '5\n',
        'feature-branch..origin/main': '3\n',
      });

      // Act
      const result = mergeReadinessChecker(input);

      // Assert
      expect(result.continue).toBe(true);
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('up to date');
    });

    test('warns when moderately behind', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      mockGitCommands({
        'origin/main..feature-branch': '5\n',
        'feature-branch..origin/main': '10\n',
      });

      // Act
      const result = mergeReadinessChecker(input);

      // Assert
      expect(result.continue).toBe(true);
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('WARNINGS');
      expect(stderrOutput).toContain('behind');
    });

    test('blocks when significantly behind (>20 commits)', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      mockGitCommands({
        'origin/main..feature-branch': '5\n',
        'feature-branch..origin/main': '25\n',
      });

      // Act
      const result = mergeReadinessChecker(input);

      // Assert
      expect(result.continue).toBe(false);
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('significantly behind');
    });

    test('fetches target branch before checking', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');

      // Act
      mergeReadinessChecker(input);

      // Assert
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('git fetch origin main'),
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Check 3: Merge conflicts
  // ---------------------------------------------------------------------------

  describe('merge conflict check', () => {
    test('passes when no conflicts', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      mockGitCommands({
        'git merge --no-commit': '', // Clean merge
      });

      // Act
      const result = mergeReadinessChecker(input);

      // Assert
      expect(result.continue).toBe(true);
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('No merge conflicts');
    });

    test('blocks when conflicts detected', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      mockGitCommands({
        'git merge --no-commit': 'CONFLICT (content): Merge conflict in file.ts',
        'git diff --name-only --diff-filter=U': 'file.ts\nother.ts\n',
      });

      // Act
      const result = mergeReadinessChecker(input);

      // Assert
      expect(result.continue).toBe(false);
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Merge conflicts detected');
      expect(stderrOutput).toContain('file.ts');
    });

    test('aborts test merge after check', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');

      // Act
      mergeReadinessChecker(input);

      // Assert
      expect(execSync).toHaveBeenCalledWith(
        'git merge --abort',
        expect.any(Object)
      );
    });

    test('shows up to 10 conflicting files', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      const files = Array.from({ length: 15 }, (_, i) => `file${i}.ts`).join('\n');
      mockGitCommands({
        'git merge --no-commit': 'CONFLICT',
        'git diff --name-only --diff-filter=U': files,
      });

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('file0.ts');
      expect(stderrOutput).toContain('file9.ts');
    });
  });

  // ---------------------------------------------------------------------------
  // Check 4: Quality gates
  // ---------------------------------------------------------------------------

  describe('quality gates check', () => {
    test('reports changed files count', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      mockGitCommands({
        'git merge-base': 'abc123\n',
        'git diff --name-only abc123': 'file1.ts\nfile2.ts\nfile3.ts\n',
      });

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('3 changed files');
    });

    test('warns when merge-base cannot be determined', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      mockGitCommands({
        'git merge-base': '', // Empty result
      });

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Cannot determine merge base');
    });
  });

  // ---------------------------------------------------------------------------
  // Check 5: Test suite
  // ---------------------------------------------------------------------------

  describe('test suite check', () => {
    test('detects frontend test script', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      vi.mocked(existsSync).mockImplementation((path) =>
        path === '/test/project/package.json'
      );
      vi.mocked(readFileSync).mockReturnValue('{"scripts": {"test": "vitest"}}');

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Frontend test script found');
    });

    test('detects pytest.ini', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      vi.mocked(existsSync).mockImplementation((path) =>
        path === '/test/project/pytest.ini'
      );

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Backend test configuration found');
    });

    test('detects pyproject.toml', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      vi.mocked(existsSync).mockImplementation((path) =>
        path === '/test/project/pyproject.toml'
      );

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Backend test configuration found');
    });
  });

  // ---------------------------------------------------------------------------
  // Report generation
  // ---------------------------------------------------------------------------

  describe('report generation', () => {
    test('generates merge readiness report', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('MERGE READINESS REPORT');
    });

    test('shows branch information in report', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      vi.mocked(getCurrentBranch).mockReturnValue('my-feature');

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('my-feature -> main');
    });

    test('shows PASSED CHECKS section', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('PASSED CHECKS');
    });

    test('shows WARNINGS section when warnings exist', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      mockGitCommands({
        'feature-branch..origin/main': '10\n', // Moderate divergence
      });

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('WARNINGS');
    });

    test('shows BLOCKERS section when errors exist', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      vi.mocked(hasUncommittedChanges).mockReturnValue(true);
      mockGitCommands({ 'git status --short': 'M  file.ts\n' });

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('BLOCKERS');
    });

    test('shows MERGE READY when all checks pass', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('MERGE READY');
    });

    test('shows MERGE NOT READY when blockers exist', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      mockGitCommands({
        'feature-branch..origin/main': '25\n',
      });

      // Act
      mergeReadinessChecker(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('MERGE NOT READY');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty command', () => {
      // Arrange
      const input = createBashInput('');

      // Act
      const result = mergeReadinessChecker(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('handles undefined command', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Bash',
        session_id: 'test-session-123',
        project_dir: '/test/project',
        tool_input: {},
      };

      // Act
      const result = mergeReadinessChecker(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles git command failures gracefully', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('git failed');
      });

      // Act & Assert
      expect(() => mergeReadinessChecker(input)).not.toThrow();
    });

    test('handles readFileSync failure gracefully with silent success', () => {
      // Arrange - For non-merge commands, should return silent success
      const input = createBashInput('git status');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Act
      const result = mergeReadinessChecker(input);

      // Assert - Non-merge commands skip validation
      expect(result.continue).toBe(true);
    });

    test('uses getRepoRoot fallback to getProjectDir', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      vi.mocked(getRepoRoot).mockReturnValue('');
      vi.mocked(getProjectDir).mockReturnValue('/fallback/project');

      // Act
      mergeReadinessChecker(input);

      // Assert
      expect(getProjectDir).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Timeout handling
  // ---------------------------------------------------------------------------

  describe('timeout handling', () => {
    test('git commands have 30 second timeout', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');

      // Act
      mergeReadinessChecker(input);

      // Assert
      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 30000 })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple conditions
  // ---------------------------------------------------------------------------

  describe('multiple conditions', () => {
    test('reports all issues, not just first', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      vi.mocked(hasUncommittedChanges).mockReturnValue(true);
      mockGitCommands({
        'git status --short': 'M  file.ts\n',
        'feature-branch..origin/main': '25\n',
        'git merge --no-commit': 'CONFLICT',
        'git diff --name-only --diff-filter=U': 'conflict.ts\n',
      });

      // Act
      const result = mergeReadinessChecker(input);

      // Assert
      expect(result.continue).toBe(false);
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Uncommitted changes');
      expect(stderrOutput).toContain('significantly behind');
      expect(stderrOutput).toContain('Merge conflicts');
    });

    test('succeeds with warnings but no blockers', () => {
      // Arrange
      const input = createBashInput('gh pr merge 123');
      mockGitCommands({
        'feature-branch..origin/main': '10\n', // Warning level
      });

      // Act
      const result = mergeReadinessChecker(input);

      // Assert
      expect(result.continue).toBe(true);
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('MERGE READY WITH WARNINGS');
    });
  });
});

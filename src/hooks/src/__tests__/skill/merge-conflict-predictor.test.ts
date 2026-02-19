/**
 * Unit tests for merge-conflict-predictor hook
 * Tests prediction of merge conflicts before commits
 *
 * WARNING HOOK: Outputs warnings to stderr, always returns continue: true
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
  outputWithContext: vi.fn((ctx: string) => ({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: ctx,
    },
  })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

vi.mock('../../lib/git.js', () => ({
  getRepoRoot: vi.fn(() => '/test/project'),
  getCurrentBranch: vi.fn(() => 'feature-branch'),
  getDefaultBranch: vi.fn(() => 'main'),
}));

import { mergeConflictPredictor } from '../../skill/merge-conflict-predictor.js';
import { outputSilentSuccess, outputWithContext, } from '../../lib/common.js';
import { getRepoRoot, getCurrentBranch, getDefaultBranch } from '../../lib/git.js';
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for Write tool
 */
function createWriteInput(
  filePath: string,
  content: string,
  overrides: Partial<HookInput> = {}
): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {
      file_path: filePath,
      content: content,
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
    if (command.includes('worktree list')) {
      return 'worktree /test/project\nworktree /test/project-wt1\n';
    }
    if (command.includes('rev-parse --abbrev-ref HEAD')) {
      return 'feature-branch\n';
    }
    if (command.includes('git status --short')) {
      return '';
    }
    if (command.includes('rev-list --count')) {
      return '0\n';
    }
    return '';
  });
}

// =============================================================================
// Merge Conflict Predictor Tests
// =============================================================================

describe('merge-conflict-predictor', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mockGitCommands();
    vi.mocked(existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance - all paths must return continue: true
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true with minimal input', () => {
      // Arrange
      const input = createWriteInput('/test/project/file.ts', 'content');
      mockGitCommands({ 'worktree list': '' }); // No worktrees

      // Act
      const result = mergeConflictPredictor(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true when conflicts detected (warning only)', () => {
      // Arrange
      const input = createWriteInput('/test/project/src/file.ts', 'new content');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('other content');
      mockGitCommands({
        'worktree list': 'worktree /test/project\nworktree /test/worktree2\n',
        'git status --short': ' M src/file.ts\n',
      });

      // Act
      const result = mergeConflictPredictor(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true when divergence detected', () => {
      // Arrange
      const input = createWriteInput('/test/project/file.ts', 'content');
      mockGitCommands({
        'worktree list': '',
        [`${getDefaultBranch()}..feature-branch`]: '5\n',
        [`feature-branch..${getDefaultBranch()}`]: '15\n',
      });

      // Act
      const result = mergeConflictPredictor(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true when git commands fail', () => {
      // Arrange
      const input = createWriteInput('/test/project/file.ts', 'content');
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('git failed');
      });

      // Act
      const result = mergeConflictPredictor(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Early exit conditions
  // ---------------------------------------------------------------------------

  describe('early exit conditions', () => {
    test('returns silent success when file_path is empty', () => {
      // Arrange
      const input = createWriteInput('', 'content');

      // Act
      const result = mergeConflictPredictor(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success when content is empty', () => {
      // Arrange
      const input = createWriteInput('/test/project/file.ts', '');

      // Act
      const result = mergeConflictPredictor(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success when no worktrees exist', () => {
      // Arrange
      const input = createWriteInput('/test/project/file.ts', 'content');
      mockGitCommands({ 'worktree list': '' });

      // Act
      const result = mergeConflictPredictor(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Worktree detection
  // ---------------------------------------------------------------------------

  describe('worktree detection', () => {
    test('parses worktree list correctly', () => {
      // Arrange
      const input = createWriteInput('/test/project/file.ts', 'content');
      const worktreeOutput = `worktree /test/project
HEAD abc123
branch refs/heads/main

worktree /test/project-wt1
HEAD def456
branch refs/heads/feature`;
      mockGitCommands({ 'worktree list --porcelain': worktreeOutput });

      // Act
      mergeConflictPredictor(input);

      // Assert
      expect(execSync).toHaveBeenCalledWith(
        'git worktree list --porcelain',
        expect.any(Object)
      );
    });

    test('handles worktree list command failure gracefully', () => {
      // Arrange
      const input = createWriteInput('/test/project/file.ts', 'content');
      vi.mocked(execSync).mockImplementation((cmd) => {
        if ((cmd as string).includes('worktree list')) {
          throw new Error('Not a git repository');
        }
        return '';
      });

      // Act
      const result = mergeConflictPredictor(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('skips current worktree when checking modifications', () => {
      // Arrange
      const input = createWriteInput('/test/project/src/file.ts', 'content');
      vi.mocked(getRepoRoot).mockReturnValue('/test/project');
      const worktreeOutput = 'worktree /test/project\nworktree /test/other-wt\n';
      mockGitCommands({ 'worktree list --porcelain': worktreeOutput });

      // Act
      mergeConflictPredictor(input);

      // Assert - should only check /test/other-wt, not /test/project
      const statusCalls = vi.mocked(execSync).mock.calls.filter(
        (call) => (call[0] as string).includes('git status')
      );
      expect(statusCalls.every((call) => !call[1]?.cwd?.includes('/test/project$'))).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Conflict detection
  // ---------------------------------------------------------------------------

  describe('conflict detection', () => {
    test('detects modified file in another worktree', () => {
      // Arrange
      const input = createWriteInput('/test/project/src/file.ts', 'new content');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('old content');

      const worktreeOutput = 'worktree /test/project\nworktree /test/other-wt\n';
      vi.mocked(execSync).mockImplementation((cmd, opts) => {
        const command = cmd as string;
        if (command.includes('worktree list')) return worktreeOutput;
        if (command.includes('git status --short') && opts?.cwd === '/test/other-wt') {
          return ' M src/file.ts\n';
        }
        if (command.includes('rev-parse --abbrev-ref HEAD')) return 'other-feature\n';
        return '';
      });

      // Act
      mergeConflictPredictor(input);

      // Assert
      expect(stderrSpy).toHaveBeenCalled();
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('MERGE CONFLICT RISK');
    });

    test('warns about significant line differences', () => {
      // Arrange
      const input = createWriteInput('/test/project/src/file.ts', 'line\n'.repeat(50));
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('line\n'.repeat(100)); // 50 lines different

      const worktreeOutput = 'worktree /test/project\nworktree /test/other-wt\n';
      vi.mocked(execSync).mockImplementation((cmd, _opts) => {
        const command = cmd as string;
        if (command.includes('worktree list')) return worktreeOutput;
        if (command.includes('git status --short')) return ' M src/file.ts\n';
        if (command.includes('rev-parse --abbrev-ref HEAD')) return 'other-branch\n';
        return '';
      });

      // Act
      mergeConflictPredictor(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('OVERLAP');
      expect(stderrOutput).toContain('High risk of merge conflict');
    });

    test('does not warn when line differences are small', () => {
      // Arrange
      const input = createWriteInput('/test/project/src/file.ts', 'line\n'.repeat(10));
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('line\n'.repeat(12)); // Only 2 lines different

      const worktreeOutput = 'worktree /test/project\nworktree /test/other-wt\n';
      vi.mocked(execSync).mockImplementation((cmd, _opts) => {
        const command = cmd as string;
        if (command.includes('worktree list')) return worktreeOutput;
        if (command.includes('git status --short')) return ' M src/file.ts\n';
        if (command.includes('rev-parse --abbrev-ref HEAD')) return 'other-branch\n';
        return '';
      });

      // Act
      mergeConflictPredictor(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).not.toContain('OVERLAP');
    });
  });

  // ---------------------------------------------------------------------------
  // Branch divergence detection
  // ---------------------------------------------------------------------------

  describe('branch divergence detection', () => {
    test('warns when branch is significantly behind base', () => {
      // Arrange
      const input = createWriteInput('/test/project/file.ts', 'content');
      vi.mocked(getCurrentBranch).mockReturnValue('feature-branch');
      vi.mocked(getDefaultBranch).mockReturnValue('main');

      // Need worktrees for the hook to continue past early exit
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        const command = cmd as string;
        if (command.includes('worktree list')) {
          return 'worktree /test/project\nworktree /test/other-wt\n';
        }
        if (command.includes('main..feature-branch')) return '5\n';
        if (command.includes('feature-branch..main')) return '15\n';
        if (command.includes('rev-parse --abbrev-ref HEAD')) return 'feature-branch\n';
        return '';
      });
      vi.mocked(existsSync).mockReturnValue(false);

      // Act
      mergeConflictPredictor(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('DIVERGENCE');
      expect(stderrOutput).toContain('15 commits behind');
    });

    test('does not warn when branch is close to base', () => {
      // Arrange
      const input = createWriteInput('/test/project/file.ts', 'content');
      vi.mocked(getCurrentBranch).mockReturnValue('feature-branch');
      vi.mocked(getDefaultBranch).mockReturnValue('main');

      mockGitCommands({
        'worktree list': '',
        'main..feature-branch': '5\n',
        'feature-branch..main': '3\n', // Behind by only 3 commits
      });

      // Act
      mergeConflictPredictor(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).not.toContain('DIVERGENCE');
    });

    test('skips divergence check when on base branch', () => {
      // Arrange
      const input = createWriteInput('/test/project/file.ts', 'content');
      vi.mocked(getCurrentBranch).mockReturnValue('main');
      vi.mocked(getDefaultBranch).mockReturnValue('main');
      mockGitCommands({ 'worktree list': '' });

      // Act
      const result = mergeConflictPredictor(input);

      // Assert
      expect(result.continue).toBe(true);
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).not.toContain('DIVERGENCE');
    });
  });

  // ---------------------------------------------------------------------------
  // Output format
  // ---------------------------------------------------------------------------

  describe('output format', () => {
    test('outputs context when conflicts detected', () => {
      // Arrange
      const input = createWriteInput('/test/project/src/file.ts', 'content');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('other');

      const worktreeOutput = 'worktree /test/project\nworktree /test/wt\n';
      vi.mocked(execSync).mockImplementation((cmd) => {
        const command = cmd as string;
        if (command.includes('worktree list')) return worktreeOutput;
        if (command.includes('git status --short')) return ' M src/file.ts\n';
        if (command.includes('rev-parse --abbrev-ref HEAD')) return 'branch\n';
        return '';
      });

      // Act
      mergeConflictPredictor(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('conflicts detected')
      );
    });

    test('includes file path in context output', () => {
      // Arrange
      const input = createWriteInput('/test/project/src/important.ts', 'content');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('other');

      const worktreeOutput = 'worktree /test/project\nworktree /test/wt\n';
      vi.mocked(execSync).mockImplementation((cmd) => {
        const command = cmd as string;
        if (command.includes('worktree list')) return worktreeOutput;
        if (command.includes('git status --short')) return ' M src/important.ts\n';
        if (command.includes('rev-parse --abbrev-ref HEAD')) return 'branch\n';
        return '';
      });

      // Act
      mergeConflictPredictor(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('important.ts')
      );
    });

    test('writes warnings to stderr', () => {
      // Arrange
      const input = createWriteInput('/test/project/src/file.ts', 'content');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('other');

      const worktreeOutput = 'worktree /test/project\nworktree /test/wt\n';
      vi.mocked(execSync).mockImplementation((cmd) => {
        const command = cmd as string;
        if (command.includes('worktree list')) return worktreeOutput;
        if (command.includes('git status --short')) return ' M src/file.ts\n';
        if (command.includes('rev-parse --abbrev-ref HEAD')) return 'branch\n';
        return '';
      });

      // Act
      mergeConflictPredictor(input);

      // Assert
      expect(stderrSpy).toHaveBeenCalled();
    });

    test('includes recommendations in stderr output', () => {
      // Arrange
      const input = createWriteInput('/test/project/src/file.ts', 'content');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('other');

      const worktreeOutput = 'worktree /test/project\nworktree /test/wt\n';
      vi.mocked(execSync).mockImplementation((cmd) => {
        const command = cmd as string;
        if (command.includes('worktree list')) return worktreeOutput;
        if (command.includes('git status --short')) return ' M src/file.ts\n';
        if (command.includes('rev-parse --abbrev-ref HEAD')) return 'branch\n';
        return '';
      });

      // Act
      mergeConflictPredictor(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Recommendations');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles file not existing in worktree', () => {
      // Arrange
      const input = createWriteInput('/test/project/src/new-file.ts', 'content');
      vi.mocked(existsSync).mockReturnValue(false);

      const worktreeOutput = 'worktree /test/project\nworktree /test/wt\n';
      mockGitCommands({ 'worktree list --porcelain': worktreeOutput });

      // Act
      const result = mergeConflictPredictor(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles readFileSync failure gracefully', () => {
      // Arrange
      const input = createWriteInput('/test/project/src/file.ts', 'content');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const worktreeOutput = 'worktree /test/project\nworktree /test/wt\n';
      vi.mocked(execSync).mockImplementation((cmd) => {
        const command = cmd as string;
        if (command.includes('worktree list')) return worktreeOutput;
        if (command.includes('git status --short')) return ' M src/file.ts\n';
        if (command.includes('rev-parse --abbrev-ref HEAD')) return 'branch\n';
        return '';
      });

      // Act
      const result = mergeConflictPredictor(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles tool_result as content source', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Edit',
        session_id: 'test-session-123',
        project_dir: '/test/project',
        tool_input: {
          file_path: '/test/project/file.ts',
        },
        tool_result: 'new content',
      };
      mockGitCommands({ 'worktree list': '' });

      // Act
      const result = mergeConflictPredictor(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles relative path calculation', () => {
      // Arrange
      const input = createWriteInput('/test/project/src/deep/nested/file.ts', 'content');
      vi.mocked(getRepoRoot).mockReturnValue('/test/project');

      const worktreeOutput = 'worktree /test/project\nworktree /test/wt\n';
      vi.mocked(execSync).mockImplementation((cmd) => {
        const command = cmd as string;
        if (command.includes('worktree list')) return worktreeOutput;
        return '';
      });
      vi.mocked(existsSync).mockReturnValue(false);

      // Act
      mergeConflictPredictor(input);

      // Assert
      // Should check /test/wt/src/deep/nested/file.ts
      expect(existsSync).toHaveBeenCalledWith('/test/wt/src/deep/nested/file.ts');
    });

    test('handles multiple worktrees with conflicts', () => {
      // Arrange
      const input = createWriteInput('/test/project/src/file.ts', 'new\n'.repeat(20));
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('old\n'.repeat(50));

      const worktreeOutput = 'worktree /test/project\nworktree /test/wt1\nworktree /test/wt2\n';
      vi.mocked(execSync).mockImplementation((cmd, opts) => {
        const command = cmd as string;
        if (command.includes('worktree list')) return worktreeOutput;
        if (command.includes('git status --short')) return ' M src/file.ts\n';
        if (command.includes('rev-parse --abbrev-ref HEAD')) {
          if (opts?.cwd === '/test/wt1') return 'branch1\n';
          if (opts?.cwd === '/test/wt2') return 'branch2\n';
        }
        return '';
      });

      // Act
      mergeConflictPredictor(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('branch1');
      expect(stderrOutput).toContain('branch2');
    });
  });

  // ---------------------------------------------------------------------------
  // Git status pattern matching
  // ---------------------------------------------------------------------------

  describe('git status pattern matching', () => {
    test.each([
      [' M file.ts', true],  // Modified
      ['M  file.ts', true],  // Modified (staged)
      ['A  file.ts', true],  // Added
      ['?? file.ts', false], // Untracked
      ['D  file.ts', false], // Deleted
      ['   file.ts', false], // No change
    ])('status "%s" is modified: %s', (status, isModified) => {
      // Arrange
      const input = createWriteInput('/test/project/src/file.ts', 'content');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('different\n'.repeat(20));

      const worktreeOutput = 'worktree /test/project\nworktree /test/wt\n';
      vi.mocked(execSync).mockImplementation((cmd) => {
        const command = cmd as string;
        if (command.includes('worktree list')) return worktreeOutput;
        if (command.includes('git status --short')) return `${status}\n`;
        if (command.includes('rev-parse --abbrev-ref HEAD')) return 'branch\n';
        return '';
      });

      // Act
      mergeConflictPredictor(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      if (isModified) {
        expect(stderrOutput).toContain('MERGE CONFLICT RISK');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Timeout handling
  // ---------------------------------------------------------------------------

  describe('timeout handling', () => {
    test('git commands have timeout set', () => {
      // Arrange
      const input = createWriteInput('/test/project/file.ts', 'content');
      mockGitCommands({ 'worktree list': '' });

      // Act
      mergeConflictPredictor(input);

      // Assert
      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: expect.any(Number) })
      );
    });
  });
});

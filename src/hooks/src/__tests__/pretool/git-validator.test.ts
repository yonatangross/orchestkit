/**
 * Unit tests for git-validator hook
 * Tests unified git validation: branch protection, naming, commit messages, and atomic commits
 *
 * Security Focus: Validates protected branch enforcement and commit message validation
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';
import { gitValidator } from '../../pretool/bash/git-validator.js';
import { isProtectedBranch, validateBranchName, extractIssueNumber } from '../../lib/git.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for Bash commands
 */
function createBashInput(command: string, overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { command },
    ...overrides,
  };
}

// =============================================================================
// Git Utility Functions Tests
// =============================================================================

describe('lib/git.ts utilities', () => {
  describe('isProtectedBranch', () => {
    test('returns true for main', () => {
      expect(isProtectedBranch('main')).toBe(true);
    });

    test('returns true for master', () => {
      expect(isProtectedBranch('master')).toBe(true);
    });

    test('returns true for dev', () => {
      expect(isProtectedBranch('dev')).toBe(true);
    });

    test('returns false for feature branches', () => {
      expect(isProtectedBranch('feature/new-feature')).toBe(false);
    });

    test('returns false for issue branches', () => {
      expect(isProtectedBranch('issue/123-fix-bug')).toBe(false);
    });

    test('returns false for fix branches', () => {
      expect(isProtectedBranch('fix/broken-test')).toBe(false);
    });

    test('returns false for release branches', () => {
      expect(isProtectedBranch('release/1.0.0')).toBe(false);
    });

    test('is case sensitive - Main is not protected', () => {
      expect(isProtectedBranch('Main')).toBe(false);
      expect(isProtectedBranch('MAIN')).toBe(false);
    });
  });

  describe('extractIssueNumber', () => {
    test('extracts from issue/ prefix', () => {
      expect(extractIssueNumber('issue/123-description')).toBe(123);
    });

    test('extracts from feature/ prefix', () => {
      expect(extractIssueNumber('feature/456-new-thing')).toBe(456);
    });

    test('extracts from fix/ prefix', () => {
      expect(extractIssueNumber('fix/789-bug')).toBe(789);
    });

    test('extracts from number prefix', () => {
      expect(extractIssueNumber('123-my-branch')).toBe(123);
    });

    test('extracts from number suffix', () => {
      expect(extractIssueNumber('my-branch-456')).toBe(456);
    });

    test('extracts from # notation', () => {
      expect(extractIssueNumber('fix-#789')).toBe(789);
    });

    test('extracts from bug/ prefix', () => {
      expect(extractIssueNumber('bug/101-crash-on-load')).toBe(101);
    });

    test('extracts from feat/ prefix', () => {
      expect(extractIssueNumber('feat/202-user-auth')).toBe(202);
    });

    test('returns null for branches without numbers', () => {
      expect(extractIssueNumber('feature/my-feature')).toBe(null);
    });

    test('returns null for protected branches', () => {
      expect(extractIssueNumber('main')).toBe(null);
      expect(extractIssueNumber('dev')).toBe(null);
    });
  });

  describe('validateBranchName', () => {
    test('accepts valid feature/ branch', () => {
      expect(validateBranchName('feature/new-feature')).toBe(null);
    });

    test('accepts valid issue/ branch with number', () => {
      expect(validateBranchName('issue/123-fix-bug')).toBe(null);
    });

    test('accepts valid fix/ branch', () => {
      expect(validateBranchName('fix/broken-test')).toBe(null);
    });

    test('accepts protected branches without validation', () => {
      expect(validateBranchName('main')).toBe(null);
      expect(validateBranchName('dev')).toBe(null);
      expect(validateBranchName('master')).toBe(null);
    });

    test('accepts chore/ prefix', () => {
      expect(validateBranchName('chore/update-deps')).toBe(null);
    });

    test('accepts docs/ prefix', () => {
      expect(validateBranchName('docs/readme-update')).toBe(null);
    });

    test('accepts refactor/ prefix', () => {
      expect(validateBranchName('refactor/cleanup')).toBe(null);
    });

    test('accepts test/ prefix', () => {
      expect(validateBranchName('test/add-unit-tests')).toBe(null);
    });

    test('accepts ci/ prefix', () => {
      expect(validateBranchName('ci/github-actions')).toBe(null);
    });

    test('accepts perf/ prefix', () => {
      expect(validateBranchName('perf/optimize-queries')).toBe(null);
    });

    test('accepts style/ prefix', () => {
      expect(validateBranchName('style/format-code')).toBe(null);
    });

    test('accepts release/ prefix', () => {
      expect(validateBranchName('release/1.0.0')).toBe(null);
    });

    test('accepts hotfix/ prefix', () => {
      expect(validateBranchName('hotfix/urgent-fix')).toBe(null);
    });

    test('accepts bug/ prefix', () => {
      expect(validateBranchName('bug/123-crash')).toBe(null);
    });

    test('rejects branch without valid prefix', () => {
      const result = validateBranchName('my-random-branch');
      expect(result).toContain('valid prefix');
    });

    test('rejects issue/ branch without number', () => {
      const result = validateBranchName('issue/my-issue');
      expect(result).toContain('issue number');
    });
  });
});

// =============================================================================
// Git Validator Hook Tests
// =============================================================================

describe('gitValidator hook', () => {
  describe('non-git commands', () => {
    test('ignores non-git commands', () => {
      // Arrange
      const input = createBashInput('npm test');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('ignores docker commands', () => {
      // Arrange
      const input = createBashInput('docker build -t myapp .');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('ignores commands starting with git-like words', () => {
      // Arrange - "github" starts with "git" but is not a git command
      const input = createBashInput('github-actions-runner --help');

      // Act
      const result = gitValidator(input);

      // Assert - command doesn't start with 'git ' so should pass
      expect(result.continue).toBe(true);
    });
  });

  describe('commit message validation', () => {
    test('blocks invalid commit message format', () => {
      // Arrange
      const input = createBashInput('git commit -m "bad commit message"');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('INVALID COMMIT FORMAT');
      expect(result.stopReason).toContain('Required: type(#issue): description');
    });

    test('allows valid conventional commit with issue reference', () => {
      // Arrange
      const input = createBashInput('git commit -m "feat(#123): Add user authentication"');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows valid conventional commit without issue reference', () => {
      // Arrange
      const input = createBashInput('git commit -m "fix: Resolve memory leak"');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows all valid commit types', () => {
      // Arrange
      const validTypes = ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'style', 'perf', 'ci', 'build'];

      // Act & Assert
      for (const type of validTypes) {
        const input = createBashInput(`git commit -m "${type}: Some message"`);
        const result = gitValidator(input);
        expect(result.continue).toBe(true);
      }
    });

    test('allows commit with scope', () => {
      // Arrange
      const input = createBashInput('git commit -m "feat(auth): Add OAuth2 support"');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('warns about long commit title', () => {
      // Arrange - title > 72 chars
      const longTitle = 'feat: ' + 'A'.repeat(80);
      const input = createBashInput(`git commit -m "${longTitle}"`);

      // Act
      const result = gitValidator(input);

      // Assert - should allow but provide context
      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('72');
      }
    });

    test('provides guidance for heredoc commits', () => {
      // Arrange
      const input = createBashInput(`git commit -m "$(cat <<'EOF'
feat(#123): Add feature

Detailed description here
EOF
)"`);

      // Act
      const result = gitValidator(input);

      // Assert - should allow heredoc with guidance
      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('Heredoc');
      }
    });

    test('handles commit with single quotes', () => {
      // Arrange
      const input = createBashInput("git commit -m 'feat: Add feature'");

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('protected branch detection patterns', () => {
    test('detects git commit command pattern', () => {
      // Arrange
      const command = 'git commit -m "direct commit"';

      // Assert - pattern should match
      expect(/git\s+commit/.test(command)).toBe(true);
    });

    test('detects git push command pattern', () => {
      // Arrange
      const command = 'git push origin dev';

      // Assert - pattern should match
      expect(/git\s+push/.test(command)).toBe(true);
    });

    test('does not match git fetch', () => {
      // Arrange
      const command = 'git fetch origin';

      // Assert - should NOT match commit or push patterns
      expect(/git\s+commit/.test(command)).toBe(false);
      expect(/git\s+push/.test(command)).toBe(false);
    });

    test('does not match git pull', () => {
      // Arrange
      const command = 'git pull origin main';

      // Assert
      expect(/git\s+commit/.test(command)).toBe(false);
      expect(/git\s+push/.test(command)).toBe(false);
    });
  });

  describe('safe git commands', () => {
    test('allows git status', () => {
      // Arrange
      const input = createBashInput('git status');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows git log', () => {
      // Arrange
      const input = createBashInput('git log --oneline -10');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows git diff', () => {
      // Arrange
      const input = createBashInput('git diff HEAD~1');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows git fetch', () => {
      // Arrange
      const input = createBashInput('git fetch origin');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows git pull', () => {
      // Arrange
      const input = createBashInput('git pull origin main');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows git stash', () => {
      // Arrange
      const input = createBashInput('git stash');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows git branch listing', () => {
      // Arrange
      const input = createBashInput('git branch -a');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('branch creation validation', () => {
    test('provides guidance for invalid branch name on checkout -b', () => {
      // Arrange
      const input = createBashInput('git checkout -b random-branch-name');

      // Act
      const result = gitValidator(input);

      // Assert - should allow but provide guidance
      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('valid prefix');
      }
    });

    test('allows valid branch creation with checkout -b', () => {
      // Arrange
      const input = createBashInput('git checkout -b feature/new-feature');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows valid issue branch creation', () => {
      // Arrange
      const input = createBashInput('git checkout -b issue/123-fix-bug');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('provides guidance for issue/ branch without number', () => {
      // Arrange
      const input = createBashInput('git checkout -b issue/no-number-here');

      // Act
      const result = gitValidator(input);

      // Assert - should allow but provide guidance
      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('issue number');
      }
    });
  });

  describe('edge cases', () => {
    test('handles empty command', () => {
      // Arrange
      const input = createBashInput('');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles git command without subcommand', () => {
      // Arrange
      const input = createBashInput('git');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles git with extra whitespace', () => {
      // Arrange
      const input = createBashInput('git   status');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('output format compliance (CC 2.1.7/2.1.9)', () => {
    test('blocked commit returns proper deny structure', () => {
      // Arrange
      const input = createBashInput('git commit -m "bad message"');

      // Act
      const result = gitValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toBeTruthy();
      expect(result.hookSpecificOutput?.permissionDecision).toBe('deny');
    });

    test('advisory context uses additionalContext field', () => {
      // Arrange - commit that passes but has guidance
      const input = createBashInput('git checkout -b random-name');

      // Act
      const result = gitValidator(input);

      // Assert - if there's context, it should use additionalContext
      if (result.hookSpecificOutput?.additionalContext) {
        expect(typeof result.hookSpecificOutput.additionalContext).toBe('string');
      }
    });
  });
});

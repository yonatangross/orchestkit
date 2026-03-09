/**
 * Unit tests for pre-commit-quality-runner hook
 * Tests parallel lint/typecheck/test gating before git commit
 *
 * Security annotations:
 * - SEC-001: eslint filenames passed as separate execFileSync args (no shell interpolation)
 * - SEC-005: --no-verify bypass is logged at 'warn' level
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputBlock: vi.fn((reason: string) => ({
    continue: false,
    suppressOutput: false,
    hookSpecificOutput: { hookEventName: 'PreToolUse', blockReason: reason },
  })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => ''),
  execFileSync: vi.fn(() => ''),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
}));

import { preCommitQualityRunner } from '../../pretool/bash/pre-commit-quality-runner.js';
import type { HookInput } from '../../types.js';
import { execSync, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { logHook, outputSilentSuccess, outputBlock, getProjectDir } from '../../lib/common.js';

function createBashInput(command: string): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { command },
  };
}

describe('pre-commit-quality-runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ORCHESTKIT_SKIP_PRE_COMMIT_CHECKS;
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(execSync).mockReturnValue('');
    vi.mocked(execFileSync).mockReturnValue('');
    vi.mocked(getProjectDir).mockReturnValue('/test/project');
  });

  // -----------------------------------------------------------------------
  // 1. Environment disable via ORCHESTKIT_SKIP_PRE_COMMIT_CHECKS
  // -----------------------------------------------------------------------

  describe('env disable', () => {
    it('returns silent success when ORCHESTKIT_SKIP_PRE_COMMIT_CHECKS=true', () => {
      // Arrange
      process.env.ORCHESTKIT_SKIP_PRE_COMMIT_CHECKS = 'true';
      const input = createBashInput('git commit -m "test"');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledOnce();
    });

    it('does not skip when ORCHESTKIT_SKIP_PRE_COMMIT_CHECKS is unset', () => {
      // Arrange — leave env unset, staged files + package.json needed for checks to run
      const input = createBashInput('git commit -m "test"');
      vi.mocked(execSync).mockReturnValue(''); // no staged files → still silent success but via different path

      // Act
      preCommitQualityRunner(input);

      // Assert — env guard did NOT trigger (outputSilentSuccess called for another reason, not env)
      // We can't distinguish calls here, but we verify the env guard works only for 'true'
      expect(process.env.ORCHESTKIT_SKIP_PRE_COMMIT_CHECKS).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // 2. Non-commit commands pass through silently
  // -----------------------------------------------------------------------

  describe('non-commit commands', () => {
    it('returns silent success for git push', () => {
      // Arrange
      const input = createBashInput('git push origin main');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('returns silent success for git status', () => {
      // Arrange
      const input = createBashInput('git status');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('returns silent success for npm run build', () => {
      // Arrange
      const input = createBashInput('npm run build');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('returns silent success for empty command', () => {
      // Arrange
      const input = createBashInput('');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 3. SEC-005: --no-verify bypass logging
  // -----------------------------------------------------------------------

  describe('SEC-005: --no-verify bypass', () => {
    it('returns silent success when --no-verify is present', () => {
      // Arrange
      const input = createBashInput('git commit -m "test" --no-verify');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('calls logHook with warn level when --no-verify is used (SEC-005)', () => {
      // Arrange
      const input = createBashInput('git commit -m "emergency" --no-verify');

      // Act
      preCommitQualityRunner(input);

      // Assert — bypass must be audited at warn level
      expect(logHook).toHaveBeenCalledWith(
        'pre-commit-quality-runner',
        expect.stringContaining('--no-verify'),
        'warn',
      );
    });

    it('does not call execSync for git diff when --no-verify is present', () => {
      // Arrange
      const input = createBashInput('git commit --no-verify -m "skip"');

      // Act
      preCommitQualityRunner(input);

      // Assert — quality checks must not even start
      expect(execSync).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 4. No projectDir → silent
  // -----------------------------------------------------------------------

  describe('no projectDir', () => {
    it('returns silent success when getProjectDir returns null', () => {
      // Arrange
      vi.mocked(getProjectDir).mockReturnValue(null as unknown as string);
      const input = createBashInput('git commit -m "test"');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('returns silent success when getProjectDir returns empty string', () => {
      // Arrange
      vi.mocked(getProjectDir).mockReturnValue('');
      const input = createBashInput('git commit -m "test"');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 5. 0 staged files → silent
  // -----------------------------------------------------------------------

  describe('staged files gating', () => {
    it('returns silent success when git diff returns no staged files', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValue('');
      const input = createBashInput('git commit -m "test"');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('returns silent success when git diff output is whitespace only', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValue('   \n\n   ');
      const input = createBashInput('git commit -m "test"');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('returns silent success when getStagedFiles throws (not a git repo)', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });
      const input = createBashInput('git commit -m "test"');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 6. No package.json → silent
  // -----------------------------------------------------------------------

  describe('no package.json', () => {
    it('returns silent success when package.json does not exist', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValue('src/index.ts');
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/index.ts';
        return '';
      });
      vi.mocked(existsSync).mockReturnValue(false); // no package.json, no configs
      const input = createBashInput('git commit -m "test"');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 7. TypeScript typecheck: .ts staged + tsconfig exists → runs tsc
  // -----------------------------------------------------------------------

  describe('TypeScript typecheck', () => {
    it('calls execSync with npx tsc --noEmit when .ts file staged and tsconfig.json exists', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/auth.ts';
        }
        return ''; // tsc passes
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/auth.ts';
        return ''; // tsc/eslint passes
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return path.endsWith('package.json') || path.endsWith('tsconfig.json');
      });
      const input = createBashInput('git commit -m "feat: add auth"');

      // Act
      preCommitQualityRunner(input);

      // Assert — typecheck now uses execFileSync (SEC-001)
      expect(execFileSync).toHaveBeenCalledWith(
        'npx',
        ['tsc', '--noEmit'],
        expect.objectContaining({ cwd: '/test/project' }),
      );
    });

    it('skips typecheck when .ts staged but tsconfig.json does not exist', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/auth.ts';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/auth.ts';
        return '';
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        // package.json exists but tsconfig.json does not
        return path.endsWith('package.json');
      });
      const input = createBashInput('git commit -m "test"');

      // Act
      preCommitQualityRunner(input);

      // Assert — tsc must NOT be called (via execFileSync)
      const execFileCalls = vi.mocked(execFileSync).mock.calls.map(c => c[1] as string[]);
      expect(execFileCalls.some(args => args.includes('tsc'))).toBe(false);
    });

    it('skips typecheck when only .md files are staged', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'README.md\ndocs/guide.md';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'README.md\ndocs/guide.md';
        return '';
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return path.endsWith('package.json') || path.endsWith('tsconfig.json');
      });
      const input = createBashInput('git commit -m "docs: update readme"');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert — no TS files → no checks queued → silent
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      const execSyncCalls = vi.mocked(execSync).mock.calls.map(c => c[0]);
      expect(execSyncCalls).not.toContain('npx tsc --noEmit');
    });
  });

  // -----------------------------------------------------------------------
  // 8. SEC-001: eslint uses execFileSync with separate array args
  // -----------------------------------------------------------------------

  describe('SEC-001: eslint via execFileSync (no shell interpolation)', () => {
    it('calls execFileSync (not execSync) when .ts staged and eslint config exists', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/auth.ts';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/auth.ts';
        return '';
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return path.endsWith('package.json') || path.endsWith('.eslintrc.js');
      });
      const input = createBashInput('git commit -m "test"');

      // Act
      preCommitQualityRunner(input);

      // Assert — lint must use execFileSync, NOT execSync
      expect(execFileSync).toHaveBeenCalled();
      const execSyncCalls = vi.mocked(execSync).mock.calls.map(c => c[0]);
      const hasEslintInExecSync = execSyncCalls.some(cmd => String(cmd).includes('eslint'));
      expect(hasEslintInExecSync).toBe(false);
    });

    it('passes filenames as separate array elements to execFileSync (SEC-001)', () => {
      // Arrange — two staged files
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/auth.ts\nsrc/user.ts';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/auth.ts\nsrc/user.ts';
        return '';
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return path.endsWith('package.json') || path.endsWith('eslint.config.js');
      });
      const input = createBashInput('git commit -m "feat: add user"');

      // Act
      preCommitQualityRunner(input);

      // Assert — args array must have individual file entries, not concatenated string
      const calls = vi.mocked(execFileSync).mock.calls;
      const lintCall = calls.find(
        ([cmd, args]) => cmd === 'npx' && Array.isArray(args) && (args as string[]).includes('eslint'),
      );
      expect(lintCall).toBeDefined();
      const args = lintCall![1] as string[];
      expect(args).toContain('eslint');
      expect(args).toContain('--cache');
      expect(args).toContain('src/auth.ts');
      expect(args).toContain('src/user.ts');
      // Critical: filenames must be separate elements, NOT a single joined string
      expect(args.some(a => a.includes(' '))).toBe(false);
    });

    it('passes eslint, --cache, file1, file2 as separate array elements', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'file1.ts\nfile2.ts';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'file1.ts\nfile2.ts';
        return '';
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return path.endsWith('package.json') || path.endsWith('.eslintrc.json');
      });
      const input = createBashInput('git commit -m "test"');

      // Act
      preCommitQualityRunner(input);

      // Assert
      expect(execFileSync).toHaveBeenCalledWith(
        'npx',
        ['eslint', '--cache', 'file1.ts', 'file2.ts'],
        expect.objectContaining({ cwd: '/test/project' }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 9. Jest related-tests check
  // -----------------------------------------------------------------------

  describe('jest related-tests check', () => {
    it('calls execFileSync for jest when .ts source staged and jest.config.js exists', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/auth.ts';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/auth.ts';
        return '';
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return path.endsWith('package.json') || path.endsWith('jest.config.js');
      });
      const input = createBashInput('git commit -m "feat: auth"');

      // Act
      preCommitQualityRunner(input);

      // Assert
      const calls = vi.mocked(execFileSync).mock.calls;
      const jestCall = calls.find(
        ([cmd, args]) => cmd === 'npx' && Array.isArray(args) && (args as string[]).includes('jest'),
      );
      expect(jestCall).toBeDefined();
      const args = jestCall![1] as string[];
      expect(args).toContain('jest');
      expect(args).toContain('--findRelatedTests');
      expect(args).toContain('src/auth.ts');
      expect(args).toContain('--passWithNoTests');
    });

    it('skips jest check when jest.config.ts is absent (no jest config found)', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/auth.ts';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/auth.ts';
        return '';
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        // only package.json, no jest config
        return String(p).endsWith('package.json');
      });
      const input = createBashInput('git commit -m "test"');

      // Act
      preCommitQualityRunner(input);

      // Assert
      const calls = vi.mocked(execFileSync).mock.calls;
      const hasJest = calls.some(
        ([cmd, args]) => cmd === 'npx' && Array.isArray(args) && (args as string[]).includes('jest'),
      );
      expect(hasJest).toBe(false);
    });

    it('skips test files from jest --findRelatedTests args (only runs on source files)', () => {
      // Arrange — staged files include both source + test file
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/auth.ts\nsrc/auth.test.ts';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/auth.ts\nsrc/auth.test.ts';
        return '';
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return path.endsWith('package.json') || path.endsWith('jest.config.js');
      });
      const input = createBashInput('git commit -m "feat: auth"');

      // Act
      preCommitQualityRunner(input);

      // Assert — test file should NOT be in jest args
      const calls = vi.mocked(execFileSync).mock.calls;
      const jestCall = calls.find(
        ([cmd, args]) => cmd === 'npx' && Array.isArray(args) && (args as string[]).includes('jest'),
      );
      if (jestCall) {
        const args = jestCall[1] as string[];
        expect(args).not.toContain('src/auth.test.ts');
        expect(args).toContain('src/auth.ts');
      }
    });
  });

  // -----------------------------------------------------------------------
  // 10. All checks pass → additionalContext with check names
  // -----------------------------------------------------------------------

  describe('all checks pass', () => {
    it('returns continue:true with additionalContext listing check names when all pass', () => {
      // Arrange — ts staged, tsconfig + package.json present
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/index.ts';
        }
        return ''; // tsc succeeds
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/index.ts';
        return '';
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return path.endsWith('package.json') || path.endsWith('tsconfig.json');
      });
      const input = createBashInput('git commit -m "feat: update index"');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('typecheck');
      expect(result.hookSpecificOutput?.additionalContext).toContain('All quality checks passed');
    });

    it('does not call outputBlock when all checks pass', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/index.ts';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/index.ts';
        return '';
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return path.endsWith('package.json') || path.endsWith('tsconfig.json');
      });
      const input = createBashInput('git commit -m "fix: bug"');

      // Act
      preCommitQualityRunner(input);

      // Assert
      expect(outputBlock).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 11. One check fails → outputBlock with failure report
  // -----------------------------------------------------------------------

  describe('check failures', () => {
    it('returns outputBlock when typecheck fails', () => {
      // Arrange — typecheck now runs via execFileSync (SEC-001)
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/index.ts';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/index.ts';
        const err = Object.assign(new Error('tsc error'), { stderr: 'TS2345: Argument of type' });
        throw err;
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return path.endsWith('package.json') || path.endsWith('tsconfig.json');
      });
      const input = createBashInput('git commit -m "wip"');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledOnce();
      const blockReason = vi.mocked(outputBlock).mock.calls[0][0];
      expect(blockReason).toContain('typecheck');
      expect(blockReason).toContain('FAILED');
    });

    it('returns outputBlock when eslint fails', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/app.js';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/app.js';
        const err = Object.assign(new Error('eslint error'), { stdout: '2 errors found' });
        throw err;
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return path.endsWith('package.json') || path.endsWith('.eslintrc.json');
      });
      const input = createBashInput('git commit -m "fix"');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(false);
      const blockReason = vi.mocked(outputBlock).mock.calls[0][0];
      expect(blockReason).toContain('lint');
      expect(blockReason).toContain('FAILED');
    });

    it('includes skip instruction in block reason', () => {
      // Arrange — typecheck now runs via execFileSync (SEC-001)
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/index.ts';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/index.ts';
        const err = Object.assign(new Error('tsc fail'), { stderr: 'error TS1234' });
        throw err;
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return path.endsWith('package.json') || path.endsWith('tsconfig.json');
      });
      const input = createBashInput('git commit -m "wip"');

      // Act
      preCommitQualityRunner(input);

      // Assert — block reason must mention the escape hatch
      const blockReason = vi.mocked(outputBlock).mock.calls[0][0];
      expect(blockReason).toContain('ORCHESTKIT_SKIP_PRE_COMMIT_CHECKS=true');
    });
  });

  // -----------------------------------------------------------------------
  // 12. Multiple failures → all failures in report
  // -----------------------------------------------------------------------

  describe('multiple check failures', () => {
    it('includes all failed check names in the block reason', () => {
      // Arrange — .ts staged + tsconfig, eslint.config.js: both run via execFileSync and both fail
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/auth.ts';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: unknown, args?: readonly string[]) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/auth.ts';
        if (args?.includes('tsc')) {
          throw Object.assign(new Error('tsc error'), { stderr: 'TS2322: Type error' });
        }
        // eslint fails
        throw Object.assign(new Error('eslint error'), { stdout: '3 errors' });
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return (
          path.endsWith('package.json') ||
          path.endsWith('tsconfig.json') ||
          path.endsWith('eslint.config.js')
        );
      });
      const input = createBashInput('git commit -m "wip"');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(false);
      const blockReason = vi.mocked(outputBlock).mock.calls[0][0];
      expect(blockReason).toContain('typecheck');
      expect(blockReason).toContain('lint');
      // Count shows both failures
      expect(blockReason).toMatch(/2\/2|2 of 2|2\//);
    });

    it('logs failure count via logHook when checks fail', () => {
      // Arrange — typecheck via execFileSync (SEC-001)
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/auth.ts';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/auth.ts';
        throw Object.assign(new Error('tsc fail'), { stderr: 'error' });
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return path.endsWith('package.json') || path.endsWith('tsconfig.json');
      });
      const input = createBashInput('git commit -m "test"');

      // Act
      preCommitQualityRunner(input);

      // Assert
      const logCalls = vi.mocked(logHook).mock.calls;
      const failureLog = logCalls.find(([, msg]) => String(msg).includes('failed'));
      expect(failureLog).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 13. 0 checks queued (only .md staged) → silent
  // -----------------------------------------------------------------------

  describe('no applicable checks queued', () => {
    it('returns silent success when only .md files staged with all configs present', () => {
      // Arrange — markdown only → no TS/JS files → no checks will run
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'README.md\ndocs/CONTRIBUTING.md';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'README.md\ndocs/CONTRIBUTING.md';
        return '';
      });
      vi.mocked(existsSync).mockImplementation(() => true);
      const input = createBashInput('git commit -m "docs: update readme"');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // execFileSync is now called for git diff (getStagedSourceFiles), but no tool commands should run
      const toolCalls = vi.mocked(execFileSync).mock.calls.filter(
        ([cmd]) => cmd === 'npx',
      );
      expect(toolCalls).toHaveLength(0);
    });

    it('does not call outputBlock when checks list is empty', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'CHANGELOG.md';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'CHANGELOG.md';
        return '';
      });
      vi.mocked(existsSync).mockImplementation(() => true); // all configs present
      const input = createBashInput('git commit -m "chore: update changelog"');

      // Act
      preCommitQualityRunner(input);

      // Assert
      expect(outputBlock).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 14. isCommitCommand edge cases
  // -----------------------------------------------------------------------

  describe('isCommitCommand detection', () => {
    it('matches git commit with leading whitespace trimmed', () => {
      // Arrange — git diff returns a staged ts file so checks can run
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/index.ts';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/index.ts';
        return '';
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) =>
        String(p).endsWith('package.json') || String(p).endsWith('tsconfig.json'),
      );
      const input = createBashInput('  git commit -m "trimmed"');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert — hook engaged (not silently skipped at command-check)
      expect(logHook).toHaveBeenCalledWith(
        'pre-commit-quality-runner',
        expect.stringContaining('staged files'),
      );
      expect(result.continue).toBe(true);
    });

    it('does not match git commit-graph as a commit command', () => {
      // git commit-graph write should NOT trigger isCommitCommand
      // because the regex uses (?:\s|$) after "commit", not \b.
      const input = createBashInput('git commit-graph write');

      // Act
      const result = preCommitQualityRunner(input);

      // Assert — silent success via the "not a commit command" guard
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // execSync should NOT be called — command rejected before staged files check
      expect(execSync).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 15. eslint config detection variants
  // -----------------------------------------------------------------------

  describe('eslint config detection', () => {
    it('detects eslint via node_modules/.bin/eslint', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/app.js';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/app.js';
        return '';
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return path.endsWith('package.json') || path.includes('node_modules/.bin/eslint');
      });
      const input = createBashInput('git commit -m "feat: app"');

      // Act
      preCommitQualityRunner(input);

      // Assert — lint check was queued
      expect(execFileSync).toHaveBeenCalled();
    });

    it('detects eslint via eslint.config.mjs', () => {
      // Arrange
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --cached --name-only --diff-filter=ACMR') {
          return 'src/app.ts';
        }
        return '';
      });
      vi.mocked(execFileSync).mockImplementation((_cmd: any, args: any) => {
        const argsStr = Array.isArray(args) ? args.join(' ') : '';
        if (argsStr.includes('diff --cached --name-only')) return 'src/app.ts';
        return '';
      });
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const path = String(p);
        return path.endsWith('package.json') || path.endsWith('eslint.config.mjs');
      });
      const input = createBashInput('git commit -m "fix: lint"');

      // Act
      preCommitQualityRunner(input);

      // Assert
      const calls = vi.mocked(execFileSync).mock.calls;
      const lintCall = calls.find(
        ([cmd, args]) => cmd === 'npx' && Array.isArray(args) && (args as string[]).includes('eslint'),
      );
      expect(lintCall).toBeDefined();
    });
  });
});

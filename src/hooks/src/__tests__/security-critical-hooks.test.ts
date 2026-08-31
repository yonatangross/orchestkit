/**
 * Security-Critical Hooks - Tier 1 Comprehensive Test Suite
 *
 * Tests all 6 security-critical hooks with thorough coverage:
 * 1. dangerousCommandBlocker - RETIRED 2026-08-31 (#3835): Bash() deny rules in the operator scope
 * 2. fileGuard - RETIRED 2026-08-31 (#3835): Edit()/Write() deny rules in the operator scope
 * 3. autoApproveSafeBash - Auto-approves known-safe commands
 * 4. redactSecrets - Detects and warns on leaked secrets
 * 5. gitValidator - RETIRED 2026-08-31 (#3835): force-push deny rules + origin branch protection
 * 6. securityCommandAudit - Audit logs Bash commands
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookInput } from '../types.js';

// Security registry
import { SECURITY_HOOKS, isSecurityCritical, getSecurityHooks, assertCanToggle } from '../lib/security-hooks-registry.js';

// Hook imports
import { autoApproveSafeBash } from '../permission/auto-approve-safe-bash.js';
import { redactSecrets } from '../skill/redact-secrets.js';
import { securityCommandAudit } from '../agent/security-command-audit.js';

// =============================================================================
// Test Utilities
// =============================================================================

function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {},
    ...overrides,
  };
}

function createBashInput(command: string, overrides: Partial<HookInput> = {}): HookInput {
  return createHookInput({
    tool_name: 'Bash',
    tool_input: { command },
    ...overrides,
  });
}

function createWriteInput(file_path: string, content: string = '', overrides: Partial<HookInput> = {}): HookInput {
  return createHookInput({
    tool_name: 'Write',
    tool_input: { file_path, content },
    ...overrides,
  });
}

/** Assert the result is a silent success (continue: true, suppressOutput: true) */
function expectSilentSuccess(result: { continue: boolean; suppressOutput?: boolean }): void {
  expect(result.continue).toBe(true);
  expect(result.suppressOutput).toBe(true);
}

/** Assert the result is a deny (continue: false) */
function expectDeny(result: { continue: boolean; stopReason?: string; hookSpecificOutput?: { permissionDecision?: string } }): void {
  expect(result.continue).toBe(false);
  expect(result.stopReason).toBeDefined();
  expect(result.hookSpecificOutput?.permissionDecision).toBe('deny');
}

/** Assert the result is a silent allow with permissionDecision: 'allow' */
function expectSilentAllow(result: ReturnType<typeof autoApproveSafeBash>): void {
  expect(result.continue).toBe(true);
  expect(result.suppressOutput).toBe(true);
  expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
}

// =============================================================================
// 1. DANGEROUS COMMAND BLOCKER
// =============================================================================


// =============================================================================
// 2. FILE GUARD
// =============================================================================


// =============================================================================
// 3. AUTO-APPROVE SAFE BASH
// =============================================================================

describe('autoApproveSafeBash', () => {
  describe('auto-approves git read operations', () => {
    test.each([
      'git status',
      'git log --oneline',
      'git diff HEAD~1',
      'git branch -a',
      'git show HEAD',
      'git fetch origin',
      'git pull origin main',
      'git checkout feature/test',
    ])('auto-approves: %s', (command) => {
      const result = autoApproveSafeBash(createBashInput(command));
      expectSilentAllow(result);
    });
  });

  describe('auto-approves package manager read operations', () => {
    test.each([
      'npm list',
      'npm ls',
      'npm outdated',
      'npm audit',
      'npm run test',
      'npm test',
      'pnpm list',
      'pnpm run test',
      'yarn list',
      'yarn test',
      'yarn audit',
      'poetry show',
      'poetry run pytest',
      'poetry env info',
    ])('auto-approves: %s', (command) => {
      const result = autoApproveSafeBash(createBashInput(command));
      expectSilentAllow(result);
    });
  });

  describe('auto-approves docker read operations', () => {
    test.each([
      'docker ps',
      'docker images',
      'docker logs my-container',
      'docker inspect my-container',
      'docker-compose ps',
      'docker-compose logs',
      'docker compose ps',
      'docker compose logs web',
    ])('auto-approves: %s', (command) => {
      const result = autoApproveSafeBash(createBashInput(command));
      expectSilentAllow(result);
    });
  });

  describe('auto-approves basic shell commands', () => {
    test.each([
      'ls -la',
      'ls',
      'pwd',
      'echo hello world',
      'cat file.txt',
      'head -n 10 file.txt',
      'tail -f logs.txt',
      'wc -l file.txt',
      'find . -name "*.ts"',
      'which node',
      'type bash',
      'env',
      'printenv',
      'printenv PATH',
    ])('auto-approves: %s', (command) => {
      const result = autoApproveSafeBash(createBashInput(command));
      expectSilentAllow(result);
    });
  });

  describe('auto-approves GitHub CLI read operations', () => {
    test.each([
      'gh issue list',
      'gh issue view 42',
      'gh issue status',
      'gh pr list',
      'gh pr view 10',
      'gh pr status',
      'gh repo view',
      'gh repo list',
      'gh workflow list',
      'gh workflow view ci',
      'gh milestone list',
    ])('auto-approves: %s', (command) => {
      const result = autoApproveSafeBash(createBashInput(command));
      expectSilentAllow(result);
    });
  });

  describe('auto-approves testing and linting commands', () => {
    test.each([
      'pytest tests/',
      'pytest -v tests/unit',
      'poetry run pytest --cov=app',
      'npm run test',
      'npm run lint',
      'npm run typecheck',
      'npm run format',
      'ruff check .',
      'ruff format --check .',
      'ty check',
      'mypy src/',
    ])('auto-approves: %s', (command) => {
      const result = autoApproveSafeBash(createBashInput(command));
      expectSilentAllow(result);
    });
  });

  describe('rejects destructive git commands (#662)', () => {
    test.each([
      'git checkout -f',
      'git checkout --force main',
      'git clean -fd',
      'git reset --hard HEAD~1',
      'git push --force origin main',
      'git push -f origin main',
    ])('requires manual review for destructive: %s', (command) => {
      const result = autoApproveSafeBash(createBashInput(command));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // Should NOT auto-approve — let user decide
      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });
  });

  describe('requires manual review for gh milestone writes (#662)', () => {
    test.each([
      'gh milestone create "v2.0"',
      'gh milestone edit 5',
      'gh milestone delete 3',
    ])('requires manual review for: %s', (command) => {
      const result = autoApproveSafeBash(createBashInput(command));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });
  });

  describe('returns silent success for unknown commands (manual review)', () => {
    test.each([
      'npm install express',
      'pip install requests',
      'docker run nginx',
      'rm -rf node_modules',
      'sudo apt-get update',
      'ssh user@server',
      'scp file.txt remote:/',
    ])('requires manual review for: %s', (command) => {
      const result = autoApproveSafeBash(createBashInput(command));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // Should NOT have permissionDecision (let user decide)
      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });
  });

  describe('result structure for allowed commands', () => {
    test('includes permissionDecision allow for safe commands', () => {
      const result = autoApproveSafeBash(createBashInput('git status'));
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });
  });
});

// =============================================================================
// 4. REDACT SECRETS
// =============================================================================

describe('redactSecrets', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  describe('detects OpenAI API keys', () => {
    test('warns on sk- prefixed key in tool_result', () => {
      const input = createHookInput({
        tool_result: 'Output contains sk-abc1234567890abcdefghijk',
      } as Partial<HookInput>);
      const result = redactSecrets(input);
      expectSilentSuccess(result);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Potential API key detected')
      );
    });

    test('warns on sk- key in output field', () => {
      const input = createHookInput({
        output: 'Found key: sk-longkeyvalue1234567890ab',
      } as Partial<HookInput>);
      const result = redactSecrets(input);
      expectSilentSuccess(result);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Potential API key detected')
      );
    });
  });

  describe('detects GitHub PATs', () => {
    test('warns on ghp_ prefixed token', () => {
      const input = createHookInput({
        tool_result: 'ghp_aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wXY',
      } as Partial<HookInput>);
      const result = redactSecrets(input);
      expectSilentSuccess(result);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Potential API key detected')
      );
    });
  });

  describe('detects AWS access keys', () => {
    test('warns on GitLab glpat- token (#3589)', () => {
      const input = createHookInput({
        tool_result: 'glpat-aB1cD2eF3gH4iJ5kL6mN7oP',
      } as Partial<HookInput>);
      const result = redactSecrets(input);
      expectSilentSuccess(result);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Potential API key detected')
      );
    });
  });

  describe('detects AWS access keys', () => {
    test('warns on AKIA prefixed key', () => {
      const input = createHookInput({
        tool_result: 'aws_key=AKIAIOSFODNN7EXAMPLE',
      } as Partial<HookInput>);
      const result = redactSecrets(input);
      expectSilentSuccess(result);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Potential API key detected')
      );
    });
  });

  describe('detects Slack tokens', () => {
    test('warns on xoxb- prefixed token', () => {
      const input = createHookInput({
        tool_result: 'SLACK_TOKEN=xoxb-123456789-abcdefghijklmn',
      } as Partial<HookInput>);
      const result = redactSecrets(input);
      expectSilentSuccess(result);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Potential API key detected')
      );
    });

    test('warns on xoxp- prefixed token', () => {
      const input = createHookInput({
        tool_result: 'token: xoxp-user-token-value',
      } as Partial<HookInput>);
      const result = redactSecrets(input);
      expectSilentSuccess(result);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Potential API key detected')
      );
    });
  });

  describe('detects generic secrets', () => {
    test('warns on password = "value" pattern', () => {
      const input = createHookInput({
        tool_result: 'password = "my-secret-pass"',
      } as Partial<HookInput>);
      const result = redactSecrets(input);
      expectSilentSuccess(result);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Potential hardcoded credential')
      );
    });

    test('warns on secret = "value" pattern', () => {
      const input = createHookInput({
        tool_result: "secret = 'super-secret-value'",
      } as Partial<HookInput>);
      const result = redactSecrets(input);
      expectSilentSuccess(result);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Potential hardcoded credential')
      );
    });

    test('warns on PASSWORD: "value" pattern', () => {
      const input = createHookInput({
        tool_result: 'PASSWORD: "admin123"',
      } as Partial<HookInput>);
      const result = redactSecrets(input);
      expectSilentSuccess(result);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Potential hardcoded credential')
      );
    });
  });

  describe('does not warn on clean output', () => {
    test('no warnings for normal output', () => {
      const input = createHookInput({
        tool_result: 'Build completed successfully. 42 tests passed.',
      } as Partial<HookInput>);
      const result = redactSecrets(input);
      expectSilentSuccess(result);
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    test('no warnings for empty output', () => {
      const input = createHookInput({
        tool_result: '',
      } as Partial<HookInput>);
      const result = redactSecrets(input);
      expectSilentSuccess(result);
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    test('no warnings when no tool_result or output', () => {
      const input = createHookInput();
      const result = redactSecrets(input);
      expectSilentSuccess(result);
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  describe('never blocks execution', () => {
    test('always returns continue: true even with secrets detected', () => {
      const input = createHookInput({
        tool_result: 'sk-abc1234567890abcdefghijk password = "leaked"',
      } as Partial<HookInput>);
      const result = redactSecrets(input);
      expect(result.continue).toBe(true);
    });
  });

  describe('warns only once per category per invocation', () => {
    test('warns once for multiple API keys in same output', () => {
      const input = createHookInput({
        tool_result: 'key1=sk-abc1234567890abcdefghijk key2=ghp_aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1w',
      } as Partial<HookInput>);
      redactSecrets(input);
      // The loop breaks after first API key match
      const apiKeyCalls = stderrSpy.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('API key')
      );
      expect(apiKeyCalls).toHaveLength(1);
    });
  });
});

// =============================================================================
// 5. GIT VALIDATOR
// =============================================================================


// =============================================================================
// 6. SECURITY COMMAND AUDIT
// =============================================================================

describe('securityCommandAudit', () => {
  describe('only processes Bash tool', () => {
    test('returns silent success for Bash commands', () => {
      const input = createBashInput('git status', { project_dir: '/test/project' });
      const result = securityCommandAudit(input);
      expectSilentSuccess(result);
    });

    test('silently ignores Write tool', () => {
      const input = createHookInput({
        tool_name: 'Write',
        tool_input: { file_path: '/test/file.ts', content: 'hello' },
        project_dir: '/test/project',
      });
      const result = securityCommandAudit(input);
      expectSilentSuccess(result);
    });

    test('silently ignores Read tool', () => {
      const input = createHookInput({
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts' },
        project_dir: '/test/project',
      });
      const result = securityCommandAudit(input);
      expectSilentSuccess(result);
    });

    test('silently ignores Edit tool', () => {
      const input = createHookInput({
        tool_name: 'Edit',
        tool_input: { file_path: '/test/file.ts', old_string: 'a', new_string: 'b' },
        project_dir: '/test/project',
      });
      const result = securityCommandAudit(input);
      expectSilentSuccess(result);
    });

    test('silently ignores Glob tool', () => {
      const input = createHookInput({
        tool_name: 'Glob',
        tool_input: { pattern: '**/*.ts' },
        project_dir: '/test/project',
      });
      const result = securityCommandAudit(input);
      expectSilentSuccess(result);
    });
  });

  describe('always returns silent success', () => {
    test('never blocks execution even for dangerous commands', () => {
      const input = createBashInput('rm -rf /', { project_dir: '/test/project' });
      const result = securityCommandAudit(input);
      expectSilentSuccess(result);
    });

    test('returns silent success for normal commands', () => {
      const input = createBashInput('ls -la', { project_dir: '/test/project' });
      const result = securityCommandAudit(input);
      expectSilentSuccess(result);
    });

    test('returns silent success for empty commands', () => {
      const input = createBashInput('', { project_dir: '/test/project' });
      const result = securityCommandAudit(input);
      expectSilentSuccess(result);
    });
  });

  describe('result structure', () => {
    test('result has continue: true', () => {
      const input = createBashInput('echo test', { project_dir: '/test/project' });
      const result = securityCommandAudit(input);
      expect(result.continue).toBe(true);
    });

    test('result has suppressOutput: true', () => {
      const input = createBashInput('echo test', { project_dir: '/test/project' });
      const result = securityCommandAudit(input);
      expect(result.suppressOutput).toBe(true);
    });

    test('does not include stopReason', () => {
      const input = createBashInput('echo test', { project_dir: '/test/project' });
      const result = securityCommandAudit(input);
      expect(result.stopReason).toBeUndefined();
    });
  });
});

// =============================================================================
// 7. SECURITY HOOKS REGISTRY (#686)
// =============================================================================

describe('SECURITY_HOOKS registry', () => {
  // #3835 (2026-08-31): dangerous-command-blocker, file-guard and git-validator
  // left the set ahead of deletion; their opinions are operator-scope
  // permissions.deny rules. Pinned so a silent re-add shows up here.
  const EXPECTED_HOOKS = [
    'auto-approve-safe-bash',
    'redact-secrets',
    'security-command-audit',
  ];
  const RETIRED_FROM_SET = ['dangerous-command-blocker', 'file-guard', 'git-validator'];

  test('contains exactly the 3 remaining security hooks', () => {
    expect(SECURITY_HOOKS.size).toBe(3);
    for (const hook of RETIRED_FROM_SET) {
      expect(SECURITY_HOOKS.has(hook as never)).toBe(false);
    }
    for (const hook of EXPECTED_HOOKS) {
      expect(SECURITY_HOOKS.has(hook as never)).toBe(true);
    }
  });

  test('isSecurityCritical() returns true for all security hooks', () => {
    for (const hook of EXPECTED_HOOKS) {
      expect(isSecurityCritical(hook)).toBe(true);
    }
  });

  test('isSecurityCritical() returns false for non-security hooks', () => {
    expect(isSecurityCritical('learning-tracker')).toBe(false);
    expect(isSecurityCritical('some-random-hook')).toBe(false);
  });

  test('getSecurityHooks() returns all 3 hooks', () => {
    const hooks = getSecurityHooks();
    expect(hooks).toHaveLength(3);
    for (const hook of EXPECTED_HOOKS) {
      expect(hooks).toContain(hook);
    }
  });

  test('assertCanToggle() throws for security hooks', () => {
    for (const hook of EXPECTED_HOOKS) {
      expect(() => assertCanToggle(hook)).toThrow('Cannot disable security-critical hook');
    }
  });

  test('assertCanToggle() does not throw for non-security hooks', () => {
    expect(() => assertCanToggle('learning-tracker')).not.toThrow();
    expect(() => assertCanToggle('pattern-sync-pull')).not.toThrow();
  });
});

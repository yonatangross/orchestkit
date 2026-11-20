/**
 * Auto-approve hardening (card ork-autoapprove-fix-2026-10-22).
 *
 * Every test here runs with ORK_PERMISSION_AUTO_APPROVE=1, the only mode in
 * which the PermissionRequest hooks can allow anything. Each describe covers
 * one class of gap and carries an allow control, so a hook that stopped
 * allowing everything would still fail the suite.
 *
 * Fail-first: written before the fix; the reject cases fail on main at
 * cc8795cdd and pass after it.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { autoApproveProjectWrites } from '../../permission/auto-approve-project-writes.js';
import { autoApproveSafeBash } from '../../permission/auto-approve-safe-bash.js';
import { projectWriteRetry } from '../../permission-denied/project-write-retry.js';
import { safeCommandRetry } from '../../permission-denied/safe-command-retry.js';
import { isHardDeniedWritePath } from '../../lib/permission-auto-approve.js';
import { isCompoundCommand, hasUnquotedExpansion } from '../../lib/normalize-command.js';
import type { HookInput } from '../../types.js';

const FLAG = 'ORK_PERMISSION_AUTO_APPROVE';
const prevFlag = process.env[FLAG];
beforeEach(() => {
  process.env[FLAG] = '1';
});
afterEach(() => {
  if (prevFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = prevFlag;
});

type AnyResult = {
  hookSpecificOutput?: { decision?: { behavior?: string }; permissionDecision?: string; retry?: boolean };
};

function isAllow(r: AnyResult): boolean {
  return r.hookSpecificOutput?.decision?.behavior === 'allow' || r.hookSpecificOutput?.permissionDecision === 'allow';
}

function isRetry(r: AnyResult): boolean {
  return r.hookSpecificOutput?.retry === true;
}

function writeInput(filePath: string, projectDir: string, event = 'PermissionRequest'): HookInput {
  return {
    hook_event_name: event,
    tool_name: 'Write',
    tool_input: { file_path: filePath, content: 'x' },
    project_dir: projectDir,
    session_id: 'hardening',
    cwd: projectDir,
  } as HookInput;
}

function bashInput(command: string, event = 'PermissionRequest'): HookInput {
  return {
    hook_event_name: event,
    tool_name: 'Bash',
    tool_input: { command },
    project_dir: '/test/project',
    session_id: 'hardening',
    cwd: '/test/project',
  } as HookInput;
}

// ---------------------------------------------------------------------------
// 1. Symlinks: the denylist must hold for the requested path AND the target
// ---------------------------------------------------------------------------

describe('write hooks check both the requested path and the symlink target', () => {
  let project = '';

  beforeAll(() => {
    project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ork-aa-sym-')));
    fs.mkdirSync(path.join(project, 'src'));
    fs.mkdirSync(path.join(project, 'plain-dir'));
    fs.writeFileSync(path.join(project, 'src', 'ordinary.ts'), 'x');
    fs.writeFileSync(path.join(project, 'protected-target.json'), '{}');
    // Protected name -> ordinary file (requested path is the protected one)
    fs.symlinkSync(path.join(project, 'src', 'ordinary.ts'), path.join(project, '.mcp.json'));
    fs.symlinkSync(path.join(project, 'src', 'ordinary.ts'), path.join(project, '.env.local'));
    // Protected directory name -> ordinary directory
    fs.symlinkSync(path.join(project, 'plain-dir'), path.join(project, '.claude'));
    // Ordinary name -> protected file (the direction main already covers)
    fs.writeFileSync(path.join(project, 'plugin.json'), '{}');
    fs.symlinkSync(path.join(project, 'plugin.json'), path.join(project, 'innocent.json'));
  });

  afterAll(() => {
    fs.rmSync(project, { recursive: true, force: true });
  });

  const protectedRequests = ['.mcp.json', '.env.local', '.claude/settings.local.json'];

  test.each(protectedRequests)('project-writes does not allow a protected name that links to an ordinary file: %s', (rel) => {
    expect(isAllow(autoApproveProjectWrites(writeInput(path.join(project, rel), project)))).toBe(false);
  });

  test.each(protectedRequests)('project-write-retry does not retry a protected name that links to an ordinary file: %s', (rel) => {
    expect(isRetry(projectWriteRetry(writeInput(path.join(project, rel), project, 'PermissionDenied')))).toBe(false);
  });

  test('an ordinary name that links to a protected file stays denied (existing direction)', () => {
    expect(isAllow(autoApproveProjectWrites(writeInput(path.join(project, 'innocent.json'), project)))).toBe(false);
    expect(isRetry(projectWriteRetry(writeInput(path.join(project, 'innocent.json'), project, 'PermissionDenied')))).toBe(false);
  });

  test('control: an ordinary in-project file is still allowed and retried', () => {
    expect(isAllow(autoApproveProjectWrites(writeInput(path.join(project, 'src', 'ordinary.ts'), project)))).toBe(true);
    expect(isRetry(projectWriteRetry(writeInput(path.join(project, 'src', 'ordinary.ts'), project, 'PermissionDenied')))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Quote state: substitution and redirects hidden by mixed quoting
// ---------------------------------------------------------------------------

describe('compound detection tracks quote state', () => {
  const executes = [
    `echo "a'b $(id) c'd"`,
    'echo "a\'b `id` c\'d"',
    `echo "x'" > out.txt "'y"`,
    `echo "a'b" $(id) "c'd"`,
  ];

  test.each(executes)('apostrophes inside double quotes do not hide an operator: %s', (cmd) => {
    expect(isCompoundCommand(cmd)).toBe(true);
  });

  const inert = [
    `echo 'a $(b) c'`,
    `echo "a > b"`,
    `echo "it's fine"`,
    `echo 'say "$(x)"'`,
  ];

  test.each(inert)('control: quoted text that bash never runs stays simple: %s', (cmd) => {
    expect(isCompoundCommand(cmd)).toBe(false);
  });

  test('safe-bash does not allow a mixed-quote command with live substitution', () => {
    expect(isAllow(autoApproveSafeBash(bashInput(`echo "a'b $(id) c'd"`)))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Credential paths: no glob or expansion games, case-insensitive
// ---------------------------------------------------------------------------

describe('credential-path reject cannot be dodged by globs, expansion or case', () => {
  const dodges = [
    'cat ~/.SSH/config',
    'cat ~/.ss?/config',
    'cat ~/.ss*/config',
    'cat ~/.[s]sh/config',
    'cat ~/.{ssh,aws}/config',
    'cat $HOME/notes.txt',
    'cat "${HOME}/notes.txt"',
    'cat ~root/notes.txt',
  ];

  test.each(dodges)('safe-bash does not allow: %s', (cmd) => {
    expect(isAllow(autoApproveSafeBash(bashInput(cmd)))).toBe(false);
  });

  test.each(dodges)('safe-command-retry does not retry: %s', (cmd) => {
    expect(isRetry(safeCommandRetry(bashInput(cmd, 'PermissionDenied')))).toBe(false);
  });

  test('hasUnquotedExpansion ignores the same characters inside single quotes', () => {
    expect(hasUnquotedExpansion(`echo '*.ts $HOME {a,b}'`)).toBe(false);
    expect(hasUnquotedExpansion('echo "plain text"')).toBe(false);
  });

  test('control: plain reads are still allowed and retried', () => {
    expect(isAllow(autoApproveSafeBash(bashInput('cat README.md')))).toBe(true);
    expect(isAllow(autoApproveSafeBash(bashInput('ls -la src')))).toBe(true);
    expect(isRetry(safeCommandRetry(bashInput('cat README.md', 'PermissionDenied')))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Hard denylist: files whose content runs code or holds secrets
// ---------------------------------------------------------------------------

describe('hard denylist covers code-execution config and secret stores', () => {
  const denied = [
    '/p/.envrc',
    '/p/.vscode/tasks.json',
    '/p/.idea/workspace.xml',
    '/p/.npmrc',
    '/p/CLAUDE.md',
    '/p/sub/claude.md',
    '/p/AGENTS.md',
    '/p/.ssh/config',
    '/p/.bashrc',
    '/p/.bash_profile',
    '/p/.zshrc',
    '/p/.zshenv',
    '/p/.zprofile',
    '/p/.profile',
    '/p/package.json',
    '/p/packages/a/package.json',
    '/p/pyproject.toml',
    '/p/Makefile',
    '/p/GNUmakefile',
    '/p/conftest.py',
    '/p/tests/conftest.py',
  ];

  test.each(denied)('denied: %s', (p) => {
    expect(isHardDeniedWritePath(p)).toBe(true);
  });

  test.each(['/p/src/index.ts', '/p/README.md', '/p/docs/makefile-notes.md', '/p/src/package.ts'])(
    'control: ordinary file not denied: %s',
    (p) => {
      expect(isHardDeniedWritePath(p)).toBe(false);
    },
  );
});

// ---------------------------------------------------------------------------
// 5. Safe-bash allowlist: background jobs, git option abuse, arbitrary scripts
// ---------------------------------------------------------------------------

describe('safe-bash allowlist refuses background jobs, risky git options and arbitrary scripts', () => {
  const refused = [
    'git status &',
    'git log --oneline &',
    'git fetch --upload-pack=x origin',
    'git log --output=out.txt',
    'git diff --ext-diff',
    'git -c core.pager=x log',
    'git -C ../other status',
    'npm run build',
    'npm run deploy',
    'pnpm run build',
    'yarn run build',
    'poetry run python x.py',
    'npm run test-e2e',
    'npm run lint:fix',
    'pnpm run format-all',
    'git --exec-path=x status',
    // git accepts any unambiguous prefix of a long option: these run x.
    'git fetch --upload-pa=x origin',
    'git fetch --upl x origin',
    'git pull --upload-p=x origin main',
  ];

  test.each(refused)('safe-bash does not allow: %s', (cmd) => {
    expect(isAllow(autoApproveSafeBash(bashInput(cmd)))).toBe(false);
  });

  test.each(['git fetch --upload-pack=x origin', 'git fetch --upload-pa=x origin', 'git log --output=out.txt', 'git status &'])(
    'safe-command-retry does not retry: %s',
    (cmd) => {
      expect(isRetry(safeCommandRetry(bashInput(cmd, 'PermissionDenied')))).toBe(false);
    },
  );

  test.each(['git status', 'git log --oneline -5', 'git diff HEAD', 'git log --stat --graph', 'git diff --cached --exit-code', 'git fetch --prune --all', 'git branch --all', 'npm test', 'npm run test', 'npm run lint', 'pnpm run test', 'yarn run lint', 'poetry run pytest -q'])(
    'control: still allowed: %s',
    (cmd) => {
      expect(isAllow(autoApproveSafeBash(bashInput(cmd)))).toBe(true);
    },
  );
});

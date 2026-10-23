/**
 * Post-merge review of #4859 (reviewer-sub-231): safe-bash must not
 * auto-approve a subcommand that only starts like an allowed one, git options
 * that run a program, or package-manager options. Runs with
 * ORK_PERMISSION_AUTO_APPROVE=1; the plain commands are the control.
 *
 * Fail-first: the refused rows fail on aabe8955 and pass after.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { autoApproveSafeBash } from '../../permission/auto-approve-safe-bash.js';
import { safeCommandRetry } from '../../permission-denied/safe-command-retry.js';
import type { HookInput } from '../../types.js';

const FLAG = 'ORK_PERMISSION_AUTO_APPROVE';
const prev = process.env[FLAG];
beforeEach(() => {
  process.env[FLAG] = '1';
});
afterEach(() => {
  if (prev === undefined) delete process.env[FLAG];
  else process.env[FLAG] = prev;
});

function bash(command: string, event = 'PermissionRequest'): HookInput {
  return {
    hook_event_name: event,
    tool_name: 'Bash',
    tool_input: { command },
    project_dir: '/test/project',
    session_id: 'option-prefix',
    cwd: '/test/project',
  } as HookInput;
}

type Out = { hookSpecificOutput?: { decision?: { behavior?: string }; permissionDecision?: string; retry?: boolean } };
const isAllow = (r: Out): boolean =>
  r.hookSpecificOutput?.decision?.behavior === 'allow' || r.hookSpecificOutput?.permissionDecision === 'allow';

describe('safe-bash refuses look-alike subcommands, program-running options and package-manager options', () => {
  const refused = [
    'git difftool -x x',
    'git difftool',
    'npm test --script-shell=x',
    'npm test --node-options=x',
    'npm test --prefi=o',
    'npm run build',
    'pnpm run build',
    'yarn run build',
    'poetry run python x.py',
    "npm run 'test x'",
    'npm run "test x"',
    "pnpm run 'lint x'",
    "npm test 'a b'",
  ];

  test.each(refused)('safe-bash does not allow: %s', (cmd) => {
    expect(isAllow(autoApproveSafeBash(bash(cmd)))).toBe(false);
  });

  test.each(['npm test --prefi=o', 'npm run test-e2e', "npm run 'test x'", 'npm run "test x"'])('safe-command-retry does not retry: %s', (cmd) => {
    expect(safeCommandRetry(bash(cmd, 'PermissionDenied')).hookSpecificOutput?.retry === true).toBe(false);
  });

  test.each(['git status', 'git diff HEAD', 'git log -1', 'npm test', 'npm run test', 'npm run lint', 'npm ls', 'poetry run pytest -q'])(
    'control: still allowed: %s',
    (cmd) => {
      expect(isAllow(autoApproveSafeBash(bash(cmd)))).toBe(true);
    },
  );
});

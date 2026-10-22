/**
 * Codex XREVIEW 6334455311 on #4844: the write hooks must check the hard
 * denylist and excluded directories against BOTH the requested path and the
 * symlink target. Runs with ORK_PERMISSION_AUTO_APPROVE=1, the only mode in
 * which these hooks allow anything; the ordinary-file case is the control.
 *
 * Fail-first: the protected-name cases fail on 44bd013b and pass after.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { autoApproveProjectWrites } from '../../permission/auto-approve-project-writes.js';
import { projectWriteRetry } from '../../permission-denied/project-write-retry.js';
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

const isAllow = (r: AnyResult): boolean =>
  r.hookSpecificOutput?.decision?.behavior === 'allow' || r.hookSpecificOutput?.permissionDecision === 'allow';
const isRetry = (r: AnyResult): boolean => r.hookSpecificOutput?.retry === true;

function writeInput(filePath: string, projectDir: string, event = 'PermissionRequest'): HookInput {
  return {
    hook_event_name: event,
    tool_name: 'Write',
    tool_input: { file_path: filePath, content: 'x' },
    project_dir: projectDir,
    session_id: 'symlink-both-paths',
    cwd: projectDir,
  } as HookInput;
}

describe('write hooks check both the requested path and the symlink target', () => {
  let project = '';

  beforeAll(() => {
    project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ork-982-sym-')));
    fs.mkdirSync(path.join(project, 'src'));
    fs.mkdirSync(path.join(project, 'plain-dir'));
    fs.writeFileSync(path.join(project, 'src', 'ordinary.ts'), 'x');
    fs.symlinkSync(path.join(project, 'src', 'ordinary.ts'), path.join(project, '.mcp.json'));
    fs.symlinkSync(path.join(project, 'src', 'ordinary.ts'), path.join(project, '.env.local'));
    fs.symlinkSync(path.join(project, 'plain-dir'), path.join(project, '.claude'));
    fs.writeFileSync(path.join(project, 'plugin.json'), '{}');
    fs.symlinkSync(path.join(project, 'plugin.json'), path.join(project, 'innocent.json'));
  });

  afterAll(() => {
    fs.rmSync(project, { recursive: true, force: true });
  });

  const protectedRequests = ['.mcp.json', '.env.local', '.claude/notes.md'];

  test.each(protectedRequests)('project-writes does not allow a protected name that links to an ordinary file: %s', (rel) => {
    expect(isAllow(autoApproveProjectWrites(writeInput(path.join(project, rel), project)))).toBe(false);
  });

  test.each(protectedRequests)('project-write-retry does not retry a protected name that links to an ordinary file: %s', (rel) => {
    expect(isRetry(projectWriteRetry(writeInput(path.join(project, rel), project, 'PermissionDenied')))).toBe(false);
  });

  test('an ordinary name that links to a protected file stays denied', () => {
    expect(isAllow(autoApproveProjectWrites(writeInput(path.join(project, 'innocent.json'), project)))).toBe(false);
    expect(isRetry(projectWriteRetry(writeInput(path.join(project, 'innocent.json'), project, 'PermissionDenied')))).toBe(false);
  });

  test('control: an ordinary in-project file is still allowed and retried', () => {
    expect(isAllow(autoApproveProjectWrites(writeInput(path.join(project, 'src', 'ordinary.ts'), project)))).toBe(true);
    expect(isRetry(projectWriteRetry(writeInput(path.join(project, 'src', 'ordinary.ts'), project, 'PermissionDenied')))).toBe(true);
  });
});

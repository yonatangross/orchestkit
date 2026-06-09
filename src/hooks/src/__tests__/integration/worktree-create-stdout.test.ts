/**
 * Regression guard: bin/run-hook.mjs WorktreeCreate stdout contract (#2335,
 * supersedes #2016/#1990).
 *
 * Current CC contract: a registered WorktreeCreate hook OWNS provisioning —
 * it must create the worktree and echo its ABSOLUTE PATH as bare stdout
 * (command-type) or return `hookSpecificOutput.worktreePath` (http-type).
 * Empty stdout is a hard failure that aborts the Agent(isolation:"worktree")
 * spawn. The pre-#2335 behavior (emit empty stdout, CC provisions at its
 * default path) is exactly what this suite USED to pin — inverted now.
 *
 * Still pinned from #2016: the JSON `{"continue":true,...}` envelope must
 * NEVER reach command-type WorktreeCreate/WorktreeRemove stdout — CC would
 * misread it as a path ("returned a path that is not a directory").
 *
 * Hermetic: runs against fresh tmpdir git repos so provisioning side effects
 * (.worktrees/, .claude/state) never touch the real repo. Skips automatically
 * when dist/lifecycle.mjs isn't built.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');
const HOOKS_ROOT = join(REPO_ROOT, 'src', 'hooks');
const RUN_HOOK = join(HOOKS_ROOT, 'bin', 'run-hook.mjs');
// worktree/* hooks live in the lifecycle bundle (entries/lifecycle.ts)
const DIST = join(HOOKS_ROOT, 'dist', 'lifecycle.mjs');

let PROJECT_DIR: string; // real git repo with a commit
let NOGIT_DIR: string; // plain directory — provisioning must decline

function runWorktreeHook(hookName: string, input: Record<string, unknown>, projectDir = PROJECT_DIR) {
  return spawnSync('node', [RUN_HOOK, hookName], {
    input: JSON.stringify({ project_dir: projectDir, ...input }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: 'utf8',
    timeout: 30_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

describe('WorktreeCreate stdout contract (#2335)', () => {
  beforeAll(() => {
    if (!existsSync(DIST)) {
      console.warn(`[integration] Skipping suite — dist bundle not built at ${DIST}`);
      return;
    }
    PROJECT_DIR = join(tmpdir(), `ork-wt2336-${process.pid}-${Date.now()}`);
    mkdirSync(PROJECT_DIR, { recursive: true });
    execFileSync('git', ['init', '--quiet', PROJECT_DIR], { stdio: 'ignore' });
    writeFileSync(join(PROJECT_DIR, 'README.md'), 'x');
    execFileSync(
      'git',
      ['-C', PROJECT_DIR, '-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.'],
      { stdio: 'ignore' },
    );
    execFileSync(
      'git',
      ['-C', PROJECT_DIR, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'init', '--no-gpg-sign'],
      { stdio: 'ignore' },
    );

    NOGIT_DIR = join(tmpdir(), `ork-wt2336-nogit-${process.pid}-${Date.now()}`);
    mkdirSync(NOGIT_DIR, { recursive: true });
  });

  afterAll(() => {
    for (const dir of [PROJECT_DIR, NOGIT_DIR]) {
      if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('worktree-provisioner emits the BARE worktree path on command-type WorktreeCreate', () => {
    if (!existsSync(DIST)) return;
    const result = runWorktreeHook('worktree/worktree-provisioner', {
      hook_event_name: 'WorktreeCreate',
      worktree_name: 'feature-test',
      session_id: 's-2336',
    });
    expect(result.status, `stderr: ${result.stderr?.slice(0, 300)}`).toBe(0);

    const expectedPath = join(PROJECT_DIR, '.worktrees', 'feature-test');
    // The crux: CC consumes stdout as the path. Bare path, no JSON envelope.
    expect(result.stdout.trim()).toBe(expectedPath);
    expect(result.stdout).not.toContain('{');
    expect(existsSync(join(expectedPath, 'README.md'))).toBe(true);
  });

  it('worktree-provisioner emits EMPTY stdout when it cannot provision (declines)', () => {
    if (!existsSync(DIST)) return;
    const result = runWorktreeHook(
      'worktree/worktree-provisioner',
      { hook_event_name: 'WorktreeCreate', worktree_name: 'nope', session_id: 's-2336' },
      NOGIT_DIR,
    );
    expect(result.status, `stderr: ${result.stderr?.slice(0, 300)}`).toBe(0);
    // Declining must NOT print the envelope either — empty stdout is the
    // only valid "no path from me" signal on this event.
    expect(result.stdout).toBe('');
  });

  it('worktree-provisioner emits the JSON envelope on http-type (positive control)', () => {
    if (!existsSync(DIST)) return;
    const result = runWorktreeHook('worktree/worktree-provisioner', {
      hook_event_name: 'WorktreeCreate',
      type: 'http',
      worktree_name: 'feature-http',
      session_id: 's-2336',
    });
    expect(result.status, `stderr: ${result.stderr?.slice(0, 300)}`).toBe(0);
    // http-type provisioners return the path inside the envelope — CC reads
    // hookSpecificOutput.worktreePath from HTTP responses directly.
    const parsed = JSON.parse(result.stdout);
    expect(parsed.hookSpecificOutput?.worktreePath).toContain('.worktrees');
  });

  it('worktree-lifecycle-logger emits EMPTY stdout on command-type WorktreeRemove', () => {
    if (!existsSync(DIST)) return;
    const result = runWorktreeHook('worktree/worktree-lifecycle-logger', {
      hook_event_name: 'WorktreeRemove',
      worktree_path: join(PROJECT_DIR, '.worktrees', 'feature-test'),
      session_id: 's-2336',
    });
    expect(result.status, `stderr: ${result.stderr?.slice(0, 300)}`).toBe(0);
    // Remove-side observers contribute no path — envelope must stay suppressed.
    expect(result.stdout).toBe('');
  });
});

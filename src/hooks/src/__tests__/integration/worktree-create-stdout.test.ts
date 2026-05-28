/**
 * Regression guard: bin/run-hook.mjs WorktreeCreate stdout contract (#2016).
 *
 * CC reads a command-type `WorktreeCreate`/`WorktreeRemove` hook's STDOUT as
 * the provisioned worktree directory PATH (not the standard continue/
 * suppressOutput envelope). OrchestKit's worktree hooks are observers (logging
 * + registry linkage) — they do NOT provision worktrees, so they must emit
 * EMPTY stdout. If they print the `{"continue":true,...}` envelope, CC misreads
 * the JSON as the path ("returned a path that is not a directory") and aborts
 * every Agent(isolation:"worktree") spawn — silently degrading
 * implement/explore/brainstorm/review-pr/cover to single-threaded mode.
 *
 * The fix lives in the RUNNER (run-hook.mjs: emitHookResult event-keyed +
 * silentExit name-keyed, both #1990), NOT the handlers — the handlers may still
 * return outputSilentSuccess(); the runner suppresses it for these events. This
 * guard asserts the end-to-end shipped contract so a future runner refactor
 * can't regress it. Pre-#1996 this test would have failed.
 *
 * Hermetic: runs against a fresh tmpdir project so the worktree hooks' side
 * effects (.worktrees/ children-bus, .claude/state advisory) never touch the
 * real repo. Skips automatically when dist/lifecycle.mjs isn't built.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');
const HOOKS_ROOT = join(REPO_ROOT, 'src', 'hooks');
const RUN_HOOK = join(HOOKS_ROOT, 'bin', 'run-hook.mjs');
// worktree/* hooks live in the lifecycle bundle (entries/lifecycle.ts)
const DIST = join(HOOKS_ROOT, 'dist', 'lifecycle.mjs');

const WORKTREE_HOOKS = [
  'worktree/worktree-lifecycle-logger',
  'worktree/enter-registrar',
] as const;

let PROJECT_DIR: string;

function runWorktreeHook(hookName: string, input: Record<string, unknown>) {
  return spawnSync('node', [RUN_HOOK, hookName], {
    input: JSON.stringify({ project_dir: PROJECT_DIR, ...input }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: PROJECT_DIR },
    encoding: 'utf8',
    timeout: 10_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

describe('WorktreeCreate stdout contract (#2016)', () => {
  beforeAll(() => {
    if (!existsSync(DIST)) {
      console.warn(`[integration] Skipping suite — dist bundle not built at ${DIST}`);
      return;
    }
    PROJECT_DIR = join(tmpdir(), `ork-wt2016-${process.pid}-${Date.now()}`);
    mkdirSync(PROJECT_DIR, { recursive: true });
  });

  afterAll(() => {
    if (PROJECT_DIR && existsSync(PROJECT_DIR)) {
      rmSync(PROJECT_DIR, { recursive: true, force: true });
    }
  });

  for (const hookName of WORKTREE_HOOKS) {
    it(`${hookName} emits EMPTY stdout on command-type WorktreeCreate`, () => {
      if (!existsSync(DIST)) return;
      const result = runWorktreeHook(hookName, {
        hook_event_name: 'WorktreeCreate',
        name: 'feature-test',
        session_id: 's-2016',
        parent_session_id: 'p-2016',
      });
      expect(result.status, `stderr: ${result.stderr?.slice(0, 300)}`).toBe(0);
      // The crux: any non-empty stdout here is read by CC as the worktree path.
      expect(result.stdout).toBe('');
    });
  }

  it('worktree-lifecycle-logger STILL emits worktreePath on http-type (positive control)', () => {
    if (!existsSync(DIST)) return;
    const result = runWorktreeHook('worktree/worktree-lifecycle-logger', {
      hook_event_name: 'WorktreeCreate',
      type: 'http',
      name: 'feature-test',
      session_id: 's-2016',
    });
    expect(result.status, `stderr: ${result.stderr?.slice(0, 300)}`).toBe(0);
    // http-type provisioners legitimately return the path — suppression must
    // be scoped to the envelope-only case, never to a real worktreePath.
    const parsed = JSON.parse(result.stdout);
    expect(parsed.hookSpecificOutput?.worktreePath).toContain('.worktrees');
  });
});

/**
 * Integration test (#3725, #4217): the redact-secrets layer must react to the
 * field CC actually sends on PostToolUse.
 *
 * The unit suite stayed green while the layer was dead in production because
 * every test fed it `tool_result` — the legacy alias — while CC sends
 * `tool_response` (the same trap posttool/secret-handler.ts documented for
 * its own reader). This file closes the loop the verify-all sweep called for:
 * one CC-shaped PostToolUse payload, carried by `tool_response` alone, driven
 * through the BUILT bundle, asserting the token does not survive unflagged.
 *
 * Two tiers:
 *  - Spawned: `node plugins/ork/hooks/bin/run-hook.mjs skill/redact-secrets`,
 *    the dispatcher CC actually spawns. The stderr assertion requires the
 *    dispatcher to import its dist bundle, which works on Linux/macOS. On
 *    Windows run-hook.mjs cannot import a win32 absolute dist path at all
 *    (ERR_UNSUPPORTED_ESM_URL_SCHEME, swallowed into a silent success by the
 *    runner's catch), a pre-existing platform gap outside #3725's scope,
 *    so there the spawned tier only checks the envelope contract.
 *  - In-process: the freshly built skill.mjs imported directly via file:// URL
 *    and its registered `skill/redact-secrets` hook driven with the same
 *    payload. Cross-platform; asserts detection itself.
 *
 * #3578: feature PRs do not commit hooks/dist, so beforeAll rebuilds src/hooks
 * to make the fixtures exercise THIS PR's source rather than main's last
 * release bundle (the CI failure mode for #4217 part 1).
 *
 * #4334: that rebuild used to land in the tracked, release-owned
 * plugins/ork/hooks/dist/skill.mjs via copyFileSync. It left every local run
 * with a dirty tree, and copyFileSync truncates before it writes, so the ~20
 * other test files that read those bundles in parallel could import a
 * half-written one. Now the build goes to a temp dir through
 * ORK_HOOKS_OUT_DIR, and the spawned dispatcher is pointed at it through
 * ORK_HOOKS_DIST_DIR. Nothing under plugins/ is written by this file.
 *
 * Skips automatically when the build produced no bundle.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');
const HOOKS_PKG = join(REPO_ROOT, 'src', 'hooks');
const PLUGIN_HOOKS = join(REPO_ROOT, 'plugins', 'ork', 'hooks');
const RUN_HOOK = join(PLUGIN_HOOKS, 'bin', 'run-hook.mjs');
const HOOK_NAME = 'skill/redact-secrets';

/** Fake-but-realistic GitLab PAT (matches the #3589 glpat- family). */
const TOKEN = 'glpat-1234567890abcdefghijklmnop';

/** CC-shaped PostToolUse payload: hook_event_name + tool_response, no legacy aliases. */
function ccShapedPayload(toolResponse: string | Record<string, unknown>): string {
  return JSON.stringify({
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    session_id: '3725-redact-secrets',
    tool_input: { command: 'gitlab-ci printenv' },
    tool_response: toolResponse,
  });
}

/** Real Bash PostToolUse shape measured on Claude Code (#4217). */
function bashObjectResponse(stdout: string, stderr = ''): Record<string, unknown> {
  return { stdout, stderr, interrupted: false };
}

let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;
let scratchDir: string;

/** Temp build output for this file only. Cleared in afterAll even if build fails. */
let distDir = '';
/** Path to skill.mjs inside distDir. Empty until beforeAll succeeds. */
let bundle = '';

/** Env the spawned dispatcher needs to load the temp bundle (#4334). */
function dispatcherEnv(): NodeJS.ProcessEnv {
  return { ...process.env, CLAUDE_PROJECT_DIR: scratchDir, ORK_HOOKS_DIST_DIR: distDir };
}

beforeAll(() => {
  // #3578: feature PRs never commit hooks/dist, so rebuild to make the
  // object-shaped fixtures see the PR source and not the release bundle on
  // disk. #4334: into a temp dir, so this file writes nothing tracked and
  // races no other test file.
  distDir = mkdtempSync(join(tmpdir(), 'ork-hooks-dist-4334-'));
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: HOOKS_PKG,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, ORK_HOOKS_OUT_DIR: distDir },
  });
  if (build.status !== 0) {
    console.warn(
      `[integration] hooks build failed (status=${build.status}): ${String(build.stderr).slice(0, 400)}`,
    );
    return;
  }
  const built = join(distDir, 'skill.mjs');
  if (!existsSync(built)) {
    console.warn(`[integration] hooks build produced no ${built}`);
    return;
  }
  bundle = built;
}, 120_000);

afterAll(() => {
  if (distDir && existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
});

beforeEach(() => {
  // Fresh project dir per run so the dispatcher's session-event tracking
  // writes to a scratch path instead of the checkout (hook-runner.test.ts
  // convention).
  scratchDir = join(tmpdir(), `ork-redact-3725-${process.pid}-${Date.now()}`);
  mkdirSync(scratchDir, { recursive: true });
});

afterEach(() => {
  stderrSpy?.mockRestore();
  stderrSpy = undefined;
  if (scratchDir && existsSync(scratchDir)) {
    rmSync(scratchDir, { recursive: true, force: true });
  }
});

describe('redact-secrets through the built skill.mjs bundle (#3725, #4217)', () => {
  it('flags a glpat token in object-shaped Bash tool_response through run-hook.mjs', () => {
    if (!bundle) {
      console.warn('[integration] Skipping - the hooks build produced no skill.mjs');
      return;
    }

    const r = spawnSync('node', [RUN_HOOK, HOOK_NAME], {
      input: ccShapedPayload(bashObjectResponse(`GITLAB_TOKEN=${TOKEN} done`)),
      env: dispatcherEnv(),
      encoding: 'utf8',
      timeout: 20_000,
    });

    expect(r.status, `stderr: ${String(r.stderr).slice(0, 300)}`).toBe(0);

    // The token must not survive into the hook's stdout envelope.
    expect(String(r.stdout)).not.toContain(TOKEN);
    const parsed = JSON.parse(String(r.stdout).trim().split('\n').pop()!);
    expect(parsed.continue).toBe(true);

    // The load-bearing assertion: the layer actually SAW the production
    // Bash object shape. Windows cannot get here until the dispatcher's dist
    // import works on win32 (see file docstring); the in-process tier covers it.
    if (process.platform !== 'win32') {
      expect(String(r.stderr)).toContain('::warning::Potential API key detected in output - verify redaction');
    }
  });

  it('flags a glpat token that arrives as a string tool_response through run-hook.mjs', () => {
    if (!bundle) {
      console.warn('[integration] Skipping - the hooks build produced no skill.mjs');
      return;
    }

    const r = spawnSync('node', [RUN_HOOK, HOOK_NAME], {
      input: ccShapedPayload(`GITLAB_TOKEN=${TOKEN} done`),
      env: dispatcherEnv(),
      encoding: 'utf8',
      timeout: 20_000,
    });

    expect(r.status, `stderr: ${String(r.stderr).slice(0, 300)}`).toBe(0);
    expect(String(r.stdout)).not.toContain(TOKEN);
    if (process.platform !== 'win32') {
      expect(String(r.stderr)).toContain('::warning::Potential API key detected in output - verify redaction');
    }
  });

  it('stays silent on a clean object-shaped tool_response through run-hook.mjs', () => {
    if (!bundle) return;

    const r = spawnSync('node', [RUN_HOOK, HOOK_NAME], {
      input: ccShapedPayload(bashObjectResponse('build finished, all tests passed')),
      env: dispatcherEnv(),
      encoding: 'utf8',
      timeout: 20_000,
    });

    expect(r.status).toBe(0);
    expect(String(r.stderr)).not.toContain('::warning::');
    // #4334: the override is not silent. A stale export would otherwise
    // redirect every hook (including security hooks) with no signal.
    expect(String(r.stderr)).toContain(`ORK_HOOKS_DIST_DIR overrides hook bundles to "${distDir}"`);
  });

  it('warns on stderr when ORK_HOOKS_DIST_DIR is active (#4334)', () => {
    if (!bundle) return;

    const r = spawnSync('node', [RUN_HOOK, HOOK_NAME], {
      input: ccShapedPayload(bashObjectResponse('noop')),
      env: dispatcherEnv(),
      encoding: 'utf8',
      timeout: 20_000,
    });

    expect(r.status).toBe(0);
    expect(String(r.stderr)).toContain(
      `[orchestkit] WARNING: ORK_HOOKS_DIST_DIR overrides hook bundles to "${distDir}" (#4334)`,
    );
  });

  it('ignores ORK_HOOKS_DIST_DIR when the directory does not exist (#4334)', () => {
    if (!bundle) return;

    const missing = join(tmpdir(), `ork-hooks-dist-missing-${process.pid}-${Date.now()}`);
    const r = spawnSync('node', [RUN_HOOK, HOOK_NAME], {
      input: ccShapedPayload(bashObjectResponse('noop')),
      env: { ...process.env, CLAUDE_PROJECT_DIR: scratchDir, ORK_HOOKS_DIST_DIR: missing },
      encoding: 'utf8',
      timeout: 20_000,
    });

    expect(r.status).toBe(0);
    expect(String(r.stderr)).not.toContain('ORK_HOOKS_DIST_DIR overrides');
  });

  it('detects the token when the built bundle is driven in-process with Bash object shape', async () => {
    if (!bundle) return;

    const loaded = await import(pathToFileURL(bundle).href);
    const hookFn = loaded.hooks?.[HOOK_NAME];
    expect(hookFn).toBeTypeOf('function');

    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const result = hookFn({
      hook_event: 'PostToolUse',
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      session_id: '3725-redact-secrets',
      tool_input: { command: 'gitlab-ci printenv' },
      tool_response: bashObjectResponse(`GITLAB_TOKEN=${TOKEN} done`),
    });

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('::warning::Potential API key detected in output - verify redaction')
    );
    // Never echoes the secret back, whatever it decides.
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(result.continue).toBe(true);
  });
});

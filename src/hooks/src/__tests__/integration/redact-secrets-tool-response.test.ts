/**
 * Integration test (#3725): the redact-secrets layer must react to the field
 * CC actually sends on PostToolUse.
 *
 * The unit suite stayed green while the layer was dead in production because
 * every test fed it `tool_result` — the legacy alias — while CC sends
 * `tool_response` (the same trap posttool/secret-handler.ts documented for
 * its own reader). This file closes the loop the verify-all sweep called for:
 * one CC-shaped PostToolUse payload, carried by `tool_response` alone, driven
 * through the BUILT bundle (plugins/ork/hooks/dist/skill.mjs), asserting the
 * token does not survive unflagged.
 *
 * Two tiers:
 *  - Spawned: `node plugins/ork/hooks/bin/run-hook.mjs skill/redact-secrets`,
 *    the dispatcher CC actually spawns. The stderr assertion requires the
 *    dispatcher to import its dist bundle, which works on Linux/macOS. On
 *    Windows run-hook.mjs cannot import a win32 absolute dist path at all
 *    (ERR_UNSUPPORTED_ESM_URL_SCHEME, swallowed into a silent success by the
 *    runner's catch) — a pre-existing platform gap outside #3725's scope —
 *    so there the spawned tier only checks the envelope contract.
 *  - In-process: the built plugins/ork/hooks/dist/skill.mjs imported directly
 *    via file:// URL and its registered `skill/redact-secrets` hook driven
 *    with the same payload. Cross-platform; asserts detection itself.
 *
 * Skips automatically when the built bundle isn't present.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');
const PLUGIN_HOOKS = join(REPO_ROOT, 'plugins', 'ork', 'hooks');
const RUN_HOOK = join(PLUGIN_HOOKS, 'bin', 'run-hook.mjs');
const DIST_BUNDLE = join(PLUGIN_HOOKS, 'dist', 'skill.mjs');
const HOOK_NAME = 'skill/redact-secrets';

/** Fake-but-realistic GitLab PAT (matches the #3589 glpat- family). */
const TOKEN = 'glpat-1234567890abcdefghijklmnop';

/** CC-shaped PostToolUse payload: hook_event_name + tool_response, no legacy aliases. */
function ccShapedPayload(toolResponse: string): string {
  return JSON.stringify({
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    session_id: '3725-redact-secrets',
    tool_input: { command: 'gitlab-ci printenv' },
    tool_response: toolResponse,
  });
}

let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;
let scratchDir: string;

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

describe('redact-secrets through the built skill.mjs bundle (#3725)', () => {
  it('flags a glpat token that arrives via tool_response through run-hook.mjs', () => {
    if (!existsSync(DIST_BUNDLE)) {
      console.warn(`[integration] Skipping — built bundle not found at ${DIST_BUNDLE}`);
      return;
    }

    const r = spawnSync('node', [RUN_HOOK, HOOK_NAME], {
      input: ccShapedPayload(`GITLAB_TOKEN=${TOKEN} done`),
      env: { ...process.env, CLAUDE_PROJECT_DIR: scratchDir },
      encoding: 'utf8',
      timeout: 20_000,
    });

    expect(r.status, `stderr: ${String(r.stderr).slice(0, 300)}`).toBe(0);

    // The token must not survive into the hook's stdout envelope.
    expect(String(r.stdout)).not.toContain(TOKEN);
    const parsed = JSON.parse(String(r.stdout).trim().split('\n').pop()!);
    expect(parsed.continue).toBe(true);

    // The load-bearing assertion: the layer actually SAW the production
    // payload. Windows cannot get here until the dispatcher's dist import
    // works on win32 (see file docstring) — the in-process tier covers it.
    if (process.platform !== 'win32') {
      expect(String(r.stderr)).toContain('::warning::Potential API key detected in output - verify redaction');
    }
  });

  it('stays silent on a clean tool_response through run-hook.mjs', () => {
    if (!existsSync(DIST_BUNDLE)) return;

    const r = spawnSync('node', [RUN_HOOK, HOOK_NAME], {
      input: ccShapedPayload('build finished, all tests passed'),
      env: { ...process.env, CLAUDE_PROJECT_DIR: scratchDir },
      encoding: 'utf8',
      timeout: 20_000,
    });

    expect(r.status).toBe(0);
    expect(String(r.stderr)).not.toContain('::warning::');
  });

  it('detects the token when the built bundle is driven in-process', async () => {
    if (!existsSync(DIST_BUNDLE)) return;

    const bundle = await import(pathToFileURL(DIST_BUNDLE).href);
    const hookFn = bundle.hooks?.[HOOK_NAME];
    expect(hookFn).toBeTypeOf('function');

    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const result = hookFn({
      hook_event: 'PostToolUse',
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      session_id: '3725-redact-secrets',
      tool_input: { command: 'gitlab-ci printenv' },
      tool_response: `GITLAB_TOKEN=${TOKEN} done`,
    });

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('::warning::Potential API key detected in output - verify redaction')
    );
    // Never echoes the secret back, whatever it decides.
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(result.continue).toBe(true);
  });
});

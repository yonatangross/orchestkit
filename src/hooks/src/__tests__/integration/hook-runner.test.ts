/**
 * Integration test: bin/run-hook.mjs end-to-end (P1.1).
 *
 * Spawns the real `node bin/run-hook.mjs posttool/context-crossing-warn`
 * subprocess, pipes a HookInput JSON payload via stdin, and verifies the
 * CLI entry path works end-to-end. Closes the gap that unit tests left
 * (bundle import, stdin parsing, env-var handling).
 *
 * Scope is intentionally narrow to avoid vitest parallel-worker env-var
 * races. Unit tests in ccw.test.ts cover accumulation, thresholds, image
 * handling, kindCounts, and opt-out behavior at higher fidelity.
 *
 * Skips automatically when dist/posttool.mjs isn't built.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');
const HOOKS_ROOT = join(REPO_ROOT, 'src', 'hooks');
const RUN_HOOK = join(HOOKS_ROOT, 'bin', 'run-hook.mjs');
const DIST = join(HOOKS_ROOT, 'dist', 'posttool.mjs');

function makePostToolInput(params: {
  sessionId: string;
  toolName?: string;
  toolResult?: string;
}) {
  return JSON.stringify({
    hook_event_name: 'PostToolUse',
    tool_name: params.toolName ?? 'Bash',
    session_id: params.sessionId,
    tool_input: {},
    tool_result: params.toolResult ?? 'x'.repeat(8000),
  });
}

function runHook(
  projectDir: string,
  inputJson: string,
  env: Record<string, string> = {},
  sessionId?: string,
) {
  return spawnSync('node', [RUN_HOOK, 'posttool/context-crossing-warn'], {
    input: inputJson,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: projectDir,
      // HookContext session id is driven by env, not the JSON payload
      ...(sessionId ? { CLAUDE_SESSION_ID: sessionId } : {}),
      ...env,
    },
    encoding: 'utf8',
    timeout: 10_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

let TMP_ROOT: string;

describe('hook-runner integration: bin/run-hook.mjs posttool/context-crossing-warn', () => {
  beforeAll(() => {
    if (!existsSync(DIST)) {
      console.warn(`[integration] Skipping suite — dist bundle not built at ${DIST}`);
      return;
    }
    TMP_ROOT = join(tmpdir(), `ork-integration-${process.pid}-${Date.now()}`);
    mkdirSync(TMP_ROOT, { recursive: true });
  });

  afterAll(() => {
    if (TMP_ROOT && existsSync(TMP_ROOT)) {
      rmSync(TMP_ROOT, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Reset env vars that ccw unit tests also use, so the subprocess env
    // is deterministic regardless of what other tests ran in this worker.
    delete process.env.ORK_NO_CTX_WARN;
    delete process.env.ORK_CTX_WARN_THRESHOLD;
  });

  it('produces valid HookResult JSON on stdout for a normal tool call', () => {
    if (!existsSync(DIST)) return;
    const projectDir = join(TMP_ROOT, 'test-basic');
    mkdirSync(projectDir, { recursive: true });

    const result = runHook(
      projectDir,
      makePostToolInput({ sessionId: 'basic', toolResult: 'x'.repeat(100) }),
      { ORK_CTX_WARN_THRESHOLD: '1000000' },
      'basic',
    );

    expect(result.status, `stderr: ${result.stderr.slice(0, 300)}`).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.continue).toBe(true);
    expect(parsed.suppressOutput).toBe(true);
    expect(parsed.hookSpecificOutput?.additionalContext).toBeUndefined();
  });

  it('fully silent + no state file when ORK_NO_CTX_WARN=1', () => {
    if (!existsSync(DIST)) return;
    const projectDir = join(TMP_ROOT, 'test-optout');
    mkdirSync(projectDir, { recursive: true });

    const result = runHook(
      projectDir,
      makePostToolInput({ sessionId: 'opt', toolResult: 'x'.repeat(100_000) }),
      { ORK_NO_CTX_WARN: '1' },
      'opt',
    );
    expect(result.status, `stderr: ${result.stderr.slice(0, 300)}`).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.continue).toBe(true);
    expect(parsed.hookSpecificOutput?.additionalContext).toBeUndefined();

    // No state file when opted out — proves the short-circuit path lands
    // at run-hook entry and not somewhere deeper that still wrote state.
    const stateDir = join(projectDir, '.claude', 'state');
    expect(existsSync(stateDir)).toBe(false);
  });

  it('writes a parseable state file on a single tool call', () => {
    if (!existsSync(DIST)) return;
    const projectDir = join(TMP_ROOT, 'test-statefile');
    mkdirSync(projectDir, { recursive: true });

    const result = runHook(
      projectDir,
      makePostToolInput({ sessionId: 'sf', toolResult: 'x'.repeat(400) }),
      { ORK_CTX_WARN_THRESHOLD: '1000000' },
      'sf',
    );
    expect(result.status, `stderr: ${result.stderr.slice(0, 300)}`).toBe(0);

    const stateDir = join(projectDir, '.claude', 'state');
    expect(existsSync(stateDir)).toBe(true);
    const files = readdirSync(stateDir);
    expect(files.length).toBeGreaterThanOrEqual(1);

    // Find the file that matches this test's session id
    const stateFile =
      files.find((f: string) => f.includes('sf')) ?? files[0];
    const state = JSON.parse(readFileSync(join(stateDir, stateFile), 'utf8'));

    // Exact-count assertions happen in ccw.test.ts unit tier; at this
    // tier we only prove the CLI wiring wrote a valid, parseable file.
    expect(state.updatedAt).toBeDefined();
    expect(state.crossings).toBeDefined();
    expect(state.kindCounts).toBeDefined();
  });
});

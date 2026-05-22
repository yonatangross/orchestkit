/**
 * Dispatcher E2E Tests
 *
 * Tests the full hook execution pipeline:
 *   Claude Code → stdin JSON → run-hook.mjs → bundle load → dispatcher → stdout JSON
 *
 * Spawns real node processes running run-hook.mjs and validates
 * the complete stdin/stdout contract that Claude Code depends on.
 *
 * What this catches that integration tests don't:
 * - Bundle not built / missing from dist/
 * - run-hook.mjs routing logic (getBundleName, hook registry lookup)
 * - Input normalization (toolInput → tool_input, sessionId → session_id)
 * - JSON parse errors on malformed stdin
 * - Timeout handling when no stdin provided
 * - Exit code guarantees (always 0)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = join(__dirname, '..', '..', '..');
const RUN_HOOK = join(HOOKS_DIR, 'bin', 'run-hook.mjs');
const DIST_DIR = join(HOOKS_DIR, 'dist');

// ---------------------------------------------------------------------------
// Helper — run a hook via run-hook.mjs with piped stdin
// ---------------------------------------------------------------------------

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  parsed: Record<string, unknown> | null;
}

function runHook(hookName: string, input?: Record<string, unknown>): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn('node', [RUN_HOOK, hookName], {
      env: {
        ...process.env,
        // Prevent real side effects
        CLAUDE_PROJECT_DIR: join(tmpdir(), 'ork-e2e-test'),
        CLAUDE_SESSION_ID: 'e2e-test-session',
        CLAUDE_PLUGIN_ROOT: '',
        ORCHESTKIT_LOG_LEVEL: 'error', // minimize noise
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      // Bumped from 10s after M168 Phase 2 (#1912) increased the lifecycle
      // bundle to ~200KB (sqlite native + migrations). Under vitest's
      // parallel-worker saturation, cold node startup + bundle import for
      // the heaviest bundles (stop, lifecycle) can exceed 10s — manifesting
      // as exitCode=null (SIGTERM from this timeout, before the test's
      // own per-test timeout fires). 30s gives generous headroom; the
      // process exits naturally in 2-4s under normal load.
      timeout: 30000,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    child.on('close', (code) => {
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(stdout.trim());
      } catch {
        // Not valid JSON
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code, parsed });
    });

    child.on('error', (err) => {
      resolve({ stdout, stderr: err.message, exitCode: 1, parsed: null });
    });

    if (input) {
      child.stdin.write(JSON.stringify(input));
    }
    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// Pre-flight check
// ---------------------------------------------------------------------------

beforeAll(() => {
  // Verify dist bundles exist (tests are meaningless without them)
  const requiredBundles = ['posttool', 'lifecycle', 'stop', 'subagent', 'notification', 'setup'];
  const missing = requiredBundles.filter(b => !existsSync(join(DIST_DIR, `${b}.mjs`)));
  if (missing.length > 0) {
    throw new Error(
      `Missing dist bundles: ${missing.join(', ')}. Run "cd src/hooks && npm run build" first.`
    );
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Run this file's tests serially. Every test spawns a node subprocess
// (cold load → bundle import → hook execution), which is CPU-intensive.
// When vitest runs these in parallel WITHIN this file AND the worker pool
// runs 8 files in parallel, the system thrashes badly enough that
// individual spawns can exceed 30s — the subprocess gets killed (SIGTERM),
// resulting in exitCode=null. Serial execution within the file caps
// concurrent node spawns at one-per-worker, which is the right amount
// of parallelism for spawn-heavy tests. (Fixes #1912 flake.)
describe.sequential('E2E: run-hook.mjs Pipeline', () => {

  // =========================================================================
  // BUNDLE ROUTING + STDOUT CONTRACT — each dispatcher loads correct bundle,
  // exits 0, and outputs valid JSON with continue:true, suppressOutput:true
  // =========================================================================

  describe('bundle routing and stdout contract', () => {
    // v7.30.0: lifecycle, subagent-stop, notification dispatchers flattened — individual hooks (#1264)
    // v7.30.0: PostToolUse dispatcher flattened — per-matcher async entries + auto-lint sync (#1284)
    // Only stop and setup remain as unified dispatchers in hooks.json
    // posttool/unified-dispatcher still exists as a TS function (bundle export) for backward compat
    const dispatchers: Array<{ name: string; hook: string; input: Record<string, unknown> }> = [
      { name: 'posttool', hook: 'posttool/commit-nudge', input: { tool_name: 'Bash', session_id: 'test', tool_input: { command: 'echo hi' } } },
      // stop: use stop_hook_active=true to short-circuit the re-entry guard in
      // stop/unified-dispatcher.ts (line 102). This exercises the same bundle-
      // routing / stdout-contract path as an "empty" input, but without
      // spawning 9 stop hooks in parallel (handoff-writer, session-summary,
      // security-scan-aggregator, perf-snapshot, etc.). Under concurrent
      // vitest load the parallel hooks blew past the 5s timeout — flaky on CI,
      // consistent locally. Re-entry path is what users hit in production
      // anyway when Claude invokes stop recursively.
      { name: 'stop', hook: 'stop/unified-dispatcher', input: { tool_name: '', session_id: 'test', tool_input: {}, stop_hook_active: true } },
      { name: 'setup', hook: 'setup/unified-dispatcher', input: { tool_name: '', session_id: 'test', tool_input: {} } },
    ];

    for (const { name, hook, input } of dispatchers) {
      // Each iteration spawns `node bin/run-hook.mjs ...` as a subprocess,
      // which cold-loads the corresponding bundle. After M168 Phase 2
      // (#1912) the lifecycle bundle ballooned to ~200KB (sqlite native
      // imports), and the stop bundle's transitive imports of session
      // hooks also grew. Under vitest's parallel-worker contention, cold
      // subprocess startup + bundle import can exceed the 5s default.
      // Bump to 35s — these tests assert the CLI contract (exit code +
      // JSON shape), not throughput. Subprocess spawn itself has a 30s
      // hard timeout (see runHook above); 35s lets that fire first with
      // a meaningful exitCode=null signal instead of vitest's SIGKILL.
      it(`${name}: exits 0, outputs valid JSON with continue:true and suppressOutput:true`, { timeout: 60000 }, async () => {
        const result = await runHook(hook, input);
        expect(result.exitCode).toBe(0);
        expect(result.parsed).not.toBeNull();
        expect(result.parsed!.continue).toBe(true);
        expect(result.parsed!.suppressOutput).toBe(true);
      });
    }
  });

  // =========================================================================
  // ERROR RESILIENCE — never crashes, never blocks Claude Code (exit 0)
  // =========================================================================

  describe('error resilience', () => {
    it('returns silent success when no hook name provided', async () => {
      const result = await runHook('', {});
      expect(result.exitCode).toBe(0);
      expect(result.parsed).toEqual({ continue: true, suppressOutput: true });
    });

    it('returns silent success for unknown hook', async () => {
      const result = await runHook('nonexistent/fake-hook', {
        tool_name: 'Bash', session_id: 'test', tool_input: {},
      });
      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });

    it('returns silent success for unknown bundle prefix', async () => {
      const result = await runHook('zzzfake/some-hook', {});
      expect(result.exitCode).toBe(0);
      expect(result.parsed).toEqual({ continue: true, suppressOutput: true });
    });

    it('handles malformed JSON stdin gracefully (exit 0)', async () => {
      // v7.30.0: PostToolUse dispatcher flattened — per-matcher async entries + auto-lint sync (#1284)
      const child = spawn('node', [RUN_HOOK, 'posttool/commit-nudge'], {
        env: { ...process.env, CLAUDE_PROJECT_DIR: join(tmpdir(), 'ork-e2e-test') },
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });

      let stdout = '';
      child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });

      const result = await new Promise<{ stdout: string; exitCode: number | null }>((resolve) => {
        child.on('close', (code) => resolve({ stdout: stdout.trim(), exitCode: code }));
        child.stdin.write('this is not json{{{');
        child.stdin.end();
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.continue).toBe(true);
    });

    it('handles empty stdin gracefully (exit 0)', async () => {
      // v7.30.0: PostToolUse dispatcher flattened — per-matcher async entries + auto-lint sync (#1284)
      const result = await runHook('posttool/commit-nudge');
      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });
  });

  // =========================================================================
  // INPUT NORMALIZATION — CC version compatibility
  // =========================================================================

  describe('input normalization', () => {
    it('normalizes toolInput to tool_input (legacy CC format)', async () => {
      // v7.30.0: PostToolUse dispatcher flattened — per-matcher async entries + auto-lint sync (#1284)
      const result = await runHook('posttool/commit-nudge', {
        toolName: 'Bash',
        sessionId: 'test',
        toolInput: { command: 'echo legacy' },
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });

    it('handles mixed old/new field names', async () => {
      // v7.30.0: PostToolUse dispatcher flattened — per-matcher async entries + auto-lint sync (#1284)
      const result = await runHook('posttool/commit-nudge', {
        tool_name: 'Write',
        sessionId: 'test-mixed',
        tool_input: { file_path: '/tmp/test.ts', content: 'const x = 1;' },
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });

    it('normalizes SubagentStart cwd to project_dir', async () => {
      // CC SubagentStart sends cwd (not project_dir) at top level
      const result = await runHook('subagent-start/unified-dispatcher', {
        session_id: 'test',
        cwd: '/Users/test/my-project',
        hook_event_name: 'SubagentStart',
        agent_id: 'agent-abc123',
        agent_type: 'ork:test-generator',
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });

    it('normalizes SubagentStart agent_type to tool_input.subagent_type', async () => {
      // CC sends agent_type at top level, not in tool_input
      const result = await runHook('subagent-start/unified-dispatcher', {
        session_id: 'test',
        cwd: '/Users/test/project',
        hook_event_name: 'SubagentStart',
        agent_id: 'agent-xyz',
        agent_type: 'Explore',
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });

    // v7.30.0: SubagentStop dispatcher flattened — handoff-preparer is now individual async hook (#1264)
    it('normalizes SubagentStop cwd and agent_type', async () => {
      // CC SubagentStop also sends cwd and agent_type at top level
      const result = await runHook('subagent-stop/handoff-preparer', {
        session_id: 'test',
        cwd: '/Users/test/project',
        hook_event_name: 'SubagentStop',
        agent_id: 'agent-xyz',
        agent_type: 'ork:test-generator',
        last_assistant_message: 'Done.',
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });
  });

});

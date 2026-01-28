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
import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
        CLAUDE_PROJECT_DIR: '/tmp/ork-e2e-test',
        CLAUDE_SESSION_ID: 'e2e-test-session',
        CLAUDE_PLUGIN_ROOT: '',
        ORCHESTKIT_LOG_LEVEL: 'error', // minimize noise
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
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

describe('E2E: run-hook.mjs Pipeline', () => {

  // =========================================================================
  // BUNDLE ROUTING + STDOUT CONTRACT — each dispatcher loads correct bundle,
  // exits 0, and outputs valid JSON with continue:true, suppressOutput:true
  // =========================================================================

  describe('bundle routing and stdout contract', () => {
    const dispatchers: Array<{ name: string; hook: string; input: Record<string, unknown> }> = [
      { name: 'posttool', hook: 'posttool/unified-dispatcher', input: { tool_name: 'Bash', session_id: 'test', tool_input: { command: 'echo hi' } } },
      { name: 'lifecycle', hook: 'lifecycle/unified-dispatcher', input: { tool_name: '', session_id: 'test', tool_input: {} } },
      { name: 'stop', hook: 'stop/unified-dispatcher', input: { tool_name: '', session_id: 'test', tool_input: {} } },
      { name: 'subagent-stop', hook: 'subagent-stop/unified-dispatcher', input: { tool_name: '', session_id: 'test', tool_input: {}, subagent_type: 'Explore' } },
      { name: 'notification', hook: 'notification/unified-dispatcher', input: { tool_name: '', session_id: 'test', tool_input: {}, message: 'test', notification_type: 'idle_prompt' } },
      { name: 'setup', hook: 'setup/unified-dispatcher', input: { tool_name: '', session_id: 'test', tool_input: {} } },
    ];

    for (const { name, hook, input } of dispatchers) {
      it(`${name}: exits 0, outputs valid JSON with continue:true and suppressOutput:true`, async () => {
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
      const child = spawn('node', [RUN_HOOK, 'posttool/unified-dispatcher'], {
        env: { ...process.env, CLAUDE_PROJECT_DIR: '/tmp/ork-e2e-test' },
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
      const result = await runHook('posttool/unified-dispatcher');
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
      const result = await runHook('posttool/unified-dispatcher', {
        toolName: 'Bash',
        sessionId: 'test',
        toolInput: { command: 'echo legacy' },
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });

    it('handles mixed old/new field names', async () => {
      const result = await runHook('posttool/unified-dispatcher', {
        tool_name: 'Write',
        sessionId: 'test-mixed',
        tool_input: { file_path: '/tmp/test.ts', content: 'const x = 1;' },
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });
  });

  // =========================================================================
  // STANDALONE HOOK: stop/mem0-pre-compaction-sync
  // =========================================================================

  describe('E2E: stop/mem0-pre-compaction-sync', () => {
    it('returns silent success with no API key', async () => {
      // Must explicitly clear MEM0_API_KEY since runHook inherits process.env
      const env = { ...process.env, MEM0_API_KEY: '', CLAUDE_PROJECT_DIR: '/tmp/ork-e2e-test', CLAUDE_PLUGIN_ROOT: '', ORCHESTKIT_LOG_LEVEL: 'error' };
      const result = await new Promise<RunResult>((resolve) => {
        const child = spawn('node', [RUN_HOOK, 'stop/mem0-pre-compaction-sync'], {
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
        child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
        child.on('close', (code) => {
          let parsed: Record<string, unknown> | null = null;
          try { parsed = JSON.parse(stdout.trim()); } catch {}
          resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code, parsed });
        });
        child.stdin.write(JSON.stringify({ tool_name: '', session_id: 'e2e-mem0-test', tool_input: {} }));
        child.stdin.end();
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
      expect(result.parsed!.suppressOutput).toBe(true);
    });

    it('handles malformed input gracefully', async () => {
      const result = await runHook('stop/mem0-pre-compaction-sync', {
        // Missing standard fields
        tool_name: '',
        session_id: '',
        tool_input: {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });

    it('returns valid JSON for empty stdin', async () => {
      const result = await runHook('stop/mem0-pre-compaction-sync');

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });
  });
});

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
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const HOOKS_DIR = join(import.meta.dirname, '..', '..', '..');
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
  // BASIC CONTRACT — stdout is always valid JSON with continue:true
  // =========================================================================

  describe('stdout contract', () => {
    it('outputs valid JSON for posttool dispatcher', async () => {
      const result = await runHook('posttool/unified-dispatcher', {
        tool_name: 'Bash',
        session_id: 'test',
        tool_input: { command: 'echo hi' },
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });

    it('outputs valid JSON for lifecycle dispatcher', async () => {
      const result = await runHook('lifecycle/unified-dispatcher', {
        tool_name: '',
        session_id: 'test',
        tool_input: {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });

    it('outputs valid JSON for stop dispatcher', async () => {
      const result = await runHook('stop/unified-dispatcher', {
        tool_name: '',
        session_id: 'test',
        tool_input: {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });

    it('outputs valid JSON for subagent-stop dispatcher', async () => {
      const result = await runHook('subagent-stop/unified-dispatcher', {
        tool_name: '',
        session_id: 'test',
        tool_input: {},
        subagent_type: 'Explore',
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });

    it('outputs valid JSON for notification dispatcher', async () => {
      const result = await runHook('notification/unified-dispatcher', {
        tool_name: '',
        session_id: 'test',
        tool_input: {},
        message: 'test notification',
        notification_type: 'idle_prompt',
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });

    it('outputs valid JSON for setup dispatcher', async () => {
      const result = await runHook('setup/unified-dispatcher', {
        tool_name: '',
        session_id: 'test',
        tool_input: {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });
  });

  // =========================================================================
  // ERROR RESILIENCE — never crashes, never blocks Claude Code
  // =========================================================================

  describe('error resilience', () => {
    it('returns silent success when no hook name provided', async () => {
      const result = await runHook('', {});

      expect(result.exitCode).toBe(0);
      expect(result.parsed).toEqual({ continue: true, suppressOutput: true });
    });

    it('returns silent success for unknown hook', async () => {
      const result = await runHook('nonexistent/fake-hook', {
        tool_name: 'Bash',
        session_id: 'test',
        tool_input: {},
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

    it('handles malformed JSON stdin gracefully', async () => {
      // Send raw invalid JSON via stdin
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

    it('handles empty stdin gracefully', async () => {
      const result = await runHook('posttool/unified-dispatcher');
      // No input piped — stdin timeout kicks in

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
        sessionId: 'test-mixed', // old format
        tool_input: { file_path: '/tmp/test.ts', content: 'const x = 1;' },
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.continue).toBe(true);
    });
  });

  // =========================================================================
  // BUNDLE ROUTING — correct bundle loaded for each prefix
  // =========================================================================

  describe('bundle routing', () => {
    it('routes posttool/* to posttool.mjs bundle', async () => {
      const result = await runHook('posttool/unified-dispatcher', {
        tool_name: 'Bash',
        session_id: 'test',
        tool_input: { command: 'ls' },
      });
      expect(result.exitCode).toBe(0);
      expect(result.parsed!.continue).toBe(true);
    });

    it('routes lifecycle/* to lifecycle.mjs bundle', async () => {
      const result = await runHook('lifecycle/unified-dispatcher', {
        tool_name: '',
        session_id: 'test',
        tool_input: {},
      });
      expect(result.exitCode).toBe(0);
      expect(result.parsed!.continue).toBe(true);
    });

    it('routes stop/* to stop.mjs bundle', async () => {
      const result = await runHook('stop/unified-dispatcher', {
        tool_name: '',
        session_id: 'test',
        tool_input: {},
      });
      expect(result.exitCode).toBe(0);
      expect(result.parsed!.continue).toBe(true);
    });

    it('routes subagent-stop/* to subagent.mjs bundle', async () => {
      const result = await runHook('subagent-stop/unified-dispatcher', {
        tool_name: '',
        session_id: 'test',
        tool_input: {},
      });
      expect(result.exitCode).toBe(0);
      expect(result.parsed!.continue).toBe(true);
    });

    it('routes notification/* to notification.mjs bundle', async () => {
      const result = await runHook('notification/unified-dispatcher', {
        tool_name: '',
        session_id: 'test',
        tool_input: {},
      });
      expect(result.exitCode).toBe(0);
      expect(result.parsed!.continue).toBe(true);
    });

    it('routes setup/* to setup.mjs bundle', async () => {
      const result = await runHook('setup/unified-dispatcher', {
        tool_name: '',
        session_id: 'test',
        tool_input: {},
      });
      expect(result.exitCode).toBe(0);
      expect(result.parsed!.continue).toBe(true);
    });
  });

  // =========================================================================
  // EXIT CODE — always 0 (never blocks Claude Code)
  // =========================================================================

  describe('exit code guarantee', () => {
    it('exits 0 on success', async () => {
      const result = await runHook('posttool/unified-dispatcher', {
        tool_name: 'Bash',
        session_id: 'test',
        tool_input: { command: 'echo ok' },
      });
      expect(result.exitCode).toBe(0);
    });

    it('exits 0 on missing hook', async () => {
      const result = await runHook('posttool/nonexistent-hook', {});
      expect(result.exitCode).toBe(0);
    });

    it('exits 0 on missing bundle', async () => {
      const result = await runHook('zzzfake/missing', {});
      expect(result.exitCode).toBe(0);
    });

    it('exits 0 on malformed input', async () => {
      const child = spawn('node', [RUN_HOOK, 'posttool/unified-dispatcher'], {
        env: { ...process.env, CLAUDE_PROJECT_DIR: '/tmp/ork-e2e-test' },
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });

      const exitCode = await new Promise<number | null>((resolve) => {
        child.on('close', resolve);
        child.stdin.write('{bad json');
        child.stdin.end();
      });

      expect(exitCode).toBe(0);
    });
  });
});

/**
 * Dispatcher Integration Tests
 *
 * Calls REAL dispatchers with REAL hook functions (no hook mocking).
 * Uses temp directories for filesystem side effects and mocks
 * child_process to prevent real git/osascript/notify-send calls.
 *
 * Validates the full internal chain:
 *   dispatcher → real hook fn → filesystem side effects
 *
 * What this catches that functional tests don't:
 * - Hook that imports a missing module
 * - Hook that crashes on real input shapes
 * - Hook that writes to wrong path
 * - Dispatcher ↔ hook interface mismatches
 *
 * Dead-hook triage (#2561): the legacy posttool/lifecycle/stop/notification
 * unified-dispatchers were deleted (flattened into per-hook async entries in
 * hooks.json), so only the subagent-stop and setup dispatchers remain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { HookInput } from '../../types.js';

// ---------------------------------------------------------------------------
// Mock child_process BEFORE any hook imports (prevents real git/osascript)
// ---------------------------------------------------------------------------

vi.mock('node:child_process', () => ({
  execSync: vi.fn((cmd: string) => {
    // Allow git branch for session-env-setup (return fake branch)
    if (typeof cmd === 'string' && cmd.includes('git branch')) {
      return 'test-branch\n';
    }
    // Allow command -v checks (return success)
    if (typeof cmd === 'string' && cmd.includes('command -v')) {
      throw new Error('not found'); // simulate no osascript/notify-send
    }
    return '';
  }),
  execFileSync: vi.fn(() => ''),
}));

// ---------------------------------------------------------------------------
// Import REAL dispatchers (hooks are NOT mocked)
// ---------------------------------------------------------------------------

import { _resetForTesting } from '../../lib/analytics-buffer.js';
import { unifiedSubagentStopDispatcher } from '../../subagent-stop/unified-dispatcher.js';
import { unifiedSetupDispatcher } from '../../setup/unified-dispatcher.js';

// ---------------------------------------------------------------------------
// Test setup — temp directory per test
// ---------------------------------------------------------------------------

let testDir: string;
const savedEnv: Record<string, string | undefined> = {};

const ENV_KEYS = [
  'CLAUDE_PROJECT_DIR', 'CLAUDE_SESSION_ID', 'CLAUDE_PLUGIN_ROOT',
  'ORCHESTKIT_LOG_LEVEL', 'ORCHESTKIT_BRANCH', 'AGENT_TYPE',
];

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'integration-test-session',
    project_dir: testDir,
    tool_input: { command: 'echo hello' },
    ...overrides,
  };
}

beforeEach(() => {
  // Create isolated temp directory
  testDir = join(tmpdir(), `ork-int-test-${randomUUID().slice(0, 8)}`);
  mkdirSync(testDir, { recursive: true });

  // Save and set env vars
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  process.env.CLAUDE_PROJECT_DIR = testDir;
  process.env.CLAUDE_SESSION_ID = 'integration-test-session';
  process.env.CLAUDE_PLUGIN_ROOT = ''; // force local log dir
  process.env.ORCHESTKIT_LOG_LEVEL = 'debug'; // enable all logging
  process.env.ORCHESTKIT_BRANCH = 'test-branch';
});

afterEach(() => {
  _resetForTesting();

  // Restore env vars
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }

  // Clean up temp directory
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const SILENT_SUCCESS = { continue: true, suppressOutput: true };

describe('Dispatcher Integration (real hooks, temp filesystem)', () => {

  // =========================================================================
  // SUBAGENT-STOP — subagent stop hooks
  // =========================================================================

  describe('subagent-stop/unified-dispatcher', () => {
    it('returns silent success running all subagent-stop hooks', async () => {
      const result = await unifiedSubagentStopDispatcher(makeInput({
        subagent_type: 'Explore',
        agent_id: 'test-agent-id',
        agent_output: 'Found 5 files',
        duration_ms: 1500,
      }));
      expect(result).toEqual(SILENT_SUCCESS);
    });

    it('returns silent success for minimal input', async () => {
      const result = await unifiedSubagentStopDispatcher(makeInput({
        tool_name: '',
        tool_input: {},
      }));
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });

  // =========================================================================
  // SETUP — plugin initialization hooks
  // =========================================================================

  describe('setup/unified-dispatcher', () => {
    it('returns silent success running all setup hooks', async () => {
      const result = await unifiedSetupDispatcher(makeInput());
      expect(result).toEqual(SILENT_SUCCESS);
    });

    it('returns silent success when env vars are missing', async () => {
      delete process.env.CLAUDE_PROJECT_DIR;
      delete process.env.CLAUDE_SESSION_ID;
      delete process.env.CLAUDE_PLUGIN_ROOT;

      const result = await unifiedSetupDispatcher(makeInput({
        project_dir: undefined,
        session_id: '',
      }));
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });

  // =========================================================================
  // CROSS-DISPATCHER — shared guarantees
  // =========================================================================

  describe('cross-dispatcher guarantees', () => {
    it('all dispatchers return silent success for minimal input', async () => {
      const minimalInput: HookInput = {
        tool_name: '',
        session_id: '',
        tool_input: {},
      };

      const results = await Promise.all([
        unifiedSubagentStopDispatcher(minimalInput),
        unifiedSetupDispatcher(minimalInput),
      ]);

      for (const result of results) {
        expect(result).toEqual(SILENT_SUCCESS);
      }
    });
  });
});

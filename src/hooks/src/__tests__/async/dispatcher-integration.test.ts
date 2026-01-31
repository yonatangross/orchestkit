/**
 * Dispatcher Integration Tests
 *
 * Calls REAL dispatchers with REAL hook functions (no hook mocking).
 * Uses temp directories for filesystem side effects and mocks
 * child_process to prevent real git/osascript/notify-send calls.
 *
 * Validates the full internal chain:
 *   dispatcher → matchesTool → real hook fn → filesystem side effects
 *
 * What this catches that functional tests don't:
 * - Hook that imports a missing module
 * - Hook that crashes on real input shapes
 * - Hook that writes to wrong path
 * - Dispatcher ↔ hook interface mismatches
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
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
}));

// ---------------------------------------------------------------------------
// Import REAL dispatchers (hooks are NOT mocked)
// ---------------------------------------------------------------------------

import { unifiedDispatcher } from '../../posttool/unified-dispatcher.js';
import { unifiedSessionStartDispatcher } from '../../lifecycle/unified-dispatcher.js';
import { unifiedStopDispatcher } from '../../stop/unified-dispatcher.js';
import { unifiedSubagentStopDispatcher } from '../../subagent-stop/unified-dispatcher.js';
import { unifiedNotificationDispatcher } from '../../notification/unified-dispatcher.js';
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
  // POSTTOOL — real hooks execute through dispatcher
  // =========================================================================

  describe('posttool/unified-dispatcher', () => {
    it('returns silent success for Bash tool with real hooks', async () => {
      const result = await unifiedDispatcher(makeInput({ tool_name: 'Bash' }));
      expect(result).toEqual(SILENT_SUCCESS);
    });

    it('returns silent success for Write tool with real hooks', async () => {
      const result = await unifiedDispatcher(makeInput({
        tool_name: 'Write',
        tool_input: { file_path: '/tmp/test.ts', content: 'const x = 1;' },
      }));
      expect(result).toEqual(SILENT_SUCCESS);
    });

    it('returns silent success for Edit tool with real hooks', async () => {
      const result = await unifiedDispatcher(makeInput({
        tool_name: 'Edit',
        tool_input: { file_path: '/tmp/test.ts', old_string: 'x', new_string: 'y' },
      }));
      expect(result).toEqual(SILENT_SUCCESS);
    });

    it('returns silent success for Task tool with real hooks', async () => {
      const result = await unifiedDispatcher(makeInput({
        tool_name: 'Task',
        tool_input: { subagent_type: 'Explore' },
      }));
      expect(result).toEqual(SILENT_SUCCESS);
    });

    it('returns silent success for Skill tool with real hooks', async () => {
      const result = await unifiedDispatcher(makeInput({
        tool_name: 'Skill',
        tool_input: { skill: 'commit' },
      }));
      expect(result).toEqual(SILENT_SUCCESS);
    });

    it('returns silent success for read-only tools (Read, Glob, Grep, WebFetch, WebSearch)', async () => {
      for (const tool of ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch']) {
        const result = await unifiedDispatcher(makeInput({ tool_name: tool }));
        expect(result).toEqual(SILENT_SUCCESS);
      }
    });

    it('audit-logger creates log directory and writes audit.log', async () => {
      await unifiedDispatcher(makeInput({
        tool_name: 'Bash',
        tool_input: { command: 'npm test' },
      }));

      const logDir = join(testDir, '.claude', 'logs');
      expect(existsSync(logDir)).toBe(true);

      const auditLog = join(logDir, 'audit.log');
      expect(existsSync(auditLog)).toBe(true);

      const content = readFileSync(auditLog, 'utf-8');
      expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}/); // timestamp
      expect(content).toContain('Bash');
    });

    it('returns silent success for empty tool_name', async () => {
      const result = await unifiedDispatcher(makeInput({ tool_name: '' }));
      expect(result).toEqual(SILENT_SUCCESS);
    });

    it('returns silent success for empty tool_input', async () => {
      const result = await unifiedDispatcher(makeInput({
        tool_name: 'Bash',
        tool_input: {},
      }));
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });

  // =========================================================================
  // LIFECYCLE — session start hooks
  // =========================================================================

  describe('lifecycle/unified-dispatcher', () => {
    it('returns silent success running all 6 session-start hooks', async () => {
      const result = await unifiedSessionStartDispatcher(makeInput());
      expect(result).toEqual(SILENT_SUCCESS);
    });

    it('session-env-setup creates log directory', async () => {
      await unifiedSessionStartDispatcher(makeInput());

      const logDir = join(testDir, '.claude', 'logs');
      expect(existsSync(logDir)).toBe(true);
    });

    it('returns silent success when project_dir is missing', async () => {
      delete process.env.CLAUDE_PROJECT_DIR;
      const result = await unifiedSessionStartDispatcher(makeInput({
        project_dir: undefined,
      }));
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });

  // =========================================================================
  // STOP — session stop hooks
  // =========================================================================

  describe('stop/unified-dispatcher', () => {
    it('returns silent success running all 4 stop hooks', async () => {
      const result = await unifiedStopDispatcher(makeInput());
      expect(result).toEqual(SILENT_SUCCESS);
    });

    it('auto-save-context creates session state file', async () => {
      await unifiedStopDispatcher(makeInput());

      const stateFile = join(testDir, '.claude', 'context', 'session', 'state.json');
      expect(existsSync(stateFile)).toBe(true);

      const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
      expect(state.$schema).toBe('context://session/v1');
      expect(state._meta).toBeDefined();
      expect(state.last_activity).toBeTruthy();
    });

    it('auto-save-context updates existing state file', async () => {
      // Pre-create state file
      const sessionDir = join(testDir, '.claude', 'context', 'session');
      mkdirSync(sessionDir, { recursive: true });
      const stateFile = join(sessionDir, 'state.json');
      const existingState = {
        $schema: 'context://session/v1',
        _meta: { position: 'END', token_budget: 500, auto_load: 'always', compress: 'on_threshold', description: 'test' },
        session_id: 'old-session',
        started: '2026-01-01T00:00:00.000Z',
        last_activity: '2026-01-01T00:00:00.000Z',
        current_task: { description: 'Testing', status: 'in_progress' },
        next_steps: ['verify'],
        blockers: [],
      };
      writeFileSync(stateFile, JSON.stringify(existingState));

      await unifiedStopDispatcher(makeInput());

      const updated = JSON.parse(readFileSync(stateFile, 'utf-8'));
      // last_activity should be newer than what we wrote
      expect(updated.last_activity).not.toBe('2026-01-01T00:00:00.000Z');
      // existing data preserved
      expect(updated.current_task.description).toBe('Testing');
    });
  });

  // =========================================================================
  // SUBAGENT-STOP — subagent stop hooks
  // =========================================================================

  describe('subagent-stop/unified-dispatcher', () => {
    it('returns silent success running all 4 subagent-stop hooks', async () => {
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
  // NOTIFICATION — notification hooks
  // =========================================================================

  describe('notification/unified-dispatcher', () => {
    it('returns silent success for permission_prompt notification', async () => {
      const result = await unifiedNotificationDispatcher(makeInput({
        tool_name: '',
        notification_type: 'permission_prompt',
        message: 'Claude wants to run: npm test',
      }));
      expect(result).toEqual(SILENT_SUCCESS);
    });

    it('returns silent success for idle_prompt notification', async () => {
      const result = await unifiedNotificationDispatcher(makeInput({
        tool_name: '',
        notification_type: 'idle_prompt',
        message: 'Claude is waiting for input',
      }));
      expect(result).toEqual(SILENT_SUCCESS);
    });

    it('returns silent success for unknown notification type', async () => {
      const result = await unifiedNotificationDispatcher(makeInput({
        tool_name: '',
        notification_type: 'unknown_type',
        message: 'Something happened',
      }));
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });

  // =========================================================================
  // SETUP — plugin initialization hooks
  // =========================================================================

  describe('setup/unified-dispatcher', () => {
    it('returns silent success running all 3 setup hooks', async () => {
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
        unifiedDispatcher(minimalInput),
        unifiedSessionStartDispatcher(minimalInput),
        unifiedStopDispatcher(minimalInput),
        unifiedSubagentStopDispatcher(minimalInput),
        unifiedNotificationDispatcher(minimalInput),
        unifiedSetupDispatcher(minimalInput),
      ]);

      for (const result of results) {
        expect(result).toEqual(SILENT_SUCCESS);
      }
    });

    it('hooks write to correct project directory (not cwd)', async () => {
      // Run stop dispatcher which creates state.json
      await unifiedStopDispatcher(makeInput());

      // Verify file is in testDir
      const testState = join(testDir, '.claude', 'context', 'session', 'state.json');
      expect(existsSync(testState)).toBe(true);

      const state = JSON.parse(readFileSync(testState, 'utf-8'));
      expect(state.$schema).toBe('context://session/v1');
    });
  });
});

// =============================================================================
// STANDALONE HOOK: stop/mem0-pre-compaction-sync
// =============================================================================

describe('stop/mem0-pre-compaction-sync (standalone hook)', () => {
  // Import the hook directly (it's not inside the stop unified-dispatcher)
  let mem0PreCompactionSync: (input: HookInput) => { continue: boolean; suppressOutput?: boolean; systemMessage?: string };

  beforeEach(async () => {
    const mod = await import('../../stop/mem0-pre-compaction-sync.js');
    mem0PreCompactionSync = mod.mem0PreCompactionSync;
  });

  it('creates log directory when sync triggered', () => {
    process.env.MEM0_API_KEY = 'integration-test-key';
    process.env.CLAUDE_PLUGIN_ROOT = testDir;

    // Create decision log with pending decisions
    const coordDir = join(testDir, '.claude', 'coordination');
    mkdirSync(coordDir, { recursive: true });
    writeFileSync(
      join(coordDir, 'decision-log.json'),
      JSON.stringify({ decisions: [{ decision_id: 'int-d1' }] })
    );
    writeFileSync(
      join(coordDir, '.decision-sync-state.json'),
      JSON.stringify({ synced_decisions: [] })
    );

    const result = mem0PreCompactionSync(makeInput());

    expect(result.continue).toBe(true);
    // Log directory should have been created
    const logDir = join(testDir, '.claude', 'logs');
    expect(existsSync(logDir)).toBe(true);
  });

  it('returns silent success when MEM0_API_KEY missing', () => {
    delete process.env.MEM0_API_KEY;

    const result = mem0PreCompactionSync(makeInput());

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns systemMessage with pending count when script missing', () => {
    process.env.MEM0_API_KEY = 'test-key';
    process.env.CLAUDE_PLUGIN_ROOT = testDir;

    // Create decision log with pending decisions
    const coordDir = join(testDir, '.claude', 'coordination');
    mkdirSync(coordDir, { recursive: true });
    writeFileSync(
      join(coordDir, 'decision-log.json'),
      JSON.stringify({ decisions: [{ decision_id: 'pend-1' }, { decision_id: 'pend-2' }] })
    );
    writeFileSync(
      join(coordDir, '.decision-sync-state.json'),
      JSON.stringify({ synced_decisions: [] })
    );

    const result = mem0PreCompactionSync(makeInput());

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toContain('2 decisions to sync');
    expect(result.systemMessage).toContain('/mem0-sync');
  });
});

/**
 * Tier 2: Data-Loss Risk Hooks - Comprehensive Test Suite
 *
 * Tests hooks that handle session state persistence, memory sync,
 * webhook processing, context loading, and retry logic.
 *
 * Hooks under test:
 * 1. autoSaveContext       (stop/auto-save-context)
 * 2. mem0PreCompactionSync (stop/mem0-pre-compaction-sync)
 * 3. mem0WebhookHandler    (posttool/mem0-webhook-handler)
 * 4. sessionContextLoader  (lifecycle/session-context-loader)
 * 5. retryHandler          (subagent-stop/retry-handler)
 */

import { describe, test, expect, beforeEach, vi, type Mock } from 'vitest';
import type { HookInput, HookResult } from '../types.js';

// ---------------------------------------------------------------------------
// Mock node:fs at module level before any hook imports
// ---------------------------------------------------------------------------
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ size: 0 }),
  renameSync: vi.fn(),
  readSync: vi.fn().mockReturnValue(0),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue('main\n'),
  spawn: vi.fn().mockReturnValue({
    unref: vi.fn(),
    on: vi.fn(),
    stderr: { on: vi.fn() },
    stdout: { on: vi.fn() },
    pid: 12345,
  }),
}));

// Mock orchestration dependencies for retryHandler
vi.mock('../lib/orchestration-state.js', () => ({
  loadConfig: vi.fn().mockReturnValue({ maxRetries: 3, retryDelayBaseMs: 1000 }),
  loadState: vi.fn().mockReturnValue({ activeAgents: [], injectedSkills: [], promptHistory: [] }),
  updateAgentStatus: vi.fn(),
}));

vi.mock('../lib/task-integration.js', () => ({
  getTaskByAgent: vi.fn().mockReturnValue(null),
  updateTaskStatus: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  appendFileSync,
} from 'node:fs';
import { spawn } from 'node:child_process';

import { autoSaveContext } from '../stop/auto-save-context.js';
import { mem0PreCompactionSync } from '../stop/mem0-pre-compaction-sync.js';
import { mem0WebhookHandler } from '../posttool/mem0-webhook-handler.js';
import { sessionContextLoader } from '../lifecycle/session-context-loader.js';
import { retryHandler } from '../subagent-stop/retry-handler.js';
import { loadState, updateAgentStatus } from '../lib/orchestration-state.js';
import { getTaskByAgent, updateTaskStatus } from '../lib/task-integration.js';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {},
    ...overrides,
  };
}

function createBashInput(command: string, overrides: Partial<HookInput> = {}): HookInput {
  return createHookInput({
    tool_name: 'Bash',
    tool_input: { command },
    ...overrides,
  });
}

/** Assert the result is a silent success (continue=true, suppressOutput=true) */
function expectSilentSuccess(result: HookResult): void {
  expect(result.continue).toBe(true);
  expect(result.suppressOutput).toBe(true);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const mockExistsSync = existsSync as Mock;
const mockReadFileSync = readFileSync as Mock;
const mockWriteFileSync = writeFileSync as Mock;
const mockMkdirSync = mkdirSync as Mock;
const mockAppendFileSync = appendFileSync as Mock;
const mockSpawn = spawn as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no files exist
  mockExistsSync.mockReturnValue(false);
  mockReadFileSync.mockReturnValue('{}');
  // Reset env vars
  delete process.env.MEM0_API_KEY;
  delete process.env.AGENT_TYPE;
  delete process.env.ORCHESTKIT_LAST_SESSION;
  delete process.env.ORCHESTKIT_LAST_DECISIONS;
  delete process.env.CLAUDE_PROJECT_DIR;
  delete process.env.CLAUDE_PLUGIN_ROOT;
});

// =============================================================================
// 1. autoSaveContext
// =============================================================================

describe('autoSaveContext', () => {
  describe('directory creation', () => {
    test('creates session directory when it does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = autoSaveContext(createHookInput());

      expectSilentSuccess(result);
      expect(mockMkdirSync).toHaveBeenCalledWith(
        '/test/project/.claude/context/session',
        { recursive: true }
      );
    });

    test('does not create directory when it already exists', () => {
      // First call: sessionDir exists check -> true
      // Second call: sessionState exists check -> false
      mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);

      autoSaveContext(createHookInput());

      expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    test('handles directory creation error gracefully', () => {
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockImplementationOnce(() => {
        throw new Error('EACCES');
      });

      const result = autoSaveContext(createHookInput());

      expectSilentSuccess(result);
    });
  });

  describe('new state creation', () => {
    test('creates new session state with all required Protocol 2.0 fields', () => {
      mockExistsSync.mockReturnValue(false);

      autoSaveContext(createHookInput());

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const [path, content] = mockWriteFileSync.mock.calls[0];
      // Cross-platform: accept either / or \ path separators
      expect(path).toMatch(/[/\\]test[/\\]project[/\\]\.claude[/\\]context[/\\]session[/\\]state\.json$/);

      const state = JSON.parse(content);
      expect(state.$schema).toBe('context://session/v1');
      expect(state._meta).toEqual({
        position: 'END',
        token_budget: 500,
        auto_load: 'always',
        compress: 'on_threshold',
        description: 'Session state and progress - ALWAYS loaded at END of context',
      });
      expect(state.session_id).toBeNull();
      expect(state.started).toBeDefined();
      expect(state.last_activity).toBeDefined();
      expect(state.current_task).toEqual({ description: 'No active task', status: 'pending' });
      expect(state.next_steps).toEqual([]);
      expect(state.blockers).toEqual([]);
    });

    test('sets started and last_activity to same ISO timestamp for new state', () => {
      mockExistsSync.mockReturnValue(false);

      autoSaveContext(createHookInput());

      const state = JSON.parse(mockWriteFileSync.mock.calls[0][1]);
      expect(state.started).toBe(state.last_activity);
      // Verify ISO format
      expect(new Date(state.started).toISOString()).toBe(state.started);
    });
  });

  describe('existing state update', () => {
    test('updates last_activity timestamp on existing state', () => {
      const existingState = {
        $schema: 'context://session/v1',
        _meta: { position: 'END', token_budget: 500, auto_load: 'always', compress: 'on_threshold', description: 'desc' },
        session_id: 'existing-session',
        started: '2026-01-01T00:00:00.000Z',
        last_activity: '2026-01-01T00:00:00.000Z',
        current_task: { description: 'Working on tests', status: 'in_progress' },
        next_steps: ['review'],
        blockers: ['none'],
      };

      // sessionDir exists, sessionState exists
      mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(existingState));

      autoSaveContext(createHookInput());

      const updated = JSON.parse(mockWriteFileSync.mock.calls[0][1]);
      expect(updated.session_id).toBe('existing-session');
      expect(updated.started).toBe('2026-01-01T00:00:00.000Z');
      expect(updated.last_activity).not.toBe('2026-01-01T00:00:00.000Z');
      expect(updated.current_task.description).toBe('Working on tests');
      expect(updated.next_steps).toEqual(['review']);
      expect(updated.blockers).toEqual(['none']);
    });

    test('fills in missing fields with defaults when merging existing state', () => {
      const partialState = { session_id: 'partial-session' };

      mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(partialState));

      autoSaveContext(createHookInput());

      const updated = JSON.parse(mockWriteFileSync.mock.calls[0][1]);
      expect(updated.$schema).toBe('context://session/v1');
      expect(updated._meta.position).toBe('END');
      expect(updated.session_id).toBe('partial-session');
      expect(updated.current_task).toEqual({ description: 'No active task', status: 'pending' });
      expect(updated.next_steps).toEqual([]);
      expect(updated.blockers).toEqual([]);
    });

    test('preserves existing $schema and _meta from state file', () => {
      const customState = {
        $schema: 'context://session/v2',
        _meta: { position: 'START', token_budget: 1000, auto_load: 'never', compress: 'always', description: 'custom' },
        session_id: 's1',
        started: '2026-01-01T00:00:00.000Z',
        last_activity: '2026-01-01T00:00:00.000Z',
        current_task: { description: 'task', status: 'done' },
        next_steps: [],
        blockers: [],
      };

      mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(customState));

      autoSaveContext(createHookInput());

      const updated = JSON.parse(mockWriteFileSync.mock.calls[0][1]);
      expect(updated.$schema).toBe('context://session/v2');
      expect(updated._meta.position).toBe('START');
      expect(updated._meta.token_budget).toBe(1000);
    });
  });

  describe('error handling', () => {
    test('returns silent success when readFileSync throws', () => {
      mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('read failure');
      });

      const result = autoSaveContext(createHookInput());

      expectSilentSuccess(result);
    });

    test('returns silent success when writeFileSync throws', () => {
      mockExistsSync.mockReturnValue(false);
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('write failure');
      });

      const result = autoSaveContext(createHookInput());

      expectSilentSuccess(result);
    });

    test('returns silent success when JSON.parse fails on malformed state', () => {
      mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(true);
      mockReadFileSync.mockReturnValue('not json{{{');

      const result = autoSaveContext(createHookInput());

      expectSilentSuccess(result);
    });
  });

  describe('project_dir resolution', () => {
    test('uses input.project_dir when provided', () => {
      mockExistsSync.mockReturnValue(false);

      autoSaveContext(createHookInput({ project_dir: '/custom/dir' }));

      expect(mockMkdirSync).toHaveBeenCalledWith(
        '/custom/dir/.claude/context/session',
        { recursive: true }
      );
    });

    test('falls back to getProjectDir when project_dir not in input', () => {
      process.env.CLAUDE_PROJECT_DIR = '/env/project';
      mockExistsSync.mockReturnValue(false);

      autoSaveContext(createHookInput({ project_dir: undefined }));

      expect(mockMkdirSync).toHaveBeenCalledWith(
        '/env/project/.claude/context/session',
        { recursive: true }
      );
    });
  });

  test('always returns outputSilentSuccess regardless of code path', () => {
    // New file path
    mockExistsSync.mockReturnValue(false);
    expectSilentSuccess(autoSaveContext(createHookInput()));

    vi.clearAllMocks();

    // Update path
    mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(true);
    mockReadFileSync.mockReturnValue('{}');
    expectSilentSuccess(autoSaveContext(createHookInput()));

    vi.clearAllMocks();

    // Error path
    mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(true);
    mockReadFileSync.mockImplementation(() => { throw new Error('boom'); });
    expectSilentSuccess(autoSaveContext(createHookInput()));
  });
});

// =============================================================================
// 2. mem0PreCompactionSync
// =============================================================================

describe('mem0PreCompactionSync', () => {
  // Helper to set up file existence patterns
  function setupFiles(files: Record<string, string | boolean>) {
    mockExistsSync.mockImplementation((path: string) => {
      for (const [key, val] of Object.entries(files)) {
        if (path.includes(key)) {
          return val !== false;
        }
      }
      return false;
    });
    mockReadFileSync.mockImplementation((path: string) => {
      for (const [key, val] of Object.entries(files)) {
        if (path.includes(key) && typeof val === 'string') {
          return val;
        }
      }
      return '{}';
    });
  }

  describe('nothing-to-sync path', () => {
    test('returns silent success when no decision log and no patterns', () => {
      mockExistsSync.mockReturnValue(false);

      const result = mem0PreCompactionSync(createHookInput());

      expectSilentSuccess(result);
    });

    test('returns silent success when decision log exists but all synced', () => {
      setupFiles({
        'decision-log.json': JSON.stringify({
          decisions: [{ decision_id: 'd1' }, { decision_id: 'd2' }],
        }),
        '.decision-sync-state.json': JSON.stringify({
          synced_decisions: ['d1', 'd2'],
        }),
        'agent-patterns.jsonl': false,
        'state.json': false,
      });

      const result = mem0PreCompactionSync(createHookInput());

      expectSilentSuccess(result);
    });

    test('returns silent success when patterns exist but none pending sync', () => {
      setupFiles({
        'decision-log.json': false,
        'agent-patterns.jsonl': '{"pending_sync": false, "agent_id": "test"}\n{"pending_sync": false, "agent_id": "test2"}',
        'state.json': false,
      });

      const result = mem0PreCompactionSync(createHookInput());

      expectSilentSuccess(result);
    });
  });

  describe('no API key gate', () => {
    test('returns silent success when MEM0_API_KEY not set', () => {
      delete process.env.MEM0_API_KEY;

      setupFiles({
        'decision-log.json': JSON.stringify({
          decisions: [{ decision_id: 'd1' }],
        }),
        '.decision-sync-state.json': JSON.stringify({
          synced_decisions: [],
        }),
        'state.json': false,
        'agent-patterns.jsonl': false,
      });

      const result = mem0PreCompactionSync(createHookInput());

      expectSilentSuccess(result);
    });
  });

  describe('pending items without sync script', () => {
    test('returns systemMessage with sync suggestion when decisions pending', () => {
      process.env.MEM0_API_KEY = 'test-key';
      process.env.CLAUDE_PLUGIN_ROOT = '/plugin/root';

      setupFiles({
        'decision-log.json': JSON.stringify({
          decisions: [{ decision_id: 'd1' }],
        }),
        '.decision-sync-state.json': JSON.stringify({
          synced_decisions: [],
        }),
        'add-memory.py': false,
        'state.json': false,
        'agent-patterns.jsonl': false,
      });

      const result = mem0PreCompactionSync(createHookInput());

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('1 decisions to sync');
      expect(result.systemMessage).toContain('/mem0-sync');
    });

    test('returns systemMessage when patterns are pending sync', () => {
      process.env.MEM0_API_KEY = 'test-key';
      process.env.CLAUDE_PLUGIN_ROOT = '/plugin/root';

      setupFiles({
        'decision-log.json': false,
        'agent-patterns.jsonl': '{"pending_sync": true, "agent_id": "test-agent"}\n{"pending_sync": false, "agent_id": "other"}',
        'add-memory.py': false,
        'state.json': false,
      });

      const result = mem0PreCompactionSync(createHookInput());

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('1 agent patterns pending');
      expect(result.systemMessage).toContain('test-agent');
    });

    test('includes multiple agent names in message', () => {
      process.env.MEM0_API_KEY = 'test-key';
      process.env.CLAUDE_PLUGIN_ROOT = '/plugin/root';

      const patterns = [
        '{"pending_sync": true, "agent_id": "agent-a"}',
        '{"pending_sync": true, "agent_id": "agent-b"}',
        '{"pending_sync": true, "agent_id": "agent-c"}',
      ].join('\n');

      setupFiles({
        'decision-log.json': false,
        'agent-patterns.jsonl': patterns,
        'add-memory.py': false,
        'state.json': false,
      });

      const result = mem0PreCompactionSync(createHookInput());

      expect(result.systemMessage).toContain('agent-a');
      expect(result.systemMessage).toContain('agent-b');
      expect(result.systemMessage).toContain('agent-c');
    });
  });

  describe('pending items with API key and script', () => {
    test('spawns background python process when MEM0_API_KEY set and script exists', () => {
      process.env.MEM0_API_KEY = 'test-key';
      process.env.CLAUDE_PLUGIN_ROOT = '/plugin/root';

      setupFiles({
        'decision-log.json': JSON.stringify({
          decisions: [{ decision_id: 'new-decision' }],
        }),
        '.decision-sync-state.json': JSON.stringify({ synced_decisions: [] }),
        'add-memory.py': true,
        'state.json': false,
        'agent-patterns.jsonl': false,
      });

      const result = mem0PreCompactionSync(createHookInput());

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Auto-synced');
      expect(mockSpawn).toHaveBeenCalledWith(
        'python3',
        expect.arrayContaining(['--text', '--user-id', '--metadata', '--enable-graph']),
        expect.objectContaining({
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );
    });

    test('marks patterns as synced after spawning process', () => {
      process.env.MEM0_API_KEY = 'test-key';
      process.env.CLAUDE_PLUGIN_ROOT = '/plugin/root';

      const patterns = '{"pending_sync": true, "agent_id": "a"}\n{"pending_sync": true, "agent_id": "b"}';

      setupFiles({
        'decision-log.json': false,
        'agent-patterns.jsonl': patterns,
        'add-memory.py': true,
        'state.json': JSON.stringify({ current_task: 'working on feature' }),
      });

      mem0PreCompactionSync(createHookInput());

      // Should write updated patterns with pending_sync=false
      const writeCall = mockWriteFileSync.mock.calls.find(
        (call: [string, string]) => String(call[0]).includes('agent-patterns')
      );
      expect(writeCall).toBeDefined();
      if (writeCall) {
        const lines = writeCall[1].split('\n').filter((l: string) => l.trim());
        for (const line of lines) {
          const parsed = JSON.parse(line);
          expect(parsed.pending_sync).toBe(false);
        }
      }
    });
  });

  describe('session info extraction', () => {
    test('includes current task from session state in sync text', () => {
      process.env.MEM0_API_KEY = 'test-key';
      process.env.CLAUDE_PLUGIN_ROOT = '/plugin/root';

      setupFiles({
        'decision-log.json': JSON.stringify({ decisions: [{ decision_id: 'x' }] }),
        '.decision-sync-state.json': JSON.stringify({ synced_decisions: [] }),
        'state.json': JSON.stringify({ current_task: 'Implementing auth flow' }),
        'add-memory.py': false,
        'agent-patterns.jsonl': false,
      });

      const result = mem0PreCompactionSync(createHookInput());

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
    });

    test('handles missing session state gracefully', () => {
      process.env.MEM0_API_KEY = 'test-key';
      process.env.CLAUDE_PLUGIN_ROOT = '/plugin/root';

      setupFiles({
        'decision-log.json': JSON.stringify({ decisions: [{ decision_id: 'x' }] }),
        '.decision-sync-state.json': false,
        'state.json': false,
        'add-memory.py': false,
        'agent-patterns.jsonl': false,
      });

      const result = mem0PreCompactionSync(createHookInput());

      expect(result.continue).toBe(true);
    });
  });

  describe('JSONL parsing', () => {
    test('handles single-line JSONL with pending_sync', () => {
      process.env.MEM0_API_KEY = 'test-key';
      process.env.CLAUDE_PLUGIN_ROOT = '/plugin/root';

      setupFiles({
        'decision-log.json': false,
        'agent-patterns.jsonl': '{"pending_sync": true, "agent_id": "solo"}',
        'add-memory.py': false,
        'state.json': false,
      });

      const result = mem0PreCompactionSync(createHookInput());

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('1 agent patterns pending');
    });

    test('handles corrupt JSONL gracefully', () => {
      process.env.MEM0_API_KEY = 'test-key';
      process.env.CLAUDE_PLUGIN_ROOT = '/plugin/root';

      setupFiles({
        'decision-log.json': false,
        'agent-patterns.jsonl': 'not valid jsonl at all',
        'add-memory.py': false,
        'state.json': false,
      });

      // Should not throw
      const result = mem0PreCompactionSync(createHookInput());
      expect(result.continue).toBeTruthy();
    });
  });

  test('always returns continue: true', () => {
    // Silent success path (no API key)
    mockExistsSync.mockReturnValue(false);
    expect(mem0PreCompactionSync(createHookInput()).continue).toBe(true);

    vi.clearAllMocks();

    // Pending items path (with API key, no script)
    process.env.MEM0_API_KEY = 'test-key';
    process.env.CLAUDE_PLUGIN_ROOT = '/plugin/root';
    setupFiles({
      'decision-log.json': JSON.stringify({ decisions: [{ decision_id: 'd' }] }),
      '.decision-sync-state.json': JSON.stringify({ synced_decisions: [] }),
      'add-memory.py': false,
      'state.json': false,
      'agent-patterns.jsonl': false,
    });
    expect(mem0PreCompactionSync(createHookInput()).continue).toBe(true);
  });

  describe('close handler logging', () => {
    // Helper: set up env + files so spawn path is reached, call hook, extract close callback
    function getCloseHandler(): (code: number | null) => void {
      process.env.MEM0_API_KEY = 'test-key';
      process.env.CLAUDE_PLUGIN_ROOT = '/plugin/root';

      setupFiles({
        'decision-log.json': JSON.stringify({
          decisions: [{ decision_id: 'close-test' }],
        }),
        '.decision-sync-state.json': JSON.stringify({ synced_decisions: [] }),
        'add-memory.py': true,
        'state.json': false,
        'agent-patterns.jsonl': false,
      });

      mem0PreCompactionSync(createHookInput());

      const childMock = mockSpawn.mock.results[0].value;
      const closeCall = childMock.on.mock.calls.find(
        (call: any[]) => call[0] === 'close'
      );
      expect(closeCall).toBeDefined();
      return closeCall![1];
    }

    test('logs success when child exits with code 0', () => {
      const closeHandler = getCloseHandler();
      closeHandler(0);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Sync completed successfully')
      );
    });

    test('logs failure when child exits with non-zero code', () => {
      const closeHandler = getCloseHandler();
      closeHandler(1);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Sync exited with code 1')
      );
    });

    test('logs null exit code when process killed', () => {
      const closeHandler = getCloseHandler();
      closeHandler(null);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Sync exited with code null')
      );
    });

    test('suppresses errors when appendFileSync throws', () => {
      const closeHandler = getCloseHandler();
      mockAppendFileSync.mockImplementation(() => {
        throw new Error('ENOSPC');
      });

      // Should not throw
      expect(() => closeHandler(0)).not.toThrow();
    });
  });
});

// =============================================================================
// 3. mem0WebhookHandler
// =============================================================================

describe('mem0WebhookHandler', () => {
  describe('non-webhook passthrough', () => {
    test('returns silent success for non-Bash tool', () => {
      const input = createHookInput({ tool_name: 'Write', tool_input: { command: 'webhook-receiver.py' } });
      expectSilentSuccess(mem0WebhookHandler(input));
    });

    test('returns silent success for Bash without webhook-receiver.py', () => {
      const input = createBashInput('ls -la');
      expectSilentSuccess(mem0WebhookHandler(input));
    });

    test('returns silent success for empty command', () => {
      const input = createBashInput('');
      expectSilentSuccess(mem0WebhookHandler(input));
    });

    test('returns silent success for Bash with unrelated python script', () => {
      const input = createBashInput('python3 other-script.py');
      expectSilentSuccess(mem0WebhookHandler(input));
    });
  });

  describe('missing or empty tool_result', () => {
    test('returns silent success when tool_result is missing', () => {
      const input = createBashInput('python3 webhook-receiver.py');
      // No tool_result set
      expectSilentSuccess(mem0WebhookHandler(input));
    });

    test('returns silent success when tool_result is empty string', () => {
      const input = createBashInput('python3 webhook-receiver.py');
      input.tool_result = '';
      expectSilentSuccess(mem0WebhookHandler(input));
    });
  });

  describe('valid webhook events', () => {
    test('processes memory.created event without error', () => {
      const input = createBashInput('python3 webhook-receiver.py');
      input.tool_result = JSON.stringify({
        event_type: 'memory.created',
        memory: { id: 'mem-001' },
      });

      const result = mem0WebhookHandler(input);

      expectSilentSuccess(result);
    });

    test('processes memory.updated event', () => {
      const input = createBashInput('python3 webhook-receiver.py');
      input.tool_result = JSON.stringify({
        result: { event_type: 'memory.updated', memory_id: 'mem-002' },
      });

      const result = mem0WebhookHandler(input);

      expectSilentSuccess(result);
    });

    test('processes memory.deleted event', () => {
      const input = createBashInput('python3 webhook-receiver.py');
      input.tool_result = JSON.stringify({
        event_type: 'memory.deleted',
        memory: { id: 'mem-003' },
      });

      expectSilentSuccess(mem0WebhookHandler(input));
    });

    test('handles unknown event type gracefully', () => {
      const input = createBashInput('python3 webhook-receiver.py');
      input.tool_result = JSON.stringify({
        event_type: 'memory.unknown_action',
        memory: { id: 'mem-004' },
      });

      expectSilentSuccess(mem0WebhookHandler(input));
    });

    test('handles nested result.event_type format', () => {
      const input = createBashInput('python3 webhook-receiver.py');
      input.tool_result = JSON.stringify({
        result: {
          event_type: 'memory.created',
          memory_id: 'nested-mem',
        },
      });

      expectSilentSuccess(mem0WebhookHandler(input));
    });
  });

  describe('invalid JSON handling', () => {
    test('returns silent success for malformed JSON in tool_result', () => {
      const input = createBashInput('python3 webhook-receiver.py');
      input.tool_result = '{not valid json{{{';

      const result = mem0WebhookHandler(input);

      expectSilentSuccess(result);
    });

    test('returns silent success for non-object JSON in tool_result', () => {
      const input = createBashInput('python3 webhook-receiver.py');
      input.tool_result = '"just a string"';

      // Should not crash -- outer try/catch handles it
      const result = mem0WebhookHandler(input);
      expectSilentSuccess(result);
    });

    test('returns silent success for truncated JSON', () => {
      const input = createBashInput('python3 webhook-receiver.py');
      input.tool_result = '{"event_type": "memory.created", "mem';

      expectSilentSuccess(mem0WebhookHandler(input));
    });
  });

  describe('command matching', () => {
    test('matches when command contains webhook-receiver.py anywhere', () => {
      const input = createBashInput('cd /tmp && python3 /path/to/webhook-receiver.py --port 8080');
      input.tool_result = JSON.stringify({ event_type: 'memory.created', memory: { id: 'm' } });

      expectSilentSuccess(mem0WebhookHandler(input));
    });

    test('does not match tool_name case-sensitively', () => {
      const input = createHookInput({
        tool_name: 'bash', // lowercase
        tool_input: { command: 'webhook-receiver.py' },
      });

      // Lowercase 'bash' != 'Bash' -- should return silent success (passthrough)
      expectSilentSuccess(mem0WebhookHandler(input));
    });
  });

  test('always returns outputSilentSuccess', () => {
    // Passthrough
    expectSilentSuccess(mem0WebhookHandler(createBashInput('ls')));

    // Valid event
    const valid = createBashInput('python3 webhook-receiver.py');
    valid.tool_result = JSON.stringify({ event_type: 'memory.created', memory: { id: 'x' } });
    expectSilentSuccess(mem0WebhookHandler(valid));

    // Invalid JSON
    const invalid = createBashInput('python3 webhook-receiver.py');
    invalid.tool_result = 'bad json';
    expectSilentSuccess(mem0WebhookHandler(invalid));
  });
});

// =============================================================================
// 4. sessionContextLoader
// =============================================================================

describe('sessionContextLoader', () => {
  function setupContextFiles(files: Record<string, string | boolean>) {
    mockExistsSync.mockImplementation((path: string) => {
      for (const [key, val] of Object.entries(files)) {
        if (path.includes(key)) {
          return val !== false;
        }
      }
      return false;
    });
    mockReadFileSync.mockImplementation((path: string) => {
      for (const [key, val] of Object.entries(files)) {
        if (path.includes(key) && typeof val === 'string') {
          return val;
        }
      }
      return '{}';
    });
  }

  describe('context file detection', () => {
    test('returns silent success when no context files exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = sessionContextLoader(createHookInput());

      expectSilentSuccess(result);
    });

    test('loads session state when valid JSON file exists', () => {
      setupContextFiles({
        'state.json': JSON.stringify({ session_id: 's1', last_activity: '2026-01-01' }),
        'identity.json': false,
        'index.json': false,
        'CURRENT_STATUS.md': false,
        'compaction-manifest.json': false,
      });

      const result = sessionContextLoader(createHookInput());

      expectSilentSuccess(result);
    });

    test('detects identity file', () => {
      setupContextFiles({
        'state.json': false,
        'identity.json': JSON.stringify({ name: 'orchestkit' }),
        'index.json': false,
        'CURRENT_STATUS.md': false,
        'compaction-manifest.json': false,
      });

      const result = sessionContextLoader(createHookInput());

      expectSilentSuccess(result);
    });

    test('detects knowledge index', () => {
      setupContextFiles({
        'state.json': false,
        'identity.json': false,
        'index.json': JSON.stringify({ entries: [] }),
        'CURRENT_STATUS.md': false,
        'compaction-manifest.json': false,
      });

      expectSilentSuccess(sessionContextLoader(createHookInput()));
    });

    test('detects status document', () => {
      setupContextFiles({
        'state.json': false,
        'identity.json': false,
        'index.json': false,
        'CURRENT_STATUS.md': '# Status',
        'compaction-manifest.json': false,
      });

      // existsSync is used for this file (not isValidJsonFile)
      expectSilentSuccess(sessionContextLoader(createHookInput()));
    });

    test('loads all context files simultaneously', () => {
      setupContextFiles({
        'state.json': JSON.stringify({ session_id: 's1' }),
        'identity.json': JSON.stringify({ name: 'test' }),
        'index.json': JSON.stringify({ entries: [] }),
        'CURRENT_STATUS.md': '# Status',
        'compaction-manifest.json': false,
      });

      expectSilentSuccess(sessionContextLoader(createHookInput()));
    });
  });

  describe('isValidJsonFile behavior', () => {
    test('treats files with invalid JSON as non-existent', () => {
      mockExistsSync.mockImplementation((path: string) => {
        return path.includes('state.json');
      });
      mockReadFileSync.mockReturnValue('{{invalid json');

      const result = sessionContextLoader(createHookInput());

      expectSilentSuccess(result);
    });

    test('treats empty files as valid JSON (empty object) when parseable', () => {
      mockExistsSync.mockImplementation((path: string) => path.includes('identity.json'));
      mockReadFileSync.mockReturnValue('{}');

      expectSilentSuccess(sessionContextLoader(createHookInput()));
    });
  });

  describe('agent-type aware loading', () => {
    test('checks for agent-specific config when AGENT_TYPE is set', () => {
      process.env.AGENT_TYPE = 'test-generator';

      setupContextFiles({
        'state.json': false,
        'identity.json': false,
        'index.json': false,
        'CURRENT_STATUS.md': false,
        'compaction-manifest.json': false,
        'test-generator.md': '# Test Generator Agent',
      });

      const result = sessionContextLoader(createHookInput());

      expectSilentSuccess(result);
      // existsSync should have been called with the agent config path
      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringContaining('test-generator.md')
      );
    });

    test('skips agent config check when AGENT_TYPE is empty', () => {
      process.env.AGENT_TYPE = '';

      setupContextFiles({
        'state.json': false,
        'identity.json': false,
        'index.json': false,
        'CURRENT_STATUS.md': false,
        'compaction-manifest.json': false,
      });

      sessionContextLoader(createHookInput());

      // Should not check for agent-specific config
      const agentConfigCalls = mockExistsSync.mock.calls.filter(
        (call: [string]) => String(call[0]).includes('/agents/')
      );
      expect(agentConfigCalls).toHaveLength(0);
    });
  });

  describe('compaction manifest', () => {
    test('sets ORCHESTKIT_LAST_SESSION env var from manifest', () => {
      setupContextFiles({
        'state.json': false,
        'identity.json': false,
        'index.json': false,
        'CURRENT_STATUS.md': false,
        'compaction-manifest.json': JSON.stringify({
          sessionId: 'prev-session-abc',
          keyDecisions: ['decision-1', 'decision-2'],
          filesTouched: ['file.ts'],
        }),
      });

      sessionContextLoader(createHookInput());

      expect(process.env.ORCHESTKIT_LAST_SESSION).toBe('prev-session-abc');
    });

    test('sets ORCHESTKIT_LAST_DECISIONS env var as JSON string', () => {
      setupContextFiles({
        'state.json': false,
        'identity.json': false,
        'index.json': false,
        'CURRENT_STATUS.md': false,
        'compaction-manifest.json': JSON.stringify({
          sessionId: 'prev-abc',
          keyDecisions: ['use-vitest', 'add-coverage'],
        }),
      });

      sessionContextLoader(createHookInput());

      expect(process.env.ORCHESTKIT_LAST_DECISIONS).toBe(
        JSON.stringify(['use-vitest', 'add-coverage'])
      );
    });

    test('handles manifest with missing keyDecisions (defaults to empty array)', () => {
      setupContextFiles({
        'state.json': false,
        'identity.json': false,
        'index.json': false,
        'CURRENT_STATUS.md': false,
        'compaction-manifest.json': JSON.stringify({ sessionId: 's1' }),
      });

      sessionContextLoader(createHookInput());

      expect(process.env.ORCHESTKIT_LAST_SESSION).toBe('s1');
      expect(process.env.ORCHESTKIT_LAST_DECISIONS).toBe('[]');
    });

    test('handles manifest with missing sessionId', () => {
      setupContextFiles({
        'state.json': false,
        'identity.json': false,
        'index.json': false,
        'CURRENT_STATUS.md': false,
        'compaction-manifest.json': JSON.stringify({ keyDecisions: ['d1'] }),
      });

      sessionContextLoader(createHookInput());

      expect(process.env.ORCHESTKIT_LAST_SESSION).toBe('');
    });

    test('skips manifest when file does not exist', () => {
      setupContextFiles({
        'state.json': false,
        'identity.json': false,
        'index.json': false,
        'CURRENT_STATUS.md': false,
        'compaction-manifest.json': false,
      });

      sessionContextLoader(createHookInput());

      expect(process.env.ORCHESTKIT_LAST_SESSION).toBeUndefined();
      expect(process.env.ORCHESTKIT_LAST_DECISIONS).toBeUndefined();
    });
  });

  describe('project_dir resolution', () => {
    test('uses input.project_dir when provided', () => {
      mockExistsSync.mockReturnValue(false);

      sessionContextLoader(createHookInput({ project_dir: '/custom/path' }));

      // Cross-platform: accept either / or \ path separators
      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringMatching(/[/\\]custom[/\\]path[/\\]/)
      );
    });
  });

  test('always returns outputSilentSuccess', () => {
    mockExistsSync.mockReturnValue(false);
    expectSilentSuccess(sessionContextLoader(createHookInput()));

    vi.clearAllMocks();

    // All files present
    setupContextFiles({
      'state.json': '{}',
      'identity.json': '{}',
      'index.json': '{}',
      'CURRENT_STATUS.md': '# Status',
      'compaction-manifest.json': JSON.stringify({ sessionId: 's', keyDecisions: [] }),
    });
    expectSilentSuccess(sessionContextLoader(createHookInput()));
  });
});

// =============================================================================
// 5. retryHandler
// =============================================================================

describe('retryHandler', () => {
  describe('success passthrough', () => {
    test('returns silent success for successful agent completion', () => {
      const input = createHookInput({
        tool_input: { subagent_type: 'test-generator' },
        agent_output: 'All tests passed successfully.',
      });

      const result = retryHandler(input);

      expectSilentSuccess(result);
    });

    test('returns silent success for output without failure indicators', () => {
      const input = createHookInput({
        subagent_type: 'backend-system-architect',
        agent_output: 'Implemented the API endpoint as requested.',
      });

      expectSilentSuccess(retryHandler(input));
    });
  });

  describe('no agentType passthrough', () => {
    test('returns silent success when no agent type is provided', () => {
      const input = createHookInput({
        tool_input: {},
        // No subagent_type, agent_type, or tool_input.subagent_type
      });

      expectSilentSuccess(retryHandler(input));
    });

    test('returns silent success when tool_input is empty', () => {
      const input = createHookInput({ tool_input: {} });

      expectSilentSuccess(retryHandler(input));
    });
  });

  describe('failure detection - error field', () => {
    test('detects failure from error field', () => {
      const input = createHookInput({
        subagent_type: 'test-generator',
        error: 'Module not found: vitest',
      });

      const result = retryHandler(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    });

    test('detects failure from tool_error field', () => {
      const input = createHookInput({
        tool_input: { subagent_type: 'backend-system-architect' },
        tool_error: 'Timeout after 30s',
      });

      const result = retryHandler(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    });

    test('ignores null-string error', () => {
      const input = createHookInput({
        subagent_type: 'test-generator',
        error: 'null',
        agent_output: 'Everything worked fine.',
      });

      expectSilentSuccess(retryHandler(input));
    });

    test('ignores empty string error', () => {
      const input = createHookInput({
        subagent_type: 'test-generator',
        error: '',
        agent_output: 'Done.',
      });

      expectSilentSuccess(retryHandler(input));
    });
  });

  describe('failure detection - exit_code', () => {
    test('detects failure from non-zero exit code', () => {
      const input = createHookInput({
        subagent_type: 'test-generator',
        exit_code: 1,
      });

      const result = retryHandler(input);

      expect(result.continue).toBe(true);
      // Non-zero exit code triggers retry logic, producing additionalContext
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
      expect(result.hookSpecificOutput?.additionalContext).toContain('test-generator');
    });

    test('treats exit_code 0 as success', () => {
      const input = createHookInput({
        subagent_type: 'test-generator',
        exit_code: 0,
        agent_output: 'All good.',
      });

      expectSilentSuccess(retryHandler(input));
    });
  });

  describe('rejection pattern detection', () => {
    test.each([
      'I cannot perform this task',
      "I can't do that",
      'I am unable to complete this',
      'This is outside my scope',
      'This request is not appropriate',
      'I refuse to execute this',
    ])('detects rejection pattern: "%s"', (output) => {
      const input = createHookInput({
        subagent_type: 'test-generator',
        agent_output: output,
      });

      const result = retryHandler(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    });

    test('only checks first 500 chars for rejection patterns', () => {
      const input = createHookInput({
        subagent_type: 'test-generator',
        agent_output: 'A'.repeat(501) + 'I cannot do this',
      });

      // Rejection pattern is beyond 500-char boundary, should not match
      expectSilentSuccess(retryHandler(input));
    });
  });

  describe('partial detection', () => {
    test.each([
      'The task was partially completed',
      'Results are incomplete due to timeout',
      'Some tests failed during execution',
      "Couldn't finish all the requested changes",
    ])('detects partial outcome: "%s"', (output) => {
      const input = createHookInput({
        subagent_type: 'test-generator',
        agent_output: output,
      });

      const result = retryHandler(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    });
  });

  describe('agent type resolution', () => {
    test('resolves from tool_input.subagent_type first', () => {
      const input = createHookInput({
        tool_input: { subagent_type: 'from-tool-input' },
        subagent_type: 'from-root',
        agent_type: 'from-agent-type',
        error: 'test error',
      });

      const result = retryHandler(input);

      expect(result.hookSpecificOutput?.additionalContext).toContain('from-tool-input');
    });

    test('falls back to input.subagent_type', () => {
      const input = createHookInput({
        tool_input: {},
        subagent_type: 'from-root',
        error: 'test error',
      });

      const result = retryHandler(input);

      expect(result.hookSpecificOutput?.additionalContext).toContain('from-root');
    });

    test('falls back to input.agent_type', () => {
      const input = createHookInput({
        tool_input: {},
        agent_type: 'from-agent-type',
        error: 'test error',
      });

      const result = retryHandler(input);

      expect(result.hookSpecificOutput?.additionalContext).toContain('from-agent-type');
    });
  });

  describe('retry decision integration', () => {
    test('calls updateAgentStatus with retrying for retryable errors', () => {
      const input = createHookInput({
        subagent_type: 'test-generator',
        error: 'Temporary network error',
      });

      retryHandler(input);

      expect(updateAgentStatus).toHaveBeenCalledWith('test-generator', expect.any(String));
    });

    test('calls updateAgentStatus with failed for non-retryable errors at max retries', () => {
      // Set up state so agent has reached max retries
      (loadState as Mock).mockReturnValue({
        activeAgents: [
          { agent: 'test-generator', retryCount: 2, taskId: 'task-1' },
        ],
        injectedSkills: [],
        promptHistory: [],
      });

      const input = createHookInput({
        subagent_type: 'test-generator',
        error: 'Permission denied',
      });

      retryHandler(input);

      expect(updateAgentStatus).toHaveBeenCalledWith('test-generator', 'failed');
    });

    test('updates task status to failed when agent has associated task', () => {
      (loadState as Mock).mockReturnValue({
        activeAgents: [{ agent: 'backend-system-architect', retryCount: 3 }],
        injectedSkills: [],
        promptHistory: [],
      });
      (getTaskByAgent as Mock).mockReturnValue({ taskId: 'task-42' });

      const input = createHookInput({
        subagent_type: 'backend-system-architect',
        error: 'Permission denied: cannot access resource',
      });

      retryHandler(input);

      expect(updateTaskStatus).toHaveBeenCalledWith('task-42', 'failed');
    });
  });

  describe('output format', () => {
    test('returns outputWithContext format for non-success outcomes', () => {
      const input = createHookInput({
        subagent_type: 'test-generator',
        error: 'Something went wrong',
      });

      const result = retryHandler(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput?.hookEventName).toBe('PostToolUse');
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
      expect(typeof result.hookSpecificOutput?.additionalContext).toBe('string');
    });

    test('message includes agent name', () => {
      const input = createHookInput({
        subagent_type: 'security-auditor',
        error: 'Access denied',
      });

      const result = retryHandler(input);

      expect(result.hookSpecificOutput?.additionalContext).toContain('security-auditor');
    });
  });
});

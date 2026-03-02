/**
 * Tier 2: Data-Loss Risk Hooks - Comprehensive Test Suite
 *
 * Tests hooks that handle session state persistence, memory sync,
 * webhook processing, and retry logic.
 *
 * Hooks under test:
 * 1. handoffWriter         (stop/handoff-writer)
 * 2. retryHandler          (subagent-stop/retry-handler)
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
import { handoffWriter } from '../stop/handoff-writer.js';
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
const _mockAppendFileSync = appendFileSync as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no files exist
  mockExistsSync.mockReturnValue(false);
  mockReadFileSync.mockReturnValue('{}');
  // Reset env vars
  delete process.env.AGENT_TYPE;
  delete process.env.ORCHESTKIT_LAST_SESSION;
  delete process.env.ORCHESTKIT_LAST_DECISIONS;
  delete process.env.CLAUDE_PROJECT_DIR;
  delete process.env.CLAUDE_PLUGIN_ROOT;
});

// =============================================================================
// 1. handoffWriter
// =============================================================================

describe('handoffWriter', () => {
  describe('writes HANDOFF.md', () => {
    test('creates .claude directory and writes HANDOFF.md', () => {
      mockExistsSync.mockReturnValue(false);

      const result = handoffWriter(createHookInput());

      expectSilentSuccess(result);
      // Should create .claude/ directory
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringMatching(/\.claude$/),
        { recursive: true }
      );
      // Should write HANDOFF.md
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const [path, content] = mockWriteFileSync.mock.calls[0];
      expect(path).toMatch(/HANDOFF\.md$/);
      expect(content).toContain('# Session Handoff');
    });

    test('HANDOFF.md contains branch and session info', () => {
      mockExistsSync.mockReturnValue(false);

      handoffWriter(createHookInput());

      const content = mockWriteFileSync.mock.calls[0][1] as string;
      expect(content).toContain('**Branch**:');
      expect(content).toContain('**Session**:');
      expect(content).toContain('**When**:');
    });

    test('HANDOFF.md includes summary from last_assistant_message', () => {
      mockExistsSync.mockReturnValue(false);

      handoffWriter(createHookInput({
        last_assistant_message: 'I implemented the handoff writer hook and updated all tests.',
      }));

      const content = mockWriteFileSync.mock.calls[0][1] as string;
      expect(content).toContain('## Summary');
      expect(content).toContain('implemented the handoff writer');
    });

    test('does not crash when .claude dir already exists', () => {
      // .claude exists
      mockExistsSync.mockReturnValueOnce(true);

      const result = handoffWriter(createHookInput());

      expectSilentSuccess(result);
      expect(mockMkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('returns silent success when mkdirSync throws', () => {
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockImplementationOnce(() => {
        throw new Error('EACCES');
      });

      const result = handoffWriter(createHookInput());

      expectSilentSuccess(result);
    });

    test('returns silent success when writeFileSync throws', () => {
      mockExistsSync.mockReturnValue(false);
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('write failure');
      });

      const result = handoffWriter(createHookInput());

      expectSilentSuccess(result);
    });
  });

  describe('project_dir resolution', () => {
    test('uses input.project_dir when provided', () => {
      mockExistsSync.mockReturnValue(false);

      handoffWriter(createHookInput({ project_dir: '/custom/dir' }));

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('/custom/dir/.claude/HANDOFF.md'),
        expect.any(String),
        'utf8'
      );
    });

    test('falls back to getProjectDir when project_dir not in input', () => {
      process.env.CLAUDE_PROJECT_DIR = '/env/project';
      mockExistsSync.mockReturnValue(false);

      handoffWriter(createHookInput({ project_dir: undefined }));

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('/env/project/.claude/HANDOFF.md'),
        expect.any(String),
        'utf8'
      );
    });
  });

  test('always returns outputSilentSuccess regardless of code path', () => {
    // Normal path
    mockExistsSync.mockReturnValue(false);
    expectSilentSuccess(handoffWriter(createHookInput()));

    vi.clearAllMocks();

    // Error path
    mockWriteFileSync.mockImplementation(() => { throw new Error('boom'); });
    mockExistsSync.mockReturnValue(false);
    expectSilentSuccess(handoffWriter(createHookInput()));
  });
});

// =============================================================================
// 2. retryHandler
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
        agent_output: `${'A'.repeat(501)}I cannot do this`,
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

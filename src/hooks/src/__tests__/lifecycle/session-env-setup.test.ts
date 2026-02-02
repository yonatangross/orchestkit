/**
 * Unit tests for session-env-setup lifecycle hook
 * Tests environment initialization at session start
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST be before imports
// =============================================================================

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => 'main'),
}));

vi.mock('../../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/common.js')>();
  return {
    ...actual,
    logHook: vi.fn(),
    getProjectDir: vi.fn(() => process.env.CLAUDE_PROJECT_DIR || '/test/project'),
    getSessionId: vi.fn(() => 'test-session-123'),
    outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  };
});

// Import after mocks
import { sessionEnvSetup } from '../../lifecycle/session-env-setup.js';
import { execSync } from 'node:child_process';
import { logHook, getProjectDir, getSessionId, outputSilentSuccess } from '../../lib/common.js';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = join(tmpdir(), 'session-env-setup-test');
const METRICS_FILE = '/tmp/claude-session-metrics.json';

/**
 * Create realistic HookInput for testing
 */
function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: 'test-session-env-setup-123',
    project_dir: TEST_PROJECT_DIR,
    tool_input: {},
    ...overrides,
  };
}

/**
 * Create session state file for testing
 */
function createSessionState(state: Record<string, unknown> = {}): void {
  const stateDir = `${TEST_PROJECT_DIR}/.claude/context/session`;
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(`${stateDir}/state.json`, JSON.stringify(state));
}

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();

  // Set environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;

  // Create test directory
  mkdirSync(TEST_PROJECT_DIR, { recursive: true });

  // IMPORTANT: Clean metrics file BEFORE each test to avoid pollution from other test files
  // The source hook uses a hardcoded path /tmp/claude-session-metrics.json
  // Multiple test files may write to this path concurrently
  try {
    rmSync(METRICS_FILE, { force: true });
  } catch {
    // Ignore removal errors
  }

  // Reset agent type env
  delete process.env.AGENT_TYPE;
});

afterEach(() => {
  // Clean up test directory
  if (existsSync(TEST_PROJECT_DIR)) {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }

  // Clean up metrics file
  if (existsSync(METRICS_FILE)) {
    rmSync(METRICS_FILE, { force: true });
  }

  // Clean up environment
  delete process.env.CLAUDE_PROJECT_DIR;
  delete process.env.AGENT_TYPE;
});

// =============================================================================
// Tests
// =============================================================================

describe('session-env-setup', () => {
  describe('basic behavior', () => {
    test('returns silent success on successful setup', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = sessionEnvSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('creates logs directory if it does not exist', () => {
      // Arrange
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      const logsDir = `${TEST_PROJECT_DIR}/.claude/logs`;
      expect(existsSync(logsDir)).toBe(true);
    });

    test('handles missing project directory gracefully', () => {
      // Arrange
      const input = createHookInput({ project_dir: '/non/existent/path' });

      // Act
      const result = sessionEnvSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('uses default project_dir when not provided', () => {
      // Arrange
      const input = createHookInput({ project_dir: undefined });

      // Act
      const result = sessionEnvSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(getProjectDir).toHaveBeenCalled();
    });
  });

  describe('metrics initialization', () => {
    test('creates session metrics file with correct structure', () => {
      // Arrange
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      expect(existsSync(METRICS_FILE)).toBe(true);
      const metrics = JSON.parse(readFileSync(METRICS_FILE, 'utf-8'));
      expect(metrics).toHaveProperty('session_id');
      expect(metrics).toHaveProperty('started_at');
      expect(metrics).toHaveProperty('tools');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('warnings');
    });

    test('initializes metrics with empty tool counts', () => {
      // Arrange
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      const metrics = JSON.parse(readFileSync(METRICS_FILE, 'utf-8'));
      expect(metrics.tools).toEqual({});
    });

    test('initializes metrics with zero errors and warnings', () => {
      // Arrange
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      const metrics = JSON.parse(readFileSync(METRICS_FILE, 'utf-8'));
      expect(metrics.errors).toBe(0);
      expect(metrics.warnings).toBe(0);
    });

    test('includes session_id in metrics', () => {
      // Arrange
      const input = createHookInput({ session_id: 'custom-session-id' });

      // Act
      sessionEnvSetup(input);

      // Assert
      const metrics = JSON.parse(readFileSync(METRICS_FILE, 'utf-8'));
      expect(metrics.session_id).toBe('custom-session-id');
    });

    test('includes ISO timestamp in started_at', () => {
      // Arrange
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      const metrics = JSON.parse(readFileSync(METRICS_FILE, 'utf-8'));
      expect(metrics.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('agent type handling', () => {
    test('reads agent_type from environment variable', () => {
      // Arrange
      process.env.AGENT_TYPE = 'test-agent';
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      const metrics = JSON.parse(readFileSync(METRICS_FILE, 'utf-8'));
      expect(metrics.agent_type).toBe('test-agent');
    });

    test('reads agent_type from hook input when env not set', () => {
      // Arrange
      const input = createHookInput({ agent_type: 'input-agent' });

      // Act
      sessionEnvSetup(input);

      // Assert
      const metrics = JSON.parse(readFileSync(METRICS_FILE, 'utf-8'));
      expect(metrics.agent_type).toBe('input-agent');
    });

    test('prefers environment variable over hook input for agent_type', () => {
      // Arrange
      process.env.AGENT_TYPE = 'env-agent';
      const input = createHookInput({ agent_type: 'input-agent' });

      // Act
      sessionEnvSetup(input);

      // Assert
      const metrics = JSON.parse(readFileSync(METRICS_FILE, 'utf-8'));
      expect(metrics.agent_type).toBe('env-agent');
    });

    test('handles missing agent_type gracefully', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = sessionEnvSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      const metrics = JSON.parse(readFileSync(METRICS_FILE, 'utf-8'));
      expect(metrics.agent_type).toBe('');
    });
  });

  describe('session state update (CC 2.1.6)', () => {
    test('updates session state with agent_type when state file exists', () => {
      // Arrange
      createSessionState({ existing: 'data' });
      process.env.AGENT_TYPE = 'test-agent';
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      const stateFile = `${TEST_PROJECT_DIR}/.claude/context/session/state.json`;
      const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
      expect(state.agent_type).toBe('test-agent');
      expect(state.existing).toBe('data');
    });

    test('updates session_id in state file', () => {
      // Arrange
      createSessionState({});
      process.env.AGENT_TYPE = 'test-agent';
      const input = createHookInput({ session_id: 'new-session-id' });

      // Act
      sessionEnvSetup(input);

      // Assert
      const stateFile = `${TEST_PROJECT_DIR}/.claude/context/session/state.json`;
      const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
      expect(state.session_id).toBe('new-session-id');
    });

    test('updates last_activity timestamp in state file', () => {
      // Arrange
      createSessionState({});
      process.env.AGENT_TYPE = 'test-agent';
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      const stateFile = `${TEST_PROJECT_DIR}/.claude/context/session/state.json`;
      const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
      expect(state.last_activity).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('does not update state file when agent_type is not set', () => {
      // Arrange
      createSessionState({ existing: 'data' });
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      const stateFile = `${TEST_PROJECT_DIR}/.claude/context/session/state.json`;
      const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
      expect(state).toEqual({ existing: 'data' });
    });

    test('handles missing state file gracefully', () => {
      // Arrange
      process.env.AGENT_TYPE = 'test-agent';
      const input = createHookInput();

      // Act
      const result = sessionEnvSetup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles invalid state JSON gracefully', () => {
      // Arrange
      const stateDir = `${TEST_PROJECT_DIR}/.claude/context/session`;
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(`${stateDir}/state.json`, 'invalid json {');
      process.env.AGENT_TYPE = 'test-agent';
      const input = createHookInput();

      // Act
      const result = sessionEnvSetup(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('git branch detection', () => {
    test('calls git branch command with project directory', () => {
      // Arrange
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      expect(execSync).toHaveBeenCalledWith(
        'git branch --show-current',
        expect.objectContaining({
          cwd: TEST_PROJECT_DIR,
          encoding: 'utf-8',
          timeout: 500,
        })
      );
    });

    test('handles git command failure gracefully', () => {
      // Arrange
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('Not a git repository');
      });
      const input = createHookInput();

      // Act
      const result = sessionEnvSetup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('logs git branch when detected', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce('feature-branch\n');
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-env-setup',
        'Git branch: feature-branch'
      );
    });

    test('does not log branch when empty', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce('');
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      expect(logHook).not.toHaveBeenCalledWith(
        'session-env-setup',
        expect.stringContaining('Git branch:')
      );
    });
  });

  describe('logging behavior', () => {
    test('logs setup initialization', () => {
      // Arrange
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-env-setup',
        'Setting up session environment'
      );
    });

    test('logs metrics initialization', () => {
      // Arrange
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-env-setup',
        'Initialized session metrics'
      );
    });

    test('logs agent type when present', () => {
      // Arrange
      process.env.AGENT_TYPE = 'test-agent';
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-env-setup',
        'Agent type: test-agent'
      );
    });

    test('logs state update when agent_type is set', () => {
      // Arrange
      createSessionState({});
      process.env.AGENT_TYPE = 'test-agent';
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-env-setup',
        'Updated session state with agent_type: test-agent'
      );
    });
  });

  describe('error handling', () => {
    test('continues even when mkdir fails', () => {
      // Arrange - create file to block mkdir
      const logsPath = `${TEST_PROJECT_DIR}/.claude/logs`;
      mkdirSync(`${TEST_PROJECT_DIR}/.claude`, { recursive: true });
      writeFileSync(logsPath, 'blocking file');
      const input = createHookInput();

      // Act
      const result = sessionEnvSetup(input);

      // Assert - should continue despite error
      expect(result.continue).toBe(true);
    });

    test('never blocks session start', () => {
      // Arrange
      const input = createHookInput({ project_dir: '/non/existent/path' });

      // Act
      const result = sessionEnvSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });

    test('logs error when metrics write fails', () => {
      // Arrange
      // Create metrics file as directory to cause write error
      mkdirSync(METRICS_FILE, { recursive: true });
      const input = createHookInput();

      // Act
      const result = sessionEnvSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(logHook).toHaveBeenCalledWith(
        'session-env-setup',
        expect.stringContaining('Failed to initialize metrics')
      );

      // Cleanup
      rmSync(METRICS_FILE, { recursive: true, force: true });
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = sessionEnvSetup(input);

      // Assert
      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('suppressOutput', true);
    });

    test('always returns continue: true for non-blocking hook', () => {
      // Arrange - various error conditions
      const testCases = [
        { project_dir: '/non/existent' },
        { project_dir: undefined },
        { session_id: '' },
      ];

      // Act & Assert
      for (const overrides of testCases) {
        const input = createHookInput(overrides);
        const result = sessionEnvSetup(input);
        expect(result.continue).toBe(true);
      }
    });

    test('always suppresses output', () => {
      // Arrange
      process.env.AGENT_TYPE = 'test-agent';
      createSessionState({});
      const input = createHookInput();

      // Act
      const result = sessionEnvSetup(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('parametric tests', () => {
    test.each([
      ['test-agent', 'test-agent'],
      ['backend-system-architect', 'backend-system-architect'],
      ['code-quality-reviewer', 'code-quality-reviewer'],
      ['', ''],
    ])('handles agent_type "%s" correctly', (agentType, expected) => {
      // Arrange
      if (agentType) {
        process.env.AGENT_TYPE = agentType;
      }
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      const metrics = JSON.parse(readFileSync(METRICS_FILE, 'utf-8'));
      expect(metrics.agent_type).toBe(expected);
    });

    test.each([
      [{ existing: 'data' }],
      [{ nested: { deep: 'value' } }],
      [{}],
    ])('preserves existing state: %o', (existingState) => {
      // Arrange
      createSessionState(existingState);
      process.env.AGENT_TYPE = 'test-agent';
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      const stateFile = `${TEST_PROJECT_DIR}/.claude/context/session/state.json`;
      const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
      for (const [key, value] of Object.entries(existingState)) {
        expect(state[key]).toEqual(value);
      }
    });
  });

  describe('edge cases', () => {
    test('handles empty session_id', () => {
      // Arrange
      const input = createHookInput({ session_id: '' });

      // Act
      const result = sessionEnvSetup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles very long agent_type', () => {
      // Arrange
      process.env.AGENT_TYPE = 'a'.repeat(1000);
      const input = createHookInput();

      // Act
      const result = sessionEnvSetup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles special characters in agent_type', () => {
      // Arrange
      process.env.AGENT_TYPE = 'agent-with-special_chars.v1';
      const input = createHookInput();

      // Act
      sessionEnvSetup(input);

      // Assert
      const metrics = JSON.parse(readFileSync(METRICS_FILE, 'utf-8'));
      expect(metrics.agent_type).toBe('agent-with-special_chars.v1');
    });

    test('handles concurrent session state updates', () => {
      // Arrange - create state with concurrent-like scenario
      createSessionState({ concurrent: 'data' });
      process.env.AGENT_TYPE = 'test-agent';
      const input = createHookInput();

      // Act - multiple calls
      sessionEnvSetup(input);
      sessionEnvSetup(input);

      // Assert - should not corrupt state
      const stateFile = `${TEST_PROJECT_DIR}/.claude/context/session/state.json`;
      const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
      expect(state.agent_type).toBe('test-agent');
    });
  });
});

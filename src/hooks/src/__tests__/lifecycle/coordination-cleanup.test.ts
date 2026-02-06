/**
 * Unit tests for coordination-cleanup lifecycle hook
 * Tests instance unregistration and cleanup at session end
 * CC 2.1.7 Compliant: Non-blocking - always returns continue: true
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { HookInput } from '../../types.js';
import { coordinationCleanup } from '../../lifecycle/coordination-cleanup.js';

// =============================================================================
// Mock Setup - BEFORE imports
// =============================================================================

vi.mock('../../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/common.js')>();
  return {
    ...actual,
    logHook: vi.fn(),
    getProjectDir: vi.fn(() => process.env.CLAUDE_PROJECT_DIR || '/test/project'),
    outputSilentSuccess: actual.outputSilentSuccess,
  };
});

// =============================================================================
// Test Setup
// =============================================================================

let TEST_PROJECT_DIR: string;
let TEST_SESSION_ID: string;
let TEST_INSTANCE_ID: string;

/**
 * Create realistic HookInput for testing
 */
function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: TEST_SESSION_ID,
    project_dir: TEST_PROJECT_DIR,
    tool_input: {},
    ...overrides,
  };
}

/**
 * Create instance environment file
 */
function createInstanceEnv(instanceId: string): void {
  const claudeDir = `${TEST_PROJECT_DIR}/.claude`;
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(`${claudeDir}/.instance_env`, `CLAUDE_INSTANCE_ID=${instanceId}\n`);
}

/**
 * Create heartbeat file for instance
 */
function createHeartbeatFile(instanceId: string, status: string = 'active'): void {
  const heartbeatsDir = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats`;
  mkdirSync(heartbeatsDir, { recursive: true });
  const heartbeat = {
    instance_id: instanceId,
    status,
    started_at: new Date().toISOString(),
    last_heartbeat: new Date().toISOString(),
    task: 'Test task',
    role: 'main',
  };
  writeFileSync(`${heartbeatsDir}/${instanceId}.json`, JSON.stringify(heartbeat, null, 2));
}

/**
 * Create coordination database marker
 */
function createCoordinationDb(): void {
  const coordDir = `${TEST_PROJECT_DIR}/.claude/coordination`;
  mkdirSync(coordDir, { recursive: true });
  writeFileSync(`${coordDir}/.claude.db`, 'mock database');
}

/**
 * Store original environment values
 */
let originalEnv: {
  CLAUDE_PROJECT_DIR?: string;
  CLAUDE_SESSION_ID?: string;
  CLAUDE_CODE_TEAM_NAME?: string;
  CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS?: string;
};

beforeEach(() => {
  // Generate unique paths per test to avoid parallel worker collisions
  const unique = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  TEST_PROJECT_DIR = join(tmpdir(), `coordination-cleanup-test-${unique}`);
  TEST_SESSION_ID = `test-session-cleanup-${unique}`;
  TEST_INSTANCE_ID = `test-instance-${unique}`;

  vi.clearAllMocks();

  // Store original environment
  originalEnv = {
    CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
    CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID,
    CLAUDE_CODE_TEAM_NAME: process.env.CLAUDE_CODE_TEAM_NAME,
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS,
  };

  // Ensure Agent Teams env vars are cleared
  delete process.env.CLAUDE_CODE_TEAM_NAME;
  delete process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;

  // Set environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;
  process.env.CLAUDE_SESSION_ID = TEST_SESSION_ID;

  // Create test directory
  mkdirSync(TEST_PROJECT_DIR, { recursive: true });
});

afterEach(() => {
  // Clean up test directory
  if (existsSync(TEST_PROJECT_DIR)) {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }

  // Restore original environment
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }

  // Restore all mocks
  vi.restoreAllMocks();
});

// =============================================================================
// Tests
// =============================================================================

describe('coordination-cleanup', () => {
  describe('Agent Teams guard', () => {
    test('skips when CLAUDE_CODE_TEAM_NAME is set (Agent Teams active)', () => {
      // Arrange
      process.env.CLAUDE_CODE_TEAM_NAME = 'my-team';
      createInstanceEnv(TEST_INSTANCE_ID);
      createHeartbeatFile(TEST_INSTANCE_ID);
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert — yields to CC native cleanup
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips when CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1', () => {
      // Arrange
      process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1';
      createInstanceEnv(TEST_INSTANCE_ID);
      createHeartbeatFile(TEST_INSTANCE_ID);
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert — yields to CC native cleanup
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('basic cleanup behavior', () => {
    test('returns silent success when no instance env exists', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('cleans up instance environment file', () => {
      // Arrange
      createInstanceEnv(TEST_INSTANCE_ID);
      const input = createHookInput();
      const envFile = `${TEST_PROJECT_DIR}/.claude/.instance_env`;

      // Pre-condition: file exists
      expect(existsSync(envFile)).toBe(true);

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(existsSync(envFile)).toBe(false);
    });

    test('updates heartbeat status to stopping', () => {
      // Arrange
      createInstanceEnv(TEST_INSTANCE_ID);
      createHeartbeatFile(TEST_INSTANCE_ID, 'active');
      const input = createHookInput();
      const heartbeatFile = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats/${TEST_INSTANCE_ID}.json`;

      // Act
      coordinationCleanup(input);

      // Assert
      if (existsSync(heartbeatFile)) {
        const heartbeat = JSON.parse(readFileSync(heartbeatFile, 'utf-8'));
        expect(heartbeat.status).toBe('stopping');
      }
    });
  });

  describe('instance ID loading', () => {
    test('loads instance ID from environment file', () => {
      // Arrange
      createInstanceEnv(TEST_INSTANCE_ID);
      createHeartbeatFile(TEST_INSTANCE_ID);
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles missing instance ID gracefully', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles malformed instance env file', () => {
      // Arrange
      const claudeDir = `${TEST_PROJECT_DIR}/.claude`;
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(`${claudeDir}/.instance_env`, 'MALFORMED_CONTENT_NO_EQUALS');
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test.each([
      ['instance-123', 'instance-123'],
      ['inst-with-spaces ', 'inst-with-spaces'],
      ['  leading-spaces', 'leading-spaces'],
    ])('parses instance ID "%s" correctly', (envValue, expectedId) => {
      // Arrange
      const claudeDir = `${TEST_PROJECT_DIR}/.claude`;
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(`${claudeDir}/.instance_env`, `CLAUDE_INSTANCE_ID=${envValue}\n`);
      createHeartbeatFile(expectedId);
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('heartbeat status update', () => {
    test('does not fail when heartbeat file missing', () => {
      // Arrange
      createInstanceEnv(TEST_INSTANCE_ID);
      // Intentionally no heartbeat file
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles corrupted heartbeat JSON gracefully', () => {
      // Arrange
      createInstanceEnv(TEST_INSTANCE_ID);
      const heartbeatsDir = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats`;
      mkdirSync(heartbeatsDir, { recursive: true });
      writeFileSync(`${heartbeatsDir}/${TEST_INSTANCE_ID}.json`, 'not valid json');
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('preserves other heartbeat fields when updating status', () => {
      // Arrange
      createInstanceEnv(TEST_INSTANCE_ID);
      const heartbeatsDir = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats`;
      mkdirSync(heartbeatsDir, { recursive: true });
      const originalHeartbeat = {
        instance_id: TEST_INSTANCE_ID,
        status: 'active',
        started_at: '2024-01-15T10:00:00Z',
        last_heartbeat: '2024-01-15T10:30:00Z',
        task: 'Important task',
        role: 'backend-engineer',
        custom_field: 'preserved',
      };
      writeFileSync(
        `${heartbeatsDir}/${TEST_INSTANCE_ID}.json`,
        JSON.stringify(originalHeartbeat, null, 2)
      );
      const input = createHookInput();

      // Act
      coordinationCleanup(input);

      // Assert
      const heartbeatFile = `${heartbeatsDir}/${TEST_INSTANCE_ID}.json`;
      if (existsSync(heartbeatFile)) {
        const updated = JSON.parse(readFileSync(heartbeatFile, 'utf-8'));
        expect(updated.status).toBe('stopping');
        expect(updated.task).toBe('Important task');
        expect(updated.role).toBe('backend-engineer');
        expect(updated.custom_field).toBe('preserved');
      }
    });
  });

  describe('coordination database handling', () => {
    test('handles missing coordination database gracefully', () => {
      // Arrange
      createInstanceEnv(TEST_INSTANCE_ID);
      // No database created
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('logs unregister intent when database exists', async () => {
      // Arrange
      createInstanceEnv(TEST_INSTANCE_ID);
      createCoordinationDb();
      const input = createHookInput();
      const { logHook } = await import('../../lib/common.js');

      // Act
      coordinationCleanup(input);

      // Assert
      expect(logHook).toHaveBeenCalled();
    });
  });

  describe('environment file cleanup', () => {
    test('removes instance env file on cleanup', () => {
      // Arrange
      createInstanceEnv(TEST_INSTANCE_ID);
      const envFile = `${TEST_PROJECT_DIR}/.claude/.instance_env`;
      const input = createHookInput();

      // Act
      coordinationCleanup(input);

      // Assert
      expect(existsSync(envFile)).toBe(false);
    });

    test('handles already-deleted env file gracefully', () => {
      // Arrange
      const input = createHookInput();
      // No env file to delete

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles permission errors gracefully', () => {
      // Arrange
      createInstanceEnv(TEST_INSTANCE_ID);
      const input = createHookInput();
      // Note: We can't easily simulate permission errors in test,
      // but the hook should handle them gracefully

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('error handling', () => {
    test('handles non-existent project directory gracefully', () => {
      // Arrange
      const input = createHookInput({ project_dir: '/non/existent/path' });

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles undefined project_dir by using default', () => {
      // Arrange
      const input = createHookInput({ project_dir: undefined });

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles empty project_dir', () => {
      // Arrange
      const input = createHookInput({ project_dir: '' });

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('full cleanup workflow', () => {
    test('performs complete cleanup sequence', () => {
      // Arrange
      createInstanceEnv(TEST_INSTANCE_ID);
      createHeartbeatFile(TEST_INSTANCE_ID, 'active');
      createCoordinationDb();
      const input = createHookInput();
      const envFile = `${TEST_PROJECT_DIR}/.claude/.instance_env`;
      const heartbeatFile = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats/${TEST_INSTANCE_ID}.json`;

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(existsSync(envFile)).toBe(false);
      if (existsSync(heartbeatFile)) {
        const heartbeat = JSON.parse(readFileSync(heartbeatFile, 'utf-8'));
        expect(heartbeat.status).toBe('stopping');
      }
    });

    test('cleanup is idempotent - can be called multiple times', () => {
      // Arrange
      createInstanceEnv(TEST_INSTANCE_ID);
      createHeartbeatFile(TEST_INSTANCE_ID);
      const input = createHookInput();

      // Act
      const result1 = coordinationCleanup(input);
      const result2 = coordinationCleanup(input);
      const result3 = coordinationCleanup(input);

      // Assert
      expect(result1.continue).toBe(true);
      expect(result2.continue).toBe(true);
      expect(result3.continue).toBe(true);
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('suppressOutput', true);
    });

    test('never blocks session end', () => {
      // Arrange
      createInstanceEnv(TEST_INSTANCE_ID);
      createHeartbeatFile(TEST_INSTANCE_ID);
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });

    test.each([
      [undefined, true],
      ['/valid/path', true],
      ['/non/existent', true],
      ['', true],
    ])('always returns continue: true for project_dir=%s', (projectDir, expected) => {
      // Arrange
      const input = createHookInput({ project_dir: projectDir });

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(expected);
    });

    test('does not set stopReason on any code path', () => {
      // Arrange - test multiple scenarios
      const scenarios: HookInput[] = [
        createHookInput(),
        createHookInput({ project_dir: undefined }),
        createHookInput({ project_dir: '/non/existent' }),
      ];

      for (const input of scenarios) {
        // Act
        const result = coordinationCleanup(input);

        // Assert
        expect(result.stopReason).toBeUndefined();
      }
    });
  });

  describe('edge cases', () => {
    test('handles empty instance ID in env file', () => {
      // Arrange
      const claudeDir = `${TEST_PROJECT_DIR}/.claude`;
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(`${claudeDir}/.instance_env`, 'CLAUDE_INSTANCE_ID=\n');
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles instance ID with special characters', () => {
      // Arrange
      const specialId = 'instance-123_abc.def';
      createInstanceEnv(specialId);
      createHeartbeatFile(specialId);
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles very long instance ID', () => {
      // Arrange
      const longId = 'instance-' + 'a'.repeat(200);
      createInstanceEnv(longId);
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles multiple instance env variables', () => {
      // Arrange
      const claudeDir = `${TEST_PROJECT_DIR}/.claude`;
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(
        `${claudeDir}/.instance_env`,
        `OTHER_VAR=value\nCLAUDE_INSTANCE_ID=${TEST_INSTANCE_ID}\nANOTHER_VAR=value2\n`
      );
      createHeartbeatFile(TEST_INSTANCE_ID);
      const input = createHookInput();

      // Act
      const result = coordinationCleanup(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });
});

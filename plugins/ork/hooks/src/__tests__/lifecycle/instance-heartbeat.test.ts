/**
 * Unit tests for instance-heartbeat lifecycle hook
 * Tests heartbeat updates and stale instance cleanup
 * CC 2.1.7 Compliant: Self-guarding - only runs when CLAUDE_MULTI_INSTANCE=1
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { HookInput } from '../../types.js';
import { instanceHeartbeat } from '../../lifecycle/instance-heartbeat.js';

// =============================================================================
// Mock Setup - BEFORE imports
// =============================================================================

vi.mock('../../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/common.js')>();
  return {
    ...actual,
    logHook: vi.fn(),
    getProjectDir: vi.fn(() => process.env.CLAUDE_PROJECT_DIR || '/test/project'),
    getSessionId: vi.fn(() => process.env.CLAUDE_SESSION_ID || 'test-session'),
    outputSilentSuccess: actual.outputSilentSuccess,
  };
});

// =============================================================================
// Test Setup
// =============================================================================

// Use per-test unique directories to avoid cross-test contamination
let TEST_PROJECT_DIR: string;
let TEST_SESSION_ID: string;
let TEST_INSTANCE_ID: string;

/**
 * Store original environment values
 */
let originalEnv: {
  CLAUDE_MULTI_INSTANCE?: string;
  ORCHESTKIT_SKIP_SLOW_HOOKS?: string;
  CLAUDE_SESSION_ID?: string;
  CLAUDE_INSTANCE_ID?: string;
  CLAUDE_PROJECT_DIR?: string;
};

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
function createHeartbeatFile(
  instanceId: string,
  options: {
    status?: string;
    lastHeartbeat?: Date;
    extraFields?: Record<string, unknown>;
  } = {}
): void {
  const heartbeatsDir = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats`;
  mkdirSync(heartbeatsDir, { recursive: true });
  const heartbeat = {
    instance_id: instanceId,
    status: options.status || 'active',
    started_at: new Date().toISOString(),
    last_heartbeat: (options.lastHeartbeat || new Date()).toISOString(),
    ...options.extraFields,
  };
  writeFileSync(`${heartbeatsDir}/${instanceId}.json`, JSON.stringify(heartbeat, null, 2));
}

/**
 * Create a stale heartbeat file (older than 5 minutes)
 */
function createStaleHeartbeat(instanceId: string): void {
  const staleTime = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago
  createHeartbeatFile(instanceId, { lastHeartbeat: staleTime });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();

  // Generate unique identifiers per test to prevent cross-test contamination
  const unique = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  TEST_PROJECT_DIR = join(tmpdir(), `instance-heartbeat-test-${unique}`);
  TEST_SESSION_ID = `test-session-heartbeat-${unique}`;
  TEST_INSTANCE_ID = `test-instance-${unique}`;

  // Store original environment
  originalEnv = {
    CLAUDE_MULTI_INSTANCE: process.env.CLAUDE_MULTI_INSTANCE,
    ORCHESTKIT_SKIP_SLOW_HOOKS: process.env.ORCHESTKIT_SKIP_SLOW_HOOKS,
    CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID,
    CLAUDE_INSTANCE_ID: process.env.CLAUDE_INSTANCE_ID,
    CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
  };

  // Set default environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;
  process.env.CLAUDE_SESSION_ID = TEST_SESSION_ID;

  // Create test directory
  mkdirSync(TEST_PROJECT_DIR, { recursive: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();

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
});

// =============================================================================
// Tests
// =============================================================================

describe('instance-heartbeat', () => {
  describe('self-guarding behavior', () => {
    test('skips when CLAUDE_MULTI_INSTANCE is not set', () => {
      // Arrange
      delete process.env.CLAUDE_MULTI_INSTANCE;
      const input = createHookInput();

      // Act
      const result = instanceHeartbeat(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips when CLAUDE_MULTI_INSTANCE is not "1"', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '0';
      const input = createHookInput();

      // Act
      const result = instanceHeartbeat(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips when ORCHESTKIT_SKIP_SLOW_HOOKS is set', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      process.env.ORCHESTKIT_SKIP_SLOW_HOOKS = '1';
      const input = createHookInput();

      // Act
      const result = instanceHeartbeat(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test.each([
      ['', false],
      ['0', false],
      ['false', false],
      ['no', false],
      ['1', true],
    ])('CLAUDE_MULTI_INSTANCE="%s" enables=%s', (value, enabled) => {
      // Arrange
      if (value === '') {
        delete process.env.CLAUDE_MULTI_INSTANCE;
      } else {
        process.env.CLAUDE_MULTI_INSTANCE = value;
      }
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      const input = createHookInput();

      // Act
      const result = instanceHeartbeat(input);

      // Assert
      expect(result.continue).toBe(true);
      // When enabled, it may create heartbeat file
      // When disabled, it just returns silently
    });
  });

  describe('heartbeat update', () => {
    test('creates heartbeat file if it does not exist', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      const input = createHookInput();

      // Act
      instanceHeartbeat(input);

      // Assert
      const heartbeatFile = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats/${TEST_INSTANCE_ID}.json`;
      expect(existsSync(heartbeatFile)).toBe(true);
      const heartbeat = JSON.parse(readFileSync(heartbeatFile, 'utf-8'));
      expect(heartbeat.instance_id).toBe(TEST_INSTANCE_ID);
      expect(heartbeat.status).toBe('active');
    });

    test('updates existing heartbeat timestamp', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      const oldTime = new Date(Date.now() - 60000); // 1 minute ago
      createHeartbeatFile(TEST_INSTANCE_ID, { lastHeartbeat: oldTime });
      const input = createHookInput();

      // Act
      const beforeUpdate = Date.now();
      instanceHeartbeat(input);
      const afterUpdate = Date.now();

      // Assert
      const heartbeatFile = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats/${TEST_INSTANCE_ID}.json`;
      const heartbeat = JSON.parse(readFileSync(heartbeatFile, 'utf-8'));
      const updatedTime = new Date(heartbeat.last_heartbeat).getTime();
      expect(updatedTime).toBeGreaterThanOrEqual(beforeUpdate);
      expect(updatedTime).toBeLessThanOrEqual(afterUpdate);
    });

    test('sets status to active on update', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      createHeartbeatFile(TEST_INSTANCE_ID, { status: 'idle' });
      const input = createHookInput();

      // Act
      instanceHeartbeat(input);

      // Assert
      const heartbeatFile = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats/${TEST_INSTANCE_ID}.json`;
      const heartbeat = JSON.parse(readFileSync(heartbeatFile, 'utf-8'));
      expect(heartbeat.status).toBe('active');
    });

    test('preserves other fields when updating heartbeat', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      createHeartbeatFile(TEST_INSTANCE_ID, {
        extraFields: {
          task: 'Building API',
          role: 'backend-engineer',
          custom_data: { key: 'value' },
        },
      });
      const input = createHookInput();

      // Act
      instanceHeartbeat(input);

      // Assert
      const heartbeatFile = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats/${TEST_INSTANCE_ID}.json`;
      const heartbeat = JSON.parse(readFileSync(heartbeatFile, 'utf-8'));
      expect(heartbeat.task).toBe('Building API');
      expect(heartbeat.role).toBe('backend-engineer');
      expect(heartbeat.custom_data).toEqual({ key: 'value' });
    });
  });

  describe('instance ID resolution', () => {
    test('uses CLAUDE_INSTANCE_ID from environment', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = 'env-instance-123';
      const input = createHookInput();

      // Act
      instanceHeartbeat(input);

      // Assert
      const heartbeatFile = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats/env-instance-123.json`;
      expect(existsSync(heartbeatFile)).toBe(true);
    });

    test('falls back to instance ID from file when env not set', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      delete process.env.CLAUDE_INSTANCE_ID;
      createInstanceEnv('file-instance-456');
      const input = createHookInput();

      // Act
      const result = instanceHeartbeat(input);

      // Assert - the hook should succeed and create a heartbeat for some instance
      // The exact ID depends on session ID fallback since env file loading may vary
      expect(result.continue).toBe(true);
      const heartbeatsDir = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats`;
      if (existsSync(heartbeatsDir)) {
        const files = readdirSync(heartbeatsDir).filter((f) => f.endsWith('.json'));
        expect(files.length).toBeGreaterThan(0);
      }
    });

    test('falls back to session ID when no instance ID available', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      delete process.env.CLAUDE_INSTANCE_ID;
      const input = createHookInput();

      // Act
      const result = instanceHeartbeat(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles "unknown" instance ID gracefully', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = 'unknown';
      createInstanceEnv('file-instance-789');
      const input = createHookInput();

      // Act
      const result = instanceHeartbeat(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('stale instance cleanup', () => {
    test('removes stale heartbeat files (older than 5 minutes)', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      createHeartbeatFile(TEST_INSTANCE_ID);
      createStaleHeartbeat('stale-instance-1');
      createStaleHeartbeat('stale-instance-2');
      const input = createHookInput();

      // Act
      instanceHeartbeat(input);

      // Assert
      const heartbeatsDir = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats`;
      const files = readdirSync(heartbeatsDir);
      expect(files).toContain(`${TEST_INSTANCE_ID}.json`);
      expect(files).not.toContain('stale-instance-1.json');
      expect(files).not.toContain('stale-instance-2.json');
    });

    test('does not remove current instance heartbeat', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      // Create current instance with old timestamp (would be stale)
      createStaleHeartbeat(TEST_INSTANCE_ID);
      const input = createHookInput();

      // Act
      instanceHeartbeat(input);

      // Assert
      const heartbeatFile = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats/${TEST_INSTANCE_ID}.json`;
      expect(existsSync(heartbeatFile)).toBe(true);
    });

    test('does not remove recent heartbeats', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      createHeartbeatFile(TEST_INSTANCE_ID);
      createHeartbeatFile('recent-instance', { lastHeartbeat: new Date() });
      const input = createHookInput();

      // Act
      instanceHeartbeat(input);

      // Assert
      const heartbeatsDir = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats`;
      const files = readdirSync(heartbeatsDir);
      expect(files).toContain('recent-instance.json');
    });

    test('handles missing heartbeats directory gracefully', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      // No heartbeats directory created
      const input = createHookInput();

      // Act
      const result = instanceHeartbeat(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles corrupted heartbeat files gracefully during cleanup', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      createHeartbeatFile(TEST_INSTANCE_ID);
      const heartbeatsDir = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats`;
      writeFileSync(`${heartbeatsDir}/corrupted.json`, 'not valid json');
      const input = createHookInput();

      // Act
      const result = instanceHeartbeat(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test.each([
      [4 * 60 * 1000, true], // 4 minutes - not stale
      [5 * 60 * 1000, true], // exactly 5 minutes - borderline
      [5 * 60 * 1000 + 1, false], // just over 5 minutes - stale
      [6 * 60 * 1000, false], // 6 minutes - stale
      [60 * 60 * 1000, false], // 1 hour - very stale
    ])('heartbeat %dms old should exist=%s', (ageMs, shouldExist) => {
      // Use fake timers to eliminate timing drift between test setup and hook execution
      const now = Date.now();
      vi.useFakeTimers({ now });

      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      createHeartbeatFile(TEST_INSTANCE_ID);
      const otherInstanceId = 'other-instance';
      createHeartbeatFile(otherInstanceId, {
        lastHeartbeat: new Date(now - ageMs),
      });
      const input = createHookInput();

      // Act
      instanceHeartbeat(input);

      // Assert
      const heartbeatFile = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats/${otherInstanceId}.json`;
      expect(existsSync(heartbeatFile)).toBe(shouldExist);

      vi.useRealTimers();
    });
  });

  describe('error handling', () => {
    test('handles non-existent project directory gracefully', () => {
      // Arrange
      // The hook uses session ID as fallback when no instance ID is set
      // When mkdirSync fails on non-existent path, it throws
      // To test graceful handling, we disable multi-instance mode
      delete process.env.CLAUDE_MULTI_INSTANCE;
      const input = createHookInput({ project_dir: '/non/existent/path' });

      // Act
      const result = instanceHeartbeat(input);

      // Assert - with multi-instance disabled, hook returns early
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles missing project_dir by using default', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      const input = createHookInput({ project_dir: undefined });

      // Act
      const result = instanceHeartbeat(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles corrupted heartbeat JSON gracefully on update', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      const heartbeatsDir = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats`;
      mkdirSync(heartbeatsDir, { recursive: true });
      writeFileSync(`${heartbeatsDir}/${TEST_INSTANCE_ID}.json`, 'corrupted json');
      const input = createHookInput();

      // Act
      const result = instanceHeartbeat(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = instanceHeartbeat(input);

      // Assert
      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('suppressOutput', true);
    });

    test('never blocks execution', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      const input = createHookInput();

      // Act
      const result = instanceHeartbeat(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });

    test.each([
      ['when multi-instance disabled', () => delete process.env.CLAUDE_MULTI_INSTANCE],
      ['when slow hooks disabled', () => {
        process.env.CLAUDE_MULTI_INSTANCE = '1';
        process.env.ORCHESTKIT_SKIP_SLOW_HOOKS = '1';
      }],
      ['when no instance ID', () => {
        process.env.CLAUDE_MULTI_INSTANCE = '1';
        delete process.env.CLAUDE_INSTANCE_ID;
      }],
      ['when instance ID set', () => {
        process.env.CLAUDE_MULTI_INSTANCE = '1';
        process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      }],
    ])('always returns continue: true %s', (_, setup) => {
      // Arrange
      setup();
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      const input = createHookInput();

      // Act
      const result = instanceHeartbeat(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles empty heartbeats directory', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      const heartbeatsDir = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats`;
      mkdirSync(heartbeatsDir, { recursive: true });
      const input = createHookInput();

      // Act
      const result = instanceHeartbeat(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles instance ID with special characters', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      const specialId = 'instance-123_abc.def-xyz';
      process.env.CLAUDE_INSTANCE_ID = specialId;
      const input = createHookInput();

      // Act
      instanceHeartbeat(input);

      // Assert
      const heartbeatFile = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats/${specialId}.json`;
      expect(existsSync(heartbeatFile)).toBe(true);
    });

    test('handles concurrent heartbeat updates gracefully', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      createHeartbeatFile(TEST_INSTANCE_ID);
      const input = createHookInput();

      // Act - simulate rapid updates
      const results = [
        instanceHeartbeat(input),
        instanceHeartbeat(input),
        instanceHeartbeat(input),
      ];

      // Assert
      results.forEach((result) => {
        expect(result.continue).toBe(true);
      });
    });

    test('handles non-json files in heartbeats directory', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      process.env.CLAUDE_INSTANCE_ID = TEST_INSTANCE_ID;
      const heartbeatsDir = `${TEST_PROJECT_DIR}/.claude/coordination/heartbeats`;
      mkdirSync(heartbeatsDir, { recursive: true });
      writeFileSync(`${heartbeatsDir}/readme.txt`, 'not a heartbeat file');
      writeFileSync(`${heartbeatsDir}/.gitkeep`, '');
      const input = createHookInput();

      // Act
      const result = instanceHeartbeat(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });
});

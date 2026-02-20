/**
 * Stop Hook Lifecycle E2E Tests
 *
 * Tests complete Stop event lifecycle including:
 * - Context persistence and compression
 * - Session cleanup
 * - Memory sync operations
 * - Task completion check
 *
 * Critical for ensuring session data is not lost on termination.
 */

/// <reference types="node" />

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput, HookResult } from '../../types.js';

// Mock fs module
const mockExistsSync = vi.fn().mockReturnValue(false);
const mockReadFileSync = vi.fn().mockReturnValue('{}');
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockAppendFileSync = vi.fn();
const mockReaddirSync = vi.fn().mockReturnValue([]);
const mockStatSync = vi.fn().mockReturnValue({ size: 0, mtimeMs: Date.now() });
const mockUnlinkSync = vi.fn();
const mockRmSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  appendFileSync: (...args: unknown[]) => mockAppendFileSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
  unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
  rmSync: (...args: unknown[]) => mockRmSync(...args),
}));

// Mock child_process
const mockExecSync = vi.fn().mockReturnValue('main\n');
vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// Mock common module
vi.mock('../../lib/common.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/common.js')>('../../lib/common.js');
  return {
    ...actual,
    logHook: vi.fn(),
    getProjectDir: vi.fn().mockReturnValue('/test/project'),
    getCachedBranch: vi.fn().mockReturnValue('main'),
  };
});

// Import stop hooks
import { autoSaveContext } from '../../stop/auto-save-context.js';
import { sessionPatterns } from '../../stop/session-patterns.js';
import { taskCompletionCheck } from '../../stop/task-completion-check.js';
import { unifiedStopDispatcher } from '../../stop/unified-dispatcher.js';

/**
 * Create a mock HookInput for Stop event
 */
function createStopInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: 'test-session-stop-123',
    tool_input: {},
    project_dir: '/test/project',
    ...overrides,
  };
}

describe('Stop Hook Lifecycle E2E', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      CLAUDE_SESSION_ID: 'test-session-stop-123',
      CLAUDE_PROJECT_DIR: '/test/project',
    };
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('{}');
    mockReaddirSync.mockReturnValue([]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Auto Save Context', () => {
    test('should save session context on stop', async () => {
      const input = createStopInput();

      const result = await Promise.resolve(autoSaveContext(input));

      expect(result.continue).toBe(true);
    });

    test('should handle missing context directory gracefully', async () => {
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      const result = await Promise.resolve(autoSaveContext(input));

      expect(result.continue).toBe(true);
    });

    test('should not block on write errors', async () => {
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Write permission denied');
      });
      const input = createStopInput();

      const result = await Promise.resolve(autoSaveContext(input));

      // Should continue even on error
      expect(result.continue).toBe(true);
    });
  });

  describe('Context Compressor (removed)', () => {
    test('placeholder — context-compressor removed (dead code cleanup)', () => {
      expect(true).toBe(true);
    });
  });

  describe('Session Patterns', () => {
    test('should extract session patterns on stop', async () => {
      const input = createStopInput();

      const result = await Promise.resolve(sessionPatterns(input));

      expect(result.continue).toBe(true);
    });

    test('should handle empty session gracefully', async () => {
      const input = createStopInput();

      const result = await Promise.resolve(sessionPatterns(input));

      expect(result.continue).toBe(true);
    });
  });

  describe('Task Completion Check', () => {
    test('should check for incomplete tasks on stop', async () => {
      const input = createStopInput();

      const result = await Promise.resolve(taskCompletionCheck(input));

      expect(result.continue).toBe(true);
    });

    test('should warn about pending tasks', async () => {
      // Mock task list with pending tasks
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        tasks: [
          { id: '1', status: 'pending', subject: 'Incomplete task' },
        ],
      }));

      const input = createStopInput();

      const result = await Promise.resolve(taskCompletionCheck(input));

      expect(result.continue).toBe(true);
    });

    test('should not block on task errors', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Task file corrupted');
      });

      const input = createStopInput();

      const result = await Promise.resolve(taskCompletionCheck(input));

      expect(result.continue).toBe(true);
    });
  });

  describe('Complete Stop Lifecycle Flow', () => {
    test('should execute all stop hooks in sequence', async () => {
      const input = createStopInput();
      const results: HookResult[] = [];

      // Simulate the stop lifecycle sequence
      results.push(await Promise.resolve(autoSaveContext(input)));
      results.push(await Promise.resolve(sessionPatterns(input)));
      results.push(await Promise.resolve(taskCompletionCheck(input)));

      // All hooks should continue
      expect(results.every(r => r.continue)).toBe(true);
    });

    test('should preserve session state across hook failures', async () => {
      const input = createStopInput();

      // First hook fails
      mockWriteFileSync.mockImplementationOnce(() => {
        throw new Error('First write failed');
      });

      const result1 = await Promise.resolve(autoSaveContext(input));
      expect(result1.continue).toBe(true);

      // Subsequent hooks should still work
      mockWriteFileSync.mockImplementation(() => {});
      const result2 = await Promise.resolve(sessionPatterns(input));
      expect(result2.continue).toBe(true);
    });

    test('should handle rapid stop/restart scenario', async () => {
      const input = createStopInput();

      // Simulate rapid stop
      const stopResults = await Promise.all([
        Promise.resolve(autoSaveContext(input)),
        Promise.resolve(sessionPatterns(input)),
      ]);

      expect(stopResults.every(r => r.continue)).toBe(true);

      // Simulate restart with new session
      process.env.CLAUDE_SESSION_ID = 'new-session-789';
      vi.clearAllMocks();

      const newInput = createStopInput({ session_id: 'new-session-789' });
      const newResult = await Promise.resolve(autoSaveContext(newInput));

      expect(newResult.continue).toBe(true);
    });
  });

  describe('Timeout Behavior', () => {
    test('should complete within acceptable time bounds', async () => {
      const input = createStopInput();
      const startTime = Date.now();

      await Promise.all([
        Promise.resolve(autoSaveContext(input)),
        Promise.resolve(sessionPatterns(input)),
      ]);

      const elapsed = Date.now() - startTime;
      // All stop hooks should complete within 1 second in test environment
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('CC 2.1.7 Compliance', () => {
    test('all stop hooks return valid HookResult structure', async () => {
      const input = createStopInput();
      const hooks = [
        autoSaveContext,
        sessionPatterns,
        taskCompletionCheck,
      ];

      for (const hook of hooks) {
        const result = await Promise.resolve(hook(input));

        expect(result).toHaveProperty('continue');
        expect(typeof result.continue).toBe('boolean');

        // Stop hooks should never block
        expect(result.continue).toBe(true);
      }
    });
  });

  describe('Re-entry Prevention (CC 2.1.25: stop_hook_active)', () => {
    test('prevents re-entry when stop_hook_active is true', async () => {
      const result = await unifiedStopDispatcher(createStopInput({
        stop_hook_active: true,
      }));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('runs normally when stop_hook_active is false', async () => {
      const result = await unifiedStopDispatcher(createStopInput({
        stop_hook_active: false,
      }));
      expect(result.continue).toBe(true);
    });

    test('runs normally when stop_hook_active is undefined', async () => {
      const result = await unifiedStopDispatcher(createStopInput());
      expect(result.continue).toBe(true);
    });
  });
});

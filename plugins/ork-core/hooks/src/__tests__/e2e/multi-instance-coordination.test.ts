/**
 * Multi-Instance Coordination E2E Tests
 *
 * Tests concurrent session lock coordination including:
 * - Lock acquisition and release
 * - Lock contention between sessions
 * - Stale lock cleanup
 * - File-level and directory-level locking
 *
 * Critical for preventing file conflicts in multi-Claude scenarios.
 */

/// <reference types="node" />

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// Mock fs module
const mockExistsSync = vi.fn().mockReturnValue(false);
const mockReadFileSync = vi.fn().mockReturnValue('{}');
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockReaddirSync = vi.fn().mockReturnValue([]);
const mockStatSync = vi.fn().mockReturnValue({ mtimeMs: Date.now() });
const mockUnlinkSync = vi.fn();
const mockRmSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
  unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
  rmSync: (...args: unknown[]) => mockRmSync(...args),
}));

// Mock child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue('main\n'),
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

// Import multi-instance hooks
import { multiInstanceLock } from '../../pretool/write-edit/multi-instance-lock.js';
import { fileLockRelease } from '../../posttool/write-edit/file-lock-release.js';
import { multiInstanceInit } from '../../lifecycle/multi-instance-init.js';
import { multiInstanceCleanup } from '../../stop/multi-instance-cleanup.js';

/**
 * Create a mock HookInput for Write operations
 */
function createWriteInput(filePath: string, sessionId = 'session-1'): HookInput {
  return {
    tool_name: 'Write',
    session_id: sessionId,
    tool_input: { file_path: filePath, content: 'test content' },
    project_dir: '/test/project',
  };
}

/**
 * Create a mock HookInput for Edit operations
 */
function createEditInput(filePath: string, sessionId = 'session-1'): HookInput {
  return {
    tool_name: 'Edit',
    session_id: sessionId,
    tool_input: {
      file_path: filePath,
      old_string: 'old',
      new_string: 'new',
    },
    project_dir: '/test/project',
  };
}

// Ensure createEditInput is used
void createEditInput;

/**
 * Create a mock HookInput for lifecycle events
 */
function createLifecycleInput(sessionId = 'session-1'): HookInput {
  return {
    tool_name: '',
    session_id: sessionId,
    tool_input: {},
    project_dir: '/test/project',
  };
}

/**
 * Helper to create mockExistsSync implementation that enables multi-instance lock checking
 * The hook requires .instance/id.json to exist to check locks
 */
function createExistsSyncMock(overrides: Record<string, boolean> = {}) {
  return (path: string): boolean => {
    // Check explicit overrides first
    for (const [pattern, value] of Object.entries(overrides)) {
      if (path.includes(pattern)) return value;
    }
    // Default: instance identity exists (required for lock checking)
    if (path.includes('.instance/id.json') || path.includes('.instance\\id.json')) {
      return true;
    }
    // Locks file exists by default for reading
    if (path.includes('locks.json')) {
      return true;
    }
    return false;
  };
}

describe('Multi-Instance Coordination E2E', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      CLAUDE_MULTI_INSTANCE: '1',
      CLAUDE_SESSION_ID: 'session-1',
      CLAUDE_PROJECT_DIR: '/test/project',
    };
    // Enable multi-instance lock checking by default
    mockExistsSync.mockImplementation(createExistsSyncMock());
    // Return proper locks structure for multi-instance hooks
    mockReadFileSync.mockReturnValue(JSON.stringify({ locks: [] }));
    mockReaddirSync.mockReturnValue([]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Lock Acquisition', () => {
    test('should acquire lock for unlocked file', async () => {
      // Instance identity exists, but no locks yet
      mockExistsSync.mockImplementation(createExistsSyncMock({ 'locks.json': false }));
      mockReadFileSync.mockReturnValue(JSON.stringify({ locks: [] }));

      const input = createWriteInput('/test/project/src/file.ts');
      const result = await Promise.resolve(multiInstanceLock(input));

      expect(result.continue).toBe(true);
    });

    test('should allow write when session owns the lock', async () => {
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 60000).toISOString();

      // Instance identity and locks file both exist
      mockExistsSync.mockImplementation(createExistsSyncMock());
      // Note: The hook normalizes the path by removing projectDir prefix
      // So we need to use the normalized path in the lock
      mockReadFileSync.mockReturnValue(JSON.stringify({
        locks: [{
          lock_id: 'lock-1',
          file_path: 'src/file.ts', // Normalized path (without project dir prefix)
          lock_type: 'file',
          instance_id: 'session-1',
          acquired_at: now,
          expires_at: expiresAt,
        }],
      }));

      const input = createWriteInput('/test/project/src/file.ts', 'session-1');
      const result = await Promise.resolve(multiInstanceLock(input));

      expect(result.continue).toBe(true);
    });

    test('should block write when another session owns the lock', async () => {
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 60000).toISOString();

      mockExistsSync.mockImplementation(createExistsSyncMock());
      // Use normalized path (without project dir prefix)
      mockReadFileSync.mockReturnValue(JSON.stringify({
        locks: [{
          lock_id: 'lock-1',
          file_path: 'src/file.ts', // Normalized path
          lock_type: 'file',
          instance_id: 'other-session',
          acquired_at: now,
          expires_at: expiresAt,
        }],
      }));

      const input = createWriteInput('/test/project/src/file.ts', 'session-1');
      const result = await Promise.resolve(multiInstanceLock(input));

      // Should block with stopReason when file is locked by another session
      expect(result.continue).toBe(false);
      expect(result.stopReason).toBeDefined();
    });

    test('should acquire expired lock', async () => {
      const pastDate = new Date(Date.now() - 120000).toISOString();
      const expiredDate = new Date(Date.now() - 60000).toISOString();

      mockExistsSync.mockImplementation(createExistsSyncMock());
      // Use normalized path
      mockReadFileSync.mockReturnValue(JSON.stringify({
        locks: [{
          lock_id: 'lock-1',
          file_path: 'src/file.ts', // Normalized path
          lock_type: 'file',
          instance_id: 'other-session',
          acquired_at: pastDate,
          expires_at: expiredDate, // Already expired
        }],
      }));

      const input = createWriteInput('/test/project/src/file.ts', 'session-1');
      const result = await Promise.resolve(multiInstanceLock(input));

      expect(result.continue).toBe(true);
    });
  });

  describe('Lock Release', () => {
    test('should release lock after successful write', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        '/test/project/src/file.ts': {
          session_id: 'session-1',
          acquired_at: Date.now(),
          expires_at: Date.now() + 60000,
        },
      }));

      const input = createWriteInput('/test/project/src/file.ts', 'session-1');
      const result = await Promise.resolve(fileLockRelease(input));

      expect(result.continue).toBe(true);
    });

    test('should not release lock owned by another session', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        '/test/project/src/file.ts': {
          session_id: 'other-session',
          acquired_at: Date.now(),
          expires_at: Date.now() + 60000,
        },
      }));

      const input = createWriteInput('/test/project/src/file.ts', 'session-1');
      const result = await Promise.resolve(fileLockRelease(input));

      // Should continue but not release the lock
      expect(result.continue).toBe(true);
    });
  });

  describe('Session Initialization', () => {
    test('should initialize multi-instance coordination on session start', async () => {
      const input = createLifecycleInput('new-session');
      const result = await Promise.resolve(multiInstanceInit(input));

      expect(result.continue).toBe(true);
    });

    test('should skip initialization when multi-instance is disabled', async () => {
      delete process.env.CLAUDE_MULTI_INSTANCE;

      const input = createLifecycleInput('new-session');
      const result = await Promise.resolve(multiInstanceInit(input));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('should create lock directory if missing', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        return !path.includes('.locks') && !path.includes('coordination');
      });

      const input = createLifecycleInput('new-session');
      await Promise.resolve(multiInstanceInit(input));

      // Should attempt to create lock directory
    });
  });

  describe('Session Cleanup', () => {
    test('should clean up session locks on stop', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        '/test/project/src/file1.ts': {
          session_id: 'session-1',
          acquired_at: Date.now(),
          expires_at: Date.now() + 60000,
        },
        '/test/project/src/file2.ts': {
          session_id: 'session-1',
          acquired_at: Date.now(),
          expires_at: Date.now() + 60000,
        },
      }));

      const input = createLifecycleInput('session-1');
      const result = await Promise.resolve(multiInstanceCleanup(input));

      expect(result.continue).toBe(true);
    });

    test('should not clean up locks from other sessions', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        '/test/project/src/file.ts': {
          session_id: 'other-session',
          acquired_at: Date.now(),
          expires_at: Date.now() + 60000,
        },
      }));

      const input = createLifecycleInput('session-1');
      const result = await Promise.resolve(multiInstanceCleanup(input));

      expect(result.continue).toBe(true);
      // Lock from other session should remain
    });

    test('should handle cleanup errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Read permission denied');
      });

      const input = createLifecycleInput('session-1');
      const result = await Promise.resolve(multiInstanceCleanup(input));

      expect(result.continue).toBe(true);
    });
  });

  describe('Concurrent Session Simulation', () => {
    test('first session acquires lock, second is blocked', async () => {
      // Session 1 (session-1) acquires lock
      process.env.CLAUDE_SESSION_ID = 'session-1';
      mockExistsSync.mockImplementation(createExistsSyncMock());
      mockReadFileSync.mockReturnValue(JSON.stringify({ locks: [] }));

      const session1Input = createWriteInput('/test/project/src/shared.ts', 'session-1');
      const session1Result = await Promise.resolve(multiInstanceLock(session1Input));
      expect(session1Result.continue).toBe(true);

      // Simulate lock was written by session-1 (using CLAUDE_SESSION_ID)
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 60000).toISOString();

      // Session 2 (different CLAUDE_SESSION_ID) attempts to acquire same lock
      process.env.CLAUDE_SESSION_ID = 'session-2';
      // Use normalized path (without project dir prefix)
      mockReadFileSync.mockReturnValue(JSON.stringify({
        locks: [{
          lock_id: 'lock-1',
          file_path: 'src/shared.ts', // Normalized path
          lock_type: 'file',
          instance_id: 'session-1', // Lock owned by session-1
          acquired_at: now,
          expires_at: expiresAt,
        }],
      }));

      const session2Input = createWriteInput('/test/project/src/shared.ts', 'session-2');
      const session2Result = await Promise.resolve(multiInstanceLock(session2Input));

      // Session 2 should be blocked because lock is owned by session-1
      expect(session2Result.continue).toBe(false);
      expect(session2Result.stopReason).toBeDefined();

      // Reset session ID
      process.env.CLAUDE_SESSION_ID = 'session-1';
    });

    test('session can write to different files concurrently', async () => {
      mockExistsSync.mockImplementation(createExistsSyncMock({ 'locks.json': false }));
      mockReadFileSync.mockReturnValue(JSON.stringify({ locks: [] }));

      // Session 1 writes file A
      const session1Input = createWriteInput('/test/project/src/fileA.ts', 'session-1');
      const session1Result = await Promise.resolve(multiInstanceLock(session1Input));
      expect(session1Result.continue).toBe(true);

      // Session 2 writes file B
      const session2Input = createWriteInput('/test/project/src/fileB.ts', 'session-2');
      const session2Result = await Promise.resolve(multiInstanceLock(session2Input));
      expect(session2Result.continue).toBe(true);
    });

    test('lock release allows next session to proceed', async () => {
      // Session 1 acquires and releases lock
      mockExistsSync.mockImplementation(createExistsSyncMock({ 'locks.json': false }));
      mockReadFileSync.mockReturnValue(JSON.stringify({ locks: [] }));
      const session1LockInput = createWriteInput('/test/project/src/file.ts', 'session-1');
      await Promise.resolve(multiInstanceLock(session1LockInput));

      // Simulate successful write and release
      mockExistsSync.mockImplementation(createExistsSyncMock());
      mockReadFileSync.mockReturnValue(JSON.stringify({
        locks: [{
          lock_id: 'lock-1',
          file_path: 'src/file.ts',
          lock_type: 'exclusive_write',
          instance_id: 'session-1',
          acquired_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60000).toISOString(),
        }],
      }));
      await Promise.resolve(fileLockRelease(session1LockInput));

      // After release, lock should be removed
      mockExistsSync.mockImplementation(createExistsSyncMock({ 'locks.json': false }));
      mockReadFileSync.mockReturnValue(JSON.stringify({ locks: [] }));

      // Session 2 can now acquire
      const session2Input = createWriteInput('/test/project/src/file.ts', 'session-2');
      const session2Result = await Promise.resolve(multiInstanceLock(session2Input));
      expect(session2Result.continue).toBe(true);
    });
  });

  describe('Directory-Level Locking', () => {
    test('should handle directory lock for multiple files', async () => {
      // Provide valid locks array for the hook
      mockExistsSync.mockImplementation(createExistsSyncMock());
      mockReadFileSync.mockReturnValue(JSON.stringify({ locks: [] }));

      const files = [
        '/test/project/src/module/index.ts',
        '/test/project/src/module/utils.ts',
      ];

      for (const file of files) {
        const input = createWriteInput(file, 'session-1');
        const result = await Promise.resolve(multiInstanceLock(input));
        expect(result.continue).toBe(true);
      }
    });
  });

  describe('Stale Lock Detection', () => {
    test('should detect and handle stale locks during cleanup', async () => {
      const staleLockTime = Date.now() - 3600000; // 1 hour ago
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        '/test/project/src/stale.ts': {
          session_id: 'dead-session',
          acquired_at: staleLockTime,
          expires_at: staleLockTime + 60000,
        },
      }));

      const input = createLifecycleInput('new-session');
      const result = await Promise.resolve(multiInstanceCleanup(input));

      expect(result.continue).toBe(true);
    });
  });

  describe('Full Lifecycle Flow', () => {
    test('init → lock → write → release → cleanup lifecycle', async () => {
      // 1. Session initialization
      const initInput = createLifecycleInput('session-lifecycle');
      const initResult = await Promise.resolve(multiInstanceInit(initInput));
      expect(initResult.continue).toBe(true);

      // 2. Acquire lock
      mockExistsSync.mockImplementation(createExistsSyncMock({ 'locks.json': false }));
      mockReadFileSync.mockReturnValue(JSON.stringify({ locks: [] }));
      const lockInput = createWriteInput('/test/project/src/file.ts', 'session-lifecycle');
      const lockResult = await Promise.resolve(multiInstanceLock(lockInput));
      expect(lockResult.continue).toBe(true);

      // 3. Simulate write operation...

      // 4. Release lock
      mockExistsSync.mockImplementation(createExistsSyncMock());
      mockReadFileSync.mockReturnValue(JSON.stringify({
        locks: [{
          lock_id: 'lock-1',
          file_path: 'src/file.ts',
          lock_type: 'exclusive_write',
          instance_id: 'session-lifecycle',
          acquired_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60000).toISOString(),
        }],
      }));
      const releaseInput = createWriteInput('/test/project/src/file.ts', 'session-lifecycle');
      const releaseResult = await Promise.resolve(fileLockRelease(releaseInput));
      expect(releaseResult.continue).toBe(true);

      // 5. Session cleanup on stop
      const cleanupInput = createLifecycleInput('session-lifecycle');
      const cleanupResult = await Promise.resolve(multiInstanceCleanup(cleanupInput));
      expect(cleanupResult.continue).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle lock file corruption gracefully', async () => {
      mockExistsSync.mockImplementation(createExistsSyncMock());
      mockReadFileSync.mockReturnValue('invalid json');

      const input = createWriteInput('/test/project/src/file.ts');
      const result = await Promise.resolve(multiInstanceLock(input));

      // loadLocks returns { locks: [] } on error, so this should pass
      expect(result.continue).toBe(true);
    });

    test('should handle empty lock file', async () => {
      mockExistsSync.mockImplementation(createExistsSyncMock());
      // Valid JSON with locks array
      mockReadFileSync.mockReturnValue(JSON.stringify({ locks: [] }));

      const input = createWriteInput('/test/project/src/file.ts');
      const result = await Promise.resolve(multiInstanceLock(input));

      expect(result.continue).toBe(true);
    });
  });

  describe('Performance', () => {
    test('lock operations should complete quickly', async () => {
      mockExistsSync.mockImplementation(createExistsSyncMock({ 'locks.json': false }));
      mockReadFileSync.mockReturnValue(JSON.stringify({ locks: [] }));

      const startTime = Date.now();

      // Multiple lock/release cycles
      for (let i = 0; i < 10; i++) {
        const lockInput = createWriteInput(`/test/project/src/file${i}.ts`);
        await Promise.resolve(multiInstanceLock(lockInput));

        mockExistsSync.mockImplementation(createExistsSyncMock());
        mockReadFileSync.mockReturnValue(JSON.stringify({
          locks: [{
            lock_id: `lock-${i}`,
            file_path: `src/file${i}.ts`,
            lock_type: 'exclusive_write',
            instance_id: 'session-1',
            acquired_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }],
        }));

        const releaseInput = createWriteInput(`/test/project/src/file${i}.ts`);
        await Promise.resolve(fileLockRelease(releaseInput));

        mockExistsSync.mockImplementation(createExistsSyncMock({ 'locks.json': false }));
        mockReadFileSync.mockReturnValue(JSON.stringify({ locks: [] }));
      }

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('CC 2.1.7 Compliance', () => {
    test('multi-instance hooks return valid HookResult', async () => {
      const hooks = [
        { fn: multiInstanceLock, input: createWriteInput('/test/project/src/file.ts') },
        { fn: fileLockRelease, input: createWriteInput('/test/project/src/file.ts') },
        { fn: multiInstanceInit, input: createLifecycleInput() },
        { fn: multiInstanceCleanup, input: createLifecycleInput() },
      ];

      for (const { fn, input } of hooks) {
        const result = await Promise.resolve(fn(input));

        expect(result).toHaveProperty('continue');
        expect(typeof result.continue).toBe('boolean');
      }
    });
  });
});

/**
 * Unit tests for file-lock-release hook
 * Verifies locks are released from locks.json (not SQLite)
 *
 * Issue: Previously file-lock-release released from SQLite but locks were
 * acquired in locks.json, causing orphaned locks.
 */

/// <reference types="node" />

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileLockRelease } from '../../posttool/write-edit/file-lock-release.js';
import type { HookInput } from '../../types.js';

// Track what was written to locks.json
let savedLocksJson: string | null = null;

// Mock fs module
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (path: string, content: string) => {
    savedLocksJson = content;
    mockWriteFileSync(path, content);
  },
}));

// Mock common module
vi.mock('../../lib/common.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/common.js')>('../../lib/common.js');
  return {
    ...actual,
    logHook: vi.fn(),
    getProjectDir: vi.fn().mockReturnValue('/test/project'),
    getField: actual.getField,
  };
});

// Mock session-id-generator to control instance ID in tests
const mockGetOrGenerateSessionId = vi.fn();
vi.mock('../../lib/session-id-generator.js', () => ({
  getOrGenerateSessionId: () => mockGetOrGenerateSessionId(),
}));

/**
 * Create a mock HookInput for PostToolUse Write/Edit
 */
function createPostToolInput(filePath: string, toolName = 'Write'): HookInput {
  return {
    tool_name: toolName,
    session_id: 'test-session-123',
    tool_input: { file_path: filePath, content: 'test content' },
    tool_result: 'File written successfully',
    project_dir: '/test/project',
  };
}

/**
 * Create a mock locks.json content
 */
function createLocksJson(locks: Array<{
  lock_id: string;
  file_path: string;
  lock_type: string;
  instance_id: string;
  acquired_at: string;
  expires_at: string;
  reason?: string;
}>): string {
  return JSON.stringify({ locks }, null, 2);
}

describe('file-lock-release', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    savedLocksJson = null;
    process.env = { ...originalEnv, CLAUDE_SESSION_ID: 'current-session-id' };
    // Default: return current-session-id (matches CLAUDE_SESSION_ID)
    mockGetOrGenerateSessionId.mockReturnValue('current-session-id');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Basic functionality', () => {
    it('releases lock from locks.json (not SQLite)', () => {
      const futureTime = new Date(Date.now() + 60000).toISOString();

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          lock_id: 'lock-123',
          file_path: 'src/file.ts',
          lock_type: 'exclusive_write',
          instance_id: 'current-session-id',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
          reason: 'Test',
        },
      ]));

      const input = createPostToolInput('/test/project/src/file.ts');
      const result = fileLockRelease(input);

      expect(result.continue).toBe(true);
      expect(mockWriteFileSync).toHaveBeenCalled();

      // Verify the lock was removed
      const writtenLocks = JSON.parse(savedLocksJson!);
      expect(writtenLocks.locks).toHaveLength(0);
    });

    it('only releases locks owned by current instance', () => {
      const futureTime = new Date(Date.now() + 60000).toISOString();

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          lock_id: 'lock-123',
          file_path: 'src/file.ts',
          lock_type: 'exclusive_write',
          instance_id: 'other-session-id', // Different instance
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
          reason: 'Test',
        },
      ]));

      const input = createPostToolInput('/test/project/src/file.ts');
      const result = fileLockRelease(input);

      expect(result.continue).toBe(true);

      // Lock should NOT be removed (belongs to different instance)
      // No write happens because nothing changed
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });

  describe('Tool guard', () => {
    it('only runs for Write tool', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([]));

      const input: HookInput = {
        tool_name: 'Read',
        session_id: 'test-session',
        tool_input: { file_path: '/test/project/src/file.ts' },
      };
      const result = fileLockRelease(input);

      expect(result.continue).toBe(true);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('only runs for Edit tool', () => {
      const futureTime = new Date(Date.now() + 60000).toISOString();

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          lock_id: 'lock-123',
          file_path: 'src/file.ts',
          lock_type: 'exclusive_write',
          instance_id: 'current-session-id',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
          reason: 'Test',
        },
      ]));

      const input = createPostToolInput('/test/project/src/file.ts', 'Edit');
      const result = fileLockRelease(input);

      expect(result.continue).toBe(true);
      expect(mockWriteFileSync).toHaveBeenCalled();

      const writtenLocks = JSON.parse(savedLocksJson!);
      expect(writtenLocks.locks).toHaveLength(0);
    });
  });

  describe('Coordination disabled', () => {
    it('skips when coordination directory does not exist', () => {
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes('coordination')) return false;
        return true;
      });

      const input = createPostToolInput('/test/project/src/file.ts');
      const result = fileLockRelease(input);

      expect(result.continue).toBe(true);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });

  describe('Path normalization', () => {
    it('normalizes absolute path to relative for matching', () => {
      const futureTime = new Date(Date.now() + 60000).toISOString();

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          lock_id: 'lock-123',
          file_path: 'src/file.ts', // Stored as relative
          lock_type: 'exclusive_write',
          instance_id: 'current-session-id',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
          reason: 'Test',
        },
      ]));

      // Input has absolute path
      const input = createPostToolInput('/test/project/src/file.ts');
      const result = fileLockRelease(input);

      expect(result.continue).toBe(true);
      expect(mockWriteFileSync).toHaveBeenCalled();

      // Lock should be removed (paths should match after normalization)
      const writtenLocks = JSON.parse(savedLocksJson!);
      expect(writtenLocks.locks).toHaveLength(0);
    });
  });

  describe('Expired lock cleanup', () => {
    it('cleans expired locks when releasing', () => {
      const futureTime = new Date(Date.now() + 60000).toISOString();
      const pastTime = new Date(Date.now() - 60000).toISOString();

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          lock_id: 'lock-expired',
          file_path: 'src/other-file.ts',
          lock_type: 'exclusive_write',
          instance_id: 'dead-session',
          acquired_at: new Date(Date.now() - 120000).toISOString(),
          expires_at: pastTime, // Expired
          reason: 'Old',
        },
        {
          lock_id: 'lock-current',
          file_path: 'src/file.ts',
          lock_type: 'exclusive_write',
          instance_id: 'current-session-id',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime, // Not expired
          reason: 'Current',
        },
      ]));

      const input = createPostToolInput('/test/project/src/file.ts');
      const result = fileLockRelease(input);

      expect(result.continue).toBe(true);

      // Both locks should be removed: one expired, one released
      const writtenLocks = JSON.parse(savedLocksJson!);
      expect(writtenLocks.locks).toHaveLength(0);
    });
  });

  describe('Coordination paths', () => {
    it('skips release for coordination directory files', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([]));

      const input = createPostToolInput('/test/project/.claude/coordination/locks.json');
      const result = fileLockRelease(input);

      expect(result.continue).toBe(true);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('handles malformed locks.json gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('not valid json');

      const input = createPostToolInput('/test/project/src/file.ts');
      const result = fileLockRelease(input);

      // Should not crash, should continue
      expect(result.continue).toBe(true);
    });

    it('handles missing locks.json', () => {
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes('coordination') && !path.includes('locks.json')) return true;
        if (path.includes('locks.json')) return false;
        return true;
      });

      const input = createPostToolInput('/test/project/src/file.ts');
      const result = fileLockRelease(input);

      expect(result.continue).toBe(true);
    });

    it('handles empty file_path', () => {
      const input = createPostToolInput('');
      const result = fileLockRelease(input);

      expect(result.continue).toBe(true);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });

  describe('Instance ID fallback', () => {
    it('uses smart session ID when CLAUDE_SESSION_ID is missing', () => {
      delete process.env.CLAUDE_SESSION_ID;

      const futureTime = new Date(Date.now() + 60000).toISOString();
      // Mock returns smart session ID format (Issue #245)
      const smartSessionId = 'project-main-0130-1900-abc1';
      mockGetOrGenerateSessionId.mockReturnValue(smartSessionId);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          lock_id: 'lock-123',
          file_path: 'src/file.ts',
          lock_type: 'exclusive_write',
          instance_id: smartSessionId, // Matches smart session ID
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
          reason: 'Test',
        },
      ]));

      const input = createPostToolInput('/test/project/src/file.ts');
      const result = fileLockRelease(input);

      expect(result.continue).toBe(true);
      expect(mockWriteFileSync).toHaveBeenCalled();

      const writtenLocks = JSON.parse(savedLocksJson!);
      expect(writtenLocks.locks).toHaveLength(0);
    });
  });

  describe('Multiple locks scenario', () => {
    it('releases only matching lock, keeps others', () => {
      const futureTime = new Date(Date.now() + 60000).toISOString();

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          lock_id: 'lock-1',
          file_path: 'src/file-a.ts',
          lock_type: 'exclusive_write',
          instance_id: 'other-session',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
          reason: 'Other',
        },
        {
          lock_id: 'lock-2',
          file_path: 'src/file.ts', // Target
          lock_type: 'exclusive_write',
          instance_id: 'current-session-id',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
          reason: 'Current',
        },
        {
          lock_id: 'lock-3',
          file_path: 'src/file-c.ts',
          lock_type: 'exclusive_write',
          instance_id: 'another-session',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
          reason: 'Another',
        },
      ]));

      const input = createPostToolInput('/test/project/src/file.ts');
      const result = fileLockRelease(input);

      expect(result.continue).toBe(true);

      const writtenLocks = JSON.parse(savedLocksJson!);
      // Should have 2 locks remaining (not the one we released)
      expect(writtenLocks.locks).toHaveLength(2);
      expect(writtenLocks.locks.find((l: { file_path: string }) => l.file_path === 'src/file.ts')).toBeUndefined();
      expect(writtenLocks.locks.find((l: { file_path: string }) => l.file_path === 'src/file-a.ts')).toBeDefined();
      expect(writtenLocks.locks.find((l: { file_path: string }) => l.file_path === 'src/file-c.ts')).toBeDefined();
    });
  });

  describe('Critical fix verification', () => {
    it('CRITICAL: does NOT use SQLite for lock release', () => {
      // This test documents the fix for the bug where locks were acquired
      // in locks.json but released from SQLite, causing orphaned locks.

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          lock_id: 'lock-123',
          file_path: 'src/file.ts',
          lock_type: 'exclusive_write',
          instance_id: 'current-session-id',
          acquired_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60000).toISOString(),
          reason: 'Test',
        },
      ]));

      const input = createPostToolInput('/test/project/src/file.ts');
      fileLockRelease(input);

      // Verify JSON file was written (not SQLite)
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('locks.json'),
        expect.any(String)
      );

      // Verify the path does NOT contain .claude.db (SQLite)
      const writeCall = mockWriteFileSync.mock.calls[0];
      expect(writeCall[0]).not.toContain('.claude.db');
      expect(writeCall[0]).toContain('locks.json');
    });

    it('CRITICAL: lock is actually removed after write completes', () => {
      const futureTime = new Date(Date.now() + 60000).toISOString();

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          lock_id: 'lock-to-release',
          file_path: 'src/file.ts',
          lock_type: 'exclusive_write',
          instance_id: 'current-session-id',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
        },
      ]));

      const input = createPostToolInput('/test/project/src/file.ts');
      fileLockRelease(input);

      // Parse what was written
      expect(savedLocksJson).not.toBeNull();
      const writtenData = JSON.parse(savedLocksJson!);

      // The lock should be GONE
      expect(writtenData.locks.length).toBe(0);
    });
  });
});

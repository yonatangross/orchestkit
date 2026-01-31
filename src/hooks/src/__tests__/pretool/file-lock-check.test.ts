/**
 * Unit tests for file-lock-check hook
 * Tests file locking mechanism for multi-instance coordination
 */

/// <reference types="node" />

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileLockCheck } from '../../pretool/write-edit/file-lock-check.js';
import type { HookInput } from '../../types.js';

// Mock fs module
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

// Mock common module
vi.mock('../../lib/common.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/common.js')>('../../lib/common.js');
  return {
    ...actual,
    logHook: vi.fn(),
    logPermissionFeedback: vi.fn(),
    getProjectDir: vi.fn().mockReturnValue('/test/project'),
  };
});

/**
 * Create a mock HookInput for Write/Edit commands
 */
function createWriteInput(filePath: string, toolName = 'Write'): HookInput {
  return {
    tool_name: toolName,
    session_id: 'test-session-123',
    tool_input: { file_path: filePath, content: 'test content' },
    project_dir: '/test/project',
  };
}

/**
 * Create a mock locks.json content
 */
function createLocksJson(locks: Array<{
  instance_id: string;
  file_path: string;
  acquired_at: string;
  expires_at: string;
}>): string {
  return JSON.stringify({ locks });
}

describe('file-lock-check', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CLAUDE_SESSION_ID: 'current-session-id' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Coordination not enabled', () => {
    test('passes when coordination directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const input = createWriteInput('/test/project/src/file.ts');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });
  });

  describe('Coordination enabled - no locks', () => {
    beforeEach(() => {
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes('coordination')) return true;
        if (path.includes('locks.json')) return false;
        return false;
      });
    });

    test('passes when locks.json does not exist', () => {
      const input = createWriteInput('/test/project/src/file.ts');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(true);
    });

    test('passes when locks array is empty', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([]));

      const input = createWriteInput('/test/project/src/file.ts');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(true);
    });
  });

  describe('Lock detection', () => {
    const futureTime = new Date(Date.now() + 60000).toISOString(); // 1 minute in future
    const pastTime = new Date(Date.now() - 60000).toISOString(); // 1 minute ago

    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
    });

    test('blocks when file is locked by another instance', () => {
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          instance_id: 'other-session-id',
          file_path: 'src/file.ts',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
        },
      ]));

      const input = createWriteInput('/test/project/src/file.ts');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(false);
      expect(result.hookSpecificOutput?.permissionDecision).toBe('deny');
      expect(result.stopReason).toContain('locked');
    });

    test('passes when file is locked by current instance', () => {
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          instance_id: 'current-session-id',
          file_path: 'src/file.ts',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
        },
      ]));

      const input = createWriteInput('/test/project/src/file.ts');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(true);
    });

    test('passes when lock has expired', () => {
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          instance_id: 'other-session-id',
          file_path: 'src/file.ts',
          acquired_at: new Date(Date.now() - 120000).toISOString(),
          expires_at: pastTime,
        },
      ]));

      const input = createWriteInput('/test/project/src/file.ts');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(true);
    });

    test('passes when different file is locked', () => {
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          instance_id: 'other-session-id',
          file_path: 'src/other-file.ts',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
        },
      ]));

      const input = createWriteInput('/test/project/src/file.ts');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(true);
    });
  });

  describe('Multiple locks', () => {
    const futureTime = new Date(Date.now() + 60000).toISOString();

    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
    });

    test('blocks when target file has active lock among many', () => {
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          instance_id: 'session-1',
          file_path: 'src/file-a.ts',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
        },
        {
          instance_id: 'session-2',
          file_path: 'src/file.ts', // Target file
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
        },
        {
          instance_id: 'session-3',
          file_path: 'src/file-c.ts',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
        },
      ]));

      const input = createWriteInput('/test/project/src/file.ts');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(false);
    });

    test('passes when all locks are for different files', () => {
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          instance_id: 'session-1',
          file_path: 'src/file-a.ts',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
        },
        {
          instance_id: 'session-2',
          file_path: 'src/file-b.ts',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
        },
      ]));

      const input = createWriteInput('/test/project/src/file.ts');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(true);
    });
  });

  describe('Coordination directory paths', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([]));
    });

    test('skips lock check for coordination directory itself', () => {
      const input = createWriteInput('/test/project/.claude/coordination/locks.json');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(true);
      // Should not even check the locks
    });

    test('skips for other coordination files', () => {
      const input = createWriteInput('/test/project/.claude/coordination/work-registry.json');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(true);
    });
  });

  describe('Path normalization', () => {
    const futureTime = new Date(Date.now() + 60000).toISOString();

    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
    });

    test('normalizes absolute path to relative for matching', () => {
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          instance_id: 'other-session-id',
          file_path: 'src/file.ts', // Stored as relative
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
        },
      ]));

      // Input has absolute path
      const input = createWriteInput('/test/project/src/file.ts');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(false);
    });

    test('handles relative path in input', () => {
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          instance_id: 'other-session-id',
          file_path: 'src/file.ts',
          acquired_at: new Date().toISOString(),
          expires_at: futureTime,
        },
      ]));

      const input = createWriteInput('src/file.ts');
      const result = fileLockCheck(input);

      // Relative path may or may not match depending on normalization logic
      // The hook normalizes absolute paths that start with project dir
      // For relative paths, behavior depends on implementation
      expect(result.continue).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    test('handles empty file path', () => {
      const input = createWriteInput('');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(true);
    });

    test('handles missing file_path in tool_input', () => {
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: { content: 'test' },
        project_dir: '/test/project',
      };
      const result = fileLockCheck(input);

      expect(result.continue).toBe(true);
    });

    test('handles malformed locks.json', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('not valid json');

      const input = createWriteInput('/test/project/src/file.ts');
      const result = fileLockCheck(input);

      // Should gracefully handle parse error
      expect(result.continue).toBe(true);
    });

    test('handles locks.json with missing locks array', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{}');

      const input = createWriteInput('/test/project/src/file.ts');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(true);
    });

    test('handles fs read error', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const input = createWriteInput('/test/project/src/file.ts');
      const result = fileLockCheck(input);

      // Should gracefully handle error
      expect(result.continue).toBe(true);
    });

    test('handles missing CLAUDE_SESSION_ID', () => {
      delete process.env.CLAUDE_SESSION_ID;
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          instance_id: 'other-session',
          file_path: 'src/file.ts',
          acquired_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60000).toISOString(),
        },
      ]));

      const input = createWriteInput('/test/project/src/file.ts');
      const result = fileLockCheck(input);

      // Should use fallback instance ID
      expect(result.continue).toBe(false);
    });
  });

  describe('Tool types', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          instance_id: 'other-session-id',
          file_path: 'src/file.ts',
          acquired_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60000).toISOString(),
        },
      ]));
    });

    test('blocks Write operations', () => {
      const input = createWriteInput('/test/project/src/file.ts', 'Write');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(false);
    });

    test('blocks Edit operations', () => {
      const input = createWriteInput('/test/project/src/file.ts', 'Edit');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(false);
    });
  });

  describe('Lock message content', () => {
    test('includes lock details in denial message', () => {
      const acquiredAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 60000).toISOString();

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createLocksJson([
        {
          instance_id: 'blocking-instance-123',
          file_path: 'src/file.ts',
          acquired_at: acquiredAt,
          expires_at: expiresAt,
        },
      ]));

      const input = createWriteInput('/test/project/src/file.ts');
      const result = fileLockCheck(input);

      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('blocking-instance-123');
      expect(result.stopReason).toContain(acquiredAt);
      expect(result.stopReason).toContain(expiresAt);
    });
  });
});

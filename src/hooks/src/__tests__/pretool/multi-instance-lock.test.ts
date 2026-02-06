/**
 * Unit tests for multi-instance-lock hook
 * Tests file lock acquisition, conflict detection, coordination guards,
 * and edge cases for Write/Edit operations.
 *
 * Consolidates tests from the removed file-lock-check hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  logPermissionFeedback: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputDeny: vi.fn((reason: string) => ({
    continue: false,
    stopReason: reason,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

vi.mock('../../lib/guards.js', () => ({
  guardWriteEdit: vi.fn(() => null),
}));

vi.mock('../../lib/session-id-generator.js', () => ({
  getOrGenerateSessionId: vi.fn(() => 'instance-abc-123'),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{"locks":[]}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
  dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
}));

import { multiInstanceLock } from '../../pretool/write-edit/multi-instance-lock.js';
import type { HookInput } from '../../types.js';
import { guardWriteEdit } from '../../lib/guards.js';
import { existsSync, readFileSync } from 'node:fs';

function createWriteInput(filePath: string, toolName = 'Write'): HookInput {
  return {
    tool_name: toolName,
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { file_path: filePath, content: 'new content' },
  };
}

/** Helper: mock existsSync so coordination dir exists and locks.json optionally exists */
function enableCoordination(locksExist = true) {
  vi.mocked(existsSync).mockImplementation((p: unknown) => {
    const path = String(p);
    if (path.includes('.claude/coordination')) return true;
    if (locksExist && path.includes('locks.json')) return true;
    return false;
  });
}

describe('multi-instance-lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardWriteEdit).mockReturnValue(null);
    vi.mocked(existsSync).mockReturnValue(false);
  });

  it('returns guard result when tool is not Write or Edit', () => {
    vi.mocked(guardWriteEdit).mockReturnValue({ continue: true, suppressOutput: true });

    const input: HookInput = {
      tool_name: 'Read',
      session_id: 'test-session-123',
      project_dir: '/test/project',
      tool_input: { file_path: '/test/project/src/app.ts' },
    };
    const result = multiInstanceLock(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success for empty file path', () => {
    const input = createWriteInput('');
    const result = multiInstanceLock(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  describe('Coordination not enabled', () => {
    it('passes when coordination directory does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const input = createWriteInput('/test/project/src/file.ts');
      const result = multiInstanceLock(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('Coordination directory paths', () => {
    it('skips lock check for coordination directory itself', () => {
      enableCoordination();

      const input = createWriteInput('/test/project/.claude/coordination/locks.json');
      const result = multiInstanceLock(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('skips for other coordination files', () => {
      enableCoordination();

      const input = createWriteInput('/test/project/.claude/coordination/work-registry.json');
      const result = multiInstanceLock(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('Lock acquisition', () => {
    it('acquires lock when no existing lock for the file', () => {
      enableCoordination(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ locks: [] }));

      const input = createWriteInput('/test/project/src/app.ts');
      const result = multiInstanceLock(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('acquires lock when locks.json does not exist', () => {
      enableCoordination(false);

      const input = createWriteInput('/test/project/src/app.ts');
      const result = multiInstanceLock(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('Lock detection', () => {
    const futureDate = new Date(Date.now() + 60000).toISOString();
    const acquiredAt = new Date().toISOString();

    it('denies when file is locked by another instance', () => {
      enableCoordination();
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          locks: [
            {
              lock_id: 'lock-existing',
              file_path: 'src/app.ts',
              lock_type: 'exclusive_write',
              instance_id: 'other-instance-456',
              acquired_at: acquiredAt,
              expires_at: futureDate,
            },
          ],
        })
      );

      const input = createWriteInput('/test/project/src/app.ts');
      const result = multiInstanceLock(input);

      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('other-instance-456');
    });

    it('passes when file is locked by current instance', () => {
      enableCoordination();
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          locks: [
            {
              lock_id: 'lock-self',
              file_path: 'src/app.ts',
              lock_type: 'exclusive_write',
              instance_id: 'instance-abc-123', // Same as mocked getOrGenerateSessionId
              acquired_at: acquiredAt,
              expires_at: futureDate,
            },
          ],
        })
      );

      const input = createWriteInput('/test/project/src/app.ts');
      const result = multiInstanceLock(input);

      expect(result.continue).toBe(true);
    });

    it('passes when lock has expired', () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      enableCoordination();
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          locks: [
            {
              lock_id: 'lock-expired',
              file_path: 'src/app.ts',
              lock_type: 'exclusive_write',
              instance_id: 'other-instance-456',
              acquired_at: new Date(Date.now() - 120000).toISOString(),
              expires_at: pastDate,
            },
          ],
        })
      );

      const input = createWriteInput('/test/project/src/app.ts');
      const result = multiInstanceLock(input);

      expect(result.continue).toBe(true);
    });

    it('passes when different file is locked', () => {
      enableCoordination();
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          locks: [
            {
              lock_id: 'lock-other-file',
              file_path: 'src/other-file.ts',
              lock_type: 'exclusive_write',
              instance_id: 'other-instance-456',
              acquired_at: acquiredAt,
              expires_at: futureDate,
            },
          ],
        })
      );

      const input = createWriteInput('/test/project/src/app.ts');
      const result = multiInstanceLock(input);

      expect(result.continue).toBe(true);
    });
  });

  describe('Multiple locks', () => {
    const futureDate = new Date(Date.now() + 60000).toISOString();
    const acquiredAt = new Date().toISOString();

    it('blocks when target file has active lock among many', () => {
      enableCoordination();
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          locks: [
            {
              lock_id: 'lock-1',
              file_path: 'src/file-a.ts',
              lock_type: 'exclusive_write',
              instance_id: 'session-1',
              acquired_at: acquiredAt,
              expires_at: futureDate,
            },
            {
              lock_id: 'lock-2',
              file_path: 'src/app.ts', // Target file
              lock_type: 'exclusive_write',
              instance_id: 'session-2',
              acquired_at: acquiredAt,
              expires_at: futureDate,
            },
            {
              lock_id: 'lock-3',
              file_path: 'src/file-c.ts',
              lock_type: 'exclusive_write',
              instance_id: 'session-3',
              acquired_at: acquiredAt,
              expires_at: futureDate,
            },
          ],
        })
      );

      const input = createWriteInput('/test/project/src/app.ts');
      const result = multiInstanceLock(input);

      expect(result.continue).toBe(false);
    });

    it('passes when all locks are for different files', () => {
      enableCoordination();
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          locks: [
            {
              lock_id: 'lock-1',
              file_path: 'src/file-a.ts',
              lock_type: 'exclusive_write',
              instance_id: 'session-1',
              acquired_at: acquiredAt,
              expires_at: futureDate,
            },
            {
              lock_id: 'lock-2',
              file_path: 'src/file-b.ts',
              lock_type: 'exclusive_write',
              instance_id: 'session-2',
              acquired_at: acquiredAt,
              expires_at: futureDate,
            },
          ],
        })
      );

      const input = createWriteInput('/test/project/src/app.ts');
      const result = multiInstanceLock(input);

      expect(result.continue).toBe(true);
    });
  });

  describe('Lock message content', () => {
    it('includes acquired_at and expires_at in denial message', () => {
      const acquiredAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 300000).toISOString();

      enableCoordination();
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          locks: [
            {
              lock_id: 'lock-blocking',
              file_path: 'src/app.ts',
              lock_type: 'exclusive_write',
              instance_id: 'blocking-instance-123',
              acquired_at: acquiredAt,
              expires_at: expiresAt,
            },
          ],
        })
      );

      const input = createWriteInput('/test/project/src/app.ts');
      const result = multiInstanceLock(input);

      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('blocking-instance-123');
      expect(result.stopReason).toContain(acquiredAt);
      expect(result.stopReason).toContain(expiresAt);
    });
  });

  describe('Edge cases', () => {
    it('handles missing file_path in tool_input', () => {
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        project_dir: '/test/project',
        tool_input: { content: 'test' },
      };
      const result = multiInstanceLock(input);

      expect(result.continue).toBe(true);
    });

    it('handles malformed locks.json gracefully', () => {
      enableCoordination();
      vi.mocked(readFileSync).mockReturnValue('not valid json');

      const input = createWriteInput('/test/project/src/file.ts');
      const result = multiInstanceLock(input);

      // loadLocks catches parse errors and returns empty locks
      expect(result.continue).toBe(true);
    });

    it('handles locks.json with missing locks array', () => {
      enableCoordination();
      vi.mocked(readFileSync).mockReturnValue('{}');

      const input = createWriteInput('/test/project/src/file.ts');
      const result = multiInstanceLock(input);

      // loadLocks returns { locks: [] } when parse succeeds but locks is missing
      // (JSON.parse succeeds, but data.locks is undefined → cleanExpiredLocks filters empty)
      expect(result.continue).toBe(true);
    });

    it('handles fs read error gracefully', () => {
      enableCoordination();
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const input = createWriteInput('/test/project/src/file.ts');
      const result = multiInstanceLock(input);

      // loadLocks catches and returns empty
      expect(result.continue).toBe(true);
    });
  });

  describe('Tool types', () => {
    it('processes Edit operations', () => {
      enableCoordination();
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ locks: [] }));

      const input = createWriteInput('/test/project/src/file.ts', 'Edit');
      const result = multiInstanceLock(input);

      expect(result.continue).toBe(true);
    });
  });
});

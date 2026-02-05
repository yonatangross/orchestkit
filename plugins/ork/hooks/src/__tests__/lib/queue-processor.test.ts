/**
 * Queue Processor Unit Tests (mocked filesystem)
 *
 * Covers error paths and edge cases that integration tests cannot trigger:
 * - Filesystem read failures (permission denied, etc.)
 * - unlinkSync failures
 * - statSync failures
 * - renameSync failure with fallback to clear
 * - Unrecognized operation types
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
}));

import { existsSync, readFileSync, unlinkSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { logHook } from '../../lib/common.js';
import {
  readGraphQueue,
  readMem0Queue,
  aggregateGraphOperations,
  deduplicateMem0Memories,
  clearQueueFile,
  isQueueStale,
  archiveQueue,
} from '../../lib/queue-processor.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockUnlinkSync = vi.mocked(unlinkSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockRenameSync = vi.mocked(renameSync);
const mockStatSync = vi.mocked(statSync);
const mockLogHook = vi.mocked(logHook);

describe('Queue Processor Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  // ---------------------------------------------------------------------------
  // readGraphQueue
  // ---------------------------------------------------------------------------

  describe('readGraphQueue', () => {
    it('returns empty array when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(readGraphQueue('/test/queue.jsonl')).toEqual([]);
    });

    it('returns empty array when readFileSync throws', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = readGraphQueue('/test/queue.jsonl');
      expect(result).toEqual([]);
      expect(mockLogHook).toHaveBeenCalledWith(
        'queue-processor',
        expect.stringContaining('Failed to read graph queue'),
        'warn'
      );
    });

    it('skips corrupt JSON lines and logs warning', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        'NOT_JSON\n' +
        JSON.stringify({ type: 'create_entities', payload: { entities: [] }, timestamp: '' }) + '\n'
      );

      const result = readGraphQueue('/test/queue.jsonl');
      expect(result).toHaveLength(1);
      expect(mockLogHook).toHaveBeenCalledWith(
        'queue-processor',
        expect.stringContaining('Failed to parse graph queue line'),
        'warn'
      );
    });

    it('handles file with only whitespace lines', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('  \n\n  \n');

      expect(readGraphQueue('/test/queue.jsonl')).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // readMem0Queue
  // ---------------------------------------------------------------------------

  describe('readMem0Queue', () => {
    it('returns empty array when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(readMem0Queue('/test/queue.jsonl')).toEqual([]);
    });

    it('returns empty array when readFileSync throws', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = readMem0Queue('/test/queue.jsonl');
      expect(result).toEqual([]);
      expect(mockLogHook).toHaveBeenCalledWith(
        'queue-processor',
        expect.stringContaining('Failed to read mem0 queue'),
        'warn'
      );
    });

    it('skips entries missing text field', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ user_id: 'test', metadata: {} }) + '\n'
      );

      const result = readMem0Queue('/test/queue.jsonl');
      expect(result).toHaveLength(0);
      expect(mockLogHook).toHaveBeenCalledWith(
        'queue-processor',
        expect.stringContaining('Skipping invalid mem0 memory'),
        'warn'
      );
    });

    it('skips entries missing user_id field', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ text: 'memory text', metadata: {} }) + '\n'
      );

      const result = readMem0Queue('/test/queue.jsonl');
      expect(result).toHaveLength(0);
    });

    it('skips corrupt JSON lines and logs warning', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        '{bad json\n' +
        JSON.stringify({ text: 'valid', user_id: 'test', metadata: {}, queued_at: '' }) + '\n'
      );

      const result = readMem0Queue('/test/queue.jsonl');
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('valid');
    });
  });

  // ---------------------------------------------------------------------------
  // aggregateGraphOperations
  // ---------------------------------------------------------------------------

  describe('aggregateGraphOperations', () => {
    it('handles empty operations array', () => {
      const result = aggregateGraphOperations([]);
      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
      expect(result.observations).toEqual([]);
    });

    it('ignores unrecognized operation types', () => {
      const result = aggregateGraphOperations([
        { type: 'unknown_type' as string, payload: { entities: [] }, timestamp: '' },
        { type: 'delete_entities' as string, payload: { entities: [] }, timestamp: '' },
      ] as any);

      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
      expect(result.observations).toEqual([]);
    });

    it('handles create_entities with missing entities field', () => {
      const result = aggregateGraphOperations([
        { type: 'create_entities', payload: {}, timestamp: '' } as any,
      ]);

      expect(result.entities).toEqual([]);
    });

    it('handles create_relations with missing relations field', () => {
      const result = aggregateGraphOperations([
        { type: 'create_relations', payload: {}, timestamp: '' } as any,
      ]);

      expect(result.relations).toEqual([]);
    });

    it('handles add_observations with missing observations field', () => {
      const result = aggregateGraphOperations([
        { type: 'add_observations', payload: {}, timestamp: '' } as any,
      ]);

      expect(result.observations).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // deduplicateMem0Memories
  // ---------------------------------------------------------------------------

  describe('deduplicateMem0Memories', () => {
    it('returns empty array for empty input', () => {
      expect(deduplicateMem0Memories([])).toEqual([]);
    });

    it('deduplicates by lowercase trimmed text', () => {
      const result = deduplicateMem0Memories([
        { text: '  Hello World  ', user_id: 'a', metadata: {}, queued_at: '2025-01-15T10:00:00Z' },
        { text: 'hello world', user_id: 'b', metadata: {}, queued_at: '2025-01-15T12:00:00Z' },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].queued_at).toBe('2025-01-15T12:00:00Z');
    });

    it('keeps entry with later queued_at timestamp', () => {
      const result = deduplicateMem0Memories([
        { text: 'Same text', user_id: 'a', metadata: {}, queued_at: '2025-01-15T12:00:00Z' },
        { text: 'same text', user_id: 'b', metadata: {}, queued_at: '2025-01-15T10:00:00Z' },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].queued_at).toBe('2025-01-15T12:00:00Z');
    });
  });

  // ---------------------------------------------------------------------------
  // clearQueueFile
  // ---------------------------------------------------------------------------

  describe('clearQueueFile', () => {
    it('does nothing when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      clearQueueFile('/test/queue.jsonl');
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    it('deletes file when it exists', () => {
      mockExistsSync.mockReturnValue(true);
      clearQueueFile('/test/queue.jsonl');
      expect(mockUnlinkSync).toHaveBeenCalledWith('/test/queue.jsonl');
    });

    it('logs warning when unlinkSync fails', () => {
      mockExistsSync.mockReturnValue(true);
      mockUnlinkSync.mockImplementation(() => {
        throw new Error('EBUSY: file in use');
      });

      clearQueueFile('/test/queue.jsonl');
      expect(mockLogHook).toHaveBeenCalledWith(
        'queue-processor',
        expect.stringContaining('Failed to clear queue'),
        'warn'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // isQueueStale
  // ---------------------------------------------------------------------------

  describe('isQueueStale', () => {
    it('returns false when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(isQueueStale('/test/queue.jsonl', 1000)).toBe(false);
    });

    it('returns true when file mtime exceeds maxAgeMs', () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({
        mtime: new Date(Date.now() - 48 * 60 * 60 * 1000),
      } as any);

      expect(isQueueStale('/test/queue.jsonl', 24 * 60 * 60 * 1000)).toBe(true);
    });

    it('returns false when file mtime is within maxAgeMs', () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({
        mtime: new Date(),
      } as any);

      expect(isQueueStale('/test/queue.jsonl', 24 * 60 * 60 * 1000)).toBe(false);
    });

    it('returns false when statSync throws', () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockImplementation(() => {
        throw new Error('EACCES');
      });

      expect(isQueueStale('/test/queue.jsonl', 1000)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // archiveQueue
  // ---------------------------------------------------------------------------

  describe('archiveQueue', () => {
    it('does nothing when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      archiveQueue('/test/queue.jsonl', '/test/archive');
      expect(mockRenameSync).not.toHaveBeenCalled();
    });

    it('creates archive dir if it does not exist', () => {
      mockExistsSync.mockImplementation((path: unknown) => {
        const p = String(path);
        if (p.includes('archive')) return false;
        return true; // queue file exists
      });

      archiveQueue('/test/queue.jsonl', '/test/archive');

      expect(mockMkdirSync).toHaveBeenCalledWith('/test/archive', { recursive: true });
    });

    it('renames file to archive dir with timestamp prefix', () => {
      mockExistsSync.mockReturnValue(true);

      archiveQueue('/test/memory/graph-queue.jsonl', '/test/archive');

      expect(mockRenameSync).toHaveBeenCalledOnce();
      const [src, dest] = mockRenameSync.mock.calls[0];
      expect(src).toBe('/test/memory/graph-queue.jsonl');
      expect(String(dest)).toContain('graph-queue.jsonl');
      expect(String(dest).replace(/\\/g, '/')).toMatch(/\/test\/archive\//);
    });

    it('falls back to clearQueueFile when renameSync throws', () => {
      mockExistsSync.mockReturnValue(true);
      mockRenameSync.mockImplementation(() => {
        throw new Error('EXDEV: cross-device link');
      });

      archiveQueue('/test/queue.jsonl', '/test/archive');

      expect(mockLogHook).toHaveBeenCalledWith(
        'queue-processor',
        expect.stringContaining('Failed to archive queue'),
        'warn'
      );
      // Should fall back to unlinkSync
      expect(mockUnlinkSync).toHaveBeenCalledWith('/test/queue.jsonl');
    });

    it('logs success after archiving', () => {
      mockExistsSync.mockReturnValue(true);
      // Ensure renameSync succeeds (reset from previous test)
      mockRenameSync.mockImplementation(() => {});

      archiveQueue('/test/queue.jsonl', '/test/archive');

      expect(mockLogHook).toHaveBeenCalledWith(
        'queue-processor',
        expect.stringContaining('Archived queue to'),
        'info'
      );
    });
  });
});

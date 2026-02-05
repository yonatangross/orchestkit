/**
 * Tests for Mem0 Queue Sync Hook
 *
 * Tests processing of queued mem0 operations at session end.
 * Covers: skipping when MEM0 not configured, silent success when no
 * memories, systemMessage generation, and memory deduplication.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock common utilities
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

// Mock memory writer
vi.mock('../../lib/memory-writer.js', () => ({
  isMem0Configured: vi.fn(),
}));

// Mock queue processor
vi.mock('../../lib/queue-processor.js', () => ({
  readMem0Queue: vi.fn(),
  deduplicateMem0Memories: vi.fn(),
  clearQueueFile: vi.fn(),
}));

import { mem0QueueSync } from '../../stop/mem0-queue-sync.js';
import { logHook } from '../../lib/common.js';
import { isMem0Configured } from '../../lib/memory-writer.js';
import {
  readMem0Queue,
  deduplicateMem0Memories,
  clearQueueFile,
} from '../../lib/queue-processor.js';
import type { HookInput } from '../../types.js';

describe('Mem0 Queue Sync Hook', () => {
  const mockLogHook = vi.mocked(logHook);
  const mockIsMem0Configured = vi.mocked(isMem0Configured);
  const mockReadMem0Queue = vi.mocked(readMem0Queue);
  const mockDeduplicateMem0Memories = vi.mocked(deduplicateMem0Memories);
  const mockClearQueueFile = vi.mocked(clearQueueFile);

  const defaultInput: HookInput = {
    hook_event: 'Stop',
    tool_name: '',
    session_id: 'test-session-001',
    tool_input: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMem0Configured.mockReturnValue(true);
    mockReadMem0Queue.mockReturnValue([]);
    mockDeduplicateMem0Memories.mockImplementation((memories) => memories);
  });

  // ===========================================================================
  // SECTION 1: MEM0 Not Configured
  // ===========================================================================
  describe('MEM0 Not Configured', () => {
    it('should skip when MEM0 is not configured', () => {
      // Arrange
      mockIsMem0Configured.mockReturnValue(false);

      // Act
      const result = mem0QueueSync(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'mem0-queue-sync',
        'MEM0_API_KEY not configured, skipping',
        'debug'
      );
    });

    it('should not read queue when MEM0 is not configured', () => {
      // Arrange
      mockIsMem0Configured.mockReturnValue(false);

      // Act
      mem0QueueSync(defaultInput);

      // Assert
      expect(mockReadMem0Queue).not.toHaveBeenCalled();
    });

    it('should not clear queue when MEM0 is not configured', () => {
      // Arrange
      mockIsMem0Configured.mockReturnValue(false);

      // Act
      mem0QueueSync(defaultInput);

      // Assert
      expect(mockClearQueueFile).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // SECTION 2: No Queued Memories
  // ===========================================================================
  describe('No Queued Memories', () => {
    it('should return silent success when no memories are queued', () => {
      // Arrange
      mockReadMem0Queue.mockReturnValue([]);

      // Act
      const result = mem0QueueSync(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should log debug message when no memories found', () => {
      // Arrange
      mockReadMem0Queue.mockReturnValue([]);

      // Act
      mem0QueueSync(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'mem0-queue-sync',
        'No queued mem0 memories',
        'debug'
      );
    });

    it('should not call deduplicateMem0Memories when queue is empty', () => {
      // Arrange
      mockReadMem0Queue.mockReturnValue([]);

      // Act
      mem0QueueSync(defaultInput);

      // Assert
      expect(mockDeduplicateMem0Memories).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // SECTION 3: System Message Generation
  // ===========================================================================
  describe('System Message Generation', () => {
    const sampleMemory = {
      text: 'Use cursor pagination for large datasets',
      user_id: 'orchestkit-project-decisions',
      metadata: {
        category: 'database',
        outcome: 'success',
        timestamp: '2026-01-28T10:00:00Z',
      },
      queued_at: '2026-01-28T10:00:00Z',
    };

    it('should generate systemMessage with memory content', () => {
      // Arrange
      mockReadMem0Queue.mockReturnValue([sampleMemory]);
      mockDeduplicateMem0Memories.mockReturnValue([sampleMemory]);

      // Act
      const result = mem0QueueSync(defaultInput);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
      expect(result.systemMessage).toContain('Mem0 Cloud Memory Sync');
      expect(result.systemMessage).toContain('cursor pagination');
    });

    it('should include scope in systemMessage', () => {
      // Arrange
      mockReadMem0Queue.mockReturnValue([sampleMemory]);
      mockDeduplicateMem0Memories.mockReturnValue([sampleMemory]);

      // Act
      const result = mem0QueueSync(defaultInput);

      // Assert
      expect(result.systemMessage).toContain('orchestkit-project-decisions');
    });

    it('should include summary with count in systemMessage', () => {
      // Arrange
      const memories = [sampleMemory, { ...sampleMemory, text: 'Second memory' }];
      mockReadMem0Queue.mockReturnValue(memories);
      mockDeduplicateMem0Memories.mockReturnValue(memories);

      // Act
      const result = mem0QueueSync(defaultInput);

      // Assert
      expect(result.systemMessage).toContain('2 memories to sync');
    });

    it('should include category in summary', () => {
      // Arrange
      mockReadMem0Queue.mockReturnValue([sampleMemory]);
      mockDeduplicateMem0Memories.mockReturnValue([sampleMemory]);

      // Act
      const result = mem0QueueSync(defaultInput);

      // Assert
      expect(result.systemMessage).toContain('database');
    });
  });

  // ===========================================================================
  // SECTION 4: Memory Deduplication
  // ===========================================================================
  describe('Memory Deduplication', () => {
    it('should deduplicate memories before generating message', () => {
      // Arrange
      const rawMemories = [
        { text: 'Same memory', user_id: 'uid', metadata: { category: 'test' }, queued_at: '2026-01-28T10:00:00Z' },
        { text: 'Same memory', user_id: 'uid', metadata: { category: 'test' }, queued_at: '2026-01-28T10:00:00Z' },
      ];
      const deduped = [
        { text: 'Same memory', user_id: 'uid', metadata: { category: 'test' }, queued_at: '2026-01-28T10:00:00Z' },
      ];
      mockReadMem0Queue.mockReturnValue(rawMemories);
      mockDeduplicateMem0Memories.mockReturnValue(deduped);

      // Act
      mem0QueueSync(defaultInput);

      // Assert
      expect(mockDeduplicateMem0Memories).toHaveBeenCalledWith(rawMemories);
      expect(mockLogHook).toHaveBeenCalledWith(
        'mem0-queue-sync',
        expect.stringContaining('Deduplicated 2'),
        'debug'
      );
    });

    it('should not log dedup message when no duplicates removed', () => {
      // Arrange
      const memories = [
        { text: 'Memory 1', user_id: 'uid', metadata: { category: 'test' }, queued_at: '2026-01-28T10:00:00Z' },
      ];
      mockReadMem0Queue.mockReturnValue(memories);
      mockDeduplicateMem0Memories.mockReturnValue(memories);

      // Act
      mem0QueueSync(defaultInput);

      // Assert
      expect(mockLogHook).not.toHaveBeenCalledWith(
        'mem0-queue-sync',
        expect.stringContaining('Deduplicated'),
        'debug'
      );
    });
  });

  // ===========================================================================
  // SECTION 5: Queue Clearing
  // ===========================================================================
  describe('Queue Clearing', () => {
    it('should clear queue after processing', () => {
      // Arrange
      const memory = {
        text: 'Test', user_id: 'uid', metadata: { category: 'test' }, queued_at: '2026-01-28T10:00:00Z',
      };
      mockReadMem0Queue.mockReturnValue([memory]);
      mockDeduplicateMem0Memories.mockReturnValue([memory]);

      // Act
      mem0QueueSync(defaultInput);

      // Assert
      expect(mockClearQueueFile).toHaveBeenCalledWith(
        expect.stringContaining('mem0-queue.jsonl')
      );
    });

    it('should log processing count', () => {
      // Arrange
      const memories = [
        { text: 'M1', user_id: 'uid', metadata: { category: 'a' }, queued_at: '2026-01-28T10:00:00Z' },
        { text: 'M2', user_id: 'uid', metadata: { category: 'b' }, queued_at: '2026-01-28T10:00:00Z' },
      ];
      mockReadMem0Queue.mockReturnValue(memories);
      mockDeduplicateMem0Memories.mockReturnValue(memories);

      // Act
      mem0QueueSync(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'mem0-queue-sync',
        'Processing 2 queued memories',
        'info'
      );
    });
  });
});

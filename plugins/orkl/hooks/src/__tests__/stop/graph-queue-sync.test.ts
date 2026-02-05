/**
 * Tests for Graph Queue Sync Hook
 *
 * Tests processing of queued graph operations at session end.
 * Covers: silent success when no operations, systemMessage generation
 * with entities/relations/observations, and queue clearing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock common utilities
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

// Mock queue processor
vi.mock('../../lib/queue-processor.js', () => ({
  readGraphQueue: vi.fn(),
  aggregateGraphOperations: vi.fn(),
  clearQueueFile: vi.fn(),
}));

import { graphQueueSync } from '../../stop/graph-queue-sync.js';
import { logHook, outputSilentSuccess, getProjectDir } from '../../lib/common.js';
import {
  readGraphQueue,
  aggregateGraphOperations,
  clearQueueFile,
} from '../../lib/queue-processor.js';
import type { HookInput } from '../../types.js';

describe('Graph Queue Sync Hook', () => {
  const mockLogHook = vi.mocked(logHook);
  const mockOutputSilentSuccess = vi.mocked(outputSilentSuccess);
  const mockReadGraphQueue = vi.mocked(readGraphQueue);
  const mockAggregateGraphOperations = vi.mocked(aggregateGraphOperations);
  const mockClearQueueFile = vi.mocked(clearQueueFile);

  const defaultInput: HookInput = {
    hook_event: 'Stop',
    tool_name: '',
    session_id: 'test-session-001',
    tool_input: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReadGraphQueue.mockReturnValue([]);
    mockAggregateGraphOperations.mockReturnValue({
      entities: [],
      relations: [],
      observations: [],
    });
  });

  // ===========================================================================
  // SECTION 1: No Operations
  // ===========================================================================
  describe('No Queued Operations', () => {
    it('should return silent success when no operations are queued', () => {
      // Arrange
      mockReadGraphQueue.mockReturnValue([]);

      // Act
      const result = graphQueueSync(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should log debug message when no operations found', () => {
      // Arrange
      mockReadGraphQueue.mockReturnValue([]);

      // Act
      graphQueueSync(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'graph-queue-sync',
        'No queued graph operations',
        'debug'
      );
    });

    it('should not call aggregateGraphOperations when queue is empty', () => {
      // Arrange
      mockReadGraphQueue.mockReturnValue([]);

      // Act
      graphQueueSync(defaultInput);

      // Assert
      expect(mockAggregateGraphOperations).not.toHaveBeenCalled();
    });

    it('should not call clearQueueFile when queue is empty', () => {
      // Arrange
      mockReadGraphQueue.mockReturnValue([]);

      // Act
      graphQueueSync(defaultInput);

      // Assert
      expect(mockClearQueueFile).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // SECTION 2: System Message Generation
  // ===========================================================================
  describe('System Message Generation', () => {
    it('should generate systemMessage with entities', () => {
      // Arrange
      mockReadGraphQueue.mockReturnValue([{ type: 'entity' }]);
      mockAggregateGraphOperations.mockReturnValue({
        entities: [{ name: 'PostgreSQL', entityType: 'Technology', observations: ['Used for DB'] }],
        relations: [],
        observations: [],
      });

      // Act
      const result = graphQueueSync(defaultInput);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
      expect(result.systemMessage).toContain('Graph Memory Sync');
      expect(result.systemMessage).toContain('Create Entities');
      expect(result.systemMessage).toContain('PostgreSQL');
    });

    it('should generate systemMessage with relations', () => {
      // Arrange
      mockReadGraphQueue.mockReturnValue([{ type: 'relation' }]);
      mockAggregateGraphOperations.mockReturnValue({
        entities: [],
        relations: [{ from: 'A', to: 'B', relationType: 'USES' }],
        observations: [],
      });

      // Act
      const result = graphQueueSync(defaultInput);

      // Assert
      expect(result.systemMessage).toContain('Create Relations');
      expect(result.systemMessage).toContain('USES');
    });

    it('should generate systemMessage with observations', () => {
      // Arrange
      mockReadGraphQueue.mockReturnValue([{ type: 'obs' }]);
      mockAggregateGraphOperations.mockReturnValue({
        entities: [],
        relations: [],
        observations: [{ entityName: 'node', contents: ['fact'] }],
      });

      // Act
      const result = graphQueueSync(defaultInput);

      // Assert
      expect(result.systemMessage).toContain('Add Observations');
    });

    it('should include summary with counts in systemMessage', () => {
      // Arrange
      mockReadGraphQueue.mockReturnValue([{ type: 'mixed' }]);
      mockAggregateGraphOperations.mockReturnValue({
        entities: [{ name: 'E1' }, { name: 'E2' }],
        relations: [{ from: 'E1', to: 'E2' }],
        observations: [{ entityName: 'E1', contents: ['o1'] }],
      });

      // Act
      const result = graphQueueSync(defaultInput);

      // Assert
      expect(result.systemMessage).toContain('2 entities');
      expect(result.systemMessage).toContain('1 relations');
      expect(result.systemMessage).toContain('1 observations');
    });
  });

  // ===========================================================================
  // SECTION 3: Queue Processing
  // ===========================================================================
  describe('Queue Processing', () => {
    it('should clear queue after processing', () => {
      // Arrange
      mockReadGraphQueue.mockReturnValue([{ type: 'entity' }]);
      mockAggregateGraphOperations.mockReturnValue({
        entities: [{ name: 'Test' }],
        relations: [],
        observations: [],
      });

      // Act
      graphQueueSync(defaultInput);

      // Assert
      expect(mockClearQueueFile).toHaveBeenCalledWith(
        expect.stringContaining('graph-queue.jsonl')
      );
    });

    it('should log operation count when processing', () => {
      // Arrange
      mockReadGraphQueue.mockReturnValue([
        { type: 'entity' },
        { type: 'relation' },
        { type: 'entity' },
      ]);
      mockAggregateGraphOperations.mockReturnValue({
        entities: [{ name: 'E1' }],
        relations: [],
        observations: [],
      });

      // Act
      graphQueueSync(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'graph-queue-sync',
        'Processing 3 queued operations',
        'info'
      );
    });

    it('should return silent success when aggregated has all empty arrays', () => {
      // Arrange
      mockReadGraphQueue.mockReturnValue([{ type: 'empty' }]);
      mockAggregateGraphOperations.mockReturnValue({
        entities: [],
        relations: [],
        observations: [],
      });

      // Act
      const result = graphQueueSync(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });
});

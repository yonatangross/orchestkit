/**
 * Tests for Memory Usage Metrics
 *
 * Validates:
 * - Metric collection with various file states
 * - Queue depth counting
 * - Session counting from analytics
 *
 * v7: appendMetricSnapshot removed (#919 orphan JSONL audit).
 * Only collectMemoryMetrics remains.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { collectMemoryMetrics } from '../../lib/memory-metrics.js';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../../lib/common.js', () => ({
  getProjectDir: vi.fn(() => '/test/project'),
}));

import { existsSync, readFileSync } from 'node:fs';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('collectMemoryMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero metrics when no files exist', () => {
    mockExistsSync.mockReturnValue(false);

    const metrics = collectMemoryMetrics('/test/project');

    expect(metrics.decisions.total).toBe(0);
    expect(metrics.queues.graphQueueDepth).toBe(0);
    expect(metrics.completedFlows).toBe(0);
    expect(metrics.sessionCount).toBe(0);
  });

  it('returns empty decisions structure (v7 simplified)', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('');

    const metrics = collectMemoryMetrics('/test/project');

    // v7: decisions counting simplified - totals come from health check, not metrics
    expect(metrics.decisions.total).toBe(0);
    expect(metrics.decisions.byCategory).toEqual({});
    expect(metrics.decisions.byType).toEqual({});
  });

  it('counts queue depths', () => {
    mockExistsSync.mockReturnValue(true);

    mockReadFileSync.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('graph-queue.jsonl')) {
        return '{"type":"create_entities"}\n{"type":"create_relations"}\n{"type":"add_observations"}\n';
      }
      return '';
    });

    const metrics = collectMemoryMetrics('/test/project');

    expect(metrics.queues.graphQueueDepth).toBe(3);
  });

  it('includes timestamp', () => {
    mockExistsSync.mockReturnValue(false);

    const metrics = collectMemoryMetrics('/test/project');

    expect(metrics.timestamp).toBeDefined();
    expect(new Date(metrics.timestamp).getTime()).not.toBeNaN();
  });
});

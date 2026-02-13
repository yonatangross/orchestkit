/**
 * Tests for Memory Metrics Collector Hook
 *
 * Validates the SessionStart hook entry point that wires
 * collectMemoryMetrics and appendMetricSnapshot into the lifecycle.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { memoryMetricsCollector } from '../../lifecycle/memory-metrics-collector.js';
import type { HookInput } from '../../types.js';

// Mock dependencies
vi.mock('../../lib/common.js', () => ({
  getProjectDir: vi.fn(() => '/fallback/project'),
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

vi.mock('../../lib/memory-metrics.js', () => ({
  collectMemoryMetrics: vi.fn(() => ({
    timestamp: '2025-01-15T10:00:00Z',
    decisions: { total: 5, byCategory: {}, byType: {} },
    queues: { graphQueueDepth: 0 },
    completedFlows: 0,
    sessionCount: 1,
  })),
  appendMetricSnapshot: vi.fn(),
}));

import { getProjectDir, logHook } from '../../lib/common.js';
import { collectMemoryMetrics, appendMetricSnapshot } from '../../lib/memory-metrics.js';

const mockCollectMemoryMetrics = vi.mocked(collectMemoryMetrics);
const mockAppendMetricSnapshot = vi.mocked(appendMetricSnapshot);
const mockLogHook = vi.mocked(logHook);
const mockGetProjectDir = vi.mocked(getProjectDir);

function createInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: 'test-session',
    tool_input: {},
    project_dir: '/test/project',
    ...overrides,
  };
}

describe('memoryMetricsCollector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns outputSilentSuccess on happy path', () => {
    const result = memoryMetricsCollector(createInput());

    expect(result).toEqual({ continue: true, suppressOutput: true });
  });

  it('calls collectMemoryMetrics with project_dir from input', () => {
    memoryMetricsCollector(createInput({ project_dir: '/my/project' }));

    expect(mockCollectMemoryMetrics).toHaveBeenCalledWith('/my/project');
  });

  it('calls appendMetricSnapshot with project_dir and collected metrics', () => {
    const mockMetrics = {
      timestamp: '2025-01-15T10:00:00Z',
      decisions: { total: 5, byCategory: {}, byType: {} },
      queues: { graphQueueDepth: 0 },
      completedFlows: 0,
      sessionCount: 1,
      };
    mockCollectMemoryMetrics.mockReturnValue(mockMetrics);

    memoryMetricsCollector(createInput({ project_dir: '/my/project' }));

    expect(mockAppendMetricSnapshot).toHaveBeenCalledWith('/my/project', mockMetrics);
  });

  it('falls back to getProjectDir when input.project_dir is undefined', () => {
    memoryMetricsCollector(createInput({ project_dir: undefined }));

    expect(mockGetProjectDir).toHaveBeenCalled();
    expect(mockCollectMemoryMetrics).toHaveBeenCalledWith('/fallback/project');
  });

  it('returns outputSilentSuccess even when collectMemoryMetrics throws', () => {
    mockCollectMemoryMetrics.mockImplementation(() => {
      throw new Error('disk full');
    });

    const result = memoryMetricsCollector(createInput());

    expect(result).toEqual({ continue: true, suppressOutput: true });
    expect(mockLogHook).toHaveBeenCalledWith(
      'memory-metrics-collector',
      expect.stringContaining('disk full'),
      'warn'
    );
  });

  it('returns outputSilentSuccess even when appendMetricSnapshot throws', () => {
    // Ensure collectMemoryMetrics succeeds (reset from previous test)
    mockCollectMemoryMetrics.mockReturnValue({
      timestamp: '2025-01-15T10:00:00Z',
      decisions: { total: 0, byCategory: {}, byType: {} },
      queues: { graphQueueDepth: 0 },
      completedFlows: 0,
      sessionCount: 0,
      });
    mockAppendMetricSnapshot.mockImplementation(() => {
      throw new Error('write failed');
    });

    const result = memoryMetricsCollector(createInput());

    expect(result).toEqual({ continue: true, suppressOutput: true });
    expect(mockLogHook).toHaveBeenCalledWith(
      'memory-metrics-collector',
      expect.stringContaining('write failed'),
      'warn'
    );
  });

  it('logs hook execution on every call', () => {
    memoryMetricsCollector(createInput());

    expect(mockLogHook).toHaveBeenCalledWith(
      'memory-metrics-collector',
      'Collecting memory metrics'
    );
  });

  it('does not call appendMetricSnapshot when collectMemoryMetrics throws', () => {
    mockCollectMemoryMetrics.mockImplementation(() => {
      throw new Error('fail');
    });

    memoryMetricsCollector(createInput());

    expect(mockAppendMetricSnapshot).not.toHaveBeenCalled();
  });
});

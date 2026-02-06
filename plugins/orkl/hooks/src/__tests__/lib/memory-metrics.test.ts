/**
 * Tests for Memory Usage Metrics
 *
 * Validates:
 * - Metric collection with various file states
 * - Category counting from decisions.jsonl
 * - Queue depth counting
 * - Session counting from analytics
 * - Append behavior for metric snapshots
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { collectMemoryMetrics, appendMetricSnapshot } from '../../lib/memory-metrics.js';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('../../lib/common.js', () => ({
  getProjectDir: vi.fn(() => '/test/project'),
  logHook: vi.fn(),
}));

import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockAppendFileSync = vi.mocked(appendFileSync);

describe('collectMemoryMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MEM0_API_KEY;
  });

  it('returns zero metrics when no files exist', () => {
    mockExistsSync.mockReturnValue(false);

    const metrics = collectMemoryMetrics('/test/project');

    expect(metrics.decisions.total).toBe(0);
    expect(metrics.queues.graphQueueDepth).toBe(0);
    expect(metrics.queues.mem0QueueDepth).toBe(0);
    expect(metrics.completedFlows).toBe(0);
    expect(metrics.sessionCount).toBe(0);
    expect(metrics.mem0Available).toBe(false);
  });

  it('counts decisions by category and type', () => {
    mockExistsSync.mockReturnValue(true);
    const decisions = [
      JSON.stringify({ type: 'decision', metadata: { category: 'api' } }),
      JSON.stringify({ type: 'decision', metadata: { category: 'database' } }),
      JSON.stringify({ type: 'pattern', metadata: { category: 'api' } }),
      JSON.stringify({ type: 'preference', metadata: { category: 'api' } }),
    ].join('\n') + '\n';

    mockReadFileSync.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('decisions.jsonl')) return decisions;
      return '';
    });

    const metrics = collectMemoryMetrics('/test/project');

    expect(metrics.decisions.total).toBe(4);
    expect(metrics.decisions.byCategory).toEqual({ api: 3, database: 1 });
    expect(metrics.decisions.byType).toEqual({ decision: 2, pattern: 1, preference: 1 });
  });

  it('counts queue depths', () => {
    mockExistsSync.mockReturnValue(true);

    mockReadFileSync.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('graph-queue.jsonl')) {
        return '{"type":"create_entities"}\n{"type":"create_relations"}\n{"type":"add_observations"}\n';
      }
      if (p.includes('mem0-queue.jsonl')) {
        return '{"text":"memory1"}\n{"text":"memory2"}\n';
      }
      return '';
    });

    const metrics = collectMemoryMetrics('/test/project');

    expect(metrics.queues.graphQueueDepth).toBe(3);
    expect(metrics.queues.mem0QueueDepth).toBe(2);
  });

  it('counts sessions from analytics', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('mem0-analytics.jsonl')) {
        return [
          JSON.stringify({ event: 'session_start', timestamp: '2025-01-10T00:00:00Z' }),
          JSON.stringify({ event: 'session_start', timestamp: '2025-01-11T00:00:00Z' }),
          JSON.stringify({ event: 'other_event', timestamp: '2025-01-11T00:00:00Z' }),
        ].join('\n') + '\n';
      }
      return '';
    });

    const metrics = collectMemoryMetrics('/test/project');

    expect(metrics.sessionCount).toBe(2);
  });

  it('detects mem0 availability', () => {
    mockExistsSync.mockReturnValue(false);
    process.env.MEM0_API_KEY = 'test-key';

    const metrics = collectMemoryMetrics('/test/project');

    expect(metrics.mem0Available).toBe(true);

    delete process.env.MEM0_API_KEY;
  });

  it('includes timestamp', () => {
    mockExistsSync.mockReturnValue(false);

    const metrics = collectMemoryMetrics('/test/project');

    expect(metrics.timestamp).toBeDefined();
    expect(new Date(metrics.timestamp).getTime()).not.toBeNaN();
  });
});

describe('appendMetricSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('');
  });

  it('appends metrics to JSONL file', () => {
    const metrics = collectMemoryMetrics('/test/project');
    appendMetricSnapshot('/test/project', metrics);

    expect(mockAppendFileSync).toHaveBeenCalledOnce();
    const [path, content] = mockAppendFileSync.mock.calls[0] as [string, string];
    expect(path).toContain('memory-metrics.jsonl');
    expect(content.endsWith('\n')).toBe(true);

    const parsed = JSON.parse(content.trim());
    expect(parsed.decisions).toBeDefined();
    expect(parsed.queues).toBeDefined();
    expect(parsed.timestamp).toBeDefined();
  });

  it('creates directory if missing', () => {
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('logs')) return false;
      return false;
    });

    appendMetricSnapshot('/test/project');

    expect(mkdirSync).toHaveBeenCalled();
  });
});

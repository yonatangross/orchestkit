/**
 * Tests for Memory Metrics Collector Hook
 *
 * v7: Hook simplified to no-op (orphan JSONL write removed #919).
 * Just logs and returns outputSilentSuccess.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { memoryMetricsCollector } from '../../lifecycle/memory-metrics-collector.js';
import type { HookInput } from '../../types.js';

// Mock dependencies
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

import { logHook } from '../../lib/common.js';

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

  it('returns outputSilentSuccess', () => {
    const result = memoryMetricsCollector(createInput());
    expect(result).toEqual({ continue: true, suppressOutput: true });
  });

  it('logs hook execution on every call', () => {
    memoryMetricsCollector(createInput());
    expect(logHook).toHaveBeenCalledWith(
      'memory-metrics-collector',
      expect.stringContaining('no-op'),
    );
  });

  it('returns silent success regardless of input', () => {
    const result = memoryMetricsCollector(createInput({ project_dir: undefined }));
    expect(result).toEqual({ continue: true, suppressOutput: true });
  });
});

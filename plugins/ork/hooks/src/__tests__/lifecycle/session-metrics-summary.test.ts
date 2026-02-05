/**
 * Unit tests for session-metrics-summary lifecycle hook
 * Tests metrics summary generation at session end
 *
 * NOTE: This test mocks node:fs to avoid file system race conditions
 * when running in parallel with other test files that use the same
 * hardcoded metrics file path (/tmp/claude-session-metrics.json).
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST be before imports
// =============================================================================

// Mock file content for the metrics file
let mockFileContent: string | null = null;
let mockFileExists = false;

vi.mock('node:fs', () => ({
  existsSync: vi.fn((path: string) => {
    if (path === '/tmp/claude-session-metrics.json') {
      return mockFileExists;
    }
    return false;
  }),
  readFileSync: vi.fn((path: string) => {
    if (path === '/tmp/claude-session-metrics.json' && mockFileContent !== null) {
      return mockFileContent;
    }
    throw new Error('File not found');
  }),
}));

vi.mock('../../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/common.js')>();
  return {
    ...actual,
    logHook: vi.fn(),
    outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  };
});

// Import after mocks
import { sessionMetricsSummary } from '../../lifecycle/session-metrics-summary.js';
import { logHook, outputSilentSuccess } from '../../lib/common.js';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = join(tmpdir(), 'session-metrics-summary-test');

/**
 * Create realistic HookInput for testing
 */
function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: 'test-session-metrics-123',
    project_dir: TEST_PROJECT_DIR,
    tool_input: {},
    ...overrides,
  };
}

/**
 * Set mock metrics file content
 */
function setMockMetricsFile(metrics: Record<string, unknown> | null): void {
  if (metrics === null) {
    mockFileExists = false;
    mockFileContent = null;
  } else {
    mockFileExists = true;
    mockFileContent = JSON.stringify(metrics);
  }
}

/**
 * Set mock metrics file with raw string content
 */
function setMockMetricsFileRaw(content: string | null): void {
  if (content === null) {
    mockFileExists = false;
    mockFileContent = null;
  } else {
    mockFileExists = true;
    mockFileContent = content;
  }
}

/**
 * Create metrics with tool counts
 */
function createToolMetrics(tools: Record<string, number>, errors: number = 0): void {
  setMockMetricsFile({
    tools,
    errors,
    timestamp: new Date().toISOString(),
  });
}

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();

  // Reset mock file state
  mockFileExists = false;
  mockFileContent = null;

  // Set environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;
});

// =============================================================================
// Tests
// =============================================================================

describe('session-metrics-summary', () => {
  describe('basic behavior', () => {
    test('returns silent success when no metrics file exists', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = sessionMetricsSummary(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('logs message when no metrics file found', () => {
      // Arrange
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        'No metrics file found'
      );
    });

    test('returns silent success when metrics exist', () => {
      // Arrange
      createToolMetrics({ Bash: 5, Read: 10 });
      const input = createHookInput();

      // Act
      const result = sessionMetricsSummary(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('metrics parsing', () => {
    test('calculates total tool calls correctly', () => {
      // Arrange
      createToolMetrics({ Bash: 5, Read: 10, Write: 3 });
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining('18 tool calls')
      );
    });

    test('reports zero tool calls when tools object is empty', () => {
      // Arrange
      createToolMetrics({});
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining('0 tool calls')
      );
    });

    test('reports error count in summary', () => {
      // Arrange
      createToolMetrics({ Bash: 5 }, 3);
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining('3 errors')
      );
    });

    test('handles missing tools field gracefully', () => {
      // Arrange
      setMockMetricsFile({ errors: 1 });
      const input = createHookInput();

      // Act
      const result = sessionMetricsSummary(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining('0 tool calls')
      );
    });

    test('handles missing errors field gracefully', () => {
      // Arrange
      setMockMetricsFile({ tools: { Bash: 5 } });
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining('0 errors')
      );
    });
  });

  describe('top tools calculation', () => {
    test('identifies top 3 tools by usage', () => {
      // Arrange
      createToolMetrics({
        Bash: 20,
        Read: 15,
        Write: 10,
        Edit: 5,
        Glob: 2,
      });
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining('Bash: 20')
      );
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining('Read: 15')
      );
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining('Write: 10')
      );
    });

    test('handles fewer than 3 tools', () => {
      // Arrange
      createToolMetrics({ Bash: 5, Read: 3 });
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining('Bash: 5')
      );
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining('Read: 3')
      );
    });

    test('handles single tool', () => {
      // Arrange
      createToolMetrics({ Bash: 5 });
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining('Bash: 5')
      );
    });

    test('does not log top tools when no tools used', () => {
      // Arrange
      createToolMetrics({});
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(logHook).not.toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining('Top tools:')
      );
    });

    test('sorts tools by count descending', () => {
      // Arrange
      createToolMetrics({
        Edit: 5,
        Bash: 20,
        Read: 10,
      });
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      // The log should show Bash first (highest), then Read, then Edit
      const topToolsCall = vi.mocked(logHook).mock.calls.find(
        call => call[1].includes('Top tools:')
      );
      expect(topToolsCall).toBeDefined();
      const message = topToolsCall![1];
      const bashIndex = message.indexOf('Bash');
      const readIndex = message.indexOf('Read');
      const editIndex = message.indexOf('Edit');
      expect(bashIndex).toBeLessThan(readIndex);
      expect(readIndex).toBeLessThan(editIndex);
    });
  });

  describe('error handling', () => {
    test('handles invalid JSON gracefully', () => {
      // Arrange
      setMockMetricsFileRaw('invalid json {');
      const input = createHookInput();

      // Act
      const result = sessionMetricsSummary(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('logs error when JSON parsing fails', () => {
      // Arrange
      setMockMetricsFileRaw('invalid json {');
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining('Failed to read metrics')
      );
    });

    test('handles empty metrics file', () => {
      // Arrange
      setMockMetricsFileRaw('');
      const input = createHookInput();

      // Act
      const result = sessionMetricsSummary(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('never blocks session end', () => {
      // Arrange
      setMockMetricsFileRaw('corrupted data!!!');
      const input = createHookInput();

      // Act
      const result = sessionMetricsSummary(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });
  });

  describe('logging behavior', () => {
    test('logs session ending message', () => {
      // Arrange
      createToolMetrics({ Bash: 5 });
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        'Session ending - generating summary'
      );
    });

    test('logs session stats with tool count and errors', () => {
      // Arrange
      createToolMetrics({ Bash: 10, Read: 5 }, 2);
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        'Session stats: 15 tool calls, 2 errors'
      );
    });

    test('logs top tools when tools were used', () => {
      // Arrange
      createToolMetrics({ Bash: 10, Read: 5, Write: 3 });
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining('Top tools:')
      );
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', () => {
      // Arrange
      createToolMetrics({ Bash: 5 });
      const input = createHookInput();

      // Act
      const result = sessionMetricsSummary(input);

      // Assert
      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('suppressOutput', true);
    });

    test('always returns continue: true for non-blocking hook', () => {
      // Arrange - various error conditions
      const testCases = [
        () => setMockMetricsFile(null), // No metrics file
        () => setMockMetricsFileRaw('invalid'),
        () => setMockMetricsFile({}),
        () => setMockMetricsFile({ tools: null }),
      ];

      // Act & Assert
      for (const setup of testCases) {
        vi.clearAllMocks();
        mockFileExists = false;
        mockFileContent = null;
        setup();
        const input = createHookInput();
        const result = sessionMetricsSummary(input);
        expect(result.continue).toBe(true);
      }
    });

    test('always suppresses output', () => {
      // Arrange
      createToolMetrics({ Bash: 100, Read: 50 }, 10);
      const input = createHookInput();

      // Act
      const result = sessionMetricsSummary(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('parametric tests', () => {
    test.each([
      [{ Bash: 10 }, 10],
      [{ Bash: 10, Read: 5 }, 15],
      [{ Bash: 10, Read: 5, Write: 3, Edit: 2 }, 20],
      [{}, 0],
    ])('calculates total correctly for %o', (tools, expectedTotal) => {
      // Arrange
      createToolMetrics(tools);
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining(`${expectedTotal} tool calls`)
      );
    });

    test.each([
      [0, '0 errors'],
      [1, '1 errors'],
      [5, '5 errors'],
      [100, '100 errors'],
    ])('displays error count %d as "%s"', (errorCount, expectedString) => {
      // Arrange
      createToolMetrics({ Bash: 1 }, errorCount);
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining(expectedString)
      );
    });

    test.each([
      [{ A: 1, B: 2, C: 3 }, ['C', 'B', 'A']],
      [{ X: 100, Y: 50, Z: 25 }, ['X', 'Y', 'Z']],
      [{ Single: 1 }, ['Single']],
    ])('sorts tools correctly for %o', (tools, expectedOrder) => {
      // Arrange
      createToolMetrics(tools);
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      const topToolsCall = vi.mocked(logHook).mock.calls.find(
        call => call[1].includes('Top tools:')
      );
      if (Object.keys(tools).length > 0) {
        expect(topToolsCall).toBeDefined();
        const message = topToolsCall![1];
        for (let i = 0; i < expectedOrder.length - 1 && i < 2; i++) {
          const currentIndex = message.indexOf(expectedOrder[i]);
          const nextIndex = message.indexOf(expectedOrder[i + 1]);
          expect(currentIndex).toBeLessThan(nextIndex);
        }
      }
    });
  });

  describe('edge cases', () => {
    test('handles very large tool counts', () => {
      // Arrange
      createToolMetrics({ Bash: 999999 });
      const input = createHookInput();

      // Act
      const result = sessionMetricsSummary(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(logHook).toHaveBeenCalledWith(
        'session-metrics-summary',
        expect.stringContaining('999999 tool calls')
      );
    });

    test('handles many different tools', () => {
      // Arrange
      const tools: Record<string, number> = {};
      for (let i = 0; i < 50; i++) {
        tools[`Tool${i}`] = i + 1;
      }
      createToolMetrics(tools);
      const input = createHookInput();

      // Act
      const result = sessionMetricsSummary(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles tool names with special characters', () => {
      // Arrange
      createToolMetrics({ 'Tool-With_Special.Chars': 5 });
      const input = createHookInput();

      // Act
      const result = sessionMetricsSummary(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles negative tool counts gracefully', () => {
      // Arrange - should not happen in practice but test robustness
      createToolMetrics({ Bash: -5 });
      const input = createHookInput();

      // Act
      const result = sessionMetricsSummary(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles floating point tool counts', () => {
      // Arrange - should not happen but test robustness
      setMockMetricsFile({ tools: { Bash: 5.5 } });
      const input = createHookInput();

      // Act
      const result = sessionMetricsSummary(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles null tools field', () => {
      // Arrange
      setMockMetricsFile({ tools: null, errors: 0 });
      const input = createHookInput();

      // Act
      const result = sessionMetricsSummary(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles array instead of object for tools', () => {
      // Arrange
      setMockMetricsFile({ tools: ['Bash', 'Read'] });
      const input = createHookInput();

      // Act
      const result = sessionMetricsSummary(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('integration with common utilities', () => {
    test('calls outputSilentSuccess for return value', () => {
      // Arrange
      createToolMetrics({ Bash: 5 });
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('uses correct hook name in all log calls', () => {
      // Arrange
      createToolMetrics({ Bash: 5 }, 2);
      const input = createHookInput();

      // Act
      sessionMetricsSummary(input);

      // Assert
      const allLogCalls = vi.mocked(logHook).mock.calls;
      for (const call of allLogCalls) {
        expect(call[0]).toBe('session-metrics-summary');
      }
    });
  });
});

/**
 * Unit tests for eval-metrics-collector hook
 * Tests collection and summarization of LLM evaluation metrics on Stop event
 *
 * Coverage Focus: Validates eval results detection, JSON parsing,
 * DeepEval/RAGAS detection, and stderr output
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST come before imports
// =============================================================================

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockReaddirSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
}));

vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-123'),
}));

import { evalMetricsCollector } from '../../skill/eval-metrics-collector.js';
import { outputSilentSuccess, getProjectDir } from '../../lib/common.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Capture stderr writes
 */
let stderrOutput: string[] = [];
const originalStderrWrite = process.stderr.write;

function captureStderr(): void {
  stderrOutput = [];
  process.stderr.write = (chunk: string | Uint8Array): boolean => {
    if (typeof chunk === 'string') {
      stderrOutput.push(chunk);
    }
    return true;
  };
}

function restoreStderr(): void {
  process.stderr.write = originalStderrWrite;
}

/**
 * Create a mock HookInput for Stop event
 */
function createStopInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {},
    hook_event: 'Stop',
    ...overrides,
  };
}

// =============================================================================
// Eval Metrics Collector Tests
// =============================================================================

describe('eval-metrics-collector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captureStderr();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreStderr();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('always returns continue: true (non-blocking)', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      const result = evalMetricsCollector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns valid HookResult structure', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      const result = evalMetricsCollector(input);

      // Assert
      expect(typeof result.continue).toBe('boolean');
      expect(result.suppressOutput).toBe(true);
    });

    test('returns outputSilentSuccess for all paths', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Evaluation results detection
  // ---------------------------------------------------------------------------

  describe('evaluation results detection', () => {
    test('detects eval_results.json', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/eval_results.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({
        accuracy: 0.95,
        f1_score: 0.92,
      }));
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      expect(stderrOutput.join('')).toContain('Evaluation results found');
    });

    test('parses and displays numeric metrics', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/eval_results.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({
        accuracy: 0.95,
        precision: 0.88,
        recall: 0.91,
      }));
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      const output = stderrOutput.join('');
      expect(output).toContain('accuracy: 0.95');
      expect(output).toContain('precision: 0.88');
      expect(output).toContain('recall: 0.91');
    });

    test('formats integer metrics without decimals', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/eval_results.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({
        total_tests: 100,
        passed: 95,
        failed: 5,
      }));
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      const output = stderrOutput.join('');
      expect(output).toContain('total_tests: 100');
      expect(output).toContain('passed: 95');
      expect(output).toContain('failed: 5');
    });

    test('formats float metrics with 2 decimals', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/eval_results.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({
        accuracy: 0.956789,
      }));
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      expect(stderrOutput.join('')).toContain('accuracy: 0.96');
    });

    test('ignores non-numeric values in results', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/eval_results.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({
        accuracy: 0.95,
        model_name: 'gpt-4',
        config: { threshold: 0.5 },
      }));
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      const output = stderrOutput.join('');
      expect(output).toContain('accuracy: 0.95');
      expect(output).not.toContain('model_name');
      expect(output).not.toContain('config');
    });
  });

  // ---------------------------------------------------------------------------
  // DeepEval detection
  // ---------------------------------------------------------------------------

  describe('DeepEval detection', () => {
    test('detects .deepeval directory', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.deepeval';
      });
      mockReaddirSync.mockReturnValue(['test_run_1.json', 'test_run_2.json']);
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      expect(stderrOutput.join('')).toContain('DeepEval results directory found');
    });

    test('lists first 5 files in .deepeval', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.deepeval';
      });
      mockReaddirSync.mockReturnValue([
        'test_1.json',
        'test_2.json',
        'test_3.json',
        'test_4.json',
        'test_5.json',
        'test_6.json',
        'test_7.json',
      ]);
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      const output = stderrOutput.join('');
      expect(output).toContain('test_1.json');
      expect(output).toContain('test_5.json');
      expect(output).not.toContain('test_6.json');
    });

    test('handles readdir error gracefully', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/.deepeval';
      });
      mockReaddirSync.mockImplementation(() => {
        throw new Error('EACCES');
      });
      const input = createStopInput();

      // Act
      const result = evalMetricsCollector(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // RAGAS detection
  // ---------------------------------------------------------------------------

  describe('RAGAS detection', () => {
    test('detects ragas_results.json', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/ragas_results.json';
      });
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      expect(stderrOutput.join('')).toContain('RAGAS evaluation results found');
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple results
  // ---------------------------------------------------------------------------

  describe('multiple results', () => {
    test('reports all found evaluation sources', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        if (path === '/test/project/eval_results.json') return true;
        if (path === '/test/project/.deepeval') return true;
        if (path === '/test/project/ragas_results.json') return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ accuracy: 0.9 }));
      mockReaddirSync.mockReturnValue(['test.json']);
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      const output = stderrOutput.join('');
      expect(output).toContain('Evaluation results found');
      expect(output).toContain('DeepEval results directory found');
      expect(output).toContain('RAGAS evaluation results found');
    });
  });

  // ---------------------------------------------------------------------------
  // JSON parsing edge cases
  // ---------------------------------------------------------------------------

  describe('JSON parsing edge cases', () => {
    test('handles invalid JSON gracefully', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/eval_results.json';
      });
      mockReadFileSync.mockReturnValue('not valid json {{{');
      const input = createStopInput();

      // Act
      const result = evalMetricsCollector(input);

      // Assert
      expect(result.continue).toBe(true);
      // Should show first 20 lines of raw content
      expect(stderrOutput.join('')).toContain('not valid json');
    });

    test('handles empty JSON object', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/eval_results.json';
      });
      mockReadFileSync.mockReturnValue('{}');
      const input = createStopInput();

      // Act
      const result = evalMetricsCollector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles null JSON value', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/eval_results.json';
      });
      mockReadFileSync.mockReturnValue('null');
      const input = createStopInput();

      // Act
      const result = evalMetricsCollector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles array JSON value', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/eval_results.json';
      });
      mockReadFileSync.mockReturnValue('[1, 2, 3]');
      const input = createStopInput();

      // Act
      const result = evalMetricsCollector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('shows first 20 lines when JSON parsing fails', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/eval_results.json';
      });
      const lines = Array(25).fill('line content').join('\n');
      mockReadFileSync.mockReturnValue(lines);
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      const output = stderrOutput.join('');
      const lineMatches = output.match(/line content/g) || [];
      expect(lineMatches.length).toBeLessThanOrEqual(20);
    });

    test('handles file read error gracefully', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/eval_results.json';
      });
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const input = createStopInput();

      // Act
      const result = evalMetricsCollector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(stderrOutput.join('')).toContain('Unable to read file');
    });
  });

  // ---------------------------------------------------------------------------
  // Stderr output format
  // ---------------------------------------------------------------------------

  describe('stderr output format', () => {
    test('outputs group markers', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      const output = stderrOutput.join('');
      expect(output).toContain('::group::LLM Evaluation Summary');
      expect(output).toContain('::endgroup::');
    });

    test('outputs evaluation complete message', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      expect(stderrOutput.join('')).toContain('Evaluation complete');
    });

    test('includes review guidance', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      expect(stderrOutput.join('')).toContain('review metrics above');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles no evaluation files', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      const result = evalMetricsCollector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles undefined input gracefully', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input: HookInput = {
        tool_name: '',
        session_id: '',
        tool_input: {},
      };

      // Act
      const result = evalMetricsCollector(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Project directory resolution
  // ---------------------------------------------------------------------------

  describe('project directory resolution', () => {
    test('uses getProjectDir for file paths', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      expect(getProjectDir).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Metric value types
  // ---------------------------------------------------------------------------

  describe('metric value types', () => {
    test.each([
      [{ score: 100 }, '100'],
      [{ score: 0 }, '0'],
      [{ score: 0.5 }, '0.50'],
      [{ score: 0.123 }, '0.12'],
      [{ score: 99.999 }, '100.00'],
    ])('formats metric value correctly: %o -> %s', (data, expected) => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/eval_results.json';
      });
      mockReadFileSync.mockReturnValue(JSON.stringify(data));
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      expect(stderrOutput.join('')).toContain(`score: ${expected}`);
    });
  });

  // ---------------------------------------------------------------------------
  // Blank line handling
  // ---------------------------------------------------------------------------

  describe('blank line handling', () => {
    test('includes blank lines between sections', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        if (path === '/test/project/eval_results.json') return true;
        if (path === '/test/project/.deepeval') return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ accuracy: 0.9 }));
      mockReaddirSync.mockReturnValue(['test.json']);
      const input = createStopInput();

      // Act
      evalMetricsCollector(input);

      // Assert
      // Should have newlines for readability
      expect(stderrOutput).toContainEqual('\n');
    });
  });
});

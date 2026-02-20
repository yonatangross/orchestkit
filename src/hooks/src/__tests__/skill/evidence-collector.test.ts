/**
 * Unit tests for evidence-collector hook
 * Tests evidence collection and logging for the evidence-verification skill
 *
 * CC 2.1.7 Compliant: All paths return { continue: true }
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST come BEFORE imports
// =============================================================================

const { mockAppendFileSync } = vi.hoisted(() => ({
  mockAppendFileSync: vi.fn(),
}));

vi.mock('../../lib/analytics-buffer.js', () => ({
  bufferWrite: vi.fn((filePath: string, content: string) => {
    mockAppendFileSync(filePath, content);
  }),
  flush: vi.fn(),
  pendingCount: vi.fn(() => 0),
  _resetForTesting: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  appendFileSync: mockAppendFileSync,
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
}));

vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getLogDir: vi.fn(() => '/test/logs'),
  getProjectDir: vi.fn(() => '/test/project'),
}));

import { evidenceCollector } from '../../skill/evidence-collector.js';
import { outputSilentSuccess, getLogDir, getProjectDir } from '../../lib/common.js';
import { existsSync, appendFileSync, mkdirSync, readdirSync } from 'node:fs';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput
 */
function createInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Stop',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {},
    ...overrides,
  };
}

// =============================================================================
// Evidence Collector Tests
// =============================================================================

describe('evidence-collector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset process.env
    delete process.env.CC_LAST_EXIT_CODE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance - all paths must return continue: true
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true with minimal input', () => {
      // Arrange
      const input = createInput();

      // Act
      const result = evidenceCollector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true when log directory creation fails', () => {
      // Arrange
      const input = createInput();
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Act
      const result = evidenceCollector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true when appendFileSync fails', () => {
      // Arrange
      const input = createInput();
      vi.mocked(appendFileSync).mockImplementation(() => {
        throw new Error('Disk full');
      });

      // Act
      const result = evidenceCollector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true when readdirSync fails', () => {
      // Arrange
      const input = createInput();
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Act
      const result = evidenceCollector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always calls outputSilentSuccess', () => {
      // Arrange
      const input = createInput();

      // Act
      evidenceCollector(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Log directory setup
  // ---------------------------------------------------------------------------

  describe('log directory setup', () => {
    test('creates log directory with recursive option', () => {
      // Arrange
      const input = createInput();

      // Act
      evidenceCollector(input);

      // Assert
      expect(mkdirSync).toHaveBeenCalledWith('/test/logs', { recursive: true });
    });

    test('uses getLogDir for log directory path', () => {
      // Arrange
      const input = createInput();
      vi.mocked(getLogDir).mockReturnValue('/custom/log/path');

      // Act
      evidenceCollector(input);

      // Assert
      expect(getLogDir).toHaveBeenCalled();
      expect(mkdirSync).toHaveBeenCalledWith('/custom/log/path', { recursive: true });
    });
  });

  // ---------------------------------------------------------------------------
  // Evidence collection - exit codes
  // ---------------------------------------------------------------------------

  describe('exit code collection', () => {
    test('logs CC_LAST_EXIT_CODE when present', () => {
      // Arrange
      const input = createInput();
      process.env.CC_LAST_EXIT_CODE = '0';

      // Act
      evidenceCollector(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0]?.[1] as string;
      expect(logContent).toContain('Last exit code: 0');
    });

    test('logs non-zero exit code', () => {
      // Arrange
      const input = createInput();
      process.env.CC_LAST_EXIT_CODE = '1';

      // Act
      evidenceCollector(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0]?.[1] as string;
      expect(logContent).toContain('Last exit code: 1');
    });

    test('does not log exit code when CC_LAST_EXIT_CODE is not set', () => {
      // Arrange
      const input = createInput();

      // Act
      evidenceCollector(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0]?.[1] as string;
      expect(logContent).not.toContain('Last exit code');
    });
  });

  // ---------------------------------------------------------------------------
  // Evidence collection - test results
  // ---------------------------------------------------------------------------

  describe('test results detection', () => {
    test.each([
      ['pytest.xml', '/test/project/pytest.xml'],
      ['junit.xml', '/test/project/junit.xml'],
    ])('detects %s test results', (_name, filePath) => {
      // Arrange
      const input = createInput();
      vi.mocked(existsSync).mockImplementation((path) => path === filePath);

      // Act
      evidenceCollector(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0]?.[1] as string;
      expect(logContent).toContain('Test results: Found (XML format)');
    });

    test('detects test-results directory', () => {
      // Arrange
      const input = createInput();
      vi.mocked(existsSync).mockImplementation((path) =>
        path === '/test/project/test-results'
      );
      vi.mocked(readdirSync).mockReturnValue(['test1.json', 'test2.json'] as any);

      // Act
      evidenceCollector(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0]?.[1] as string;
      expect(logContent).toContain('Test results directory: Found');
      expect(logContent).toContain('test1.json');
      expect(logContent).toContain('test2.json');
    });

    test('lists up to 5 files from test-results directory', () => {
      // Arrange
      const input = createInput();
      vi.mocked(existsSync).mockImplementation((path) =>
        path === '/test/project/test-results'
      );
      vi.mocked(readdirSync).mockReturnValue([
        'test1.json', 'test2.json', 'test3.json',
        'test4.json', 'test5.json', 'test6.json', 'test7.json'
      ] as any);

      // Act
      evidenceCollector(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0]?.[1] as string;
      expect(logContent).toContain('test1.json');
      expect(logContent).toContain('test5.json');
      expect(logContent).not.toContain('test6.json');
      expect(logContent).not.toContain('test7.json');
    });
  });

  // ---------------------------------------------------------------------------
  // Evidence collection - coverage
  // ---------------------------------------------------------------------------

  describe('coverage detection', () => {
    test.each([
      ['.coverage', '/test/project/.coverage'],
      ['coverage', '/test/project/coverage'],
    ])('detects %s coverage data', (_name, filePath) => {
      // Arrange
      const input = createInput();
      vi.mocked(existsSync).mockImplementation((path) => path === filePath);

      // Act
      evidenceCollector(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0]?.[1] as string;
      expect(logContent).toContain('Coverage data: Found');
    });

    test('does not report coverage when neither file exists', () => {
      // Arrange
      const input = createInput();
      vi.mocked(existsSync).mockReturnValue(false);

      // Act
      evidenceCollector(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0]?.[1] as string;
      expect(logContent).not.toContain('Coverage data');
    });
  });

  // ---------------------------------------------------------------------------
  // Evidence collection - lint results
  // ---------------------------------------------------------------------------

  describe('lint results detection', () => {
    test.each([
      ['lint-results.json', '/test/project/lint-results.json'],
      ['eslint-report.json', '/test/project/eslint-report.json'],
    ])('detects %s lint results', (_name, filePath) => {
      // Arrange
      const input = createInput();
      vi.mocked(existsSync).mockImplementation((path) => path === filePath);

      // Act
      evidenceCollector(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0]?.[1] as string;
      expect(logContent).toContain('Lint results: Found');
    });
  });

  // ---------------------------------------------------------------------------
  // Log file output
  // ---------------------------------------------------------------------------

  describe('log file output', () => {
    test('writes to evidence-collector.log in log directory', () => {
      // Arrange
      const input = createInput();
      vi.mocked(getLogDir).mockReturnValue('/custom/logs');

      // Act
      evidenceCollector(input);

      // Assert
      expect(appendFileSync).toHaveBeenCalledWith(
        '/custom/logs/evidence-collector.log',
        expect.any(String)
      );
    });

    test('log output includes timestamp', () => {
      // Arrange
      const input = createInput();

      // Act
      evidenceCollector(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0]?.[1] as string;
      // Matches format: [YYYY-MM-DD HH:MM:SS]
      expect(logContent).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/);
    });

    test('log output includes Evidence Collection header', () => {
      // Arrange
      const input = createInput();

      // Act
      evidenceCollector(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0]?.[1] as string;
      expect(logContent).toContain('Evidence Collection');
    });

    test('log output ends with completion message', () => {
      // Arrange
      const input = createInput();

      // Act
      evidenceCollector(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0]?.[1] as string;
      expect(logContent).toContain('Evidence verification complete.');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty tool_input', () => {
      // Arrange
      const input = createInput({ tool_input: {} });

      // Act & Assert
      expect(() => evidenceCollector(input)).not.toThrow();
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('handles undefined project_dir gracefully', () => {
      // Arrange
      const input = createInput({ project_dir: undefined });

      // Act & Assert
      expect(() => evidenceCollector(input)).not.toThrow();
    });

    test('handles all evidence types present simultaneously', () => {
      // Arrange
      const input = createInput();
      process.env.CC_LAST_EXIT_CODE = '0';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['test.json'] as any);

      // Act
      evidenceCollector(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0]?.[1] as string;
      expect(logContent).toContain('Last exit code: 0');
      expect(logContent).toContain('Test results: Found');
      expect(logContent).toContain('Coverage data: Found');
      expect(logContent).toContain('Lint results: Found');
    });

    test('handles no evidence found', () => {
      // Arrange
      const input = createInput();
      vi.mocked(existsSync).mockReturnValue(false);

      // Act
      evidenceCollector(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0]?.[1] as string;
      expect(logContent).toContain('Recent command results:');
      expect(logContent).toContain('Evidence verification complete.');
    });

    test('uses getProjectDir for project path', () => {
      // Arrange
      const input = createInput();
      vi.mocked(getProjectDir).mockReturnValue('/custom/project');

      // Act
      evidenceCollector(input);

      // Assert
      expect(getProjectDir).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Error resilience
  // ---------------------------------------------------------------------------

  describe('error resilience', () => {
    test('continues when mkdirSync throws EEXIST', () => {
      // Arrange
      const input = createInput();
      const error = new Error('EEXIST');
      (error as any).code = 'EEXIST';
      vi.mocked(mkdirSync).mockImplementation(() => { throw error; });

      // Act
      const result = evidenceCollector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('logging errors do not propagate', () => {
      // Arrange
      const input = createInput();
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(appendFileSync).mockImplementation(() => {
        throw new Error('Write failed');
      });

      // Act
      const result = evidenceCollector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Output format
  // ---------------------------------------------------------------------------

  describe('output format', () => {
    test('returns suppressOutput: true', () => {
      // Arrange
      const input = createInput();
      vi.mocked(existsSync).mockReturnValue(false);

      // Act
      const result = evidenceCollector(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });

    test('result matches outputSilentSuccess format', () => {
      // Arrange
      const input = createInput();
      vi.mocked(existsSync).mockReturnValue(false);

      // Act
      const result = evidenceCollector(input);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });
});

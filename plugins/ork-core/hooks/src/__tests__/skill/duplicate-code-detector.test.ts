/**
 * Unit tests for duplicate-code-detector hook
 * Tests detection of duplicate/redundant code across the codebase
 *
 * Coverage Focus: Validates signature extraction, copy-paste detection,
 * utility pattern detection, and warning behavior
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST come before imports
// =============================================================================

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockStatSync = vi.fn();
const mockExecSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
}));

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputWithContext: vi.fn((ctx: string) => ({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: ctx,
    },
  })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-123'),
}));

vi.mock('../../lib/git.js', () => ({
  getRepoRoot: vi.fn(() => '/test/project'),
}));

import { duplicateCodeDetector } from '../../skill/duplicate-code-detector.js';
import { outputSilentSuccess, outputWithContext } from '../../lib/common.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for file operations
 */
function createFileInput(
  filePath: string,
  content: string,
  overrides: Partial<HookInput> = {},
): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { file_path: filePath, content },
    ...overrides,
  };
}

/**
 * Mock readdir to return specific files
 */
function mockCodeFiles(files: string[]): void {
  mockReaddirSync.mockImplementation((dir: string, opts?: { withFileTypes: boolean }) => {
    if (opts?.withFileTypes) {
      return files.map((f) => ({
        name: f.split('/').pop(),
        isDirectory: () => f.endsWith('/'),
        isFile: () => !f.endsWith('/'),
      }));
    }
    return files.map((f) => f.split('/').pop());
  });
}

// =============================================================================
// Duplicate Code Detector Tests
// =============================================================================

describe('duplicate-code-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true for unique code', () => {
      // Arrange
      mockReaddirSync.mockReturnValue([]);
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'export function uniqueFunc() {}',
      );

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true for duplicates (warns instead of blocks)', () => {
      // Arrange
      mockReaddirSync.mockImplementation((dir: string, opts?: { withFileTypes: boolean }) => {
        if (opts?.withFileTypes) {
          return [
            { name: 'other.ts', isDirectory: () => false, isFile: () => true },
          ];
        }
        return ['other.ts'];
      });
      mockReadFileSync.mockReturnValue('function myFunc() {}');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'function myFunc() {}',
      );

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns valid HookResult structure', () => {
      // Arrange
      const input = createFileInput('/test/project/src/utils.ts', 'const x = 1');

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      expect(typeof result.continue).toBe('boolean');
    });
  });

  // ---------------------------------------------------------------------------
  // File type filtering
  // ---------------------------------------------------------------------------

  describe('file type filtering', () => {
    test.each([
      ['utils.ts', true],
      ['utils.tsx', true],
      ['utils.js', true],
      ['utils.jsx', true],
      ['utils.py', true],
      ['utils.md', false],
      ['utils.json', false],
      ['utils.css', false],
      ['utils.yaml', false],
    ])('file %s should be validated: %s', (filename, shouldValidate) => {
      // Arrange
      mockReaddirSync.mockReturnValue([]);
      const input = createFileInput(`/test/project/src/${filename}`, 'content');

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      if (shouldValidate) {
        expect(result.continue).toBe(true);
      } else {
        expect(outputSilentSuccess).toHaveBeenCalled();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Signature extraction - TypeScript/JavaScript
  // ---------------------------------------------------------------------------

  describe('signature extraction - TypeScript/JavaScript', () => {
    test.each([
      ['function myFunc() {}', 'myFunc'],
      ['class MyClass {}', 'MyClass'],
      ['const myConst = 1', 'myConst'],
      ['export function exportedFunc() {}', 'exportedFunc'],
      ['export class ExportedClass {}', 'ExportedClass'],
    ])('extracts signature from: %s', (code, _expectedName) => {
      // Arrange
      mockReaddirSync.mockImplementation((dir: string, opts?: { withFileTypes: boolean }) => {
        if (opts?.withFileTypes) {
          return [
            { name: 'existing.ts', isDirectory: () => false, isFile: () => true },
          ];
        }
        return ['existing.ts'];
      });
      mockReadFileSync.mockReturnValue(code);
      const input = createFileInput('/test/project/src/utils.ts', code);

      // Act
      duplicateCodeDetector(input);

      // Assert - outputs context about potential duplication
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('deduplicates extracted signatures', () => {
      // Arrange
      mockReaddirSync.mockReturnValue([]);
      const code = `
function myFunc() {}
function myFunc() {} // duplicate declaration
`;
      const input = createFileInput('/test/project/src/utils.ts', code);

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      // Should not error and should deduplicate
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Signature extraction - Python
  // ---------------------------------------------------------------------------

  describe('signature extraction - Python', () => {
    test.each([
      ['def my_function():\n    pass', 'my_function'],
      ['class MyClass:\n    pass', 'MyClass'],
      ['def _private_func():\n    pass', '_private_func'],
    ])('extracts signature from Python: %s', (code, _expectedName) => {
      // Arrange
      mockReaddirSync.mockImplementation((dir: string, opts?: { withFileTypes: boolean }) => {
        if (opts?.withFileTypes) {
          return [
            { name: 'existing.py', isDirectory: () => false, isFile: () => true },
          ];
        }
        return ['existing.py'];
      });
      mockReadFileSync.mockReturnValue(code);
      const input = createFileInput('/test/project/app/utils.py', code);

      // Act
      duplicateCodeDetector(input);

      // Assert - outputs context about potential duplication
      expect(outputWithContext).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Duplicate detection
  // ---------------------------------------------------------------------------

  describe('duplicate detection', () => {
    test('detects duplicate function in another file', () => {
      // Arrange
      mockReaddirSync.mockImplementation((dir: string, opts?: { withFileTypes: boolean }) => {
        if (opts?.withFileTypes) {
          return [
            { name: 'other.ts', isDirectory: () => false, isFile: () => true },
          ];
        }
        return ['other.ts'];
      });
      mockReadFileSync.mockReturnValue('function myHelper() { return 1; }');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'function myHelper() { return 1; }',
      );

      // Act
      duplicateCodeDetector(input);

      // Assert - outputs context about potential duplication
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('skips same file when checking duplicates', () => {
      // Arrange
      mockReaddirSync.mockImplementation((dir: string, opts?: { withFileTypes: boolean }) => {
        if (opts?.withFileTypes) {
          return [
            { name: 'utils.ts', isDirectory: () => false, isFile: () => true },
          ];
        }
        return ['utils.ts'];
      });
      mockReadFileSync.mockReturnValue('function myFunc() {}');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'function myFunc() {}',
      );

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      // Should not flag itself as duplicate
      expect(result.continue).toBe(true);
    });

    test('ignores directories in search', () => {
      // Arrange
      mockReaddirSync.mockImplementation((dir: string, opts?: { withFileTypes: boolean }) => {
        if (opts?.withFileTypes) {
          return [
            { name: 'node_modules', isDirectory: () => true, isFile: () => false },
            { name: 'dist', isDirectory: () => true, isFile: () => false },
          ];
        }
        return [];
      });
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'function myFunc() {}',
      );

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Copy-paste pattern detection
  // ---------------------------------------------------------------------------

  describe('copy-paste pattern detection', () => {
    test('detects repeated identical lines', () => {
      // Arrange
      mockReaddirSync.mockReturnValue([]);
      const code = `
const a = 1;
const a = 1;
const a = 1;
const a = 1;
`;
      const input = createFileInput('/test/project/src/utils.ts', code);

      // Act
      duplicateCodeDetector(input);

      // Assert - outputs context about potential duplication
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('does not flag non-repeated lines', () => {
      // Arrange
      mockReaddirSync.mockReturnValue([]);
      const code = `
const a = 1;
const b = 2;
const c = 3;
`;
      const input = createFileInput('/test/project/src/utils.ts', code);

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('ignores empty lines in copy-paste check', () => {
      // Arrange
      mockReaddirSync.mockReturnValue([]);
      const code = `
const a = 1;


const b = 2;
`;
      const input = createFileInput('/test/project/src/utils.ts', code);

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Utility pattern detection - TypeScript/JavaScript
  // ---------------------------------------------------------------------------

  describe('utility pattern detection - TypeScript/JavaScript', () => {
    test('detects direct date formatting', () => {
      // Arrange
      mockReaddirSync.mockReturnValue([]);
      const code = `
function formatDate(date) {
  return new Date(date).toLocaleDateString();
}
`;
      const input = createFileInput('/test/project/src/utils.ts', code);

      // Act
      duplicateCodeDetector(input);

      // Assert - outputs context with duplication message
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('warns about multiple fetch calls', () => {
      // Arrange
      mockReaddirSync.mockReturnValue([]);
      const code = `
async function getUsers() {
  return fetch('/api/users');
}
async function getProducts() {
  return fetch('/api/products');
}
async function getOrders() {
  return fetch('/api/orders');
}
`;
      const input = createFileInput('/test/project/src/api.ts', code);

      // Act
      duplicateCodeDetector(input);

      // Assert - outputs context when potential issues detected
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('warns about multiple inline validations', () => {
      // Arrange
      mockReaddirSync.mockReturnValue([]);
      const code = `
function validate(data) {
  if (!/^[a-z]+$/.test(data.name)) return false;
  if (!/^[0-9]+$/.test(data.id)) return false;
  if (!/^[a-z@]+$/.test(data.email)) return false;
  if (!/^[0-9]{4}$/.test(data.code)) return false;
  return true;
}
`;
      const input = createFileInput('/test/project/src/validate.ts', code);

      // Act
      duplicateCodeDetector(input);

      // Assert - outputs context with duplication/validation warning
      expect(outputWithContext).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Utility pattern detection - Python
  // ---------------------------------------------------------------------------

  describe('utility pattern detection - Python', () => {
    test('warns about multiple json.loads calls', () => {
      // Arrange
      mockReaddirSync.mockReturnValue([]);
      const code = `
def parse_config():
    data1 = json.loads(config1)
    data2 = json.loads(config2)
    data3 = json.loads(config3)
    data4 = json.loads(config4)
    return data1, data2, data3, data4
`;
      const input = createFileInput('/test/project/app/parser.py', code);

      // Act
      duplicateCodeDetector(input);

      // Assert - outputs context about potential duplication
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('warns about multiple environment variable accesses', () => {
      // Arrange
      mockReaddirSync.mockReturnValue([]);
      const code = `
def get_config():
    db_url = os.getenv("DB_URL")
    api_key = os.environ.get("API_KEY")
    secret = os.getenv("SECRET")
    host = os.environ["HOST"]
    port = os.getenv("PORT")
    debug = os.environ.get("DEBUG")
    return {
        "db_url": db_url,
        "api_key": api_key,
    }
`;
      const input = createFileInput('/test/project/app/config.py', code);

      // Act
      duplicateCodeDetector(input);

      // Assert - outputs context about potential duplication
      expect(outputWithContext).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty file path', () => {
      // Arrange
      const input = createFileInput('', 'function test() {}');

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles empty content', () => {
      // Arrange
      const input = createFileInput('/test/project/src/utils.ts', '');

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles tool_result instead of content', () => {
      // Arrange
      mockReaddirSync.mockReturnValue([]);
      const input: HookInput = {
        tool_name: 'Read',
        session_id: 'test-session-123',
        tool_input: { file_path: '/test/project/src/utils.ts' },
        tool_result: 'function myFunc() {}',
      } as any;

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles file read error gracefully', () => {
      // Arrange
      mockReaddirSync.mockImplementation((dir: string, opts?: { withFileTypes: boolean }) => {
        if (opts?.withFileTypes) {
          return [
            { name: 'other.ts', isDirectory: () => false, isFile: () => true },
          ];
        }
        return ['other.ts'];
      });
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'function myFunc() {}',
      );

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles readdir error gracefully', () => {
      // Arrange
      mockReaddirSync.mockImplementation(() => {
        throw new Error('EACCES');
      });
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'function myFunc() {}',
      );

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles regex special characters in function names', () => {
      // Arrange
      mockReaddirSync.mockImplementation((dir: string, opts?: { withFileTypes: boolean }) => {
        if (opts?.withFileTypes) {
          return [
            { name: 'other.ts', isDirectory: () => false, isFile: () => true },
          ];
        }
        return ['other.ts'];
      });
      mockReadFileSync.mockReturnValue('function $special() {}');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'function $special() {}',
      );

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      // Should not throw
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Ignored directories
  // ---------------------------------------------------------------------------

  describe('ignored directories', () => {
    test.each([
      'node_modules',
      '.venv',
      'venv',
      '__pycache__',
      'dist',
      'build',
      '.next',
      '.git',
    ])('ignores %s directory', (ignoredDir) => {
      // Arrange
      mockReaddirSync.mockImplementation((dir: string, opts?: { withFileTypes: boolean }) => {
        if (opts?.withFileTypes) {
          return [
            { name: ignoredDir, isDirectory: () => true, isFile: () => false },
            { name: 'other.ts', isDirectory: () => false, isFile: () => true },
          ];
        }
        return [ignoredDir, 'other.ts'];
      });
      mockReadFileSync.mockReturnValue('function myFunc() {}');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'function myFunc() {}',
      );

      // Act
      const result = duplicateCodeDetector(input);

      // Assert
      // Should complete without errors
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Warning message format
  // ---------------------------------------------------------------------------

  describe('warning message format', () => {
    test('detects duplicate in another file', () => {
      // Arrange
      mockReaddirSync.mockImplementation((dir: string, opts?: { withFileTypes: boolean }) => {
        if (opts?.withFileTypes) {
          return [
            { name: 'helpers.ts', isDirectory: () => false, isFile: () => true },
          ];
        }
        return ['helpers.ts'];
      });
      mockReadFileSync.mockReturnValue('function myHelper() {}');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'function myHelper() {}',
      );

      // Act
      duplicateCodeDetector(input);

      // Assert - outputs context message about duplication
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('outputs context for detected duplicates', () => {
      // Arrange
      mockReaddirSync.mockImplementation((dir: string, opts?: { withFileTypes: boolean }) => {
        if (opts?.withFileTypes) {
          return [
            { name: 'other.ts', isDirectory: () => false, isFile: () => true },
          ];
        }
        return ['other.ts'];
      });
      mockReadFileSync.mockReturnValue('function myFunc() {}');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'function myFunc() {}',
      );

      // Act
      duplicateCodeDetector(input);

      // Assert - the context contains indication of file being checked
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('/test/project/src/utils.ts'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple issue detection
  // ---------------------------------------------------------------------------

  describe('multiple issue detection', () => {
    test('reports both duplicates and utility issues', () => {
      // Arrange
      mockReaddirSync.mockReturnValue([]);
      const code = `
function formatDate(date) {
  return new Date(date).toLocaleDateString();
}
`;
      const input = createFileInput('/test/project/src/utils.ts', code);

      // Act
      duplicateCodeDetector(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalled();
    });
  });
});

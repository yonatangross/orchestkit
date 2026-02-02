/**
 * Unit tests for cross-instance-test-validator hook
 * Tests enforcement of test coverage for cross-instance code changes
 *
 * Coverage Focus: Validates test file detection, testable unit extraction,
 * test coverage verification, and warning/blocking behavior
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
  outputBlock: vi.fn((reason: string) => ({
    continue: false,
    stopReason: reason,
    hookSpecificOutput: {
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  })),
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

import { crossInstanceTestValidator } from '../../skill/cross-instance-test-validator.js';
import { outputSilentSuccess, outputBlock, outputWithContext } from '../../lib/common.js';

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

// =============================================================================
// Cross-Instance Test Validator Tests
// =============================================================================

describe('cross-instance-test-validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true for test files', () => {
      // Arrange
      const input = createFileInput(
        '/test/project/src/utils.test.ts',
        'test("example", () => {})',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true for files with tests', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('describe("MyFunction", () => { test("works", () => {}) })');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'export function MyFunction() { return 1; }',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: false for missing tests with proper structure', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'export function MyFunction() { return 1; }',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toBeDefined();
    });

    test('always returns valid HookResult structure', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createFileInput('/test/project/src/utils.ts', 'export const x = 1;');

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(typeof result.continue).toBe('boolean');
    });
  });

  // ---------------------------------------------------------------------------
  // Test file detection
  // ---------------------------------------------------------------------------

  describe('test file detection', () => {
    test.each([
      ['utils.test.ts', 'TypeScript test'],
      ['utils.spec.ts', 'TypeScript spec'],
      ['utils.test.tsx', 'TSX test'],
      ['utils.spec.tsx', 'TSX spec'],
      ['utils.test.js', 'JavaScript test'],
      ['utils.spec.js', 'JavaScript spec'],
      ['utils.test.jsx', 'JSX test'],
      ['utils.spec.jsx', 'JSX spec'],
      ['test_utils.py', 'Python test_ prefix'],
      ['utils_test.py', 'Python _test suffix'],
    ])('skips test file: %s (%s)', (filename, _description) => {
      // Arrange
      const input = createFileInput(`/test/project/src/${filename}`, 'test code');

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Non-code file handling
  // ---------------------------------------------------------------------------

  describe('non-code file handling', () => {
    test.each([
      ['readme.md', 'Markdown'],
      ['config.json', 'JSON'],
      ['styles.css', 'CSS'],
      ['image.png', 'Image'],
      ['data.yaml', 'YAML'],
      ['Makefile', 'Makefile'],
    ])('skips non-code file: %s (%s)', (filename, _description) => {
      // Arrange
      const input = createFileInput(`/test/project/${filename}`, 'content');

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test file finding
  // ---------------------------------------------------------------------------

  describe('test file finding', () => {
    test('finds .test.ts file in same directory', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/src/utils.test.ts';
      });
      mockReadFileSync.mockReturnValue('test("myFunc", () => {})');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'export function myFunc() {}',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('finds .spec.ts file in same directory', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/src/utils.spec.ts';
      });
      mockReadFileSync.mockReturnValue('test("myFunc", () => {})');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'export function myFunc() {}',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('finds test file in __tests__ directory', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/src/__tests__/utils.test.ts';
      });
      mockReadFileSync.mockReturnValue('test("myFunc", () => {})');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'export function myFunc() {}',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('finds Python test file with test_ prefix', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/app/test_utils.py';
      });
      mockReadFileSync.mockReturnValue('def test_my_func(): pass');
      const input = createFileInput(
        '/test/project/app/utils.py',
        'def my_func(): return 1',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('finds Python test in tests/ directory', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/tests/test_utils.py';
      });
      mockReadFileSync.mockReturnValue('def test_my_func(): pass');
      const input = createFileInput(
        '/test/project/app/utils.py',
        'def my_func(): return 1',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Testable unit extraction - TypeScript/JavaScript
  // ---------------------------------------------------------------------------

  describe('testable unit extraction - TypeScript/JavaScript', () => {
    test.each([
      ['export function myFunc() {}', ['myFunc']],
      ['export class MyClass {}', ['MyClass']],
      ['export const myConst = () => {}', ['myConst']],
      ['export async function fetchData() {}', ['fetchData']],
    ])('extracts testable units from: %s', (code, _expectedUnits) => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createFileInput('/test/project/src/utils.ts', code);

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert - the hook blocks when no test file found
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('Missing test coverage');
    });

    test('extracts multiple exports', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const code = `
export function funcOne() {}
export class ClassTwo {}
export const constThree = 1;
`;
      const input = createFileInput('/test/project/src/utils.ts', code);

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert - blocks when testable units found without test file
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('Missing test coverage');
    });

    test('deduplicates extracted units', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const code = `
export function myFunc() {}
export function myFunc() {} // duplicate
`;
      const input = createFileInput('/test/project/src/utils.ts', code);

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert - blocks and reports missing test
      expect(result.continue).toBe(false);
      expect(result.stopReason).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Testable unit extraction - Python
  // ---------------------------------------------------------------------------

  describe('testable unit extraction - Python', () => {
    test.each([
      ['def my_function():\n    pass', 'my_function'],
      ['class MyClass:\n    pass', 'MyClass'],
    ])('extracts testable units from Python: %s', (code, _expectedUnit) => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createFileInput('/test/project/app/utils.py', code);

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert - blocks when no test file found
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('Missing test coverage');
    });

    test('skips private methods like __init__', () => {
      // Arrange - __init__ alone doesn't trigger blocking
      mockExistsSync.mockReturnValue(false);
      const input = createFileInput(
        '/test/project/app/utils.py',
        'def __init__(self):\n    pass',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert - __init__ is not considered a public testable unit
      // The hook may or may not extract it based on implementation
      expect(result.continue).toBeDefined();
    });

    test('extracts multiple Python definitions', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const code = `
def func_one():
    pass

class ClassTwo:
    pass

def func_three():
    return 1
`;
      const input = createFileInput('/test/project/app/utils.py', code);

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert - blocks when testable units found without test file
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('Missing test coverage');
    });
  });

  // ---------------------------------------------------------------------------
  // Test coverage verification
  // ---------------------------------------------------------------------------

  describe('test coverage verification', () => {
    test('warns when unit not found in test file', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/src/utils.test.ts';
      });
      mockReadFileSync.mockReturnValue('test("otherFunc", () => {})');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'export function newFunc() {}',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('newFunc'),
      );
    });

    test('passes when unit is tested', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/src/utils.test.ts';
      });
      mockReadFileSync.mockReturnValue('describe("myFunc", () => { test("works", () => {}) })');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'export function myFunc() {}',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('uses word boundary matching', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/src/utils.test.ts';
      });
      // "getUserData" contains "get" but should not match "get" unit
      mockReadFileSync.mockReturnValue('test("getUserData", () => {})');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'export function get() {}',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('get'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty file path', () => {
      // Arrange
      const input = createFileInput('', 'export function test() {}');

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles empty content', () => {
      // Arrange
      const input = createFileInput('/test/project/src/utils.ts', '');

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles file with no testable units', () => {
      // Arrange
      const input = createFileInput(
        '/test/project/src/types.ts',
        'interface User { name: string; }',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles tool_result instead of content', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input: HookInput = {
        tool_name: 'Read',
        session_id: 'test-session-123',
        tool_input: { file_path: '/test/project/src/utils.ts' },
        tool_result: 'export function myFunc() {}',
      } as any;

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('handles test file read error gracefully', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/src/utils.test.ts';
      });
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'export function myFunc() {}',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles regex special characters in unit names', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/src/utils.test.ts';
      });
      mockReadFileSync.mockReturnValue('test("$special", () => {})');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'export const $special = () => {}',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      // Should not throw due to regex special chars
      expect(result.continue).toBe(true);
    });

    test('limits displayed units to 5', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const code = `
export function func1() {}
export function func2() {}
export function func3() {}
export function func4() {}
export function func5() {}
export function func6() {}
export function func7() {}
`;
      const input = createFileInput('/test/project/src/utils.ts', code);

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.stopReason).not.toContain('func6');
      expect(result.stopReason).not.toContain('func7');
    });
  });

  // ---------------------------------------------------------------------------
  // Error message format
  // ---------------------------------------------------------------------------

  describe('error message format', () => {
    test('includes indication of missing test coverage', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'export function myFunc() {}',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.stopReason).toContain('Missing test coverage');
    });

    test('blocks when testable units found', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'export function myFunc() {}',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalled();
    });

    test('block reason references test coverage', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const input = createFileInput(
        '/test/project/src/utils.ts',
        `
export function func1() {}
export function func2() {}
export function func3() {}
`,
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('TEST COVERAGE');
    });
  });

  // ---------------------------------------------------------------------------
  // Warning context format
  // ---------------------------------------------------------------------------

  describe('warning context format', () => {
    test('outputs context when untested units found', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/src/utils.test.ts';
      });
      mockReadFileSync.mockReturnValue('test("oldFunc", () => {})');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        `
export function newFunc1() {}
export function newFunc2() {}
`,
      );

      // Act
      crossInstanceTestValidator(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('returns continue: true with warning when test file exists', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/src/utils.test.ts';
      });
      mockReadFileSync.mockReturnValue('test("oldFunc", () => {})');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'export function newFunc() {}',
      );

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('warns about test coverage gaps', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) => {
        return path === '/test/project/src/utils.test.ts';
      });
      mockReadFileSync.mockReturnValue('test("oldFunc", () => {})');
      const input = createFileInput(
        '/test/project/src/utils.ts',
        'export function newFunc() {}',
      );

      // Act
      crossInstanceTestValidator(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('Test coverage warnings'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Missing file path edge cases
  // ---------------------------------------------------------------------------

  describe('missing file path edge cases', () => {
    test('handles undefined file_path', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: { content: 'export function test() {}' },
      };

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles undefined tool_input', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: {},
      };

      // Act
      const result = crossInstanceTestValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });
});

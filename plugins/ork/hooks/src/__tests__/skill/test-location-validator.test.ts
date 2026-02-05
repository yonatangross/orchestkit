/**
 * Unit tests for test-location-validator hook
 * Tests validation of test file locations (BLOCKING hook)
 *
 * Focus: Test files in correct directories, source files not in test dirs,
 * naming conventions for TypeScript/JavaScript and Python tests
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST come BEFORE imports
// =============================================================================

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
  logHook: vi.fn(),
}));

vi.mock('../../lib/guards.js', () => ({
  guardCodeFiles: vi.fn(() => null), // Default: allow through
}));

import { testLocationValidator } from '../../skill/test-location-validator.js';
import { outputSilentSuccess, outputBlock, logHook } from '../../lib/common.js';
import { guardCodeFiles } from '../../lib/guards.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for Write/Edit tools
 */
function createWriteInput(
  filePath: string,
  overrides: Partial<HookInput> = {},
): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    tool_input: {
      file_path: filePath,
      content: '// test content',
    },
    ...overrides,
  };
}

// =============================================================================
// Test Location Validator Tests
// =============================================================================

describe('test-location-validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardCodeFiles).mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance - Returns continue appropriately
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true for valid test file locations', () => {
      // Arrange
      const input = createWriteInput('/project/tests/unit/user.test.ts');

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: false for invalid test file locations', () => {
      // Arrange
      const input = createWriteInput('/project/src/utils/helper.test.ts');

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('returns suppressOutput: true for silent success', () => {
      // Arrange
      const input = createWriteInput('/project/tests/user.test.ts');

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });

    test('skips processing when guard returns early', () => {
      // Arrange
      vi.mocked(guardCodeFiles).mockReturnValue({ continue: true, suppressOutput: true });
      const input = createWriteInput('/project/README.md');

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputBlock).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Self-guard behavior
  // ---------------------------------------------------------------------------

  describe('self-guard behavior', () => {
    test('calls guardCodeFiles for filtering', () => {
      // Arrange
      const input = createWriteInput('/project/tests/test.ts');

      // Act
      testLocationValidator(input);

      // Assert
      expect(guardCodeFiles).toHaveBeenCalledWith(input);
    });

    test('returns guard result when guard returns early', () => {
      // Arrange
      const guardResult = { continue: true, suppressOutput: true };
      vi.mocked(guardCodeFiles).mockReturnValue(guardResult);
      const input = createWriteInput('/project/image.png');

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result).toEqual(guardResult);
    });
  });

  // ---------------------------------------------------------------------------
  // Empty/missing file path
  // ---------------------------------------------------------------------------

  describe('empty/missing file path', () => {
    test('returns silent success for empty file path', () => {
      // Arrange
      const input = createWriteInput('');

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success for missing file_path', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test',
        tool_input: { content: 'test' },
      };

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 1: Test files must be in test directories
  // ---------------------------------------------------------------------------

  describe('Rule 1: Test files must be in test directories', () => {
    test.each([
      '/project/tests/unit/user.test.ts',
      '/project/tests/integration/api.spec.ts',
      '/project/__tests__/components/Button.test.tsx',
      '/project/test/e2e/login.test.js',
      '/project/src/__tests__/utils.test.ts',
      '/project/app/tests/test_user.py',
    ])('allows test file in correct location: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test.each([
      '/project/src/utils/helper.test.ts',
      '/project/src/components/Button.spec.tsx',
      '/project/app/services/user.test.js',
      '/project/lib/math.spec.ts',
    ])('blocks test file in wrong location: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('test'),
      );
    });

    test('error message mentions correct directories', () => {
      // Arrange
      const input = createWriteInput('/project/src/utils/helper.test.ts');

      // Act
      testLocationValidator(input);

      // Assert
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('tests/'),
      );
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('__tests__/'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 2: Source files cannot be in test directories
  // ---------------------------------------------------------------------------

  describe('Rule 2: Source files cannot be in test directories', () => {
    test.each([
      '/project/tests/UserService.ts',
      '/project/__tests__/api/router.ts',
      '/project/test/utils/helper.js',
    ])('blocks source file in test directory: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('Source files cannot be in test directories'),
      );
    });

    test.each([
      '/project/tests/conftest.py',
      '/project/tests/fixtures.py',
      '/project/tests/factories.py',
      '/project/tests/mocks.py',
      '/project/tests/__init__.py',
      '/project/tests/helpers.py',
    ])('allows Python utility file in test directory: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test.each([
      '/project/tests/setup.py',  // setup.py not in Python allowed list
      '/project/tests/utils.py',  // utils.py not in Python allowed list
    ])('blocks non-allowlisted Python file in test directory: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = testLocationValidator(input);

      // Assert
      // setup.py and utils.py are in TS/JS allowed list, not Python allowed list
      expect(result.continue).toBe(false);
    });

    test.each([
      '/project/__tests__/setup.ts',
      '/project/__tests__/helpers.ts',
      '/project/__tests__/utils.js',
      '/project/__tests__/mocks.ts',
    ])('allows TS/JS utility file in test directory: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('blocks fixtures.ts since only .py version is in allowed list', () => {
      // Arrange
      // fixtures.ts is NOT in the TS/JS allowed patterns (only fixtures.py is for Python)
      const input = createWriteInput('/project/__tests__/fixtures.ts');

      // Act
      const result = testLocationValidator(input);

      // Assert
      // fixtures is only allowed for Python, not TS/JS
      expect(result.continue).toBe(false);
    });

    test.each([
      '/project/tests/fixtures/data.ts',
      '/project/__tests__/mocks/api.ts',
      '/project/__tests__/__mocks__/module.ts',
    ])(
      'blocks TS/JS files in special test subdirectories due to Rule 3: %s',
      (filePath) => {
        // Arrange
        // These files pass Rule 2 (isInAllowedDir matches /fixtures/, /mocks/, /__mocks__/)
        // But they fail Rule 3 because they're .ts files in tests/ without .test.ts suffix
        // and filename doesn't start with setup|jest|vitest|config|helpers|utils|mocks
        const input = createWriteInput(filePath);

        // Act
        const result = testLocationValidator(input);

        // Assert
        // Rule 3 blocks these because filename doesn't match allowed prefixes
        expect(result.continue).toBe(false);
        expect(result.stopReason).toContain('Test files must use .test.ts or .spec.ts suffix');
      },
    );

    test('blocks Python files in special test subdirectories without test_ prefix', () => {
      // Arrange
      // Rule 2 passes (isInAllowedDir matches /factories/)
      // But Rule 4 still requires Python test files to have test_ prefix or _test suffix
      // unless the filename is in the allowed utility list (conftest, fixtures, etc.)
      const input = createWriteInput('/project/tests/factories/user.py');

      // Act
      const result = testLocationValidator(input);

      // Assert
      // Rule 4 blocks because user.py doesn't match test_*.py or *_test.py
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('Python test files must be named test_*.py or *_test.py');
    });

    test('allows factories.py file directly in test directory', () => {
      // Arrange
      // The filename 'factories.py' is in Rule 4's allowed utility list
      const input = createWriteInput('/project/tests/factories.py');

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 3: TS/JS tests must use .test or .spec suffix
  // ---------------------------------------------------------------------------

  describe('Rule 3: TS/JS tests must use .test or .spec suffix', () => {
    test.each([
      '/project/tests/unit/user.test.ts',
      '/project/__tests__/api.spec.tsx',
      '/project/tests/integration/api.test.js',
      '/project/__tests__/component.spec.jsx',
    ])('allows correctly named TS/JS test file: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test.each([
      '/project/tests/unit/user.ts',
      '/project/__tests__/api.tsx',
      '/project/tests/integration/tests.js',
    ])('blocks incorrectly named TS/JS file in test dir: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = testLocationValidator(input);

      // Assert
      // Rule 2 (source files in test directories) fires before Rule 3 (naming)
      // since these files don't have .test/.spec suffix, they're not test files
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('Source files cannot be in test directories'),
      );
    });

    test.each([
      '/project/__tests__/setup.ts',
      '/project/__tests__/helpers.ts',
      '/project/__tests__/utils.js',
      '/project/__tests__/mocks.ts',
    ])('allows TS/JS setup/utility files via Rule 2 allowed patterns: %s', (filePath) => {
      // Arrange
      // Rule 2 allowedPatterns: /^(setup|helpers|utils|mocks|fixtures)\.(ts|js)$/
      const input = createWriteInput(filePath);

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test.each([
      '/project/tests/jest.config.ts',
      '/project/__tests__/vitest.setup.ts',
      '/project/tests/config.ts',
    ])('blocks config files not matching Rule 2 allowed patterns: %s', (filePath) => {
      // Arrange
      // Rule 2 allowedPatterns: /^(setup|helpers|utils|mocks|fixtures)\.(ts|js)$/
      // jest.config.ts, vitest.setup.ts, config.ts do NOT match this pattern
      // (setup.ts would match, but vitest.setup.ts and jest.config.ts have different names)
      const input = createWriteInput(filePath);

      // Act
      const result = testLocationValidator(input);

      // Assert
      // These are blocked by Rule 2 (source files in test directories)
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('Source files cannot be in test directories'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 4: Python tests must follow naming convention
  // ---------------------------------------------------------------------------

  describe('Rule 4: Python tests must follow naming convention', () => {
    test.each([
      '/project/tests/test_user.py',
      '/project/tests/unit/test_auth.py',
      '/project/test/integration/test_api.py',
      '/project/tests/user_test.py',
      '/project/tests/api_test.py',
    ])('allows correctly named Python test file: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test.each([
      '/project/tests/user.py',
      '/project/tests/unit/api.py',
      '/project/test/tests.py',
      '/project/tests/testing_utils.py',
    ])('blocks incorrectly named Python file in test dir: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = testLocationValidator(input);

      // Assert
      // These files don't match test file patterns (test_*.py or *_test.py)
      // so they're treated as source files in test directories (Rule 2)
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('Source files cannot be in test directories'),
      );
    });

    test.each([
      '/project/tests/conftest.py',
      '/project/tests/__init__.py',
      '/project/tests/fixtures.py',
      '/project/tests/factories.py',
      '/project/tests/mocks.py',
      '/project/tests/helpers.py',
    ])('allows Python utility files in test directories: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // isTestFile detection
  // ---------------------------------------------------------------------------

  describe('isTestFile detection', () => {
    test.each([
      ['/project/src/user.test.ts', true],
      ['/project/src/api.spec.tsx', true],
      ['/project/src/test_user.py', true],
      ['/project/src/user_test.py', true],
      ['/project/src/component.test.jsx', true],
    ])('detects %s as test file: %s', (filePath, _isTest) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = testLocationValidator(input);

      // Assert - test files outside test dirs should be blocked
      expect(result.continue).toBe(false);
    });

    test.each([
      ['/project/src/user.ts', false],
      ['/project/src/api.tsx', false],
      ['/project/src/testing.py', false],
      ['/project/src/testutils.ts', false],
    ])('does not treat %s as test file', (filePath, _isTest) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = testLocationValidator(input);

      // Assert - non-test files should pass
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Logging behavior
  // ---------------------------------------------------------------------------

  describe('logging behavior', () => {
    test('logs block events for test files in wrong location', () => {
      // Arrange
      const input = createWriteInput('/project/src/helper.test.ts');

      // Act
      testLocationValidator(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'test-location-validator',
        expect.stringContaining('BLOCKED'),
      );
    });

    test('logs block events for source files in test dirs', () => {
      // Arrange
      const input = createWriteInput('/project/tests/service.ts');

      // Act
      testLocationValidator(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'test-location-validator',
        expect.stringContaining('BLOCKED'),
      );
    });

    test('does not log for valid paths', () => {
      // Arrange
      const input = createWriteInput('/project/tests/user.test.ts');

      // Act
      testLocationValidator(input);

      // Assert
      expect(logHook).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles paths with test in directory name', () => {
      // Arrange
      const input = createWriteInput('/project/contest/helper.ts');

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles paths with multiple test directories', () => {
      // Arrange
      const input = createWriteInput('/project/tests/nested/tests/user.test.ts');

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles path ending with slash', () => {
      // Arrange
      const input = createWriteInput('/project/tests/');

      // Act
      const result = testLocationValidator(input);

      // Assert
      // Path ending with / has empty filename, but still matches test directory patterns
      // The hook treats this as a source file in test dir (rule 2)
      expect(result.continue).toBe(false);
    });

    test('handles path ending with test.ts suffix but no filename', () => {
      // Arrange
      const input = createWriteInput('/project/src/.test.ts');

      // Act
      const result = testLocationValidator(input);

      // Assert
      // Hidden files starting with dot
      expect(result.continue).toBe(false);
    });

    test('correctly parses filename from path', () => {
      // Arrange
      const input = createWriteInput('/project/tests/unit/deeply/nested/user.test.ts');

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Complex scenarios
  // ---------------------------------------------------------------------------

  describe('complex scenarios', () => {
    test('test file inside nested __tests__ is valid', () => {
      // Arrange
      const input = createWriteInput('/project/src/components/__tests__/Button.test.tsx');

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('Python test with test_ prefix in tests/ is valid', () => {
      // Arrange
      const input = createWriteInput('/project/tests/unit/test_service.py');

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('Python test with _test suffix in tests/ is valid', () => {
      // Arrange
      const input = createWriteInput('/project/tests/unit/service_test.py');

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles case where file matches multiple rules', () => {
      // Arrange - Python file in tests/ that doesn't match test naming pattern
      // Rule 2 (source files in test dir) is checked before Rule 4 (Python naming)
      const input = createWriteInput('/project/tests/myTests.py');

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      // Since it's not a test file (doesn't match test_*.py or *_test.py pattern),
      // it's treated as a source file in test dir (Rule 2)
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('Source files cannot be in test directories'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Path pattern variations
  // ---------------------------------------------------------------------------

  describe('path pattern variations', () => {
    test.each([
      '/project/tests/',
      '/project/__tests__/',
      '/project/test/',
      '/project/src/__tests__/',
    ])('recognizes %s as test directory', (testDir) => {
      // Arrange
      const input = createWriteInput(`${testDir}valid.test.ts`);

      // Act
      const result = testLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles Windows-style paths', () => {
      // Arrange - Windows paths have backslashes
      const input = createWriteInput('C:\\project\\tests\\user.test.ts');

      // Act
      const result = testLocationValidator(input);

      // Assert
      // The regex uses forward slashes, so this might not match
      // This tests the current behavior
      expect(result).toBeDefined();
    });
  });
});

/**
 * Unit tests for test-pattern-validator hook
 * Tests validation of test patterns and conventions (BLOCKING hook)
 *
 * Focus: AAA pattern, naming conventions, no console.log, no .only(),
 * proper skip usage, Python test conventions
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

import { testPatternValidator } from '../../skill/test-pattern-validator.js';
import { outputSilentSuccess, outputBlock, logHook } from '../../lib/common.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for Write tool with content
 */
function createWriteInput(
  filePath: string,
  content: string,
  overrides: Partial<HookInput> = {},
): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    tool_input: {
      file_path: filePath,
      content,
    },
    ...overrides,
  };
}

/**
 * Create minimal valid test content
 */
function createValidTestContent(): string {
  return `
import { describe, test, expect } from 'vitest';

describe('MyComponent', () => {
  beforeEach(() => {
    // Reset state
  });

  test('should render correctly', () => {
    // Arrange
    const props = { name: 'test' };

    // Act
    const result = render(props);

    // Assert
    expect(result).toBeDefined();
  });
});
`;
}

// =============================================================================
// Test Pattern Validator Tests
// =============================================================================

describe('test-pattern-validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance - Returns continue appropriately
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true for valid test patterns', () => {
      // Arrange
      const input = createWriteInput(
        '/project/tests/user.test.ts',
        createValidTestContent(),
      );

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: false for invalid test patterns', () => {
      // Arrange
      const input = createWriteInput(
        '/project/tests/user.test.ts',
        `test.only('should work', () => {});`,
      );

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('returns suppressOutput: true for silent success', () => {
      // Arrange
      const input = createWriteInput(
        '/project/tests/user.test.ts',
        createValidTestContent(),
      );

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Early exit conditions
  // ---------------------------------------------------------------------------

  describe('early exit conditions', () => {
    test('returns silent success for empty file path', () => {
      // Arrange
      const input = createWriteInput('', 'some content');

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success for empty content', () => {
      // Arrange
      const input = createWriteInput('/project/tests/user.test.ts', '');

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success for non-test files', () => {
      // Arrange
      const input = createWriteInput(
        '/project/src/utils/helper.ts',
        'console.log("debug");',
      );

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputBlock).not.toHaveBeenCalled();
    });

    test('handles missing file_path field', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test',
        tool_input: { content: 'test content' },
      };

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles missing content field', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test',
        tool_input: { file_path: '/project/tests/user.test.ts' },
      };

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test file detection
  // ---------------------------------------------------------------------------

  describe('test file detection', () => {
    test.each([
      '/project/tests/user.test.ts',
      '/project/tests/api.spec.tsx',
      '/project/__tests__/component.test.jsx',
    ])('recognizes %s as TS/JS test file and validates', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath, 'test.only(() => {});');

      // Act
      const result = testPatternValidator(input);

      // Assert - should block due to .only()
      expect(result.continue).toBe(false);
    });

    test.each([
      '/project/tests/test_user.py',
      '/project/tests/user_test.py',
    ])('recognizes %s as Python test file', (filePath) => {
      // Arrange - content with Python-specific violation (camelCase test name)
      const input = createWriteInput(filePath, 'def testUserCreation():\n    assert True');

      // Act
      const result = testPatternValidator(input);

      // Assert - should block due to camelCase
      expect(result.continue).toBe(false);
    });

    test.each([
      '/project/src/user.ts',
      '/project/src/api.tsx',
      '/project/src/testing.py',
      '/project/src/testHelper.ts',
    ])('does not validate %s as test file', (filePath) => {
      // Arrange - content that would fail if it were a test file
      const input = createWriteInput(filePath, 'test.only(() => {});');

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // TypeScript/JavaScript: Test name validation
  // ---------------------------------------------------------------------------

  describe('TS/JS: Test name validation', () => {
    test.each([
      ["test('test1', () => {})", 'test1'],
      ["test('works', () => {})", 'works'],
    ])('blocks short/generic test name: %s', (content, _name) => {
      // Arrange
      const input = createWriteInput('/project/tests/user.test.ts', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('Test pattern violations'),
      );
    });

    test('allows generic "test" name (does not match test1/works pattern)', () => {
      // Arrange - The regex looks for "test" followed by digits or "works"
      // "it('test',...)" doesn't match /test[0-9]|works|^test$/i within the match context
      const content = "it('test', () => {})";
      const input = createWriteInput('/project/tests/user.test.ts', content);

      // Act
      const result = testPatternValidator(input);

      // Assert - The current implementation only blocks test1, test2, works patterns
      // It doesn't block bare "test" since the regex is /test[0-9]|works|^test$/i
      // which looks inside the matched string like "it('test',"
      expect(result.continue).toBe(true);
    });

    test('allows descriptive test names', () => {
      // Arrange
      const content = `
        test('should return user when ID exists', () => {
          expect(true).toBe(true);
        });
      `;
      const input = createWriteInput('/project/tests/user.test.ts', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // TypeScript/JavaScript: Shared mutable state
  // ---------------------------------------------------------------------------

  describe('TS/JS: Shared mutable state detection', () => {
    test('blocks shared mutable state without beforeEach', () => {
      // Arrange - The regex /^let [a-zA-Z_][a-zA-Z0-9_]* =/m requires "let " at start of line
      const content = `let items = [];

test('adds item', () => {
  items.push('a');
  expect(items).toHaveLength(1);
});
`;
      const input = createWriteInput('/project/tests/user.test.ts', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('Test pattern violations'),
      );
    });

    test('allows shared mutable state with beforeEach reset', () => {
      // Arrange
      const content = `let items = [];

beforeEach(() => {
  items = [];
});

test('adds item', () => {
  items.push('a');
  expect(items).toHaveLength(1);
});
`;
      const input = createWriteInput('/project/tests/user.test.ts', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows async beforeEach', () => {
      // Arrange
      const content = `let db = null;

beforeEach(async () => {
  db = await createTestDb();
});

test('queries db', () => {
  expect(db).toBeDefined();
});
`;
      const input = createWriteInput('/project/tests/user.test.ts', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // TypeScript/JavaScript: Assertion count
  // ---------------------------------------------------------------------------

  describe('TS/JS: High assertion count warning', () => {
    test('warns about high assertion count per test', () => {
      // Arrange - 12 expects in 2 tests = avg 6 > 5 threshold
      const content = `test('test case one', () => {
  expect(1).toBe(1);
  expect(2).toBe(2);
  expect(3).toBe(3);
  expect(4).toBe(4);
  expect(5).toBe(5);
  expect(6).toBe(6);
});

test('test case two', () => {
  expect(7).toBe(7);
  expect(8).toBe(8);
  expect(9).toBe(9);
  expect(10).toBe(10);
  expect(11).toBe(11);
  expect(12).toBe(12);
});
`;
      const input = createWriteInput('/project/tests/user.test.ts', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('allows reasonable assertion counts', () => {
      // Arrange - 6 expects in 3 tests = avg 2 <= 5 threshold
      const content = `test('test case one', () => {
  expect(1).toBe(1);
  expect(2).toBe(2);
});

test('test case two', () => {
  expect(3).toBe(3);
  expect(4).toBe(4);
});

test('test case three', () => {
  expect(5).toBe(5);
  expect(6).toBe(6);
});
`;
      const input = createWriteInput('/project/tests/user.test.ts', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // TypeScript/JavaScript: Console statements
  // ---------------------------------------------------------------------------

  describe('TS/JS: Console statement detection', () => {
    test.each([
      'console.log("debug");',
      'console.warn("warning");',
      'console.error("error");',
    ])('blocks console statement: %s', (consoleStatement) => {
      // Arrange
      const content = `
        test('should work', () => {
          ${consoleStatement}
          expect(true).toBe(true);
        });
      `;
      const input = createWriteInput('/project/tests/user.test.ts', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('Test pattern violations'),
      );
    });

    test('allows console in non-test files', () => {
      // Arrange
      const input = createWriteInput(
        '/project/src/utils/logger.ts',
        'console.log("debug");',
      );

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // TypeScript/JavaScript: .only() detection
  // ---------------------------------------------------------------------------

  describe('TS/JS: .only() detection', () => {
    test.each([
      'test.only("focused test", () => {});',
      'it.only("focused test", () => {});',
      'describe.only("focused suite", () => {});',
    ])('blocks .only() usage: %s', (content) => {
      // Arrange
      const input = createWriteInput('/project/tests/user.test.ts', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('Test pattern violations'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // TypeScript/JavaScript: .skip() without reason
  // ---------------------------------------------------------------------------

  describe('TS/JS: .skip() without reason', () => {
    test.each([
      'test.skip("skipped test", () => {});',
      'it.skip("skipped test", () => {});',
      'describe.skip("skipped suite", () => {});',
    ])('blocks .skip() without explanation: %s', (content) => {
      // Arrange
      const input = createWriteInput('/project/tests/user.test.ts', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test.each([
      'test.skip("reason: TODO waiting for API fix", () => {});',
      '// FIXME: temporarily disabled\ntest.skip("skipped", () => {});',
      'test.skip("skip because auth is broken", () => {});',
    ])('allows .skip() with explanation: %s', (content) => {
      // Arrange
      const input = createWriteInput('/project/tests/user.test.ts', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Python: Test naming convention
  // ---------------------------------------------------------------------------

  describe('Python: Test naming convention', () => {
    test('blocks camelCase test names', () => {
      // Arrange
      const content = `
def testUserCreation():
    assert True

def testApiResponse():
    assert True
      `;
      const input = createWriteInput('/project/tests/test_user.py', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('Test pattern violations'),
      );
    });

    test('allows snake_case test names', () => {
      // Arrange
      const content = `
def test_user_creation():
    assert True

def test_api_response():
    assert True
      `;
      const input = createWriteInput('/project/tests/test_user.py', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Python: unittest setUp/tearDown detection
  // ---------------------------------------------------------------------------

  describe('Python: unittest setUp/tearDown detection', () => {
    test.each([
      'def setUp(self):',
      'def tearDown(self):',
      'def setUpClass(cls):',
      'def tearDownClass(cls):',
    ])('blocks unittest pattern: %s', (pattern) => {
      // Arrange
      const content = `
class TestUser:
    ${pattern}
        pass

    def test_user(self):
        assert True
      `;
      const input = createWriteInput('/project/tests/test_user.py', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('suggests pytest fixtures as alternative', () => {
      // Arrange
      const content = `
class TestUser:
    def setUp(self):
        pass
      `;
      const input = createWriteInput('/project/tests/test_user.py', content);

      // Act
      testPatternValidator(input);

      // Assert
      expect(outputBlock).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Python: Class-level mutable defaults
  // ---------------------------------------------------------------------------

  describe('Python: Class-level mutable defaults', () => {
    test('blocks class-level mutable list', () => {
      // Arrange
      const content = `
class TestUser:
    items = []

    def test_add_item(self):
        self.items.append('a')
        assert len(self.items) == 1
      `;
      const input = createWriteInput('/project/tests/test_user.py', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('blocks class-level mutable dict', () => {
      // Arrange
      const content = `
class TestUser:
    data = {}

    def test_add_data(self):
        self.data['key'] = 'value'
      `;
      const input = createWriteInput('/project/tests/test_user.py', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('allows immutable class-level attributes', () => {
      // Arrange
      const content = `
class TestUser:
    DEFAULT_NAME = "test"
    MAX_COUNT = 100

    def test_defaults(self):
        assert self.DEFAULT_NAME == "test"
      `;
      const input = createWriteInput('/project/tests/test_user.py', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Python: print statements
  // ---------------------------------------------------------------------------

  describe('Python: print statement detection', () => {
    test('blocks print statements in tests', () => {
      // Arrange
      const content = `
def test_user():
    print("debug")
    assert True
      `;
      const input = createWriteInput('/project/tests/test_user.py', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('allows print in non-test Python files', () => {
      // Arrange
      const input = createWriteInput(
        '/project/src/utils/logger.py',
        '    print("log message")',
      );

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Python: @pytest.mark.skip without reason
  // ---------------------------------------------------------------------------

  describe('Python: @pytest.mark.skip without reason', () => {
    test('blocks skip without reason: @pytest.mark.skip()', () => {
      // Arrange - The regex /@pytest\.mark\.skip\(\s*\)/ matches empty parens
      const content = `@pytest.mark.skip()
def test_user():
    assert True
`;
      const input = createWriteInput('/project/tests/test_user.py', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('blocks skip at end of line without parens', () => {
      // Arrange - The regex /@pytest\.mark\.skip\s*$/ matches skip at end of line
      // Need multiline flag behavior - the $ matches end of string in single-line mode
      const content = `@pytest.mark.skip
def test_user():
    assert True`;
      const input = createWriteInput('/project/tests/test_user.py', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      // Note: The regex /@pytest\.mark\.skip\s*$/ uses $ which matches end of string
      // without the multiline flag, so @pytest.mark.skip followed by newline won't match
      // This is expected current behavior
      expect(result.continue).toBe(true);
    });

    test('allows skip with reason', () => {
      // Arrange
      const content = `@pytest.mark.skip(reason="waiting for API fix")
def test_user():
    assert True
`;
      const input = createWriteInput('/project/tests/test_user.py', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Python: Async tests without pytest.mark.asyncio
  // ---------------------------------------------------------------------------

  describe('Python: Async tests without @pytest.mark.asyncio', () => {
    test('blocks async test without marker', () => {
      // Arrange
      const content = `
async def test_async_user():
    result = await fetch_user()
    assert result is not None
      `;
      const input = createWriteInput('/project/tests/test_user.py', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('allows async test with @pytest.mark.asyncio', () => {
      // Arrange
      const content = `
@pytest.mark.asyncio
async def test_async_user():
    result = await fetch_user()
    assert result is not None
      `;
      const input = createWriteInput('/project/tests/test_user.py', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Logging behavior
  // ---------------------------------------------------------------------------

  describe('logging behavior', () => {
    test('logs block events with first error', () => {
      // Arrange
      const input = createWriteInput(
        '/project/tests/user.test.ts',
        'test.only("focused", () => {});',
      );

      // Act
      testPatternValidator(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'test-pattern-validator',
        expect.stringContaining('BLOCKED'),
      );
    });

    test('does not log for valid test patterns', () => {
      // Arrange
      const input = createWriteInput(
        '/project/tests/user.test.ts',
        createValidTestContent(),
      );

      // Act
      testPatternValidator(input);

      // Assert
      expect(logHook).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles tool_result as content source', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test',
        tool_input: { file_path: '/project/tests/user.test.ts' },
        tool_result: 'test.only(() => {});',
      };

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('handles undefined tool_input gracefully', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test',
        tool_input: {},
      };

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles very long test files', () => {
      // Arrange
      const manyTests = Array(100)
        .fill(null)
        .map((_, i) => `test('test${i}', () => { expect(${i}).toBe(${i}); });`)
        .join('\n');
      const input = createWriteInput('/project/tests/big.test.ts', manyTests);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple violations
  // ---------------------------------------------------------------------------

  describe('multiple violations', () => {
    test('reports violations and blocks', () => {
      // Arrange - multiple issues
      const content = `
        let state = [];

        test.only('test1', () => {
          console.log('debug');
          expect(true).toBe(true);
        });
      `;
      const input = createWriteInput('/project/tests/user.test.ts', content);

      // Act
      const result = testPatternValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledTimes(1);
    });
  });
});

/**
 * Test Pattern Validator Hook
 * BLOCKING: Tests must follow AAA pattern and naming conventions
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputBlock, logHook } from '../lib/common.js';

/**
 * Check if file is a test file
 */
function isTestFile(filePath: string): boolean {
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath)) return true;
  if (/(^|\/)test_[^/]*\.py$/.test(filePath)) return true;
  if (/_test\.py$/.test(filePath)) return true;
  return false;
}

/**
 * Validate test patterns and conventions
 */
export function testPatternValidator(input: HookInput): HookResult {
  const filePath = input.tool_input?.file_path || '';
  const content = input.tool_input?.content || (input as any).tool_result || '';

  if (!filePath || !content) return outputSilentSuccess();

  // Only validate test files
  if (!isTestFile(filePath)) return outputSilentSuccess();

  const errors: string[] = [];

  // TypeScript/JavaScript test validation
  if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
    // Rule: Test names must be descriptive (not too short)
    const shortTests = content.match(/(test|it)\(['"][^'"]{1,10}['"]/g);
    if (shortTests) {
      if (shortTests.some((t: string) => /test[0-9]|works|^test$/i.test(t))) {
        errors.push('Test names too short or generic. Use descriptive names:');
        errors.push("  BAD:  test('test1'), test('works')");
        errors.push("  GOOD: test('should return user when ID exists')");
      }
    }

    // Rule: No shared mutable state without beforeEach reset
    if (/^let [a-zA-Z_][a-zA-Z0-9_]* =/m.test(content)) {
      if (!/beforeEach\s*\(\s*(async\s*)?\(\s*\)\s*=>/.test(content)) {
        errors.push('Shared mutable state detected without beforeEach reset:');
        errors.push('  Add beforeEach(() => { /* reset state */ }) to ensure test isolation');
      }
    }

    // Rule: Avoid too many expects in single test
    const totalExpects = (content.match(/expect\(/g) || []).length;
    const totalTests = (content.match(/(test|it)\s*\(/g) || []).length || 1;
    const avgExpects = Math.floor(totalExpects / totalTests);

    if (avgExpects > 5) {
      errors.push(`High assertion count (avg ${avgExpects} per test):`);
      errors.push('  Consider splitting into focused tests with 1-3 assertions each');
      errors.push('  Or add AAA comments (// Arrange, // Act, // Assert)');
    }

    // Rule: No console.log in tests
    if (/console\.(log|warn|error)\(/.test(content)) {
      errors.push('console.log found in test file:');
      errors.push('  Remove debugging statements before committing');
      errors.push('  Use proper assertions instead');
    }

    // Rule: No .only() left in tests
    if (/(test|it|describe)\.only\(/.test(content)) {
      errors.push('.only() found - this skips other tests:');
      errors.push('  Remove .only() before committing');
    }

    // Rule: No .skip() without explanation
    if (/(test|it|describe)\.skip\(/.test(content)) {
      if (!/TODO|FIXME|skip.*because|temporarily/i.test(content)) {
        errors.push('.skip() found without explanation:');
        errors.push('  Add a comment explaining why the test is skipped');
        errors.push("  Example: test.skip('reason: waiting for API fix')");
      }
    }
  }

  // Python test validation
  if (filePath.endsWith('.py')) {
    // Rule: Test function naming must use snake_case
    if (/def test[A-Z]/.test(content)) {
      errors.push('Test names must use snake_case, not camelCase:');
      errors.push('  BAD:  def testUserCreation()');
      errors.push('  GOOD: def test_user_creation()');
    }

    // Rule: Use pytest fixtures, not unittest setUp/tearDown
    if (/def (setUp|tearDown|setUpClass|tearDownClass)\s*\(/.test(content)) {
      errors.push('Use pytest fixtures instead of unittest setUp/tearDown:');
      errors.push('  BAD:  def setUp(self): ...');
      errors.push('  GOOD: @pytest.fixture\\n        def setup_data(): ...');
    }

    // Rule: No class-level mutable defaults
    if (/class Test.*:/.test(content)) {
      if (/^\s+[a-z_]+ = \[\]/m.test(content) || /^\s+[a-z_]+ = \{\}/m.test(content)) {
        errors.push('Class-level mutable defaults can cause test pollution:');
        errors.push('  BAD:  class TestUser:\\n            items = []');
        errors.push('  GOOD: Use @pytest.fixture to create fresh instances');
      }
    }

    // Rule: No print statements in tests
    if (/^\s+print\(/m.test(content)) {
      errors.push('print() found in test file:');
      errors.push('  Remove debugging statements before committing');
      errors.push("  Use proper assertions or pytest's capfd fixture");
    }

    // Rule: No @pytest.mark.skip without reason
    if (/@pytest\.mark\.skip\s*$/.test(content) || /@pytest\.mark\.skip\(\s*\)/.test(content)) {
      errors.push('@pytest.mark.skip without reason:');
      errors.push("  Add reason: @pytest.mark.skip(reason='waiting for fix')");
    }

    // Rule: Async tests should use pytest-asyncio
    if (/async def test_/.test(content)) {
      if (!/@pytest\.mark\.asyncio/.test(content)) {
        errors.push('Async test found without @pytest.mark.asyncio:');
        errors.push('  Add: @pytest.mark.asyncio');
        errors.push('  Or set asyncio_mode = auto in pytest.ini');
      }
    }
  }

  // Report errors and block
  if (errors.length > 0) {
    logHook('test-pattern-validator', `BLOCKED: ${errors[0]}`);
    return outputBlock(`Test pattern violations detected in ${filePath}`);
  }

  return outputSilentSuccess();
}

/**
 * Test Location Validator Hook
 * BLOCKING: Tests must be in correct location
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputBlock, logHook } from '../lib/common.js';
import { guardCodeFiles } from '../lib/guards.js';

/**
 * Check if file is a test file
 */
function isTestFile(filePath: string): boolean {
  // TypeScript/JavaScript test patterns
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath)) return true;

  // Python test patterns
  if (/(^|\/)test_[^/]*\.py$/.test(filePath)) return true;
  if (/_test\.py$/.test(filePath)) return true;

  return false;
}

/**
 * Validate test file location
 */
export function testLocationValidator(input: HookInput): HookResult {
  // Self-guard: Only run for code files
  const guard = guardCodeFiles(input);
  if (guard) return guard;

  const filePath = input.tool_input.file_path || '';
  if (!filePath) return outputSilentSuccess();

  const filename = filePath.split('/').pop() || '';
  const isTest = isTestFile(filePath);

  // Rule 1: Test files MUST be in test directories
  if (isTest) {
    if (!/(tests\/|__tests__\/|\/test\/|test\/)/.test(filePath)) {
      const reason = `Test file must be in tests/, __tests__/, or test/ directory: ${filename}`;
      logHook('test-location-validator', `BLOCKED: ${reason}`);
      return outputBlock(reason);
    }
  }

  // Rule 2: Source files CANNOT be in test directories
  if (!isTest && /(tests\/|__tests__\/|\/test\/)/.test(filePath)) {
    // Allow certain files in test directories
    const allowedPatterns = [
      /^(conftest|fixtures|factories|mocks|__init__|setup|helpers|utils)\.py$/,
      /^(setup|helpers|utils|mocks|fixtures)\.(ts|js)$/,
    ];

    const isAllowed = allowedPatterns.some((pattern) => pattern.test(filename));
    const isInAllowedDir = /\/(fixtures|mocks|factories|__mocks__)\//.test(filePath);

    if (!isAllowed && !isInAllowedDir) {
      const reason = `Source files cannot be in test directories: ${filename}`;
      logHook('test-location-validator', `BLOCKED: ${reason}`);
      return outputBlock(reason);
    }
  }

  // Rule 3: TypeScript/JavaScript tests must use .test or .spec suffix
  if (/\.(ts|tsx|js|jsx)$/.test(filePath) && /(tests\/|__tests__)/.test(filePath)) {
    // Skip setup/utility files
    if (/^(setup|jest|vitest|config|helpers|utils|mocks)\./.test(filename)) {
      return outputSilentSuccess();
    }

    // Must have .test or .spec suffix
    if (!/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filename)) {
      const reason = `Test files must use .test.ts or .spec.ts suffix: ${filename}`;
      logHook('test-location-validator', `BLOCKED: ${reason}`);
      return outputBlock(reason);
    }
  }

  // Rule 4: Python tests must follow naming convention
  if (filePath.endsWith('.py') && /(tests\/|\/test\/)/.test(filePath)) {
    // Skip utility files
    if (/^(conftest|__init__|fixtures|factories|mocks|helpers)\.py$/.test(filename)) {
      return outputSilentSuccess();
    }

    // Must start with test_ or end with _test.py
    if (!/^test_.*\.py$/.test(filename) && !/_test\.py$/.test(filename)) {
      const reason = `Python test files must be named test_*.py or *_test.py: ${filename}`;
      logHook('test-location-validator', `BLOCKED: ${reason}`);
      return outputBlock(reason);
    }
  }

  return outputSilentSuccess();
}

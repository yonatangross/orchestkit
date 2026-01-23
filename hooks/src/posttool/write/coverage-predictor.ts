/**
 * Test Coverage Predictor - LLM-powered validation hook
 * Predicts if new code has adequate test coverage
 * CC 2.1.3 Feature: Post-write analysis
 */

import { existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../../types.js';
import { outputSilentSuccess, getField, getProjectDir } from '../../lib/common.js';

/**
 * Predict test coverage for written files
 */
export function coveragePredictor(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Only run for Write tool
  if (toolName !== 'Write') {
    return outputSilentSuccess();
  }

  const filePath = getField<string>(input, 'tool_input.file_path') ||
                   process.env.TOOL_OUTPUT_FILE_PATH || '';

  if (!filePath) {
    return outputSilentSuccess();
  }

  // Only analyze source code files (not tests themselves)
  if (filePath.includes('test') || filePath.includes('spec') || filePath.includes('__tests__')) {
    return outputSilentSuccess();
  }

  // Only analyze code files
  if (!/\.(py|ts|tsx|js|jsx)$/.test(filePath)) {
    return outputSilentSuccess();
  }

  const projectDir = getProjectDir();

  // Determine corresponding test file location
  let testPattern = '';
  const basename = filePath.split('/').pop() || '';

  if (filePath.endsWith('.py')) {
    // Python: backend/app/services/foo.py -> backend/tests/unit/test_foo.py
    const nameWithoutExt = basename.replace('.py', '');
    testPattern = `test_${nameWithoutExt}.py`;
  } else if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
    // TypeScript: src/components/Foo.tsx -> src/components/__tests__/Foo.test.tsx
    const nameWithoutExt = basename.replace(/\.[^.]+$/, '');
    testPattern = `${nameWithoutExt}.test.*`;
  } else {
    return outputSilentSuccess();
  }

  // Check if test file exists
  let testExists = '';
  try {
    const findResult = execSync(
      `find "${projectDir}" -type f -name "${testPattern}" 2>/dev/null | head -1`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    testExists = findResult;
  } catch {
    // find command failed, assume no test
  }

  // Log results
  const logDir = `${projectDir}/.claude/hooks/logs`;
  try {
    mkdirSync(logDir, { recursive: true });
    const timestamp = new Date().toISOString();

    if (testExists) {
      appendFileSync(
        `${logDir}/coverage-predictor.log`,
        `[${timestamp}] COVERAGE_OK: ${filePath} has tests at ${testExists}\n`
      );
    } else {
      appendFileSync(
        `${logDir}/coverage-predictor.log`,
        `[${timestamp}] COVERAGE_WARN: ${filePath} may lack test coverage (expected: ${testPattern})\n`
      );

      // Return subtle reminder (not blocking)
      return {
        continue: true,
        systemMessage: `Consider adding tests for: ${filePath}`,
      };
    }
  } catch {
    // Ignore logging errors
  }

  return outputSilentSuccess();
}

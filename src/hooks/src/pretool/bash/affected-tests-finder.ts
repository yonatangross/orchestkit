/**
 * Affected Tests Finder Hook
 * Suggests running tests related to changed files
 * CC 2.1.9: Injects test suggestions via additionalContext
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputAllowWithContext,
  logHook,
  logPermissionFeedback,
  getProjectDir,
} from '../../lib/common.js';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';

/**
 * Find test files related to a source file
 */
function findRelatedTests(projectDir: string, sourceFile: string): string[] {
  const tests: string[] = [];
  const baseName = basename(sourceFile).replace(/\.(ts|tsx|js|jsx|py)$/, '');
  const dirName = dirname(sourceFile);

  // Common test file patterns
  const testPatterns = [
    `${dirName}/${baseName}.test.ts`,
    `${dirName}/${baseName}.test.tsx`,
    `${dirName}/${baseName}.spec.ts`,
    `${dirName}/${baseName}.spec.tsx`,
    `${dirName}/__tests__/${baseName}.test.ts`,
    `${dirName}/__tests__/${baseName}.test.tsx`,
    `tests/${sourceFile.replace(/\.(ts|tsx|js|jsx)$/, '.test.ts')}`,
    `test_${baseName}.py`,
    `tests/test_${baseName}.py`,
  ];

  for (const pattern of testPatterns) {
    const fullPath = join(projectDir, pattern);
    if (existsSync(fullPath)) {
      tests.push(pattern);
    }
  }

  return tests;
}

/**
 * Get changed files from git status
 */
function getChangedFiles(projectDir: string): string[] {
  try {
    const result = execSync('git status --short 2>/dev/null || echo ""', {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return result
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.slice(3).trim())
      .filter((file) => /\.(ts|tsx|js|jsx|py)$/.test(file));
  } catch {
    return [];
  }
}

/**
 * Suggest running affected tests before push/commit
 */
export function affectedTestsFinder(input: HookInput): HookResult {
  const command = input.tool_input.command || '';
  const projectDir = getProjectDir();

  // Only process git push or npm test commands
  if (!/git\s+push|npm\s+run\s+test|pytest/.test(command)) {
    return outputSilentSuccess();
  }

  // Skip if already running tests
  if (/npm\s+run\s+test|pytest/.test(command)) {
    return outputSilentSuccess();
  }

  // Get changed files
  const changedFiles = getChangedFiles(projectDir);
  if (changedFiles.length === 0) {
    return outputSilentSuccess();
  }

  // Find related tests
  const relatedTests: string[] = [];
  for (const file of changedFiles.slice(0, 10)) {
    // Limit to first 10 files
    const tests = findRelatedTests(projectDir, file);
    relatedTests.push(...tests);
  }

  // Remove duplicates
  const uniqueTests = [...new Set(relatedTests)];

  if (uniqueTests.length > 0) {
    const context = `Related tests for changed files:
${uniqueTests.slice(0, 5).join('\n')}${uniqueTests.length > 5 ? '\n...' : ''}

Consider running: npm run test -- ${uniqueTests[0]}`;

    logPermissionFeedback('allow', `Found ${uniqueTests.length} related tests`, input);
    logHook('affected-tests-finder', `Tests: ${uniqueTests.join(', ')}`);
    return outputAllowWithContext(context);
  }

  return outputSilentSuccess();
}

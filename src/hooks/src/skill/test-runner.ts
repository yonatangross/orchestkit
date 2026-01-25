/**
 * Test Runner Hook
 * Runs after Write in testing skills
 * Auto-runs the test file that was just created/modified
 * CC 2.1.7 Compliant
 */

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getProjectDir } from '../lib/common.js';

/**
 * Find project root by looking for package.json
 */
function findProjectRoot(startDir: string): string | null {
  let dir = startDir;
  while (dir !== '/') {
    if (existsSync(`${dir}/package.json`)) {
      return dir;
    }
    dir = dir.substring(0, dir.lastIndexOf('/'));
  }
  return null;
}

/**
 * Auto-run test file that was just created/modified
 */
export function testRunner(input: HookInput): HookResult {
  const filePath = input.tool_input?.file_path || process.env.CC_TOOL_FILE_PATH || '';

  // Early exit if no file path
  if (!filePath) return outputSilentSuccess();

  // Python test files
  if (/test.*\.py$/.test(filePath) || /_test\.py$/.test(filePath)) {
    process.stderr.write(`::group::Auto-running Python test: ${filePath.split('/').pop()}\n`);

    const dir = filePath.substring(0, filePath.lastIndexOf('/'));

    try {
      // Check for poetry
      if (existsSync(`${dir}/pyproject.toml`)) {
        try {
          execSync('command -v poetry', { stdio: ['pipe', 'pipe', 'pipe'] });
          const result = execSync(`poetry run pytest "${filePath}" -v --tb=short`, {
            cwd: dir,
            encoding: 'utf8',
            timeout: 60000,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          const lines = result.split('\n').slice(-30);
          process.stderr.write(lines.join('\n') + '\n');
        } catch {
          // Poetry not available, try pytest directly
        }
      }

      // Try pytest directly
      try {
        execSync('command -v pytest', { stdio: ['pipe', 'pipe', 'pipe'] });
        const result = execSync(`pytest "${filePath}" -v --tb=short`, {
          cwd: dir,
          encoding: 'utf8',
          timeout: 60000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const lines = result.split('\n').slice(-30);
        process.stderr.write(lines.join('\n') + '\n');
      } catch {
        process.stderr.write('pytest not found - skipping auto-run\n');
      }
    } catch (error) {
      // Test execution errors are logged but don't block
      if (error instanceof Error) {
        process.stderr.write(`Test execution error: ${error.message}\n`);
      }
    }

    process.stderr.write('::endgroup::\n');
  }

  // TypeScript/JavaScript test files
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath)) {
    process.stderr.write(`::group::Auto-running TypeScript test: ${filePath.split('/').pop()}\n`);

    // Find project root
    const projectRoot = findProjectRoot(filePath.substring(0, filePath.lastIndexOf('/')));

    if (projectRoot) {
      try {
        const testPattern = filePath
          .split('/')
          .pop()
          ?.replace(/\.[^.]+$/, '')
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const result = execSync(`npm test -- --testPathPattern="${testPattern}"`, {
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: 60000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const lines = result.split('\n').slice(-30);
        process.stderr.write(lines.join('\n') + '\n');
      } catch (error) {
        // Test execution errors are logged but don't block
        if (error instanceof Error) {
          process.stderr.write(`Test execution error: ${error.message}\n`);
        }
      }
    }

    process.stderr.write('::endgroup::\n');
  }

  return outputSilentSuccess();
}

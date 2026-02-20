/**
 * Test Runner Hook
 * Runs after Write in testing skills
 * Auto-runs the test file that was just created/modified
 * CC 2.1.7 Compliant
 */

import { existsSync } from 'node:fs';
import { execSync, execFileSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess } from '../lib/common.js';
import { basename, dirname } from 'node:path';

/**
 * Find project root by looking for package.json
 */
function findProjectRoot(startDir: string): string | null {
  let dir = startDir;
  while (dir && dir !== '/' && dir.length > 0) {
    if (existsSync(`${dir}/package.json`)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return null;
}

/**
 * Validate file path contains only safe characters (no shell metacharacters)
 */
function isSafeFilePath(p: string): boolean {
  // Allow alphanumeric, slashes, dots, hyphens, underscores, spaces (quoted)
  return /^[\w./ -]+$/.test(p);
}

/**
 * Auto-run test file that was just created/modified
 */
export function testRunner(input: HookInput): HookResult {
  const filePath = input.tool_input?.file_path || process.env.CC_TOOL_FILE_PATH || '';

  // Early exit if no file path or path contains shell metacharacters
  if (!filePath || !isSafeFilePath(filePath)) return outputSilentSuccess();

  // Python test files
  if ((filePath.endsWith('.py') && /(?:^|\/)test[^/.]*\.py$/.test(filePath)) || /_test\.py$/.test(filePath)) {
    process.stderr.write(`::group::Auto-running Python test: ${basename(filePath)}\n`);

    const dir = dirname(filePath);

    try {
      // Check for poetry
      if (existsSync(`${dir}/pyproject.toml`)) {
        try {
          execSync('command -v poetry', { stdio: ['pipe', 'pipe', 'pipe'] });
          const result = execFileSync('poetry', ['run', 'pytest', filePath, '-v', '--tb=short'], {
            cwd: dir,
            encoding: 'utf8',
            timeout: 60000,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          const lines = result.split('\n').slice(-30);
          process.stderr.write(`${lines.join('\n')}\n`);
        } catch {
          // Poetry not available, try pytest directly
        }
      }

      // Try pytest directly
      try {
        execSync('command -v pytest', { stdio: ['pipe', 'pipe', 'pipe'] });
        const result = execFileSync('pytest', [filePath, '-v', '--tb=short'], {
          cwd: dir,
          encoding: 'utf8',
          timeout: 60000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const lines = result.split('\n').slice(-30);
        process.stderr.write(`${lines.join('\n')}\n`);
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
    process.stderr.write(`::group::Auto-running TypeScript test: ${basename(filePath)}\n`);

    // Find project root
    const projectRoot = findProjectRoot(dirname(filePath));

    if (projectRoot) {
      try {
        const testPattern = basename(filePath)
          .replace(/\.[^.]+$/, '')
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const result = execFileSync('npm', ['test', '--', `--testPathPattern=${testPattern}`], {
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: 60000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const lines = result.split('\n').slice(-30);
        process.stderr.write(`${lines.join('\n')}\n`);
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

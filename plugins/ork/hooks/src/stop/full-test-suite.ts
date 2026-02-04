/**
 * Full Test Suite Runner - Stop Hook
 * CC 2.1.3 Compliant - Uses 10-minute hook timeout
 *
 * Runs the complete test suite on conversation stop.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';

/**
 * Check if we should run tests
 */
function shouldRunTests(projectDir: string): boolean {
  const lastRunFile = `${projectDir}/.claude/hooks/logs/.last-test-run`;

  // Always run if no previous run
  if (!existsSync(lastRunFile)) {
    return true;
  }

  // Check if any code files changed since last run
  try {
    const result = execSync('git diff --name-only HEAD', {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (/\.(py|js|ts|go|rs)$/.test(result)) {
      return true;
    }
  } catch {
    // On error, run tests anyway
    return true;
  }

  logHook('full-test-suite', 'No code changes detected, skipping tests');
  return false;
}

/**
 * Detect project type and run appropriate tests
 */
function runTests(projectDir: string, logFile: string): boolean {
  let exitCode = 0;

  // Python project (pytest)
  if (
    existsSync(`${projectDir}/pytest.ini`) ||
    existsSync(`${projectDir}/pyproject.toml`) ||
    (existsSync(`${projectDir}/tests`) && existsSync(`${projectDir}/requirements.txt`))
  ) {
    logHook('full-test-suite', 'Detected Python project, running pytest...');
    try {
      execSync('pytest --tb=short --timeout=300 -q', {
        cwd: projectDir,
        encoding: 'utf8',
        timeout: 300000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      exitCode = 1;
    }
  }

  // Node.js project (npm/yarn/pnpm)
  if (existsSync(`${projectDir}/package.json`)) {
    logHook('full-test-suite', 'Detected Node.js project...');
    try {
      const packageJson = JSON.parse(readFileSync(`${projectDir}/package.json`, 'utf-8'));
      if (packageJson.scripts?.test) {
        logHook('full-test-suite', 'Running npm test...');

        // Try different package managers
        let cmd = 'npm test -- --passWithNoTests --watchAll=false';
        try {
          execSync('which pnpm', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
          cmd = 'pnpm test --passWithNoTests';
        } catch {
          try {
            execSync('which yarn', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
            cmd = 'yarn test --passWithNoTests';
          } catch {
            // Use npm
          }
        }

        execSync(cmd, {
          cwd: projectDir,
          encoding: 'utf8',
          timeout: 300000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      }
    } catch {
      exitCode = 1;
    }
  }

  // Go project
  if (existsSync(`${projectDir}/go.mod`)) {
    logHook('full-test-suite', 'Detected Go project, running go test...');
    try {
      execSync('go test -v -timeout 5m ./...', {
        cwd: projectDir,
        encoding: 'utf8',
        timeout: 300000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      exitCode = 1;
    }
  }

  // Rust project
  if (existsSync(`${projectDir}/Cargo.toml`)) {
    logHook('full-test-suite', 'Detected Rust project, running cargo test...');
    try {
      execSync('cargo test', {
        cwd: projectDir,
        encoding: 'utf8',
        timeout: 300000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      exitCode = 1;
    }
  }

  return exitCode === 0;
}

/**
 * Full test suite runner
 */
export function fullTestSuite(input: HookInput): HookResult {
  logHook('full-test-suite', '=== Full Test Suite Started ===');

  const projectDir = input.project_dir || getProjectDir();
  const logDir = `${projectDir}/.claude/hooks/logs`;

  // Ensure log directory exists
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore
  }

  const logFile = `${logDir}/full-test-suite.log`;

  if (!shouldRunTests(projectDir)) {
    return outputSilentSuccess();
  }

  const passed = runTests(projectDir, logFile);

  if (passed) {
    logHook('full-test-suite', '=== All tests passed ===');
    // Update last run file
    try {
      writeFileSync(`${logDir}/.last-test-run`, String(Date.now()));
    } catch {
      // Ignore
    }
  } else {
    logHook('full-test-suite', '=== Some tests failed ===');
    // Don't block - just log the failure
  }

  return outputSilentSuccess();
}

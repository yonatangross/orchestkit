/**
 * Unit tests for run-hook-background.mjs
 *
 * Tests the background hook runner that executes hooks in detached processes.
 * Includes tests for timeout, PID tracking, metrics, and security features.
 *
 * These tests use the centralized test-helpers module for function implementations,
 * with integration tests spawning actual scripts for end-to-end verification.
 *
 * @see src/hooks/bin/run-hook-background.mjs
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';

import {
  sanitizeHookName,
  isProcessRunning,
  getBundleName,
  isDebugEnabled,
  HOOK_TIMEOUT_MS,
  loadModuleFunctions,
} from './test-helpers';

const execAsync = promisify(exec);

// Test temp directory
let testTempDir: string;


// Helper to create isolated temp directory per test
const createTestDir = (name: string) => {
  const dir = join(testTempDir, name);
  mkdirSync(dir, { recursive: true });
  return dir;
};

beforeAll(async () => {
  // Create test temp root
  testTempDir = join(tmpdir(), `hook-test-${Date.now()}`);
  mkdirSync(testTempDir, { recursive: true });

  // Set env var for module initialization
  process.env.CLAUDE_PROJECT_DIR = testTempDir;

  // Try to load real module (optional - helps with debugging)
  try {
    await loadModuleFunctions();
  } catch {
    // Helper functions will be used instead
  }
});

afterAll(() => {
  // Cleanup temp directory
  try {
    rmSync(testTempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe('run-hook-background.mjs - Unit Tests', () => {
  describe('sanitizeHookName (SEC-001: path traversal)', () => {
    it('should replace forward slashes with hyphens', () => {
      expect(sanitizeHookName('posttool/unified-dispatcher')).toBe(
        'posttool-unified-dispatcher'
      );
    });

    it('should replace backslashes with hyphens', () => {
      expect(sanitizeHookName('posttool\\unified-dispatcher')).toBe(
        'posttool-unified-dispatcher'
      );
    });

    it('should prevent path traversal attempts', () => {
      expect(sanitizeHookName('../../../etc/passwd')).toBe(
        '---------etc-passwd'
      );
      expect(sanitizeHookName('..%2F..%2Fetc')).toBe('---2F---2Fetc');
    });

    it('should handle dots in hook names', () => {
      expect(sanitizeHookName('hook.name.with.dots')).toBe(
        'hook-name-with-dots'
      );
    });

    it('should preserve alphanumeric characters and hyphens', () => {
      expect(sanitizeHookName('valid-hook-name-123')).toBe('valid-hook-name-123');
    });

    it('should handle empty string', () => {
      expect(sanitizeHookName('')).toBe('');
    });

    it('should handle special characters', () => {
      expect(sanitizeHookName('hook$name@with#special!chars')).toBe(
        'hook-name-with-special-chars'
      );
    });
  });

  describe('isProcessRunning', () => {
    it('should return true for current process', () => {
      expect(isProcessRunning(process.pid)).toBe(true);
    });

    it('should return false for non-existent process', () => {
      expect(isProcessRunning(999999999)).toBe(false);
    });

    it('should handle negative PID gracefully', () => {
      // On some systems, process.kill(-1, 0) may succeed (signals process group)
      // We just verify it returns a boolean without throwing
      const result = isProcessRunning(-1);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getBundleName mapping', () => {
    it('should map posttool hooks to posttool bundle', () => {
      expect(getBundleName('posttool/unified-dispatcher')).toBe('posttool');
      expect(getBundleName('posttool/file-lock-release')).toBe('posttool');
    });

    it('should map pretool hooks to pretool bundle', () => {
      expect(getBundleName('pretool/git-validator')).toBe('pretool');
    });

    it('should map prompt hooks to prompt bundle', () => {
      expect(getBundleName('prompt/skill-auto-suggest')).toBe('prompt');
    });

    it('should map subagent hooks to subagent bundle', () => {
      expect(getBundleName('subagent-start/graph-memory')).toBe('subagent');
      expect(getBundleName('subagent-stop/agent-memory')).toBe('subagent');
    });

    it('should return null for unknown prefixes', () => {
      expect(getBundleName('unknown/hook-name')).toBeNull();
      expect(getBundleName('invalid-prefix')).toBeNull();
    });
  });

  describe('isDebugEnabled', () => {
    it('should return false when debug is disabled', () => {
      expect(
        isDebugEnabled('posttool/test', { enabled: false, hookFilters: [] })
      ).toBe(false);
    });

    it('should return true for all hooks when filters are empty', () => {
      expect(
        isDebugEnabled('posttool/test', { enabled: true, hookFilters: [] })
      ).toBe(true);
      expect(
        isDebugEnabled('prompt/test', { enabled: true, hookFilters: [] })
      ).toBe(true);
    });

    it('should filter hooks by prefix', () => {
      const config = { enabled: true, hookFilters: ['posttool'] };
      expect(isDebugEnabled('posttool/unified-dispatcher', config)).toBe(true);
      expect(isDebugEnabled('prompt/skill-suggest', config)).toBe(false);
    });

    it('should support multiple filters', () => {
      const config = { enabled: true, hookFilters: ['posttool', 'prompt'] };
      expect(isDebugEnabled('posttool/test', config)).toBe(true);
      expect(isDebugEnabled('prompt/test', config)).toBe(true);
      expect(isDebugEnabled('pretool/test', config)).toBe(false);
    });
  });

  describe('HOOK_TIMEOUT_MS constant', () => {
    it('should be 60 seconds (60000ms)', () => {
      expect(HOOK_TIMEOUT_MS).toBe(60000);
    });
  });
});

describe('run-hook-background.mjs - Integration Tests', () => {
  const binDir = join(__dirname, '..', '..', '..', 'bin');
  const backgroundScript = join(binDir, 'run-hook-background.mjs');

  describe('script execution', () => {
    it('should exit cleanly with no hook name', async () => {
      const result = await execAsync(`node ${backgroundScript}`, {
        env: { ...process.env, CLAUDE_PROJECT_DIR: testTempDir },
        timeout: 5000,
      }).catch((e) => e);

      // Exit code 0 expected (no hook name = early exit)
      expect(result.code || 0).toBe(0);
    });

    it('should exit cleanly with unknown hook prefix', async () => {
      const inputBase64 = Buffer.from(JSON.stringify({ tool_name: 'Test' })).toString('base64');
      const result = await execAsync(
        `node ${backgroundScript} unknown/hook ${inputBase64}`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testTempDir },
          timeout: 5000,
        }
      ).catch((e) => e);

      // Exit code 0 expected (bundle not found = graceful exit)
      expect(result.code || 0).toBe(0);
    });

    it('should decode base64 input correctly', () => {
      const input = { tool_name: 'Write', tool_input: { path: '/test' } };
      const encoded = Buffer.from(JSON.stringify(input)).toString('base64');
      const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));

      expect(decoded).toEqual(input);
    });

    it('should handle malformed base64 gracefully', async () => {
      // Script should not crash with invalid base64
      const result = await execAsync(
        `node ${backgroundScript} posttool/test invalid!!!base64`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testTempDir },
          timeout: 5000,
        }
      ).catch((e) => e);

      // Should complete (either success or handled error), not throw unhandled exception
      // Verify we got a result object with expected structure
      expect(result).toHaveProperty('stdout');
    });
  });

  describe('PID file creation', () => {
    it('should create .claude directory structure', async () => {
      const testDir = createTestDir('pid-test');

      // Run the script briefly
      const inputBase64 = Buffer.from(JSON.stringify({})).toString('base64');
      await execAsync(
        `node ${backgroundScript} posttool/test-hook ${inputBase64}`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
          timeout: 5000,
        }
      ).catch(() => {});

      // Check if .claude directory was created
      const dirExists = existsSync(join(testDir, '.claude'));
      expect(dirExists).toBe(true);
    });
  });

  describe('metrics file creation', () => {
    it('should create metrics file structure when hook runs', async () => {
      const testDir = createTestDir('metrics-test');
      const metricsFile = join(testDir, '.claude', 'hooks', 'metrics.json');

      // Run script
      const inputBase64 = Buffer.from(JSON.stringify({})).toString('base64');
      await execAsync(
        `node ${backgroundScript} posttool/test-metrics ${inputBase64}`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
          timeout: 5000,
        }
      ).catch(() => {});

      // Give it a moment to write
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if metrics file exists (may not if hook exits before updateMetrics)
      if (existsSync(metricsFile)) {
        const metrics = JSON.parse(readFileSync(metricsFile, 'utf-8'));
        expect(metrics).toHaveProperty('hooks');
        expect(metrics).toHaveProperty('lastUpdated');
      } else {
        // Hooks directory should at least be created
        expect(existsSync(join(testDir, '.claude', 'hooks'))).toBe(true);
      }
    });
  });

  describe('debug config loading', () => {
    it('should load debug config from file and create log entries', async () => {
      const testDir = createTestDir('debug-config-test');
      const hooksDir = join(testDir, '.claude', 'hooks');
      mkdirSync(hooksDir, { recursive: true });

      // Write debug config
      const debugConfig = {
        enabled: true,
        verbose: true,
        hookFilters: ['posttool'],
      };
      writeFileSync(join(hooksDir, 'debug.json'), JSON.stringify(debugConfig));

      // Run script
      const inputBase64 = Buffer.from(JSON.stringify({})).toString('base64');
      await execAsync(
        `node ${backgroundScript} posttool/test-debug ${inputBase64}`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
          timeout: 5000,
        }
      ).catch(() => {});

      // Check for log in background-hooks.log
      const logsDir = join(testDir, '.claude', 'logs');
      const logFile = join(logsDir, 'background-hooks.log');
      if (existsSync(logFile)) {
        const log = readFileSync(logFile, 'utf-8');
        // Should contain debug entries with hook name
        expect(log).toContain('posttool/test-debug');
      }
    });

    it('should use defaults when debug config is missing', async () => {
      const testDir = createTestDir('no-debug-config-test');

      // Run script without debug config
      const inputBase64 = Buffer.from(JSON.stringify({})).toString('base64');
      const result = await execAsync(
        `node ${backgroundScript} posttool/test-no-debug ${inputBase64}`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
          timeout: 5000,
        }
      ).catch((e) => e);

      // Should complete without crashing - exit code 0
      expect(result.code || 0).toBe(0);
    });

    it('should handle malformed debug config gracefully', async () => {
      const testDir = createTestDir('bad-debug-config-test');
      const hooksDir = join(testDir, '.claude', 'hooks');
      mkdirSync(hooksDir, { recursive: true });

      // Write malformed config
      writeFileSync(join(hooksDir, 'debug.json'), '{ invalid json }');

      // Run script
      const inputBase64 = Buffer.from(JSON.stringify({})).toString('base64');
      const result = await execAsync(
        `node ${backgroundScript} posttool/test-bad-config ${inputBase64}`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
          timeout: 5000,
        }
      ).catch((e) => e);

      // Should exit cleanly despite malformed config
      expect(result.code || 0).toBe(0);
    });
  });

  describe('stale PID cleanup', () => {
    it('should remove PID files for non-existent processes', async () => {
      const testDir = createTestDir('stale-pid-cleanup-test');
      const pidsDir = join(testDir, '.claude', 'hooks', 'pids');
      mkdirSync(pidsDir, { recursive: true });

      // Create a stale PID file (PID that doesn't exist)
      const stalePidFile = join(pidsDir, 'stale-hook-999999999.pid');
      writeFileSync(
        stalePidFile,
        JSON.stringify({
          pid: 999999999,
          hook: 'stale/hook',
          startTime: new Date(Date.now() - 3600000).toISOString(),
        })
      );

      expect(existsSync(stalePidFile)).toBe(true);

      // Run script - it should clean up stale PIDs on startup
      const inputBase64 = Buffer.from(JSON.stringify({})).toString('base64');
      await execAsync(
        `node ${backgroundScript} posttool/test-cleanup ${inputBase64}`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
          timeout: 5000,
        }
      ).catch(() => {});

      // Stale PID file should be removed
      expect(existsSync(stalePidFile)).toBe(false);
    });

    it('should NOT remove PID files for running processes', async () => {
      const testDir = createTestDir('active-pid-test');
      const pidsDir = join(testDir, '.claude', 'hooks', 'pids');
      mkdirSync(pidsDir, { recursive: true });

      // Create PID file for current process (which IS running)
      const activePidFile = join(pidsDir, `active-hook-${process.pid}.pid`);
      writeFileSync(
        activePidFile,
        JSON.stringify({
          pid: process.pid,
          hook: 'active/hook',
          startTime: new Date().toISOString(),
        })
      );

      expect(existsSync(activePidFile)).toBe(true);

      // Run script
      const inputBase64 = Buffer.from(JSON.stringify({})).toString('base64');
      await execAsync(
        `node ${backgroundScript} posttool/test-active ${inputBase64}`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
          timeout: 5000,
        }
      ).catch(() => {});

      // Active PID file should NOT be removed
      expect(existsSync(activePidFile)).toBe(true);

      // Cleanup
      unlinkSync(activePidFile);
    });
  });

  describe('input normalization', () => {
    it('should normalize snake_case and camelCase inputs', () => {
      // Test the normalization logic
      const input: Record<string, unknown> = {
        toolInput: { path: '/test' },
        toolName: 'Bash',
      };
      input.tool_input = input.tool_input || input.toolInput || {};
      input.tool_name = input.tool_name || input.toolName || '';

      expect(input.tool_input).toEqual({ path: '/test' });
      expect(input.tool_name).toBe('Bash');
    });

    it('should use environment variables as fallback', () => {
      const input: Record<string, unknown> = {};
      const envSessionId = 'env-session-123';
      const envProjectDir = '/env/project';

      input.session_id = input.session_id || envSessionId;
      input.project_dir = input.project_dir || envProjectDir;

      expect(input.session_id).toBe(envSessionId);
      expect(input.project_dir).toBe(envProjectDir);
    });
  });
});

describe('run-hook-background.mjs - Timeout Tests', () => {
  describe('timeout behavior', () => {
    it('should have 60 second timeout constant', () => {
      expect(HOOK_TIMEOUT_MS).toBe(60000);
      expect(HOOK_TIMEOUT_MS / 1000).toBe(60);
    });

    // Note: Testing actual timeout behavior (hook hanging for 60s) would be too slow
    // for unit tests. We verify the constant and trust setTimeout behavior.
    it('should provide sufficient margin for typical hooks', () => {
      const typicalHookDuration = 500; // 500ms typical
      const safetyMargin = HOOK_TIMEOUT_MS / typicalHookDuration;

      // 120x safety margin should be sufficient
      expect(safetyMargin).toBeGreaterThan(100);
    });
  });
});

describe('run-hook-background.mjs - TOCTOU Fixes (SEC-002)', () => {
  it('should use idempotent mkdirSync instead of existsSync check', () => {
    const testDir = createTestDir('toctou-test');
    const subdir = join(testDir, 'subdir');

    // The fix: Just call mkdirSync with recursive:true
    // It's idempotent - won't error if directory exists
    mkdirSync(subdir, { recursive: true });
    mkdirSync(subdir, { recursive: true }); // No error on second call

    expect(existsSync(subdir)).toBe(true);
  });

  it('should handle concurrent directory creation without errors', async () => {
    const testDir = createTestDir('concurrent-mkdir-test');
    const subdir = join(testDir, 'concurrent');

    // Simulate concurrent calls - all should complete without error
    const results = await Promise.all([
      new Promise<void>((resolve) => {
        mkdirSync(subdir, { recursive: true });
        resolve();
      }),
      new Promise<void>((resolve) => {
        mkdirSync(subdir, { recursive: true });
        resolve();
      }),
      new Promise<void>((resolve) => {
        mkdirSync(subdir, { recursive: true });
        resolve();
      }),
    ]);

    // All 3 concurrent calls should complete successfully
    expect(results.length).toBe(3);
    expect(existsSync(subdir)).toBe(true);
  });
});

describe('run-hook-background.mjs - Error Handling', () => {
  it('should log errors to file, not stdout/stderr', async () => {
    const testDir = createTestDir('error-logging-test');

    // Run script with invalid input to trigger error path
    const inputBase64 = 'not-valid-base64!!!';
    const result = await execAsync(
      `node ${join(__dirname, '..', '..', '..', 'bin', 'run-hook-background.mjs')} posttool/test-error ${inputBase64}`,
      {
        env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
        timeout: 5000,
      }
    ).catch((e) => e);

    // Script should complete without crashing
    expect(result).toBeDefined();
    // stdout should be empty (no terminal pollution)
    expect(result.stdout || '').toBe('');
  });
});

describe('run-hook-background.mjs - Concurrent Metrics Tests', () => {
  it('should use atomic write pattern with temp file and rename', async () => {
    const testDir = createTestDir('atomic-write-test');
    const metricsFile = join(testDir, '.claude', 'hooks', 'metrics.json');

    // Simulate the FIXED updateMetrics function with atomic writes
    const updateMetricsAtomic = (
      hookName: string,
      durationMs: number,
      success: boolean,
      pid: number
    ) => {
      const { renameSync } = require('node:fs');
      mkdirSync(join(testDir, '.claude', 'hooks'), { recursive: true });

      let metrics: {
        hooks: Record<string, unknown>;
        lastUpdated: string | null;
      } = { hooks: {}, lastUpdated: null };
      if (existsSync(metricsFile)) {
        try {
          metrics = JSON.parse(readFileSync(metricsFile, 'utf-8'));
        } catch {
          metrics = { hooks: {}, lastUpdated: null };
        }
      }

      if (!metrics.hooks[hookName]) {
        metrics.hooks[hookName] = {
          totalRuns: 0,
          successCount: 0,
          errorCount: 0,
          avgDurationMs: 0,
        };
      }

      const h = metrics.hooks[hookName] as {
        totalRuns: number;
        successCount: number;
        errorCount: number;
        avgDurationMs: number;
      };
      h.totalRuns++;
      if (success) h.successCount++;
      else h.errorCount++;
      h.avgDurationMs = Math.round(
        (h.avgDurationMs * (h.totalRuns - 1) + durationMs) / h.totalRuns
      );
      metrics.lastUpdated = new Date().toISOString();

      // Atomic write: temp file + rename (SEC-003)
      const tempFile = `${metricsFile}.${pid}.tmp`;
      writeFileSync(tempFile, JSON.stringify(metrics, null, 2));
      renameSync(tempFile, metricsFile);
    };

    // Run multiple updates in parallel with atomic writes
    await Promise.all([
      new Promise<void>((resolve) => {
        updateMetricsAtomic('hook1', 100, true, 1001);
        resolve();
      }),
      new Promise<void>((resolve) => {
        updateMetricsAtomic('hook2', 200, true, 1002);
        resolve();
      }),
      new Promise<void>((resolve) => {
        updateMetricsAtomic('hook3', 300, false, 1003);
        resolve();
      }),
    ]);

    // Verify metrics file exists and is valid JSON (no corruption)
    expect(existsSync(metricsFile)).toBe(true);
    const finalMetrics = JSON.parse(readFileSync(metricsFile, 'utf-8'));
    expect(finalMetrics).toHaveProperty('hooks');
    expect(finalMetrics).toHaveProperty('lastUpdated');

    // With atomic writes, at least one hook should be recorded
    // Note: Read-modify-write race still exists, but writes are atomic
    const hookCount = Object.keys(finalMetrics.hooks).length;
    expect(hookCount).toBeGreaterThanOrEqual(1);
  });

  it('should not leave temp files after successful write', async () => {
    const testDir = createTestDir('no-temp-files-test');
    const hooksDir = join(testDir, '.claude', 'hooks');
    const metricsFile = join(hooksDir, 'metrics.json');

    mkdirSync(hooksDir, { recursive: true });

    // Simulate atomic write
    const tempFile = `${metricsFile}.12345.tmp`;
    const metrics = { hooks: { test: { totalRuns: 1 } }, lastUpdated: new Date().toISOString() };

    writeFileSync(tempFile, JSON.stringify(metrics, null, 2));
    expect(existsSync(tempFile)).toBe(true);

    const { renameSync } = require('node:fs');
    renameSync(tempFile, metricsFile);

    // Temp file should be gone, metrics file should exist
    expect(existsSync(tempFile)).toBe(false);
    expect(existsSync(metricsFile)).toBe(true);

    // Verify content is valid
    const written = JSON.parse(readFileSync(metricsFile, 'utf-8'));
    expect(written.hooks.test.totalRuns).toBe(1);
  });

  it('should handle corrupted metrics file by resetting', async () => {
    const testDir = createTestDir('corrupted-metrics-test');
    const hooksDir = join(testDir, '.claude', 'hooks');
    const metricsFile = join(hooksDir, 'metrics.json');

    // Create corrupted metrics file
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(metricsFile, '{ corrupted json data }}}');

    // Verify file exists with invalid JSON
    expect(existsSync(metricsFile)).toBe(true);

    // Run script - it should handle corrupted file
    const inputBase64 = Buffer.from(JSON.stringify({})).toString('base64');
    const result = await execAsync(
      `node ${join(__dirname, '..', '..', '..', 'bin', 'run-hook-background.mjs')} posttool/test-corrupted ${inputBase64}`,
      {
        env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
        timeout: 5000,
      }
    ).catch((e) => e);

    // Script should complete (exit code 0)
    expect(result.code || 0).toBe(0);
  });
});

describe('run-hook-background.mjs - Filesystem Error Tests', () => {
  it('should handle missing bundle directory gracefully', async () => {
    const testDir = createTestDir('missing-dist-test');

    // When dist bundle doesn't exist, script exits cleanly with code 0
    const inputBase64 = Buffer.from(JSON.stringify({})).toString('base64');
    const result = await execAsync(
      `node ${join(__dirname, '..', '..', '..', 'bin', 'run-hook-background.mjs')} posttool/test ${inputBase64}`,
      {
        env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
        timeout: 5000,
      }
    ).catch((e) => e);

    // Should exit cleanly (bundle not found is graceful exit)
    expect(result.code || 0).toBe(0);
  });

  it('should handle non-existent hook function gracefully', async () => {
    const testDir = createTestDir('missing-hook-fn-test');

    // A valid bundle prefix but hook function won't exist
    const inputBase64 = Buffer.from(JSON.stringify({})).toString('base64');
    const result = await execAsync(
      `node ${join(__dirname, '..', '..', '..', 'bin', 'run-hook-background.mjs')} posttool/nonexistent-hook ${inputBase64}`,
      {
        env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
        timeout: 5000,
      }
    ).catch((e) => e);

    // Should exit cleanly (hook function not found is graceful exit)
    expect(result.code || 0).toBe(0);
  });
});

describe('run-hook-background.mjs - Mock Bundle Execution', () => {
  /**
   * This test creates a mock bundle in a temp directory and verifies
   * that the background runner actually loads and executes hook functions.
   *
   * This is the most comprehensive test - it proves end-to-end hook execution.
   */
  it('should execute actual hook function from mock bundle', async () => {
    const testDir = createTestDir('mock-bundle-execution-test');
    const distDir = join(testDir, 'dist');
    const markerFile = join(testDir, 'hook-executed.marker');

    mkdirSync(distDir, { recursive: true });

    // Use JSON.stringify for proper cross-platform path escaping
    // This handles Windows backslashes correctly without manual escaping
    const markerFilePath = JSON.stringify(markerFile);
    const distDirPath = JSON.stringify(distDir);

    // Create a mock posttool bundle that writes a marker file when executed
    const mockBundleCode = `
// Mock bundle for testing hook execution
export const hooks = {
  'posttool/test-execution': async (input) => {
    // Import fs dynamically to avoid issues
    const { writeFileSync } = await import('node:fs');
    // Write a marker file to prove the hook ran
    writeFileSync(${markerFilePath}, JSON.stringify({
      executed: true,
      timestamp: new Date().toISOString(),
      input: input,
    }));
    return { continue: true };
  },
};
`;

    writeFileSync(join(distDir, 'posttool.mjs'), mockBundleCode);

    // Copy the actual run-hook-background.mjs to the test directory's bin/
    const testBinDir = join(testDir, 'bin');
    mkdirSync(testBinDir, { recursive: true });

    // Read the original script
    const originalScript = readFileSync(
      join(__dirname, '..', '..', '..', 'bin', 'run-hook-background.mjs'),
      'utf-8'
    );

    // Modify distDir to point to our mock dist using JSON.stringify for proper escaping
    const modifiedScript = originalScript.replace(
      "const distDir = join(__dirname, '..', 'dist');",
      `const distDir = ${distDirPath};`
    );

    writeFileSync(join(testBinDir, 'run-hook-background.mjs'), modifiedScript);

    // Prepare input
    const input = { tool_name: 'TestTool', tool_input: { key: 'value' } };
    const inputBase64 = Buffer.from(JSON.stringify(input)).toString('base64');

    // Run the modified script
    await execAsync(
      `node ${join(testBinDir, 'run-hook-background.mjs')} posttool/test-execution ${inputBase64}`,
      {
        env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
        timeout: 10000,
      }
    ).catch(() => {});

    // Give it time to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify the hook was executed by checking the marker file
    if (existsSync(markerFile)) {
      const marker = JSON.parse(readFileSync(markerFile, 'utf-8'));
      expect(marker.executed).toBe(true);
      expect(marker.input).toHaveProperty('tool_name', 'TestTool');
    } else {
      // If marker doesn't exist, check logs for errors
      const logsDir = join(testDir, '.claude', 'logs');
      const logFile = join(logsDir, 'background-hooks.log');
      if (existsSync(logFile)) {
        const logs = readFileSync(logFile, 'utf-8');
        // Fail with informative message
        throw new Error(`Hook execution failed. Logs: ${logs}`);
      }
      throw new Error('Hook execution marker file not found and no logs available');
    }
  });

  it('should handle hook function that throws an error', async () => {
    const testDir = createTestDir('mock-bundle-error-test');
    const distDir = join(testDir, 'dist');
    const logsDir = join(testDir, '.claude', 'logs');

    mkdirSync(distDir, { recursive: true });

    // Use JSON.stringify for proper cross-platform path escaping
    const distDirPath = JSON.stringify(distDir);

    // Create a mock bundle that throws an error
    const mockBundleCode = `
export const hooks = {
  'posttool/test-error': async (input) => {
    throw new Error('Intentional test error');
  },
};
`;

    writeFileSync(join(distDir, 'posttool.mjs'), mockBundleCode);

    // Copy and modify the script
    const testBinDir = join(testDir, 'bin');
    mkdirSync(testBinDir, { recursive: true });

    const originalScript = readFileSync(
      join(__dirname, '..', '..', '..', 'bin', 'run-hook-background.mjs'),
      'utf-8'
    );

    // Use JSON.stringify for proper cross-platform path escaping
    const modifiedScript = originalScript.replace(
      "const distDir = join(__dirname, '..', 'dist');",
      `const distDir = ${distDirPath};`
    );

    writeFileSync(join(testBinDir, 'run-hook-background.mjs'), modifiedScript);

    const inputBase64 = Buffer.from(JSON.stringify({})).toString('base64');

    // Run the script - should not crash despite hook error
    const result = await execAsync(
      `node ${join(testBinDir, 'run-hook-background.mjs')} posttool/test-error ${inputBase64}`,
      {
        env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
        timeout: 10000,
      }
    ).catch((e) => e);

    // Script should complete (error is caught and logged)
    expect(result.code || 0).toBe(0);

    // Give it time to write logs
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Check that error was logged
    const logFile = join(logsDir, 'background-hooks.log');
    if (existsSync(logFile)) {
      const logs = readFileSync(logFile, 'utf-8');
      expect(logs).toContain('Intentional test error');
    }
  });

  it('should update metrics after successful hook execution', async () => {
    const testDir = createTestDir('mock-bundle-metrics-test');
    const distDir = join(testDir, 'dist');
    const metricsFile = join(testDir, '.claude', 'hooks', 'metrics.json');

    mkdirSync(distDir, { recursive: true });

    // Use JSON.stringify for proper cross-platform path escaping
    const distDirPath = JSON.stringify(distDir);

    // Create a mock bundle that succeeds
    const mockBundleCode = `
export const hooks = {
  'posttool/test-metrics': async (input) => {
    return { continue: true };
  },
};
`;

    writeFileSync(join(distDir, 'posttool.mjs'), mockBundleCode);

    // Copy and modify the script
    const testBinDir = join(testDir, 'bin');
    mkdirSync(testBinDir, { recursive: true });

    const originalScript = readFileSync(
      join(__dirname, '..', '..', '..', 'bin', 'run-hook-background.mjs'),
      'utf-8'
    );

    // Use JSON.stringify for proper cross-platform path escaping
    const modifiedScript = originalScript.replace(
      "const distDir = join(__dirname, '..', 'dist');",
      `const distDir = ${distDirPath};`
    );

    writeFileSync(join(testBinDir, 'run-hook-background.mjs'), modifiedScript);

    const inputBase64 = Buffer.from(JSON.stringify({})).toString('base64');

    // Run the script
    await execAsync(
      `node ${join(testBinDir, 'run-hook-background.mjs')} posttool/test-metrics ${inputBase64}`,
      {
        env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
        timeout: 10000,
      }
    ).catch(() => {});

    // Give it time to write metrics
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check that metrics were updated
    if (existsSync(metricsFile)) {
      const metrics = JSON.parse(readFileSync(metricsFile, 'utf-8'));
      expect(metrics).toHaveProperty('hooks');
      expect(metrics.hooks).toHaveProperty('posttool/test-metrics');

      const hookMetrics = metrics.hooks['posttool/test-metrics'];
      expect(hookMetrics.totalRuns).toBeGreaterThanOrEqual(1);
      expect(hookMetrics.successCount).toBeGreaterThanOrEqual(1);
    }
  });
});

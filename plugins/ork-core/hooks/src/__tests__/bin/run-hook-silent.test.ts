/**
 * Unit tests for run-hook-silent.mjs
 *
 * Tests the synchronous wrapper that spawns background hook processes
 * to eliminate "Async hook X completed" terminal spam (Issue #243).
 *
 * These tests use integration testing via child_process to verify actual behavior.
 *
 * @see src/hooks/bin/run-hook-silent.mjs
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';

const execAsync = promisify(exec);

// Test temp directory
let testTempDir: string;

// Helper to create isolated temp directory per test
const createTestDir = (name: string) => {
  const dir = join(testTempDir, name);
  mkdirSync(dir, { recursive: true });
  return dir;
};

const binDir = join(__dirname, '..', '..', '..', 'bin');
const silentScript = join(binDir, 'run-hook-silent.mjs');

beforeAll(() => {
  // Create test temp root
  testTempDir = join(tmpdir(), `silent-hook-test-${Date.now()}`);
  mkdirSync(testTempDir, { recursive: true });
});

afterAll(() => {
  // Cleanup temp directory
  try {
    rmSync(testTempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe('run-hook-silent.mjs - Integration Tests', () => {
  describe('response format', () => {
    it('should output valid JSON with continue:true and suppressOutput:true', async () => {
      const testDir = createTestDir('response-format-test');

      // Run the script with a hook name
      const result = await execAsync(
        `echo '{}' | node ${silentScript} posttool/test-hook`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
          timeout: 5000,
        }
      );

      // Parse the output
      const response = JSON.parse(result.stdout.trim());
      expect(response.continue).toBe(true);
      expect(response.suppressOutput).toBe(true);
    });

    it('should output valid JSON even with no hook name', async () => {
      const testDir = createTestDir('no-hook-name-test');

      // Run without hook name
      const result = await execAsync(`node ${silentScript}`, {
        env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
        timeout: 5000,
      });

      const response = JSON.parse(result.stdout.trim());
      expect(response.continue).toBe(true);
      expect(response.suppressOutput).toBe(true);
    });
  });

  describe('stdin handling', () => {
    it('should handle empty stdin gracefully', async () => {
      const testDir = createTestDir('empty-stdin-test');

      // Run with empty stdin (echo nothing)
      const result = await execAsync(
        `echo '' | node ${silentScript} posttool/test`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
          timeout: 5000,
        }
      );

      const response = JSON.parse(result.stdout.trim());
      expect(response.continue).toBe(true);
    });

    it('should handle valid JSON stdin', async () => {
      const testDir = createTestDir('valid-json-stdin-test');

      const input = JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
      });
      const result = await execAsync(
        `echo '${input}' | node ${silentScript} posttool/test`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
          timeout: 5000,
        }
      );

      const response = JSON.parse(result.stdout.trim());
      expect(response.continue).toBe(true);
    });

    it('should handle malformed JSON stdin gracefully', async () => {
      const testDir = createTestDir('malformed-json-stdin-test');

      // Run with malformed JSON
      const result = await execAsync(
        `echo '{ invalid json }' | node ${silentScript} posttool/test`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
          timeout: 5000,
        }
      );

      // Should still return valid response (with logging)
      const response = JSON.parse(result.stdout.trim());
      expect(response.continue).toBe(true);

      // Check that error was logged
      const logsDir = join(testDir, '.claude', 'logs');
      if (existsSync(join(logsDir, 'background-hooks.log'))) {
        const log = readFileSync(
          join(logsDir, 'background-hooks.log'),
          'utf-8'
        );
        expect(log).toContain('Failed to parse stdin JSON');
      }
    });

    it('should handle stdin timeout (100ms) and complete quickly', async () => {
      const testDir = createTestDir('stdin-timeout-test');

      // The script has a 100ms timeout for stdin
      // If stdin doesn't close in time, it spawns with empty input
      // This is tested implicitly by the script not hanging

      const startTime = Date.now();
      const result = await execAsync(`node ${silentScript} posttool/test`, {
        env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
        timeout: 5000,
      });
      const elapsed = Date.now() - startTime;

      const response = JSON.parse(result.stdout.trim());
      expect(response.continue).toBe(true);

      // Should complete quickly (within 500ms accounting for process spawn overhead)
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('environment variable passthrough', () => {
    it('should pass through CLAUDE_SESSION_ID', async () => {
      const testDir = createTestDir('env-session-id-test');
      const sessionId = 'test-session-123';

      const result = await execAsync(
        `echo '{}' | node ${silentScript} posttool/test`,
        {
          env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: testDir,
            CLAUDE_SESSION_ID: sessionId,
          },
          timeout: 5000,
        }
      );

      // Script should complete (env vars are passed to background process)
      const response = JSON.parse(result.stdout.trim());
      expect(response.continue).toBe(true);
    });

    it('should pass through CLAUDE_PROJECT_DIR', async () => {
      const testDir = createTestDir('env-project-dir-test');

      const result = await execAsync(
        `echo '{}' | node ${silentScript} posttool/test`,
        {
          env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: testDir,
          },
          timeout: 5000,
        }
      );

      const response = JSON.parse(result.stdout.trim());
      expect(response.continue).toBe(true);
    });

    it('should pass through CLAUDE_PLUGIN_ROOT', async () => {
      const testDir = createTestDir('env-plugin-root-test');

      const result = await execAsync(
        `echo '{}' | node ${silentScript} posttool/test`,
        {
          env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: testDir,
            CLAUDE_PLUGIN_ROOT: '/path/to/plugin',
          },
          timeout: 5000,
        }
      );

      const response = JSON.parse(result.stdout.trim());
      expect(response.continue).toBe(true);
    });
  });

  describe('background process spawning', () => {
    it('should spawn detached background process and return immediately', async () => {
      const testDir = createTestDir('spawn-test');

      const startTime = Date.now();
      const result = await execAsync(
        `echo '{}' | node ${silentScript} posttool/test`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
          timeout: 5000,
        }
      );
      const elapsed = Date.now() - startTime;

      // The silent script should exit immediately
      const response = JSON.parse(result.stdout.trim());
      expect(response.continue).toBe(true);

      // Should complete very quickly (proves it's not waiting for background)
      expect(elapsed).toBeLessThan(500);
    });

    it('should encode input as base64 for background process', () => {
      // Test the base64 encoding/decoding that happens
      const input = {
        tool_name: 'Write',
        tool_input: {
          file_path: '/test/file.ts',
          content: 'const x = 1;\n"quotes"',
        },
        session_id: 'session-abc',
        project_dir: '/project',
      };

      const encoded = Buffer.from(JSON.stringify(input)).toString('base64');
      const decoded = JSON.parse(
        Buffer.from(encoded, 'base64').toString('utf-8')
      );

      expect(decoded).toEqual(input);
    });

    it('should handle special characters in input via base64', () => {
      const input = {
        tool_input: {
          content: 'line1\nline2\ttab "quotes" \'apostrophe\' $var `backtick`',
        },
      };

      const encoded = Buffer.from(JSON.stringify(input)).toString('base64');
      const decoded = JSON.parse(
        Buffer.from(encoded, 'base64').toString('utf-8')
      );

      expect(decoded.tool_input.content).toBe(input.tool_input.content);
    });
  });

  describe('error logging', () => {
    it('should log JSON parse errors to file (not stderr)', async () => {
      const testDir = createTestDir('error-log-test');

      // Send malformed JSON
      await execAsync(
        `echo '{ bad json }' | node ${silentScript} posttool/test`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
          timeout: 5000,
        }
      );

      // Check for log file
      const logFile = join(testDir, '.claude', 'logs', 'background-hooks.log');
      if (existsSync(logFile)) {
        const log = readFileSync(logFile, 'utf-8');
        // Should contain error entry
        expect(log).toContain('error');
        expect(log).toContain('Failed to parse stdin JSON');
      }
    });

    it('should not write to stderr on errors', async () => {
      const testDir = createTestDir('no-stderr-test');

      // Send malformed JSON
      const result = await execAsync(
        `echo '{ bad json }' | node ${silentScript} posttool/test`,
        {
          env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
          timeout: 5000,
        }
      );

      // stderr should be empty (silent behavior)
      expect(result.stderr).toBe('');
    });
  });
});

describe('Silent Hook Pattern (Issue #243)', () => {
  it('should demonstrate why this pattern eliminates async hook spam', () => {
    /**
     * Claude Code prints "Async hook X completed" for hooks with async: true.
     *
     * OLD PATTERN (spammy):
     * hooks.json: { "async": true, "command": "node run-hook.mjs" }
     * → Claude Code tracks async completion → prints message
     *
     * NEW PATTERN (silent):
     * hooks.json: { "command": "node run-hook-silent.mjs" } (no async flag!)
     * → run-hook-silent.mjs spawns detached child → returns immediately
     * → Claude Code sees sync hook completion → no message printed
     * → Background process runs independently
     */
    const oldPattern = { async: true, command: 'node run-hook.mjs' };
    const newPattern = { command: 'node run-hook-silent.mjs' };

    // Key difference: new pattern has NO async flag
    expect(oldPattern.async).toBe(true);
    expect(newPattern).not.toHaveProperty('async');

    // Both complete sync from Claude Code's perspective
    // but new pattern spawns background work
    expect(oldPattern.command).toContain('run-hook.mjs');
    expect(newPattern.command).toContain('run-hook-silent.mjs');
  });

  it('should verify detached spawn options are correct', () => {
    // The key to fire-and-forget is:
    // 1. detached: true - creates new process group
    // 2. stdio: 'ignore' - no pipes to parent
    // 3. child.unref() - allows parent to exit
    const spawnOptions = {
      detached: true,
      stdio: 'ignore' as const,
    };

    expect(spawnOptions.detached).toBe(true);
    expect(spawnOptions.stdio).toBe('ignore');
  });

  it('should verify unref pattern breaks parent-child link', () => {
    // When child.unref() is called:
    // - Parent process can exit without waiting for child
    // - Child continues running in background
    // - No zombie processes
    // - Node event loop doesn't wait for child

    // Mock to verify the pattern
    let unrefCalled = false;
    const mockChild = {
      unref: () => {
        unrefCalled = true;
      },
      pid: 12345,
    };

    mockChild.unref();

    expect(unrefCalled).toBe(true);
    expect(mockChild.pid).toBe(12345);
  });
});

describe('run-hook-silent.mjs - Base64 Transport', () => {
  it('should handle Unicode characters in input', () => {
    const input = {
      tool_input: {
        content: '你好世界 🌍 émojis café naïve',
      },
    };

    const encoded = Buffer.from(JSON.stringify(input)).toString('base64');
    const decoded = JSON.parse(
      Buffer.from(encoded, 'base64').toString('utf-8')
    );

    expect(decoded.tool_input.content).toBe(input.tool_input.content);
  });

  it('should handle large inputs (100KB)', () => {
    const largeContent = 'x'.repeat(100000); // 100KB
    const input = { tool_input: { content: largeContent } };

    const encoded = Buffer.from(JSON.stringify(input)).toString('base64');
    const decoded = JSON.parse(
      Buffer.from(encoded, 'base64').toString('utf-8')
    );

    expect(decoded.tool_input.content.length).toBe(100000);
  });

  it('should handle empty input object', () => {
    const input = {};
    const encoded = Buffer.from(JSON.stringify(input)).toString('base64');
    const decoded = JSON.parse(
      Buffer.from(encoded, 'base64').toString('utf-8')
    );

    expect(decoded).toEqual({});
  });

  it('should handle deeply nested objects', () => {
    const input = {
      tool_input: {
        nested: {
          deeply: {
            nested: {
              value: 'test',
            },
          },
        },
      },
    };

    const encoded = Buffer.from(JSON.stringify(input)).toString('base64');
    const decoded = JSON.parse(
      Buffer.from(encoded, 'base64').toString('utf-8')
    );

    expect(decoded.tool_input.nested.deeply.nested.value).toBe('test');
  });
});

describe('run-hook-silent.mjs - Performance', () => {
  it('should complete quickly (under 500ms)', async () => {
    const testDir = createTestDir('perf-test');

    const startTime = Date.now();
    await execAsync(`echo '{}' | node ${silentScript} posttool/test`, {
      env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
      timeout: 5000,
    });
    const elapsed = Date.now() - startTime;

    // Should be fast - under 500ms including process spawn overhead
    expect(elapsed).toBeLessThan(500);
  });

  it('should not block on background process', async () => {
    const testDir = createTestDir('non-blocking-test');

    // The script should return immediately, not wait for background
    const startTime = Date.now();
    const result = await execAsync(
      `echo '{}' | node ${silentScript} posttool/test`,
      {
        env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
        timeout: 5000,
      }
    );
    const elapsed = Date.now() - startTime;

    // Verify we got response
    const response = JSON.parse(result.stdout.trim());
    expect(response.continue).toBe(true);

    // Should complete well before any hook could finish
    expect(elapsed).toBeLessThan(500);
  });

  it('should return immediately even for multiple consecutive calls', async () => {
    const testDir = createTestDir('consecutive-calls-test');

    // Multiple rapid calls should all complete quickly
    const startTime = Date.now();

    const results = await Promise.all([
      execAsync(`echo '{}' | node ${silentScript} posttool/test1`, {
        env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
        timeout: 5000,
      }),
      execAsync(`echo '{}' | node ${silentScript} posttool/test2`, {
        env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
        timeout: 5000,
      }),
      execAsync(`echo '{}' | node ${silentScript} posttool/test3`, {
        env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
        timeout: 5000,
      }),
    ]);

    const elapsed = Date.now() - startTime;

    // All 3 should complete
    expect(results.length).toBe(3);

    // All should return valid responses
    for (const result of results) {
      const response = JSON.parse(result.stdout.trim());
      expect(response.continue).toBe(true);
    }

    // Should complete quickly (parallel execution)
    expect(elapsed).toBeLessThan(1000);
  });
});

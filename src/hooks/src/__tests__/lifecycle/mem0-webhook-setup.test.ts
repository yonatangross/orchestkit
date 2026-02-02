/**
 * Unit tests for mem0-webhook-setup lifecycle hook
 * Tests auto-configuration of mem0 webhooks at session start
 * CC 2.1.7 Compliant: Non-blocking hook that always returns continue: true
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { HookInput } from '../../types.js';
import { mem0WebhookSetup } from '../../lifecycle/mem0-webhook-setup.js';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = join(tmpdir(), 'mem0-webhook-setup-test');
const TEST_SESSION_ID = 'test-session-webhook-' + Date.now();

/**
 * Create realistic HookInput for testing
 */
function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: TEST_SESSION_ID,
    project_dir: TEST_PROJECT_DIR,
    tool_input: {},
    ...overrides,
  };
}

/**
 * Read webhook config file
 */
function readWebhookConfig(): {
  webhook_name: string;
  events: string[];
  url: string;
} | null {
  const configFile = `${TEST_PROJECT_DIR}/.claude/mem0-webhooks.json`;
  if (!existsSync(configFile)) {
    return null;
  }
  return JSON.parse(readFileSync(configFile, 'utf-8'));
}

/**
 * Store original environment values
 */
let originalEnv: {
  MEM0_API_KEY?: string;
  MEM0_WEBHOOK_URL?: string;
  ORCHESTKIT_SKIP_SLOW_HOOKS?: string;
  CLAUDE_PROJECT_DIR?: string;
};

beforeEach(() => {
  // Store original environment
  originalEnv = {
    MEM0_API_KEY: process.env.MEM0_API_KEY,
    MEM0_WEBHOOK_URL: process.env.MEM0_WEBHOOK_URL,
    ORCHESTKIT_SKIP_SLOW_HOOKS: process.env.ORCHESTKIT_SKIP_SLOW_HOOKS,
    CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
  };

  // Set up test environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;
  delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;

  // Create test directory
  mkdirSync(TEST_PROJECT_DIR, { recursive: true });

  // Clear any mocks
  vi.clearAllMocks();
});

afterEach(() => {
  // Clean up test directory
  if (existsSync(TEST_PROJECT_DIR)) {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }

  // Restore original environment
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
});

// =============================================================================
// Tests
// =============================================================================

describe('mem0-webhook-setup', () => {
  describe('basic behavior', () => {
    test('returns silent success when mem0 is not available', () => {
      // Arrange
      delete process.env.MEM0_API_KEY;
      const input = createHookInput();

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success when mem0 is available', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input = createHookInput();

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('creates webhook config file when mem0 is available', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const configFile = `${TEST_PROJECT_DIR}/.claude/mem0-webhooks.json`;
      expect(existsSync(configFile)).toBe(true);
    });

    test('does not create config file when mem0 is not available', () => {
      // Arrange
      delete process.env.MEM0_API_KEY;
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const configFile = `${TEST_PROJECT_DIR}/.claude/mem0-webhooks.json`;
      expect(existsSync(configFile)).toBe(false);
    });
  });

  describe('slow hooks bypass', () => {
    test('skips when ORCHESTKIT_SKIP_SLOW_HOOKS is set to 1', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      process.env.ORCHESTKIT_SKIP_SLOW_HOOKS = '1';
      const input = createHookInput();

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // Config file should not be created
      const configFile = `${TEST_PROJECT_DIR}/.claude/mem0-webhooks.json`;
      expect(existsSync(configFile)).toBe(false);
    });

    test('does not skip when ORCHESTKIT_SKIP_SLOW_HOOKS is not set', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const configFile = `${TEST_PROJECT_DIR}/.claude/mem0-webhooks.json`;
      expect(existsSync(configFile)).toBe(true);
    });

    test('does not skip when ORCHESTKIT_SKIP_SLOW_HOOKS is set to 0', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      process.env.ORCHESTKIT_SKIP_SLOW_HOOKS = '0';
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const configFile = `${TEST_PROJECT_DIR}/.claude/mem0-webhooks.json`;
      expect(existsSync(configFile)).toBe(true);
    });

    test.each([
      ['1', false],
      ['0', true],
      ['', true],
      ['true', true],
      ['false', true],
      [undefined, true],
    ])('with ORCHESTKIT_SKIP_SLOW_HOOKS=%s, creates config: %s', (value, shouldCreate) => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      if (value !== undefined) {
        process.env.ORCHESTKIT_SKIP_SLOW_HOOKS = value;
      } else {
        delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      }
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const configFile = `${TEST_PROJECT_DIR}/.claude/mem0-webhooks.json`;
      expect(existsSync(configFile)).toBe(shouldCreate);
    });
  });

  describe('mem0 availability check', () => {
    test('skips when MEM0_API_KEY is not set', () => {
      // Arrange
      delete process.env.MEM0_API_KEY;
      const input = createHookInput();

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      const config = readWebhookConfig();
      expect(config).toBeNull();
    });

    test('skips when MEM0_API_KEY is empty string', () => {
      // Arrange
      process.env.MEM0_API_KEY = '';
      const input = createHookInput();

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      const config = readWebhookConfig();
      expect(config).toBeNull();
    });

    test('proceeds when MEM0_API_KEY has valid value', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'valid-key-123';
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const config = readWebhookConfig();
      expect(config).not.toBeNull();
    });

    test.each([
      ['valid-key', true],
      ['m0_abc123', true],
      ['', false],
      [undefined, false],
    ])('with MEM0_API_KEY=%s, creates config: %s', (apiKey, shouldCreate) => {
      // Arrange
      if (apiKey !== undefined) {
        process.env.MEM0_API_KEY = apiKey;
      } else {
        delete process.env.MEM0_API_KEY;
      }
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const config = readWebhookConfig();
      expect(config !== null).toBe(shouldCreate);
    });
  });

  describe('webhook config structure', () => {
    test('creates config with correct webhook_name', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const config = readWebhookConfig();
      expect(config).not.toBeNull();
      expect(config!.webhook_name).toBe('orchestkit-auto-sync');
    });

    test('creates config with correct events', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const config = readWebhookConfig();
      expect(config).not.toBeNull();
      expect(config!.events).toContain('memory.created');
      expect(config!.events).toContain('memory.updated');
      expect(config!.events).toContain('memory.deleted');
      expect(config!.events).toHaveLength(3);
    });

    test('uses MEM0_WEBHOOK_URL when set', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      process.env.MEM0_WEBHOOK_URL = 'https://custom.webhook.url/mem0';
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const config = readWebhookConfig();
      expect(config).not.toBeNull();
      expect(config!.url).toBe('https://custom.webhook.url/mem0');
    });

    test('uses default URL when MEM0_WEBHOOK_URL is not set', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      delete process.env.MEM0_WEBHOOK_URL;
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const config = readWebhookConfig();
      expect(config).not.toBeNull();
      expect(config!.url).toBe('https://example.com/webhook/mem0');
    });

    test('writes valid JSON format', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const configFile = `${TEST_PROJECT_DIR}/.claude/mem0-webhooks.json`;
      const content = readFileSync(configFile, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    test('writes formatted JSON (pretty print)', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const configFile = `${TEST_PROJECT_DIR}/.claude/mem0-webhooks.json`;
      const content = readFileSync(configFile, 'utf-8');
      // Check for newlines (indicates pretty print)
      expect(content).toContain('\n');
    });
  });

  describe('directory creation', () => {
    test('creates .claude directory if not exists', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      expect(existsSync(`${TEST_PROJECT_DIR}/.claude`)).toBe(true);
    });

    test('does not fail if .claude directory already exists', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      mkdirSync(`${TEST_PROJECT_DIR}/.claude`, { recursive: true });
      const input = createHookInput();

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      const config = readWebhookConfig();
      expect(config).not.toBeNull();
    });
  });

  describe('fallback handling', () => {
    test('uses input.project_dir when provided', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const customDir = join(tmpdir(), 'custom-webhook-test-' + Date.now());
      mkdirSync(customDir, { recursive: true });
      const input = createHookInput({ project_dir: customDir });

      // Act
      mem0WebhookSetup(input);

      // Assert
      const configFile = `${customDir}/.claude/mem0-webhooks.json`;
      expect(existsSync(configFile)).toBe(true);

      // Cleanup
      rmSync(customDir, { recursive: true, force: true });
    });

    test('uses CLAUDE_PROJECT_DIR when input.project_dir is undefined', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const envDir = join(tmpdir(), 'env-webhook-test-' + Date.now());
      mkdirSync(envDir, { recursive: true });
      process.env.CLAUDE_PROJECT_DIR = envDir;
      const input = createHookInput({ project_dir: undefined });

      // Act
      mem0WebhookSetup(input);

      // Assert
      const configFile = `${envDir}/.claude/mem0-webhooks.json`;
      expect(existsSync(configFile)).toBe(true);

      // Cleanup
      rmSync(envDir, { recursive: true, force: true });
    });
  });

  describe('error handling', () => {
    test('returns silent success when write fails', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input = createHookInput({ project_dir: '/invalid/readonly/path' });

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles non-existent project directory gracefully', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input = createHookInput({ project_dir: '/non/existent/path/deep/nested' });

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles empty input gracefully', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input: HookInput = {
        tool_name: '',
        session_id: '',
        tool_input: {},
      };

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('never throws an exception', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const invalidInputs = [
        createHookInput({ project_dir: '' }),
        createHookInput({ project_dir: undefined }),
        createHookInput({ project_dir: null as unknown as string }),
      ];

      // Act & Assert
      invalidInputs.forEach((input) => {
        expect(() => mem0WebhookSetup(input)).not.toThrow();
      });
    });
  });

  describe('non-blocking behavior', () => {
    test('always returns continue: true regardless of mem0 state', () => {
      // Arrange
      const testCases = [
        { MEM0_API_KEY: 'key', ORCHESTKIT_SKIP_SLOW_HOOKS: undefined },
        { MEM0_API_KEY: 'key', ORCHESTKIT_SKIP_SLOW_HOOKS: '1' },
        { MEM0_API_KEY: undefined, ORCHESTKIT_SKIP_SLOW_HOOKS: undefined },
        { MEM0_API_KEY: '', ORCHESTKIT_SKIP_SLOW_HOOKS: undefined },
      ];

      testCases.forEach(({ MEM0_API_KEY, ORCHESTKIT_SKIP_SLOW_HOOKS }) => {
        if (MEM0_API_KEY !== undefined) {
          process.env.MEM0_API_KEY = MEM0_API_KEY;
        } else {
          delete process.env.MEM0_API_KEY;
        }
        if (ORCHESTKIT_SKIP_SLOW_HOOKS !== undefined) {
          process.env.ORCHESTKIT_SKIP_SLOW_HOOKS = ORCHESTKIT_SKIP_SLOW_HOOKS;
        } else {
          delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
        }

        // Act
        const result = mem0WebhookSetup(createHookInput());

        // Assert
        expect(result.continue).toBe(true);
      });
    });

    test('does not block on write errors', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input = createHookInput({ project_dir: '/root/readonly' });

      // Act
      const start = Date.now();
      const result = mem0WebhookSetup(input);
      const duration = Date.now() - start;

      // Assert
      expect(result.continue).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete quickly
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('suppressOutput', true);
    });

    test('always returns continue: true on success', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input = createHookInput();

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true on error', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input = createHookInput({ project_dir: '/invalid/path' });

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true when skipped', () => {
      // Arrange
      process.env.ORCHESTKIT_SKIP_SLOW_HOOKS = '1';
      const input = createHookInput();

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('never returns stopReason', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input = createHookInput();

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result.stopReason).toBeUndefined();
    });

    test('never blocks session start', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input = createHookInput();

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('overwrite behavior', () => {
    test('overwrites existing webhook config file', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      mkdirSync(`${TEST_PROJECT_DIR}/.claude`, { recursive: true });
      writeFileSync(
        `${TEST_PROJECT_DIR}/.claude/mem0-webhooks.json`,
        JSON.stringify({ old: 'config' })
      );
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const config = readWebhookConfig();
      expect(config).not.toBeNull();
      expect(config!.webhook_name).toBe('orchestkit-auto-sync');
      expect((config as Record<string, unknown>).old).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    test('handles null-like project_dir values', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      const input = createHookInput({ project_dir: null as unknown as string });

      // Act
      const result = mem0WebhookSetup(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles very long webhook URL', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      process.env.MEM0_WEBHOOK_URL = 'https://example.com/' + 'path/'.repeat(100);
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const config = readWebhookConfig();
      expect(config).not.toBeNull();
      expect(config!.url).toContain('path/');
    });

    test('handles webhook URL with special characters', () => {
      // Arrange
      process.env.MEM0_API_KEY = 'test-api-key';
      process.env.MEM0_WEBHOOK_URL = 'https://example.com/webhook?key=value&foo=bar';
      const input = createHookInput();

      // Act
      mem0WebhookSetup(input);

      // Assert
      const config = readWebhookConfig();
      expect(config).not.toBeNull();
      expect(config!.url).toBe('https://example.com/webhook?key=value&foo=bar');
    });
  });
});

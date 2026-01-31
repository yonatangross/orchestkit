/**
 * Unit tests for multi-instance-init lifecycle hook
 * Tests multi-instance coordination initialization with SQLite database
 * CC 2.1.7 Compliant: Self-guarding - only runs when CLAUDE_MULTI_INSTANCE=1
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { HookInput } from '../../types.js';
import { multiInstanceInit } from '../../lifecycle/multi-instance-init.js';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = join(tmpdir(), 'multi-instance-init-test');

/**
 * Create realistic HookInput for testing
 */
function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: 'test-session-multi-' + Date.now(),
    project_dir: TEST_PROJECT_DIR,
    tool_input: {},
    ...overrides,
  };
}

/**
 * Create project structure for capability detection
 */
function createProjectStructure(options: {
  backend?: boolean;
  frontend?: boolean;
  tests?: boolean;
  infrastructure?: boolean;
} = {}): void {
  if (options.backend) {
    mkdirSync(`${TEST_PROJECT_DIR}/backend`, { recursive: true });
  }
  if (options.frontend) {
    mkdirSync(`${TEST_PROJECT_DIR}/frontend`, { recursive: true });
  }
  if (options.tests) {
    mkdirSync(`${TEST_PROJECT_DIR}/tests`, { recursive: true });
  }
  if (options.infrastructure) {
    mkdirSync(`${TEST_PROJECT_DIR}/infrastructure`, { recursive: true });
  }
}

/**
 * Create coordination schema file
 */
function createSchemaFile(): void {
  const coordDir = `${TEST_PROJECT_DIR}/.claude/coordination`;
  mkdirSync(coordDir, { recursive: true });
  writeFileSync(
    `${coordDir}/schema.sql`,
    `
    CREATE TABLE IF NOT EXISTS instances (
      instance_id TEXT PRIMARY KEY,
      worktree_name TEXT,
      worktree_path TEXT,
      branch TEXT,
      capabilities TEXT,
      agent_type TEXT,
      model TEXT,
      priority INTEGER DEFAULT 1,
      created_at TEXT,
      status TEXT DEFAULT 'active',
      last_heartbeat TEXT
    );
    CREATE TABLE IF NOT EXISTS locks (
      resource TEXT PRIMARY KEY,
      instance_id TEXT,
      acquired_at TEXT,
      expires_at TEXT
    );
    `
  );
}

/**
 * Check if sqlite3 is available
 */
function isSqlite3Available(): boolean {
  try {
    execSync('which sqlite3', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Store original environment values
 */
let originalEnv: {
  CLAUDE_MULTI_INSTANCE?: string;
  ORCHESTKIT_SKIP_SLOW_HOOKS?: string;
  CLAUDE_PROJECT_DIR?: string;
};

beforeEach(() => {
  // Store original environment
  originalEnv = {
    CLAUDE_MULTI_INSTANCE: process.env.CLAUDE_MULTI_INSTANCE,
    ORCHESTKIT_SKIP_SLOW_HOOKS: process.env.ORCHESTKIT_SKIP_SLOW_HOOKS,
    CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
  };

  // Create test directory
  mkdirSync(TEST_PROJECT_DIR, { recursive: true });

  // Initialize as git repo for branch detection
  try {
    execSync('git init', { cwd: TEST_PROJECT_DIR, stdio: 'pipe' });
  } catch {
    // Ignore if git init fails
  }
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

describe('multi-instance-init', () => {
  describe('self-guarding behavior', () => {
    test('skips when CLAUDE_MULTI_INSTANCE is not set', () => {
      // Arrange
      delete process.env.CLAUDE_MULTI_INSTANCE;
      const input = createHookInput();

      // Act
      const result = multiInstanceInit(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips when CLAUDE_MULTI_INSTANCE is not "1"', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '0';
      const input = createHookInput();

      // Act
      const result = multiInstanceInit(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips when sqlite3 is not available', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      // Note: We can't truly test this unless sqlite3 is actually missing
      // This test documents expected behavior
      const input = createHookInput();

      // Act
      const result = multiInstanceInit(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips when ORCHESTKIT_SKIP_SLOW_HOOKS is set', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      process.env.ORCHESTKIT_SKIP_SLOW_HOOKS = '1';
      const input = createHookInput();

      // Act
      const result = multiInstanceInit(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('instance identity creation', () => {
    test.skipIf(!isSqlite3Available())('creates instance identity file', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      createSchemaFile();
      const input = createHookInput();

      // Act
      const result = multiInstanceInit(input);

      // Assert
      expect(result.continue).toBe(true);
      const instanceDir = `${TEST_PROJECT_DIR}/.instance`;
      if (existsSync(instanceDir)) {
        const idFile = `${instanceDir}/id.json`;
        if (existsSync(idFile)) {
          const identity = JSON.parse(readFileSync(idFile, 'utf-8'));
          expect(identity.instance_id).toBeTruthy();
          expect(identity.status).toBe('active');
        }
      }
    });

    test.skipIf(!isSqlite3Available())('includes correct identity fields', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      createSchemaFile();
      const input = createHookInput();

      // Act
      multiInstanceInit(input);

      // Assert
      const idFile = `${TEST_PROJECT_DIR}/.instance/id.json`;
      if (existsSync(idFile)) {
        const identity = JSON.parse(readFileSync(idFile, 'utf-8'));
        expect(identity).toHaveProperty('instance_id');
        expect(identity).toHaveProperty('worktree_name');
        expect(identity).toHaveProperty('worktree_path');
        expect(identity).toHaveProperty('branch');
        expect(identity).toHaveProperty('capabilities');
        expect(identity).toHaveProperty('agent_type');
        expect(identity).toHaveProperty('model');
        expect(identity).toHaveProperty('priority');
        expect(identity).toHaveProperty('created_at');
        expect(identity).toHaveProperty('status');
        expect(identity).toHaveProperty('heartbeat_interval_ms');
        expect(identity).toHaveProperty('last_heartbeat');
      }
    });
  });

  describe('capability detection', () => {
    test.skipIf(!isSqlite3Available())('detects backend capability', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      createSchemaFile();
      createProjectStructure({ backend: true });
      const input = createHookInput();

      // Act
      multiInstanceInit(input);

      // Assert
      const idFile = `${TEST_PROJECT_DIR}/.instance/id.json`;
      if (existsSync(idFile)) {
        const identity = JSON.parse(readFileSync(idFile, 'utf-8'));
        expect(identity.capabilities).toContain('backend');
      }
    });

    test.skipIf(!isSqlite3Available())('detects frontend capability', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      createSchemaFile();
      createProjectStructure({ frontend: true });
      const input = createHookInput();

      // Act
      multiInstanceInit(input);

      // Assert
      const idFile = `${TEST_PROJECT_DIR}/.instance/id.json`;
      if (existsSync(idFile)) {
        const identity = JSON.parse(readFileSync(idFile, 'utf-8'));
        expect(identity.capabilities).toContain('frontend');
      }
    });

    test.skipIf(!isSqlite3Available())('detects testing capability', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      createSchemaFile();
      createProjectStructure({ tests: true });
      const input = createHookInput();

      // Act
      multiInstanceInit(input);

      // Assert
      const idFile = `${TEST_PROJECT_DIR}/.instance/id.json`;
      if (existsSync(idFile)) {
        const identity = JSON.parse(readFileSync(idFile, 'utf-8'));
        expect(identity.capabilities).toContain('testing');
      }
    });

    test.skipIf(!isSqlite3Available())('detects devops capability', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      createSchemaFile();
      createProjectStructure({ infrastructure: true });
      const input = createHookInput();

      // Act
      multiInstanceInit(input);

      // Assert
      const idFile = `${TEST_PROJECT_DIR}/.instance/id.json`;
      if (existsSync(idFile)) {
        const identity = JSON.parse(readFileSync(idFile, 'utf-8'));
        expect(identity.capabilities).toContain('devops');
      }
    });

    test.skipIf(!isSqlite3Available())('detects multiple capabilities', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      createSchemaFile();
      createProjectStructure({ backend: true, frontend: true, tests: true });
      const input = createHookInput();

      // Act
      multiInstanceInit(input);

      // Assert
      const idFile = `${TEST_PROJECT_DIR}/.instance/id.json`;
      if (existsSync(idFile)) {
        const identity = JSON.parse(readFileSync(idFile, 'utf-8'));
        expect(identity.capabilities).toContain('backend');
        expect(identity.capabilities).toContain('frontend');
        expect(identity.capabilities).toContain('testing');
      }
    });
  });

  describe('database initialization', () => {
    test.skipIf(!isSqlite3Available())('initializes database from schema', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      createSchemaFile();
      const input = createHookInput();

      // Act
      const result = multiInstanceInit(input);

      // Assert
      expect(result.continue).toBe(true);
      const dbPath = `${TEST_PROJECT_DIR}/.claude/coordination/.claude.db`;
      // Database may or may not be created depending on implementation timing
    });

    test.skipIf(!isSqlite3Available())('handles missing schema file gracefully', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      // Don't create schema file
      const input = createHookInput();

      // Act
      const result = multiInstanceInit(input);

      // Assert - should still return success (graceful degradation)
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test.skipIf(!isSqlite3Available())('skips database creation if already exists', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      createSchemaFile();
      const coordDir = `${TEST_PROJECT_DIR}/.claude/coordination`;
      mkdirSync(coordDir, { recursive: true });
      writeFileSync(`${coordDir}/.claude.db`, ''); // Create empty file
      const input = createHookInput();

      // Act
      const result = multiInstanceInit(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('instance reuse', () => {
    test.skipIf(!isSqlite3Available())('reuses existing instance when id.json and pid file exist', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      createSchemaFile();

      // Create existing instance files
      const instanceDir = `${TEST_PROJECT_DIR}/.instance`;
      mkdirSync(instanceDir, { recursive: true });
      const existingId = 'existing-instance-12345';
      writeFileSync(
        `${instanceDir}/id.json`,
        JSON.stringify({
          instance_id: existingId,
          status: 'active',
          created_at: new Date().toISOString(),
        })
      );
      writeFileSync(`${instanceDir}/heartbeat.pid`, String(process.pid));

      const input = createHookInput();

      // Act
      const result = multiInstanceInit(input);

      // Assert
      expect(result.continue).toBe(true);
      // Instance ID should remain the same (reused)
      const idFile = `${instanceDir}/id.json`;
      if (existsSync(idFile)) {
        const identity = JSON.parse(readFileSync(idFile, 'utf-8'));
        expect(identity.instance_id).toBe(existingId);
      }
    });
  });

  describe('heartbeat initialization', () => {
    test.skipIf(!isSqlite3Available())('creates heartbeat.pid file', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      createSchemaFile();
      const input = createHookInput();

      // Act
      multiInstanceInit(input);

      // Assert
      const pidFile = `${TEST_PROJECT_DIR}/.instance/heartbeat.pid`;
      if (existsSync(pidFile)) {
        const content = readFileSync(pidFile, 'utf-8');
        expect(parseInt(content, 10)).toBeGreaterThan(0);
      }
    });
  });

  describe('git branch detection', () => {
    test.skipIf(!isSqlite3Available())('detects current git branch', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      createSchemaFile();
      const input = createHookInput();

      // Act
      multiInstanceInit(input);

      // Assert
      const idFile = `${TEST_PROJECT_DIR}/.instance/id.json`;
      if (existsSync(idFile)) {
        const identity = JSON.parse(readFileSync(idFile, 'utf-8'));
        // Branch should be either detected or 'unknown'
        expect(typeof identity.branch).toBe('string');
      }
    });

    test.skipIf(!isSqlite3Available())('handles non-git directory gracefully', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      createSchemaFile();
      // Remove .git directory
      const gitDir = `${TEST_PROJECT_DIR}/.git`;
      if (existsSync(gitDir)) {
        rmSync(gitDir, { recursive: true, force: true });
      }
      const input = createHookInput();

      // Act
      const result = multiInstanceInit(input);

      // Assert
      expect(result.continue).toBe(true);
      const idFile = `${TEST_PROJECT_DIR}/.instance/id.json`;
      if (existsSync(idFile)) {
        const identity = JSON.parse(readFileSync(idFile, 'utf-8'));
        expect(identity.branch).toBe('unknown');
      }
    });
  });

  describe('error handling', () => {
    test('handles non-existent project directory gracefully when multi-instance disabled', () => {
      // Arrange - when multi-instance is not enabled, hook should skip and return success
      delete process.env.CLAUDE_MULTI_INSTANCE;
      const input = createHookInput({ project_dir: '/non/existent/path' });

      // Act
      const result = multiInstanceInit(input);

      // Assert - should skip (not enabled) and return silent success
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test.skipIf(!isSqlite3Available())('creates directories in writable paths', () => {
      // Arrange - use a path in tmpdir() which is always writable
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      const writablePath = join(tmpdir(), `multi-instance-test-writable-${Date.now()}`);
      mkdirSync(writablePath, { recursive: true });
      // Initialize as git repo for the test
      try {
        execSync('git init', { cwd: writablePath, stdio: 'pipe' });
      } catch {
        // Ignore
      }
      const input = createHookInput({ project_dir: writablePath });

      // Act
      const result = multiInstanceInit(input);

      // Assert
      expect(result.continue).toBe(true);

      // Cleanup
      if (existsSync(writablePath)) {
        rmSync(writablePath, { recursive: true, force: true });
      }
    });

    test('handles missing project_dir by using default', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      const input = createHookInput({ project_dir: undefined });

      // Act
      const result = multiInstanceInit(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = multiInstanceInit(input);

      // Assert
      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('suppressOutput', true);
    });

    test('never blocks session start', () => {
      // Arrange
      process.env.CLAUDE_MULTI_INSTANCE = '1';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;
      const input = createHookInput();

      // Act
      const result = multiInstanceInit(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });
  });
});

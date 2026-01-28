/**
 * HOME Environment Fallback Tests
 *
 * Tests HOME/USERPROFILE environment variable fallback behavior across
 * multiple hooks and utilities. Validates the inconsistency between:
 * - common.ts: `HOME || '/tmp'` (no USERPROFILE fallback)
 * - pattern-sync-pull/push: `HOME || USERPROFILE || '/tmp'` (with USERPROFILE)
 * - setup-maintenance: `HOME || '/tmp'` (no USERPROFILE fallback)
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';

// ---------------------------------------------------------------------------
// Mock node:fs at module level before any hook imports
// ---------------------------------------------------------------------------
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ size: 500, mtimeMs: Date.now(), isDirectory: () => false }),
  renameSync: vi.fn(),
  readSync: vi.fn().mockReturnValue(0),
  readdirSync: vi.fn().mockReturnValue([]),
  unlinkSync: vi.fn(),
  chmodSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue('main\n'),
  spawn: vi.fn().mockReturnValue({
    unref: vi.fn(),
    on: vi.fn(),
    stderr: { on: vi.fn() },
    stdout: { on: vi.fn() },
    pid: 12345,
  }),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------
import { getLogDir } from '../../lib/common.js';
import { patternSyncPull } from '../../lifecycle/pattern-sync-pull.js';
import { patternSyncPush } from '../../lifecycle/pattern-sync-push.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Save original env values */
const originalEnv: Record<string, string | undefined> = {};

function saveEnv(...keys: string[]) {
  for (const key of keys) {
    originalEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'test-session-home-env',
    tool_input: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HOME environment fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveEnv('HOME', 'USERPROFILE', 'CLAUDE_PLUGIN_ROOT', 'CLAUDE_PROJECT_DIR', 'ORCHESTKIT_SKIP_SLOW_HOOKS');
  });

  afterEach(() => {
    restoreEnv();
  });

  // -----------------------------------------------------------------------
  // getLogDir - common.ts
  // -----------------------------------------------------------------------

  describe('getLogDir - common.ts', () => {
    test('uses HOME when set and CLAUDE_PLUGIN_ROOT is set', () => {
      process.env.HOME = '/home/testuser';
      process.env.CLAUDE_PLUGIN_ROOT = '/some/plugin/root';

      const logDir = getLogDir();

      expect(logDir).toBe('/home/testuser/.claude/logs/ork');
    });

    test('falls back to /tmp when HOME is unset and CLAUDE_PLUGIN_ROOT is set', () => {
      delete process.env.HOME;
      process.env.CLAUDE_PLUGIN_ROOT = '/some/plugin/root';

      const logDir = getLogDir();

      expect(logDir).toBe('/tmp/.claude/logs/ork');
    });

    test('uses project dir path when CLAUDE_PLUGIN_ROOT is unset', () => {
      process.env.CLAUDE_PROJECT_DIR = '/my/project';
      delete process.env.CLAUDE_PLUGIN_ROOT;

      const logDir = getLogDir();

      expect(logDir).toBe('/my/project/.claude/logs');
    });

    test('falls back to current dir when both PLUGIN_ROOT and PROJECT_DIR unset', () => {
      delete process.env.CLAUDE_PLUGIN_ROOT;
      delete process.env.CLAUDE_PROJECT_DIR;

      const logDir = getLogDir();

      expect(logDir).toBe('./.claude/logs');
    });
  });

  // -----------------------------------------------------------------------
  // pattern-sync-pull - lifecycle
  // -----------------------------------------------------------------------

  describe('pattern-sync-pull', () => {
    test('uses HOME when set for global patterns path', () => {
      process.env.HOME = '/home/pulluser';
      delete process.env.USERPROFILE;
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;

      const input = makeInput({ project_dir: '/tmp/test-project' });
      const result = patternSyncPull(input);

      // Hook returns silent success (no global patterns file exists in mock)
      expect(result.continue).toBe(true);
    });

    test('falls back to USERPROFILE when HOME is unset', () => {
      delete process.env.HOME;
      process.env.USERPROFILE = 'C:\\Users\\testuser';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;

      const input = makeInput({ project_dir: '/tmp/test-project' });
      const result = patternSyncPull(input);

      // Should not throw - USERPROFILE is the fallback
      expect(result.continue).toBe(true);
    });

    test('falls back to /tmp when both HOME and USERPROFILE are unset', () => {
      delete process.env.HOME;
      delete process.env.USERPROFILE;
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;

      const input = makeInput({ project_dir: '/tmp/test-project' });
      const result = patternSyncPull(input);

      // Should not throw - /tmp is the final fallback
      expect(result.continue).toBe(true);
    });

    test('skips when ORCHESTKIT_SKIP_SLOW_HOOKS is set', () => {
      process.env.ORCHESTKIT_SKIP_SLOW_HOOKS = '1';

      const input = makeInput({ project_dir: '/tmp/test-project' });
      const result = patternSyncPull(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // pattern-sync-push - lifecycle
  // -----------------------------------------------------------------------

  describe('pattern-sync-push', () => {
    test('uses HOME when set for global patterns path', () => {
      process.env.HOME = '/home/pushuser';
      delete process.env.USERPROFILE;

      const input = makeInput({ project_dir: '/tmp/test-project' });
      const result = patternSyncPush(input);

      expect(result.continue).toBe(true);
    });

    test('falls back to /tmp when both HOME and USERPROFILE are unset', () => {
      delete process.env.HOME;
      delete process.env.USERPROFILE;

      const input = makeInput({ project_dir: '/tmp/test-project' });
      const result = patternSyncPush(input);

      expect(result.continue).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Inconsistency documentation tests
  // -----------------------------------------------------------------------

  describe('HOME fallback inconsistency', () => {
    test('common.ts getLogDir does NOT use USERPROFILE fallback', () => {
      delete process.env.HOME;
      process.env.USERPROFILE = 'C:\\Users\\testuser';
      process.env.CLAUDE_PLUGIN_ROOT = '/some/root';

      const logDir = getLogDir();

      // common.ts uses: HOME || '/tmp' — no USERPROFILE
      expect(logDir).toBe('/tmp/.claude/logs/ork');
      expect(logDir).not.toContain('Users');
    });
  });
});

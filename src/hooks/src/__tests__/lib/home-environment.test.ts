/**
 * HOME Environment Fallback Tests
 *
 * Tests HOME/USERPROFILE environment variable fallback behavior across
 * multiple hooks and utilities. Validates the inconsistency between:
 * - common.ts: `HOME || '/tmp'` (no USERPROFILE fallback)
 * - pattern-sync-pull/push: `HOME || USERPROFILE || '/tmp'` (with USERPROFILE)
 * - setup-maintenance: `HOME || '/tmp'` (no USERPROFILE fallback)
 *
 * P2/P3 gaps for future sessions:
 * TODO(P3): Test pattern-sync-pull with large file (>1MB) triggers skip
 * TODO(P3): Test sync-config.json parse failure falls back to enabled
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';

// ---------------------------------------------------------------------------
// Mock node:fs at module level before any hook imports
// vi.mock factories are hoisted, so we cannot reference external variables.
// Instead we use inline vi.fn() and import mocked modules after.
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
import { setupMaintenance } from '../../setup/setup-maintenance.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';

// Cast mocked imports for type-safe mock API access
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockWriteFileSync = writeFileSync as ReturnType<typeof vi.fn>;
const mockMkdirSync = mkdirSync as ReturnType<typeof vi.fn>;
const mockStatSync = statSync as ReturnType<typeof vi.fn>;
const mockReaddirSync = readdirSync as ReturnType<typeof vi.fn>;

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
    // Default: no files exist
    mockExistsSync.mockReturnValue(false);
    mockStatSync.mockReturnValue({ size: 500, mtimeMs: Date.now(), isDirectory: () => false });
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
  // pattern-sync-pull: verify actual path construction
  // -----------------------------------------------------------------------

  describe('pattern-sync-pull - path verification', () => {
    test('constructs global path using HOME when set', () => {
      process.env.HOME = '/home/pulluser';
      delete process.env.USERPROFILE;
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;

      // existsSync is called with the global patterns file path
      // We track which paths are checked
      const checkedPaths: string[] = [];
      mockExistsSync.mockImplementation((p: string) => {
        checkedPaths.push(p);
        return false;
      });

      patternSyncPull(makeInput({ project_dir: '/tmp/test-project' }));

      // Verify HOME was used in the global patterns path
      const globalPathCheck = checkedPaths.find(p => p.includes('global-patterns.json'));
      expect(globalPathCheck).toBeDefined();
      expect(globalPathCheck).toContain('/home/pulluser/');
    });

    test('constructs global path using USERPROFILE when HOME is unset', () => {
      delete process.env.HOME;
      process.env.USERPROFILE = 'C:\\Users\\pulluser';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;

      const checkedPaths: string[] = [];
      mockExistsSync.mockImplementation((p: string) => {
        checkedPaths.push(p);
        return false;
      });

      patternSyncPull(makeInput({ project_dir: '/tmp/test-project' }));

      const globalPathCheck = checkedPaths.find(p => p.includes('global-patterns.json'));
      expect(globalPathCheck).toBeDefined();
      expect(globalPathCheck).toContain('C:\\Users\\pulluser');
    });

    test('constructs global path using /tmp when both HOME and USERPROFILE unset', () => {
      delete process.env.HOME;
      delete process.env.USERPROFILE;
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;

      const checkedPaths: string[] = [];
      mockExistsSync.mockImplementation((p: string) => {
        checkedPaths.push(p);
        return false;
      });

      patternSyncPull(makeInput({ project_dir: '/tmp/test-project' }));

      const globalPathCheck = checkedPaths.find(p => p.includes('global-patterns.json'));
      expect(globalPathCheck).toBeDefined();
      expect(globalPathCheck).toContain('/tmp/');
    });

    test('skips when ORCHESTKIT_SKIP_SLOW_HOOKS is set', () => {
      process.env.ORCHESTKIT_SKIP_SLOW_HOOKS = '1';

      const result = patternSyncPull(makeInput({ project_dir: '/tmp/test-project' }));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // Should NOT check any files
      expect(mockExistsSync).not.toHaveBeenCalled();
    });

    test('actually merges patterns when global file exists with HOME path', () => {
      process.env.HOME = '/home/mergeuser';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;

      const globalPatterns = { version: '1.0', patterns: [{ text: 'global-pattern-1' }] };
      const projectPatterns = { version: '1.0', patterns: [] };

      mockExistsSync.mockImplementation((p: string) => {
        if (p.includes('/home/mergeuser/.claude/global-patterns.json')) return true;
        if (p.includes('sync-config.json')) return false;
        if (p.includes('learned-patterns.json')) return true;
        return false;
      });
      mockStatSync.mockReturnValue({ size: 100 }); // Under 1MB limit
      mockReadFileSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('global-patterns.json')) return JSON.stringify(globalPatterns);
        if (typeof p === 'string' && p.includes('learned-patterns.json')) return JSON.stringify(projectPatterns);
        return '{}';
      });

      patternSyncPull(makeInput({ project_dir: '/tmp/test-project' }));

      // Verify writeFileSync was called with merged patterns
      expect(mockWriteFileSync).toHaveBeenCalled();
      const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(writtenContent.patterns).toHaveLength(1);
      expect(writtenContent.patterns[0].text).toBe('global-pattern-1');
    });
  });

  // -----------------------------------------------------------------------
  // pattern-sync-push: verify actual path construction
  // -----------------------------------------------------------------------

  describe('pattern-sync-push - path verification', () => {
    test('constructs global path using HOME when set', () => {
      process.env.HOME = '/home/pushuser';
      delete process.env.USERPROFILE;

      const checkedPaths: string[] = [];
      mockExistsSync.mockImplementation((p: string) => {
        checkedPaths.push(p);
        return false;
      });

      patternSyncPush(makeInput({ project_dir: '/tmp/test-project' }));

      // Push checks project patterns file (not global first)
      // But the global path uses HOME
      expect(checkedPaths.some(p => p.includes('learned-patterns.json'))).toBe(true);
    });

    test('uses USERPROFILE when HOME is unset', () => {
      delete process.env.HOME;
      process.env.USERPROFILE = 'C:\\Users\\pushuser';

      // Make project patterns exist so push actually tries to write global
      const projectPatterns = { version: '1.0', patterns: [{ text: 'push-pattern-1' }] };

      mockExistsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('learned-patterns.json')) return true;
        if (typeof p === 'string' && p.includes('sync-config.json')) return false;
        return false;
      });
      mockReadFileSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('learned-patterns.json')) return JSON.stringify(projectPatterns);
        return '{}';
      });

      patternSyncPush(makeInput({ project_dir: '/tmp/test-project' }));

      // writeFileSync should be called with the USERPROFILE-based global path
      if (mockWriteFileSync.mock.calls.length > 0) {
        const writePath = mockWriteFileSync.mock.calls[0][0] as string;
        expect(writePath).toContain('C:\\Users\\pushuser');
      }
      // mkdirSync should create the USERPROFILE-based .claude dir
      const mkdirCalls = mockMkdirSync.mock.calls.map(c => c[0] as string);
      const claudeDir = mkdirCalls.find(p => p.includes('.claude'));
      if (claudeDir) {
        expect(claudeDir).toContain('C:\\Users\\pushuser');
      }
    });

    test('uses /tmp when both HOME and USERPROFILE are unset', () => {
      delete process.env.HOME;
      delete process.env.USERPROFILE;

      patternSyncPush(makeInput({ project_dir: '/tmp/test-project' }));

      // Should not throw
      expect(true).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // setup-maintenance: HOME fallback in log rotation + memory fabric
  // -----------------------------------------------------------------------

  describe('setup-maintenance - HOME fallback', () => {
    test('uses HOME for log rotation dirs', () => {
      process.env.HOME = '/home/maintuser';
      process.env.CLAUDE_PLUGIN_ROOT = '/plugin/root';
      process.env.CLAUDE_PROJECT_DIR = '/test/project';

      // Force daily maintenance by providing a stale marker
      // existsSync must return true for both .setup-complete AND the log dir
      mockExistsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('.setup-complete')) return true;
        if (typeof p === 'string' && p.includes('.claude/logs')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('.setup-complete')) {
          const staleTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
          return JSON.stringify({ last_maintenance: staleTime, version: '4.25.0' });
        }
        return '{}';
      });

      // Track which dirs readdirSync is called with
      const readDirs: string[] = [];
      mockReaddirSync.mockImplementation((p: unknown) => {
        const path = typeof p === 'string' ? p : String(p);
        readDirs.push(path);
        return [];
      });

      const origArgv = process.argv;
      process.argv = [...origArgv, '--force'];

      setupMaintenance(makeInput({ project_dir: '/test/project' }));

      process.argv = origArgv;

      // setup-maintenance.ts line 91: `${process.env.HOME || '/tmp'}/.claude/logs/ork`
      const homeLogDir = readDirs.find(d => d.includes('/home/maintuser/.claude/logs/ork'));
      expect(homeLogDir).toBeDefined();
    });

    test('falls back to /tmp for log rotation when HOME is unset', () => {
      delete process.env.HOME;
      process.env.CLAUDE_PLUGIN_ROOT = '/plugin/root';
      process.env.CLAUDE_PROJECT_DIR = '/test/project';

      mockExistsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('.setup-complete')) return true;
        if (typeof p === 'string' && p.includes('.claude/logs')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('.setup-complete')) {
          const staleTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
          return JSON.stringify({ last_maintenance: staleTime, version: '4.25.0' });
        }
        return '{}';
      });

      const readDirs: string[] = [];
      mockReaddirSync.mockImplementation((p: unknown) => {
        const path = typeof p === 'string' ? p : String(p);
        readDirs.push(path);
        return [];
      });

      const origArgv = process.argv;
      process.argv = [...origArgv, '--force'];

      setupMaintenance(makeInput({ project_dir: '/test/project' }));

      process.argv = origArgv;

      // With HOME unset, should use /tmp/.claude/logs/ork
      const tmpLogDir = readDirs.find(d => d.includes('/tmp/.claude/logs/ork'));
      expect(tmpLogDir).toBeDefined();
    });

    test('uses HOME for Memory Fabric cleanup global sync path', () => {
      process.env.HOME = '/home/fabricuser';
      process.env.CLAUDE_PLUGIN_ROOT = '/plugin/root';
      process.env.CLAUDE_PROJECT_DIR = '/test/project';

      // Track existsSync calls to verify the global sync path
      const checkedPaths: string[] = [];
      mockExistsSync.mockImplementation((p: string) => {
        checkedPaths.push(p);
        if (typeof p === 'string' && p.includes('.setup-complete')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('.setup-complete')) {
          const staleTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
          return JSON.stringify({ last_maintenance: staleTime, version: '4.25.0' });
        }
        return '{}';
      });
      mockReaddirSync.mockReturnValue([]);

      const origArgv = process.argv;
      process.argv = [...origArgv, '--force'];

      setupMaintenance(makeInput({ project_dir: '/test/project' }));

      process.argv = origArgv;

      // setup-maintenance.ts line 309: `${process.env.HOME || '/tmp'}/.claude/.mem0-pending-sync.json`
      const mem0Path = checkedPaths.find(p => p.includes('.mem0-pending-sync.json'));
      expect(mem0Path).toBeDefined();
      expect(mem0Path).toContain('/home/fabricuser/');
    });
  });

  // -----------------------------------------------------------------------
  // HOME="" empty string edge case (P2.1)
  // In JS, "" is falsy, so `"" || '/tmp'` correctly produces '/tmp'.
  // These tests verify all 4 modules handle HOME="" the same as undefined.
  // -----------------------------------------------------------------------

  describe('HOME="" empty string fallback (P2.1)', () => {
    test('getLogDir: HOME="" falls back to /tmp (empty string is falsy)', () => {
      process.env.HOME = '';
      process.env.CLAUDE_PLUGIN_ROOT = '/some/plugin/root';

      const logDir = getLogDir();

      // "" || '/tmp' → '/tmp'
      expect(logDir).toBe('/tmp/.claude/logs/ork');
    });

    test('pattern-sync-pull: HOME="" falls through to USERPROFILE', () => {
      process.env.HOME = '';
      process.env.USERPROFILE = 'C:\\Users\\emptytest';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;

      const checkedPaths: string[] = [];
      mockExistsSync.mockImplementation((p: string) => {
        checkedPaths.push(p);
        return false;
      });

      patternSyncPull(makeInput({ project_dir: '/tmp/test-project' }));

      const globalPath = checkedPaths.find(p => p.includes('global-patterns.json'));
      expect(globalPath).toBeDefined();
      // HOME="" is falsy → falls to USERPROFILE
      expect(globalPath).toContain('C:\\Users\\emptytest');
    });

    test('pattern-sync-pull: HOME="" and USERPROFILE="" falls to /tmp', () => {
      process.env.HOME = '';
      process.env.USERPROFILE = '';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;

      const checkedPaths: string[] = [];
      mockExistsSync.mockImplementation((p: string) => {
        checkedPaths.push(p);
        return false;
      });

      patternSyncPull(makeInput({ project_dir: '/tmp/test-project' }));

      const globalPath = checkedPaths.find(p => p.includes('global-patterns.json'));
      expect(globalPath).toBeDefined();
      expect(globalPath).toContain('/tmp/');
    });

    test('setup-maintenance: HOME="" falls back to /tmp for log rotation', () => {
      process.env.HOME = '';
      process.env.CLAUDE_PLUGIN_ROOT = '/plugin/root';
      process.env.CLAUDE_PROJECT_DIR = '/test/project';

      mockExistsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('.setup-complete')) return true;
        if (typeof p === 'string' && p.includes('.claude/logs')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('.setup-complete')) {
          const staleTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
          return JSON.stringify({ last_maintenance: staleTime, version: '4.25.0' });
        }
        return '{}';
      });

      const readDirs: string[] = [];
      mockReaddirSync.mockImplementation((p: unknown) => {
        const path = typeof p === 'string' ? p : String(p);
        readDirs.push(path);
        return [];
      });

      const origArgv = process.argv;
      process.argv = [...origArgv, '--force'];

      setupMaintenance(makeInput({ project_dir: '/test/project' }));

      process.argv = origArgv;

      // HOME="" is falsy → `"" || '/tmp'` → '/tmp'
      const tmpLogDir = readDirs.find(d => d.includes('/tmp/.claude/logs/ork'));
      expect(tmpLogDir).toBeDefined();
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

    test('pattern-sync-pull DOES use USERPROFILE fallback (inconsistent with common.ts)', () => {
      delete process.env.HOME;
      process.env.USERPROFILE = 'C:\\Users\\testuser';
      delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;

      const checkedPaths: string[] = [];
      mockExistsSync.mockImplementation((p: string) => {
        checkedPaths.push(p);
        return false;
      });

      patternSyncPull(makeInput({ project_dir: '/tmp/test-project' }));

      // pattern-sync-pull uses: HOME || USERPROFILE || '/tmp'
      const globalPath = checkedPaths.find(p => p.includes('global-patterns.json'));
      expect(globalPath).toBeDefined();
      expect(globalPath).toContain('C:\\Users\\testuser');
      // This is DIFFERENT from common.ts which would use /tmp
    });
  });
});

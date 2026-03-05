/**
 * Unit tests for config-change/settings-reload (settings drift detector)
 *
 * Issue #962: ConfigChange hook that scans config files for dangerous/risky
 * patterns and blocks or warns accordingly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockFiles: Record<string, string> = {};

const mockAppendFileSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock('node:fs', () => ({
  readFileSync: vi.fn((path: string) => {
    if (mockFiles[path] !== undefined) return mockFiles[path];
    throw new Error(`ENOENT: ${path}`);
  }),
  existsSync: vi.fn((path: string) => mockFiles[path] !== undefined),
  appendFileSync: (...args: unknown[]) => mockAppendFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

vi.mock('../../lib/common.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/common.js')>('../../lib/common.js');
  return {
    ...actual,
    logHook: vi.fn(),
    logPermissionFeedback: vi.fn(),
    outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
    outputBlock: vi.fn((reason: string) => ({
      continue: false,
      stopReason: reason,
      hookSpecificOutput: { permissionDecision: 'deny' },
    })),
    outputWarning: vi.fn((msg: string) => ({
      continue: true,
      systemMessage: `\u26a0 ${msg}`,
    })),
    outputPromptContext: vi.fn((msg: string) => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { additionalContext: msg, hookEventName: 'ConfigChange' },
    })),
  };
});

import { settingsReload } from '../../config-change/settings-reload.js';
import { logHook, logPermissionFeedback, outputBlock, outputWarning, outputPromptContext } from '../../lib/common.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    hook_event: 'ConfigChange',
    tool_name: '',
    session_id: 'test-session-456',
    tool_input: {},
    project_dir: '/test/project',
    ...overrides,
  };
}

const PROJECT_SETTINGS = '/test/project/.claude/settings.json';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const USER_SETTINGS = `${globalThis.process?.env?.HOME || '/tmp'}/.claude/settings.json`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('config-change/settings-reload (drift detector)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFiles = {};
  });

  afterEach(() => {
    mockFiles = {};
  });

  // -------------------------------------------------------------------------
  // Safe changes — advisory context
  // -------------------------------------------------------------------------

  describe('safe changes', () => {
    it('returns advisory context when no config files exist', () => {
      const result = settingsReload(createInput());

      expect(result.continue).toBe(true);
      expect(outputPromptContext).toHaveBeenCalled();
    });

    it('returns advisory context when config is clean', () => {
      mockFiles[PROJECT_SETTINGS] = JSON.stringify({
        permissions: { allow: ['Read', 'Glob'] },
        hooks: { PreToolUse: [{ hooks: [{ type: 'command' }] }] },
      });

      const result = settingsReload(createInput());

      expect(result.continue).toBe(true);
      expect(outputPromptContext).toHaveBeenCalled();
      expect(outputBlock).not.toHaveBeenCalled();
      expect(outputWarning).not.toHaveBeenCalled();
    });

    it('context message mentions [ConfigChange]', () => {
      const result = settingsReload(createInput());

      expect(result.continue).toBe(true);
      const msg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(msg).toContain('[ConfigChange]');
    });
  });

  // -------------------------------------------------------------------------
  // Dangerous patterns — BLOCK
  // -------------------------------------------------------------------------

  describe('dangerous patterns (block)', () => {
    it('blocks when --no-verify found in project settings', () => {
      mockFiles[PROJECT_SETTINGS] = '{"scripts": {"pre-commit": "git commit --no-verify"}}';

      const result = settingsReload(createInput());

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(expect.stringContaining('--no-verify'));
    });

    it('blocks when secret key found in config', () => {
      mockFiles[PROJECT_SETTINGS] = '{"env": {"API_KEY": "sk-1234"}}';

      const result = settingsReload(createInput());

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(expect.stringContaining('secret-exposure'));
    });

    it('blocks when secret found in user settings', () => {
      mockFiles[USER_SETTINGS] = '{"SECRET_KEY": "hunter2"}';

      const result = settingsReload(createInput());

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(expect.stringContaining('secret-exposure'));
    });

    it('logs permission feedback as deny on block', () => {
      mockFiles[PROJECT_SETTINGS] = '{"scripts": {"hook": "--no-verify"}}';

      settingsReload(createInput());

      expect(logPermissionFeedback).toHaveBeenCalledWith(
        'deny',
        expect.stringContaining('blocked'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Risky patterns — WARN
  // -------------------------------------------------------------------------

  describe('risky patterns (warn)', () => {
    it('warns when permissionMode is dontAsk', () => {
      mockFiles[PROJECT_SETTINGS] = '{"permissionMode": "dontAsk"}';

      const result = settingsReload(createInput());

      expect(result.continue).toBe(true);
      expect(outputWarning).toHaveBeenCalledWith(expect.stringContaining('dontAsk'));
    });

    it('warns when Bash is in allow list', () => {
      mockFiles[PROJECT_SETTINGS] = '{"permissions": {"allow": ["Read", "Bash"]}}';

      const result = settingsReload(createInput());

      expect(result.continue).toBe(true);
      expect(outputWarning).toHaveBeenCalledWith(expect.stringContaining('permission-escalation'));
    });

    it('warns when deny list is empty', () => {
      mockFiles[PROJECT_SETTINGS] = '{"permissions": {"deny": []}}';

      const result = settingsReload(createInput());

      expect(result.continue).toBe(true);
      expect(outputWarning).toHaveBeenCalledWith(expect.stringContaining('permission-gap'));
    });

    it('warns when all hooks cleared', () => {
      mockFiles[PROJECT_SETTINGS] = '{"hooks": {}}';

      const result = settingsReload(createInput());

      expect(result.continue).toBe(true);
      expect(outputWarning).toHaveBeenCalledWith(expect.stringContaining('hooks-removed'));
    });

    it('logs permission feedback as warn', () => {
      mockFiles[PROJECT_SETTINGS] = '{"permissionMode": "dontAsk"}';

      settingsReload(createInput());

      expect(logPermissionFeedback).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('warning'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Hooks integrity checks
  // -------------------------------------------------------------------------

  describe('hooks integrity', () => {
    it('warns when PreToolUse hooks array is empty', () => {
      mockFiles[PROJECT_SETTINGS] = '{"hooks": {"PreToolUse": []}}';

      const result = settingsReload(createInput());

      expect(result.continue).toBe(true);
      expect(outputWarning).toHaveBeenCalledWith(expect.stringContaining('security-hooks-cleared'));
    });

    it('warns when PermissionRequest hooks array is empty', () => {
      mockFiles[PROJECT_SETTINGS] = '{"hooks": {"PermissionRequest": []}}';

      const result = settingsReload(createInput());

      expect(result.continue).toBe(true);
      expect(outputWarning).toHaveBeenCalledWith(expect.stringContaining('permission-hooks-cleared'));
    });

    it('does not warn when hooks arrays have entries', () => {
      mockFiles[PROJECT_SETTINGS] = '{"hooks": {"PreToolUse": [{"hooks": []}], "PermissionRequest": [{"hooks": []}]}}';

      settingsReload(createInput());

      expect(outputWarning).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Block takes priority over warn
  // -------------------------------------------------------------------------

  describe('priority', () => {
    it('blocks even when warnings also present', () => {
      mockFiles[PROJECT_SETTINGS] = '{"permissionMode": "dontAsk", "scripts": "--no-verify"}';

      const result = settingsReload(createInput());

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalled();
      expect(outputWarning).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Logging
  // -------------------------------------------------------------------------

  describe('logging', () => {
    it('logs session id', () => {
      settingsReload(createInput({ session_id: 'sess-xyz' }));

      expect(logHook).toHaveBeenCalledWith(
        'config-change',
        expect.stringContaining('sess-xyz'),
      );
    });

    it('uses "unknown" when session_id is absent', () => {
      settingsReload(createInput({ session_id: undefined }));

      expect(logHook).toHaveBeenCalledWith(
        'config-change',
        expect.stringContaining('unknown'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Audit trail (#978)
  // -------------------------------------------------------------------------

  describe('audit trail (#978)', () => {
    it('writes JSONL audit entry on block', () => {
      mockFiles[PROJECT_SETTINGS] = '{"scripts": {"hook": "--no-verify"}}';

      settingsReload(createInput());

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/test/project/.claude/logs/config-changes.jsonl',
        expect.stringContaining('"action":"block"'),
      );
    });

    it('writes JSONL audit entry on warn', () => {
      mockFiles[PROJECT_SETTINGS] = '{"permissionMode": "dontAsk"}';

      settingsReload(createInput());

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/test/project/.claude/logs/config-changes.jsonl',
        expect.stringContaining('"action":"warn"'),
      );
    });

    it('writes JSONL audit entry on pass (safe change)', () => {
      settingsReload(createInput());

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/test/project/.claude/logs/config-changes.jsonl',
        expect.stringContaining('"action":"pass"'),
      );
    });

    it('audit entry includes session ID and timestamp', () => {
      settingsReload(createInput({ session_id: 'audit-sess-123' }));

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const entry = JSON.parse(written.trim());
      expect(entry.session).toBe('audit-sess-123');
      expect(entry.timestamp).toBeDefined();
    });

    it('creates logs directory before writing', () => {
      settingsReload(createInput());

      expect(mockMkdirSync).toHaveBeenCalledWith(
        '/test/project/.claude/logs',
        { recursive: true },
      );
    });

    it('does not crash when audit write fails', () => {
      mockAppendFileSync.mockImplementation(() => { throw new Error('disk full'); });

      expect(() => settingsReload(createInput())).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Error resilience
  // -------------------------------------------------------------------------

  describe('error resilience', () => {
    it('handles empty tool_input gracefully', () => {
      expect(() => settingsReload(createInput({ tool_input: {} }))).not.toThrow();
    });

    it('handles missing project_dir gracefully', () => {
      expect(() => settingsReload(createInput({ project_dir: undefined }))).not.toThrow();
    });

    it('never throws even with minimal input', () => {
      const input = {
        hook_event: 'ConfigChange',
        tool_name: '',
        tool_input: {},
      } as unknown as HookInput;
      expect(() => settingsReload(input)).not.toThrow();
    });
  });
});

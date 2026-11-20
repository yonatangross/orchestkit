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
import { outputBlock, outputWarning, outputPromptContext, outputSilentSuccess } from '../../lib/common.js';
import { createTestContext } from '../fixtures/test-context.js';

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

/** A settings file whose hook command grants the git bypass flag. */
const BYPASS_IN_HOOK_COMMAND = JSON.stringify({
  hooks: {
    PreToolUse: [
      { matcher: 'Bash', hooks: [{ type: 'command', command: 'git commit --no-verify' }] },
    ],
  },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let testCtx: ReturnType<typeof createTestContext>;
describe('config-change/settings-reload (drift detector)', () => {
  beforeEach(() => {
    testCtx = createTestContext();
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
    // #1264 Phase 3: CC strips additionalContext on ConfigChange (#1794), so the
    // safe path is SILENT — the JSONL audit row is the record, not a dropped advisory.
    it('returns silent success when no config files exist', () => {
      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(outputPromptContext).not.toHaveBeenCalled();
    });

    it('returns silent success when config is clean', () => {
      mockFiles[PROJECT_SETTINGS] = JSON.stringify({
        permissions: { allow: ['Read', 'Glob'] },
        hooks: { PreToolUse: [{ hooks: [{ type: 'command' }] }] },
      });

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(outputBlock).not.toHaveBeenCalled();
      expect(outputWarning).not.toHaveBeenCalled();
    });

    it('skips policy_settings and skills (block is moot — CC ignores it / not a settings file)', () => {
      // A would-BLOCK pattern present, but `source` short-circuits before scan.
      mockFiles[PROJECT_SETTINGS] = JSON.stringify({ permissions: { allow: ['Bash(--no-verify)'] } });

      const policy = settingsReload(createInput({ source: 'policy_settings' }), testCtx);
      expect(policy.continue).toBe(true);
      expect(outputBlock).not.toHaveBeenCalled();

      const skills = settingsReload(createInput({ source: 'skills' }), testCtx);
      expect(skills.continue).toBe(true);
      expect(outputBlock).not.toHaveBeenCalled();
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Dangerous patterns — BLOCK
  // -------------------------------------------------------------------------

  describe('dangerous patterns (block)', () => {
    it('blocks when a hook command in project settings grants the bypass flag', () => {
      mockFiles[PROJECT_SETTINGS] = BYPASS_IN_HOOK_COMMAND;

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(expect.stringContaining('--no-verify'));
    });

    it('blocks when secret key found in config', () => {
      mockFiles[PROJECT_SETTINGS] = '{"env": {"API_KEY": "sk-1234"}}';

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(expect.stringContaining('secret-exposure'));
    });

    it('blocks when secret found in user settings', () => {
      mockFiles[USER_SETTINGS] = '{"SECRET_KEY": "hunter2"}';

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(expect.stringContaining('secret-exposure'));
    });

    it('logs permission feedback as deny on block', () => {
      mockFiles[PROJECT_SETTINGS] = BYPASS_IN_HOOK_COMMAND;

      settingsReload(createInput(), testCtx);

      expect(testCtx.logPermission).toHaveBeenCalledWith(
        'deny',
        expect.stringContaining('blocked'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Where the bypass flag counts (SC47 F3)
  // -------------------------------------------------------------------------

  describe('bypass flag is matched only where settings grant it (SC47 F3)', () => {
    it('does NOT block when a deny rule forbids the bypass flag', () => {
      mockFiles[PROJECT_SETTINGS] = JSON.stringify({
        permissions: {
          allow: ['Read'],
          deny: ['Bash(git commit --no-verify:*)', 'Bash(git push --no-verify:*)'],
        },
      });

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(outputBlock).not.toHaveBeenCalled();
    });

    it('does NOT block when an ask rule names the bypass flag', () => {
      mockFiles[PROJECT_SETTINGS] = JSON.stringify({
        permissions: { ask: ['Bash(git commit --no-verify:*)'] },
      });

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(outputBlock).not.toHaveBeenCalled();
    });

    it('blocks when an allow rule grants the bypass flag', () => {
      mockFiles[PROJECT_SETTINGS] = JSON.stringify({
        permissions: { allow: ['Bash(git commit --no-verify:*)'] },
      });

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(expect.stringContaining('hook-bypass'));
    });

    it('blocks when a hook command runs the bypass flag', () => {
      mockFiles[PROJECT_SETTINGS] = BYPASS_IN_HOOK_COMMAND;

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(expect.stringContaining('hook-bypass'));
    });

    it('blocks when an env value carries the bypass flag', () => {
      mockFiles[PROJECT_SETTINGS] = JSON.stringify({
        env: { GIT_COMMIT_ARGS: '--no-verify' },
      });

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(expect.stringContaining('hook-bypass'));
    });

    it('does NOT block on the flag in an unrelated key', () => {
      mockFiles[PROJECT_SETTINGS] = JSON.stringify({
        notes: 'never run git commit --no-verify in this repo',
      });

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(outputBlock).not.toHaveBeenCalled();
    });

    it('blocks when malformed JSON contains the bypass flag (#4368 follow-up)', () => {
      // Trailing comma / unclosed brace: JSON.parse fails; must not treat as clean.
      mockFiles[PROJECT_SETTINGS] =
        '{"permissions":{"allow":["Bash(git commit --no-verify:*)"]},}';

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(expect.stringContaining('hook-bypass'));
    });
  });

  // -------------------------------------------------------------------------
  // Payload fields: `source` (documented) and `file_path` (SC47 F3)
  // -------------------------------------------------------------------------

  describe('ConfigChange payload fields (SC47 F3)', () => {
    // CC documents the layer as `source`:
    // https://docs.claude.com/en/docs/claude-code/hooks#configchange-input
    it.each(['source', 'config_source'])('honours the skip layers under %s', (field) => {
      mockFiles[PROJECT_SETTINGS] = JSON.stringify({
        permissions: { allow: ['Bash(git commit --no-verify:*)'] },
      });

      for (const layer of ['policy_settings', 'skills']) {
        vi.clearAllMocks();
        const result = settingsReload(createInput({ [field]: layer }), testCtx);

        expect(result.continue).toBe(true);
        expect(outputBlock).not.toHaveBeenCalled();
        expect(outputSilentSuccess).toHaveBeenCalled();
      }
    });

    it('scans only the file named by file_path', () => {
      mockFiles[USER_SETTINGS] = JSON.stringify({
        permissions: { allow: ['Bash(git commit --no-verify:*)'] },
      });
      mockFiles[PROJECT_SETTINGS] = JSON.stringify({ permissions: { allow: ['Read'] } });

      const result = settingsReload(
        createInput({ file_path: PROJECT_SETTINGS, source: 'project_settings' }),
        testCtx,
      );

      expect(result.continue).toBe(true);
      expect(outputBlock).not.toHaveBeenCalled();
    });

    it('still blocks when file_path names the offending file', () => {
      mockFiles[USER_SETTINGS] = JSON.stringify({
        permissions: { allow: ['Bash(git commit --no-verify:*)'] },
      });

      const result = settingsReload(
        createInput({ file_path: USER_SETTINGS, source: 'user_settings' }),
        testCtx,
      );

      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(expect.stringContaining('hook-bypass'));
    });
  });

  // -------------------------------------------------------------------------
  // Risky patterns — WARN
  // -------------------------------------------------------------------------

  describe('risky patterns (warn)', () => {
    it('warns when permissionMode is dontAsk', () => {
      mockFiles[PROJECT_SETTINGS] = '{"permissionMode": "dontAsk"}';

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(outputWarning).toHaveBeenCalledWith(expect.stringContaining('dontAsk'));
    });

    it('warns when Bash is in allow list', () => {
      mockFiles[PROJECT_SETTINGS] = '{"permissions": {"allow": ["Read", "Bash"]}}';

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(outputWarning).toHaveBeenCalledWith(expect.stringContaining('permission-escalation'));
    });

    it('warns when deny list is empty', () => {
      mockFiles[PROJECT_SETTINGS] = '{"permissions": {"deny": []}}';

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(outputWarning).toHaveBeenCalledWith(expect.stringContaining('permission-gap'));
    });

    it('warns when all hooks cleared', () => {
      mockFiles[PROJECT_SETTINGS] = '{"hooks": {}}';

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(outputWarning).toHaveBeenCalledWith(expect.stringContaining('hooks-removed'));
    });

    it('logs permission feedback as warn', () => {
      mockFiles[PROJECT_SETTINGS] = '{"permissionMode": "dontAsk"}';

      settingsReload(createInput(), testCtx);

      expect(testCtx.logPermission).toHaveBeenCalledWith(
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

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(outputWarning).toHaveBeenCalledWith(expect.stringContaining('security-hooks-cleared'));
    });

    it('warns when PermissionRequest hooks array is empty', () => {
      mockFiles[PROJECT_SETTINGS] = '{"hooks": {"PermissionRequest": []}}';

      const result = settingsReload(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(outputWarning).toHaveBeenCalledWith(expect.stringContaining('permission-hooks-cleared'));
    });

    it('does not warn when hooks arrays have entries', () => {
      mockFiles[PROJECT_SETTINGS] = '{"hooks": {"PreToolUse": [{"hooks": []}], "PermissionRequest": [{"hooks": []}]}}';

      settingsReload(createInput(), testCtx);

      expect(outputWarning).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Block takes priority over warn
  // -------------------------------------------------------------------------

  describe('priority', () => {
    it('blocks even when warnings also present', () => {
      mockFiles[PROJECT_SETTINGS] = JSON.stringify({
        permissionMode: 'dontAsk',
        permissions: { allow: ['Bash(git commit --no-verify:*)'] },
      });

      const result = settingsReload(createInput(), testCtx);

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
      settingsReload(createInput({ session_id: 'sess-xyz' }), testCtx);

      expect(testCtx.log).toHaveBeenCalledWith(
        'config-change',
        expect.stringContaining('sess-xyz'),
      );
    });

    it('uses "unknown" when session_id is absent', () => {
      settingsReload(createInput({ session_id: undefined }), testCtx);

      expect(testCtx.log).toHaveBeenCalledWith(
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
      mockFiles[PROJECT_SETTINGS] = BYPASS_IN_HOOK_COMMAND;

      settingsReload(createInput(), testCtx);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/test/project/.claude/logs/config-changes.jsonl',
        expect.stringContaining('"action":"block"'),
      );
    });

    it('writes JSONL audit entry on warn', () => {
      mockFiles[PROJECT_SETTINGS] = '{"permissionMode": "dontAsk"}';

      settingsReload(createInput(), testCtx);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/test/project/.claude/logs/config-changes.jsonl',
        expect.stringContaining('"action":"warn"'),
      );
    });

    it('writes JSONL audit entry on pass (safe change)', () => {
      settingsReload(createInput(), testCtx);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/test/project/.claude/logs/config-changes.jsonl',
        expect.stringContaining('"action":"pass"'),
      );
    });

    it('audit entry includes session ID and timestamp', () => {
      settingsReload(createInput({ session_id: 'audit-sess-123' }), testCtx);

      // Find the JSONL audit call (not env file writes like "export ORK_DEBUG=...")
      const auditCall = mockAppendFileSync.mock.calls.find(
        (call: unknown[]) => String(call[0]).includes('config-changes.jsonl'),
      );
      expect(auditCall).toBeDefined();
      const entry = JSON.parse((auditCall![1] as string).trim());
      expect(entry.session).toBe('audit-sess-123');
      expect(entry.timestamp).toBeDefined();
    });

    it('creates logs directory before writing', () => {
      settingsReload(createInput(), testCtx);

      expect(mockMkdirSync).toHaveBeenCalledWith(
        '/test/project/.claude/logs',
        { recursive: true },
      );
    });

    it('does not crash when audit write fails', () => {
      mockAppendFileSync.mockImplementation(() => { throw new Error('disk full'); });

      expect(() => settingsReload(createInput(), testCtx)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Error resilience
  // -------------------------------------------------------------------------

  describe('error resilience', () => {
    it('handles empty tool_input gracefully', () => {
      expect(() => settingsReload(createInput({ tool_input: {} }), testCtx)).not.toThrow();
    });

    it('handles missing project_dir gracefully', () => {
      expect(() => settingsReload(createInput({ project_dir: undefined }), testCtx)).not.toThrow();
    });

    it('never throws even with minimal input', () => {
      const input = {
        hook_event: 'ConfigChange',
        tool_name: '',
        tool_input: {},
      } as unknown as HookInput;
      expect(() => settingsReload(input, testCtx)).not.toThrow();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockAppendFileSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockStatSync = vi.fn();
const mockRenameSync = vi.fn();

vi.mock('../../lib/analytics-buffer.js', () => ({
  bufferWrite: vi.fn((filePath: string, content: string) => {
    mockAppendFileSync(filePath, content);
  }),
  flush: vi.fn(),
  pendingCount: vi.fn(() => 0),
  _resetForTesting: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  appendFileSync: (...args: unknown[]) => mockAppendFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
  renameSync: (...args: unknown[]) => mockRenameSync(...args),
}));

vi.mock('node:crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'mock-hash-abc123'),
  })),
}));

vi.mock('node:os', () => ({
  tmpdir: vi.fn(() => '/tmp'),
  homedir: vi.fn(() => '/home/test'),
  default: { tmpdir: () => '/tmp', homedir: () => '/home/test' },
}));

vi.mock('node:path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:path')>();
  return { ...actual, default: actual, dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')) };
});

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
  getPluginRoot: vi.fn(() => '/test/plugin'),
  getSessionId: vi.fn(() => 'test-session-id'),
  getField: vi.fn((input: Record<string, unknown>, path: string) => {
    const parts = path.split('.');
    let val: unknown = input;
    for (const p of parts) {
      if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
      else return undefined;
    }
    return val;
  }),
}));

import { unifiedErrorHandler } from '../../posttool/unified-error-handler.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'npm test' },
    ...overrides,
  };
}

describe('unifiedErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockStatSync.mockReturnValue({ size: 100 });
  });

  it('returns silent success when no error detected', () => {
    const result = unifiedErrorHandler(makeInput({ exit_code: 0 }));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('detects error from non-zero exit code', () => {
    unifiedErrorHandler(makeInput({ exit_code: 1 }));
    expect(mockAppendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('errors.jsonl'),
      expect.stringContaining('exit_code'),
    );
  });

  it('detects error from tool_error field', () => {
    unifiedErrorHandler(makeInput({ tool_error: 'ENOENT: no such file' }));
    expect(mockAppendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('errors.jsonl'),
      expect.stringContaining('tool_error'),
    );
  });

  it('skips trivial bash commands like echo and ls', () => {
    const result = unifiedErrorHandler(makeInput({
      tool_name: 'Bash',
      tool_input: { command: 'echo hello' },
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(mockAppendFileSync).not.toHaveBeenCalled();
  });

  it('suggests solutions when error matches a known pattern', () => {
    mockExistsSync.mockReturnValue(true);
    // Mock solutions file
    mockReadFileSync.mockImplementation((path: string) => {
      if (typeof path === 'string' && path.includes('error_solutions.json')) {
        return JSON.stringify({
          patterns: [{
            id: 'enoent',
            regex: 'enoent|no such file',
            solution: { brief: 'File not found', steps: ['Check the file path'] },
            skills: ['debugging'],
          }],
        });
      }
      if (typeof path === 'string' && path.includes('dedup')) {
        return JSON.stringify({ suggestions: {}, prompt_count: 0 });
      }
      return '{}';
    });

    const result = unifiedErrorHandler(makeInput({
      tool_error: 'ENOENT: no such file or directory',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('File not found');
  });

  it('detects error patterns in tool output text', () => {
    unifiedErrorHandler(makeInput({
      tool_output: 'Error: Module not found\nFATAL: compilation failed',
      exit_code: 0, // exit code is fine but output has errors
    }));
    expect(mockAppendFileSync).toHaveBeenCalled();
  });
});

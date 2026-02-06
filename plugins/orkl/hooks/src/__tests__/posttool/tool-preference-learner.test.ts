import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...parts: string[]) => parts.join('/')),
  dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
}));

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getField: vi.fn((input: Record<string, unknown>, path: string) => {
    const parts = path.split('.');
    let val: unknown = input;
    for (const p of parts) {
      if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
      else return undefined;
    }
    return val;
  }),
  getProjectDir: vi.fn(() => '/test/project'),
}));

import { toolPreferenceLearner } from '../../posttool/tool-preference-learner.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Grep',
    session_id: 'test-session',
    tool_input: { pattern: 'TODO' },
    ...overrides,
  };
}

describe('toolPreferenceLearner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it('returns silent success for empty tool name', () => {
    const result = toolPreferenceLearner(makeInput({ tool_name: '' }));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('tracks Grep as content_search category', () => {
    toolPreferenceLearner(makeInput({ tool_name: 'Grep' }));
    expect(mockWriteFileSync).toHaveBeenCalled();
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.usage.content_search.Grep).toBe(1);
  });

  it('identifies Bash git as git_operations category', () => {
    toolPreferenceLearner(makeInput({
      tool_name: 'Bash',
      tool_input: { command: 'git status' },
    }));
    expect(mockWriteFileSync).toHaveBeenCalled();
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.usage.git_operations['Bash:git']).toBe(1);
  });

  it('skips tools that only map to "other" category', () => {
    // A tool not in the TOOL_CATEGORIES map maps to 'other' which is filtered out
    toolPreferenceLearner(makeInput({
      tool_name: 'Bash',
      tool_input: { command: 'echo hello' },
    }));
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('increments existing usage data from stored preferences', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      usage: {
        content_search: { Grep: 5 },
        file_search: {},
        code_reading: {},
        code_writing: {},
        testing: {},
        building: {},
        git_operations: {},
        agent_spawn: {},
        other: {},
      },
      preferences: {
        content_search: null,
        file_search: null,
        code_reading: null,
        code_writing: null,
        testing: null,
        building: null,
        git_operations: null,
        agent_spawn: null,
        other: null,
      },
      updated_at: new Date().toISOString(),
    }));
    toolPreferenceLearner(makeInput({ tool_name: 'Grep' }));
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.usage.content_search.Grep).toBe(6);
  });

  it('identifies Bash pytest as testing category', () => {
    toolPreferenceLearner(makeInput({
      tool_name: 'Bash',
      tool_input: { command: 'pytest tests/ -v' },
    }));
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.usage.testing['Bash:pytest']).toBe(1);
  });
});

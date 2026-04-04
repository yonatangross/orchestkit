import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

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

vi.mock('../../lib/common.js', () => mockCommonBasic());

import { toolPreferenceLearner, flushPendingPreferences } from '../../posttool/tool-preference-learner.js';
import type { HookInput } from '../../types.js';
import { createTestContext } from '../fixtures/test-context.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Grep',
    session_id: 'test-session',
    tool_input: { pattern: 'TODO' },
    ...overrides,
  };
}

let testCtx: ReturnType<typeof createTestContext>;
describe('toolPreferenceLearner', () => {
  beforeEach(() => {
    testCtx = createTestContext();
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
    flushPendingPreferences(); // Force flush in-memory accumulator (#917)
    expect(mockWriteFileSync).toHaveBeenCalled();
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.usage.content_search.Grep).toBe(1);
  });

  it('identifies Bash git as git_operations category', () => {
    toolPreferenceLearner(makeInput({
      tool_name: 'Bash',
      tool_input: { command: 'git status' },
    }));
    flushPendingPreferences(); // Force flush in-memory accumulator (#917)
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
    flushPendingPreferences(); // Force flush in-memory accumulator (#917)
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.usage.content_search.Grep).toBe(6);
  });

  it('identifies Bash pytest as testing category', () => {
    toolPreferenceLearner(makeInput({
      tool_name: 'Bash',
      tool_input: { command: 'pytest tests/ -v' },
    }));
    flushPendingPreferences(); // Force flush in-memory accumulator (#917)
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.usage.testing['Bash:pytest']).toBe(1);
  });
});

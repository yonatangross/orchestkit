import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockAppendFileSync = vi.fn();
const mockMkdirSync = vi.fn();

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
  appendFileSync: (...args: unknown[]) => mockAppendFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

vi.mock('node:path', () => ({
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
  getSessionId: vi.fn(() => 'test-session-id'),
  lineContainsAllCI: (content: string, ...terms: string[]) =>
    content.split('\n').some(line => {
      const lower = line.toLowerCase();
      return terms.every(t => lower.includes(t.toLowerCase()));
    }),
}));

import { skillEditTracker } from '../../posttool/skill-edit-tracker.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session',
    tool_input: { file_path: '/test/project/src/app.py', content: 'import logging\nlogger.info("hello")' },
    ...overrides,
  };
}

describe('skillEditTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CLAUDE_HOOK_DEBUG;
    // Default: session state with recent skill
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      recentSkills: [
        { skillId: 'error-handling', timestamp: Math.floor(Date.now() / 1000) },
      ],
    }));
  });

  it('returns silent success for non-Write/Edit tools', () => {
    const result = skillEditTracker(makeInput({ tool_name: 'Read' }));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(mockAppendFileSync).not.toHaveBeenCalled();
  });

  it('returns silent success when no file path provided', () => {
    const result = skillEditTracker(makeInput({
      tool_input: { content: 'some code' },
    }));
    expect(result.continue).toBe(true);
    expect(mockAppendFileSync).not.toHaveBeenCalled();
  });

  it('returns silent success when no recent skill usage', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ recentSkills: [] }));
    const result = skillEditTracker(makeInput());
    expect(result.continue).toBe(true);
    expect(mockAppendFileSync).not.toHaveBeenCalled();
  });

  it('detects logging patterns in written content', () => {
    skillEditTracker(makeInput({
      tool_input: { file_path: '/test/project/src/app.py', content: 'import logging\nlogger.info("test")' },
    }));
    expect(mockAppendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('edit-patterns.jsonl'),
      expect.stringContaining('add_logging'),
    );
  });

  it('detects error handling patterns in Edit diff', () => {
    skillEditTracker(makeInput({
      tool_name: 'Edit',
      tool_input: {
        file_path: '/test/project/src/app.ts',
        old_string: 'doSomething()',
        new_string: 'try { doSomething() } catch (error) { handleError(error) }',
      },
    }));
    expect(mockAppendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('edit-patterns.jsonl'),
      expect.stringContaining('add_error_handling'),
    );
  });

  it('skips old skill usage beyond 5 minute window', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({
      recentSkills: [
        { skillId: 'old-skill', timestamp: Math.floor(Date.now() / 1000) - 600 },
      ],
    }));
    const result = skillEditTracker(makeInput());
    expect(result.continue).toBe(true);
    expect(mockAppendFileSync).not.toHaveBeenCalled();
  });
});

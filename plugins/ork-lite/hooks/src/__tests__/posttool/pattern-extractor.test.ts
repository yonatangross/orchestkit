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
  basename: vi.fn((p: string) => p.split('/').pop() || ''),
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
  getProjectDir: vi.fn(() => '/home/user/myproject'),
}));

import { patternExtractor } from '../../posttool/bash/pattern-extractor.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'git commit -m "feat: add JWT authentication"' },
    exit_code: 0,
    ...overrides,
  };
}

describe('patternExtractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: queue file exists with empty patterns array
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ patterns: [] }));
  });

  it('returns silent success for non-Bash tools', () => {
    const result = patternExtractor(makeInput({ tool_name: 'Write' }));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('returns silent success when command is empty', () => {
    const result = patternExtractor(makeInput({ tool_input: { command: '' } }));
    expect(result.continue).toBe(true);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('extracts pattern from git commit with tech detection', () => {
    patternExtractor(makeInput());
    expect(mockWriteFileSync).toHaveBeenCalled();
    // Get the last write call (the one with the actual pattern)
    const lastCall = mockWriteFileSync.mock.calls[mockWriteFileSync.mock.calls.length - 1];
    expect(lastCall[0]).toContain('patterns-queue.json');
    const written = JSON.parse(lastCall[1] as string);
    const commitPattern = written.patterns.find((p: { source: string }) => p.source === 'commit');
    expect(commitPattern).toBeDefined();
    expect(commitPattern.text).toContain('JWT');
  });

  it('extracts test result patterns from pytest commands', () => {
    patternExtractor(makeInput({
      tool_input: { command: 'pytest tests/ -v' },
      exit_code: 0,
    }));
    const lastCall = mockWriteFileSync.mock.calls[mockWriteFileSync.mock.calls.length - 1];
    const written = JSON.parse(lastCall[1] as string);
    const testPattern = written.patterns.find((p: { source: string }) => p.source === 'test-run');
    expect(testPattern).toBeDefined();
    expect(testPattern.category).toBe('testing');
    expect(testPattern.outcome).toBe('success');
  });

  it('extracts build result patterns from npm run build', () => {
    patternExtractor(makeInput({
      tool_input: { command: 'npm run build' },
      exit_code: 1,
    }));
    const lastCall = mockWriteFileSync.mock.calls[mockWriteFileSync.mock.calls.length - 1];
    const written = JSON.parse(lastCall[1] as string);
    const buildPattern = written.patterns.find((p: { source: string }) => p.source === 'build');
    expect(buildPattern).toBeDefined();
    expect(buildPattern.outcome).toBe('failed');
  });

  it('extracts PR merge patterns', () => {
    patternExtractor(makeInput({
      tool_input: { command: 'gh pr merge 42' },
      exit_code: 0,
    }));
    const lastCall = mockWriteFileSync.mock.calls[mockWriteFileSync.mock.calls.length - 1];
    const written = JSON.parse(lastCall[1] as string);
    const prPattern = written.patterns.find((p: { source: string }) => p.source === 'pr-merge');
    expect(prPattern).toBeDefined();
    expect(prPattern.text).toContain('PR #42');
  });

  it('skips PR merge when exit code is non-zero', () => {
    patternExtractor(makeInput({
      tool_input: { command: 'gh pr merge 42' },
      exit_code: 1,
    }));
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });
});

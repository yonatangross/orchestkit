import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

// Mock dependencies to prevent file I/O side effects (failure tracking, debug flag)
vi.mock('../../lib/common.js', () => mockCommonBasic());

vi.mock('../../lib/atomic-write.js', () => ({
  atomicWriteSync: vi.fn(),
}));

vi.mock('../../lib/paths.js', () => ({
  getLogDir: vi.fn(() => '/tmp/test-logs'),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
}));

import { failureHandler } from '../../posttool/failure-handler.js';
import type { HookInput } from '../../types.js';
import { createTestContext } from '../fixtures/test-context.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'npm test' },
    ...overrides,
  };
}

let testCtx: ReturnType<typeof createTestContext>;
describe('failureHandler', () => {
  beforeEach(() => {
    testCtx = createTestContext({ logDir: '/tmp/test-logs' });
    vi.clearAllMocks();
  });

  it('returns silent success when no error', () => {
    const result = failureHandler(makeInput({ exit_code: 0 }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('suggests fix for file not found errors', () => {
    const result = failureHandler(makeInput({
      tool_error: 'ENOENT: no such file or directory',
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('File not found');
  });

  it('suggests fix for permission denied errors', () => {
    const result = failureHandler(makeInput({
      tool_error: 'EACCES: permission denied',
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Permission denied');
  });

  it('suggests fix for timeout errors', () => {
    const result = failureHandler(makeInput({
      tool_error: 'Command timed out after 120000ms',
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('timed out');
  });

  it('returns silent success for unknown error patterns', () => {
    const result = failureHandler(makeInput({
      tool_error: 'some unknown error xyz',
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('handles multiple matching patterns', () => {
    const result = failureHandler(makeInput({
      tool_error: 'ENOENT: no such file or directory, syntax error in config',
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    const ctx = result.hookSpecificOutput?.additionalContext || '';
    expect(ctx).toContain('File not found');
    expect(ctx).toContain('Syntax error');
  });
});

describe('failureHandler — additional error patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('suggests fix for network errors (ECONNREFUSED)', () => {
    const result = failureHandler(makeInput({
      tool_error: 'ECONNREFUSED: connection refused to localhost:5432',
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Network error');
  });

  it('suggests fix for network errors (ETIMEDOUT)', () => {
    const result = failureHandler(makeInput({
      tool_error: 'ETIMEDOUT: request timed out',
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Network error');
  });

  it('suggests fix for command not found', () => {
    const result = failureHandler(makeInput({
      tool_error: 'npx: command not found',
      exit_code: 127,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Command not found');
  });

  it('suggests fix for out of memory errors (ENOMEM)', () => {
    const result = failureHandler(makeInput({
      tool_error: 'ENOMEM: not enough memory',
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Out of memory');
  });

  it('suggests fix for out of memory errors (heap)', () => {
    const result = failureHandler(makeInput({
      tool_error: 'JavaScript heap out of memory',
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Out of memory');
  });

  it('suggests fix for merge conflicts', () => {
    const result = failureHandler(makeInput({
      tool_error: 'CONFLICT (content): Merge conflict in src/index.ts',
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Merge conflict');
  });

  it('suggests fix for resource lock errors', () => {
    const result = failureHandler(makeInput({
      tool_error: 'ELOCK: file is locked by another process',
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Resource is locked');
  });

  it('suggests fix for type errors', () => {
    const result = failureHandler(makeInput({
      tool_error: 'TypeError: Cannot read properties of undefined',
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Type error');
  });

  it('includes tool name in context header', () => {
    const result = failureHandler(makeInput({
      tool_name: 'Write',
      tool_error: 'ENOENT: no such file or directory',
      exit_code: 1,
    }), testCtx);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Write');
  });

  it('handles empty tool_error with non-zero exit code', () => {
    const result = failureHandler(makeInput({
      tool_error: '',
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});

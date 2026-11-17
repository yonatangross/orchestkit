import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

// Mock dependencies to prevent file I/O side effects (failure tracking, debug flag)
vi.mock('../../lib/common.js', () => mockCommonBasic());

vi.mock('../../lib/atomic-write.js', () => ({
  atomicWriteSync: vi.fn(),
}));

vi.mock('../../lib/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/paths.js')>();
  return {
    ...actual,
  getLogDir: vi.fn(() => '/tmp/test-logs'),
  };
});

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('node:path', () => {
  const named = { join: vi.fn((...args: string[]) => args.join('/')), basename: vi.fn((p: string) => p.split('/').pop() || ''), dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')), resolve: vi.fn((...a: string[]) => a.join('/')), sep: '/' };
  return { ...named, default: named };
});

import { failureHandler } from '../../posttool/failure-handler.js';
import { atomicWriteSync } from '../../lib/atomic-write.js';
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

/** RFC 9457 payload shaped to satisfy extractStructuredError()'s four required fields. */
const STRUCTURED_ERROR = JSON.stringify({
  type: 'https://orchestkit.dev/errors/rate-limit',
  status: 429,
  title: 'Upstream rate limit exceeded',
  retryable: true,
  retry_after: 30,
  error_category: 'rate_limit',
  what_you_should_do: 'Back off and retry the request.',
});

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

  it('returns silent success for unknown error patterns', () => {
    const result = failureHandler(makeInput({
      error: 'some unknown error xyz',
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('handles empty error with non-zero exit code', () => {
    const result = failureHandler(makeInput({
      error: '',
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('keeps the structured RFC 9457 path: title, retry guidance and tool name are injected', () => {
    const result = failureHandler(makeInput({ tool_name: 'Write', error: STRUCTURED_ERROR, exit_code: 1 }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.hookEventName).toBe('PostToolUseFailure');
    const ctx = result.hookSpecificOutput?.additionalContext ?? '';
    expect(ctx).toContain('Structured error from Write (rate_limit)');
    expect(ctx).toContain('Upstream rate limit exceeded');
    expect(ctx).toContain('Back off and retry the request.');
    expect(ctx).toContain('Retryable: wait 30s before retrying');
  });
});

/**
 * the generic tips table is cut. BEFORE this change each error text below
 * produced an injected `[OrchestKit] Tool failure analysis for <tool>:` block
 * with the tip shown here; AFTER, none of them injects anything. The "before"
 * strings are the verbatim tips the table used to inject.
 */
describe('failureHandler: generic tips table is cut', () => {
  beforeEach(() => {
    testCtx = createTestContext({ logDir: '/tmp/test-logs' });
    vi.clearAllMocks();
  });

  const BEFORE: Array<{ error: string; tip: string }> = [
    { error: 'ENOENT: no such file or directory', tip: 'File not found. Check the path exists. Use Glob to search for the correct filename.' },
    { error: 'EACCES: permission denied', tip: 'Permission denied. The file may be read-only or owned by another user.' },
    { error: 'ECONNREFUSED: connection refused to localhost:5432', tip: 'Network error. Check if the service is running and accessible.' },
    { error: 'ETIMEDOUT: request timed out', tip: 'Network error. Check if the service is running and accessible.' },
    { error: 'SyntaxError: Unexpected token', tip: 'Syntax error in the code. Review the file for missing brackets, quotes, or semicolons.' },
    { error: 'npx: command not found', tip: 'Command not found. Check if the tool is installed and in PATH.' },
    { error: 'Command timed out after 120000ms', tip: 'Command timed out. Consider increasing the timeout or breaking the command into smaller steps.' },
    { error: 'JavaScript heap out of memory', tip: 'Out of memory. Try processing smaller chunks or increasing available memory.' },
    { error: 'CONFLICT (content): Merge conflict in src/index.ts', tip: 'Merge conflict detected. Resolve conflicts manually before continuing.' },
    { error: 'ELOCK: file is locked by another process', tip: 'Resource is locked. Wait for the lock to be released or check for stale locks.' },
    { error: 'TypeError: Cannot read properties of undefined', tip: 'Type error. Check for null/undefined values and ensure correct types are passed.' },
  ];

  it.each(BEFORE)('injects nothing for "$error" (before: "$tip")', ({ error, tip }) => {
    const result = failureHandler(makeInput({ error, exit_code: 1 }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(tip);
    expect(JSON.stringify(result)).not.toContain('Tool failure analysis');
  });

  it('REGRESSION: an error that merely contains the word "blocked" no longer gets the "Resource is locked" tip', () => {
    // Real shape from a 2026-11-17 session: a CLI refused to type into a terminal
    // that had an open question. The unanchored /lock/ matched "blocked" and
    // injected "Resource is locked. Wait for the lock to be released or check for
    // stale locks." into the model's context, which was wrong and sent it to look
    // for locks.
    const error = '{"error":{"hint":"typing would answer its dialog","kind":"blocked","message":"the terminal is blocked (question)"}}';
    // Positive control: the removed pattern really did match this text.
    expect(/lock|locked|ELOCK/i.test(error)).toBe(true);
    const result = failureHandler(makeInput({ error, exit_code: 9 }), testCtx);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('still counts every failure, structured or not (the count feeds the debug auto-enable)', () => {
    vi.mocked(atomicWriteSync).mockClear();
    failureHandler(makeInput({ error: 'some unknown error xyz', exit_code: 1 }), testCtx);
    failureHandler(makeInput({ error: STRUCTURED_ERROR, exit_code: 1 }), testCtx);
    const writes = vi.mocked(atomicWriteSync).mock.calls.filter(([p]) => String(p).endsWith('failure-count.json'));
    expect(writes).toHaveLength(2);
    expect(String(writes[0][1])).toContain('"count":1');
  });

  it('does not count when there is no error text', () => {
    vi.mocked(atomicWriteSync).mockClear();
    failureHandler(makeInput({ exit_code: 0 }), testCtx);
    expect(vi.mocked(atomicWriteSync)).not.toHaveBeenCalled();
  });

  it('a structured error whose text also matches an old pattern gets only the structured block', () => {
    const error = JSON.stringify({
      type: 'https://orchestkit.dev/errors/lock',
      status: 423,
      title: 'Resource locked by another writer',
      retryable: true,
      retry_after: 5,
      error_category: 'conflict',
      what_you_should_do: 'Wait for the writer to finish.',
    });
    const ctx = failureHandler(makeInput({ error, exit_code: 1 }), testCtx).hookSpecificOutput?.additionalContext ?? '';
    expect(ctx).toContain('Structured error from Bash (conflict)');
    expect(ctx).not.toContain('Tool failure analysis');
    expect(ctx).not.toContain('Wait for the lock to be released');
  });
});

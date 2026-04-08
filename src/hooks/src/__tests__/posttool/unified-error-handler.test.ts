import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

vi.mock('../../lib/common.js', () => mockCommonBasic());

import { unifiedErrorHandler } from '../../posttool/unified-error-handler.js';

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
describe('unifiedErrorHandler', () => {
  beforeEach(() => {
    testCtx = createTestContext();
    vi.clearAllMocks();
  });

  it('returns silent success when no error detected', () => {
    const result = unifiedErrorHandler(makeInput({ exit_code: 0 }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('detects error from non-zero exit code', () => {
    unifiedErrorHandler(makeInput({ exit_code: 1 }), testCtx);
    expect(testCtx.log).toHaveBeenCalledWith('error-logger', expect.stringContaining('exit_code'));
  });

  it('detects error from tool_error field', () => {
    unifiedErrorHandler(makeInput({ tool_error: 'ENOENT: no such file' }), testCtx);
    expect(testCtx.log).toHaveBeenCalledWith('error-logger', expect.stringContaining('tool_error'));
  });

  it('skips trivial bash commands like echo and ls', () => {
    const result = unifiedErrorHandler(makeInput({
      tool_name: 'Bash',
      tool_input: { command: 'echo hello' },
      exit_code: 1,
    }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('detects error patterns in tool output text', () => {
    unifiedErrorHandler(makeInput({
      tool_output: 'Error: Module not found\nFATAL: compilation failed',
      exit_code: 0,
    }), testCtx);
    expect(testCtx.log).toHaveBeenCalledWith('error-logger', expect.stringContaining('output_pattern'));
  });

  it('always returns silent success even on error', () => {
    const result = unifiedErrorHandler(makeInput({ exit_code: 1 }), testCtx);
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});

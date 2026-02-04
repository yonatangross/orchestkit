import { describe, it, expect } from 'vitest';
import { failureHandler } from '../../posttool/failure-handler.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'npm test' },
    ...overrides,
  };
}

describe('failureHandler', () => {
  it('returns silent success when no error', () => {
    const result = failureHandler(makeInput({ exit_code: 0 }));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('suggests fix for file not found errors', () => {
    const result = failureHandler(makeInput({
      tool_error: 'ENOENT: no such file or directory',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('File not found');
  });

  it('suggests fix for permission denied errors', () => {
    const result = failureHandler(makeInput({
      tool_error: 'EACCES: permission denied',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Permission denied');
  });

  it('suggests fix for timeout errors', () => {
    const result = failureHandler(makeInput({
      tool_error: 'Command timed out after 120000ms',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('timed out');
  });

  it('returns silent success for unknown error patterns', () => {
    const result = failureHandler(makeInput({
      tool_error: 'some unknown error xyz',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('handles multiple matching patterns', () => {
    const result = failureHandler(makeInput({
      tool_error: 'ENOENT: no such file or directory, syntax error in config',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    const ctx = result.hookSpecificOutput?.additionalContext || '';
    expect(ctx).toContain('File not found');
    expect(ctx).toContain('Syntax error');
  });
});

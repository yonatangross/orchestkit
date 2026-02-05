import { describe, it, expect } from 'vitest';
import { isDontAskMode } from '../../lib/guards.js';
import type { HookInput } from '../../types.js';

function makeInput(permissionMode?: 'default' | 'acceptEdits' | 'dontAsk'): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session',
    tool_input: { file_path: 'test.ts', content: 'test' },
    permissionMode,
  };
}

describe('isDontAskMode', () => {
  it('returns true for dontAsk mode', () => {
    expect(isDontAskMode(makeInput('dontAsk'))).toBe(true);
  });

  it('returns false for default mode', () => {
    expect(isDontAskMode(makeInput('default'))).toBe(false);
  });

  it('returns false for acceptEdits mode', () => {
    expect(isDontAskMode(makeInput('acceptEdits'))).toBe(false);
  });

  it('returns false when undefined', () => {
    expect(isDontAskMode(makeInput())).toBe(false);
  });
});

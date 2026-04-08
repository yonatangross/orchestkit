import { describe, it, expect } from 'vitest';
import { isDontAskMode, isAutoMode } from '../../lib/guards.js';
import type { HookInput } from '../../types.js';

function makeInput(permissionMode?: 'default' | 'acceptEdits' | 'dontAsk' | 'auto'): HookInput {
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

  it('returns true for auto mode (CC 2.1.88)', () => {
    expect(isDontAskMode(makeInput('auto'))).toBe(true);
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

describe('isAutoMode', () => {
  it('returns true for auto mode', () => {
    expect(isAutoMode(makeInput('auto'))).toBe(true);
  });

  it('returns false for dontAsk mode', () => {
    expect(isAutoMode(makeInput('dontAsk'))).toBe(false);
  });

  it('returns false for default mode', () => {
    expect(isAutoMode(makeInput('default'))).toBe(false);
  });

  it('returns false when undefined', () => {
    expect(isAutoMode(makeInput())).toBe(false);
  });
});

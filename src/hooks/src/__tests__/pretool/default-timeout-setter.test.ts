/**
 * Unit tests for default-timeout-setter hook
 * Tests injection of default 120000ms timeout for Bash commands
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputWithUpdatedInput: vi.fn((updated: Record<string, unknown>) => ({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      updatedInput: updated,
    },
  })),
}));

import { defaultTimeoutSetter } from '../../pretool/bash/default-timeout-setter.js';
import type { HookInput } from '../../types.js';

function createBashInput(
  command: string,
  timeout?: number,
  description?: string
): HookInput {
  const tool_input: Record<string, unknown> = { command };
  if (timeout !== undefined) tool_input.timeout = timeout;
  if (description !== undefined) tool_input.description = description;

  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input,
  };
}

describe('default-timeout-setter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets default timeout of 120000ms when no timeout specified', () => {
    const input = createBashInput('npm run build');
    const result = defaultTimeoutSetter(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.updatedInput).toBeDefined();
    expect(result.hookSpecificOutput?.updatedInput?.timeout).toBe(120000);
    expect(result.hookSpecificOutput?.updatedInput?.command).toBe('npm run build');
  });

  it('preserves existing timeout when already set', () => {
    const input = createBashInput('npm run build', 60000);
    const result = defaultTimeoutSetter(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    // Should not have updatedInput since timeout was already set
    expect(result.hookSpecificOutput?.updatedInput).toBeUndefined();
  });

  it('preserves description field in updated input', () => {
    const input = createBashInput('npm test', undefined, 'Run test suite');
    const result = defaultTimeoutSetter(input);

    expect(result.hookSpecificOutput?.updatedInput?.description).toBe('Run test suite');
    expect(result.hookSpecificOutput?.updatedInput?.timeout).toBe(120000);
  });

  it('does not include description when not provided', () => {
    const input = createBashInput('git status');
    const result = defaultTimeoutSetter(input);

    expect(result.hookSpecificOutput?.updatedInput?.description).toBeUndefined();
    expect(result.hookSpecificOutput?.updatedInput?.command).toBe('git status');
  });

  it('handles empty command string', () => {
    const input = createBashInput('');
    const result = defaultTimeoutSetter(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.updatedInput?.timeout).toBe(120000);
    expect(result.hookSpecificOutput?.updatedInput?.command).toBe('');
  });
});

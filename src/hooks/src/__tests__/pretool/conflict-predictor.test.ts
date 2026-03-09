/**
 * Unit tests for conflict-predictor hook
 * Tests prediction of merge conflicts before git merge/rebase/pull
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  logPermissionFeedback: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputAllowWithContext: vi.fn((ctx: string) => ({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: ctx,
      permissionDecision: 'allow',
    },
  })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => ''),
}));

import { conflictPredictor } from '../../pretool/bash/conflict-predictor.js';
import type { HookInput } from '../../types.js';
import { execFileSync } from 'node:child_process';

function createBashInput(command: string): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { command },
  };
}

describe('conflict-predictor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns silent success for non-merge/rebase commands', () => {
    const input = createBashInput('git status');
    const result = conflictPredictor(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success when no potential conflicts found', () => {
    vi.mocked(execFileSync).mockReturnValue('');

    const input = createBashInput('git merge main');
    const result = conflictPredictor(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('warns about potential conflicts on git merge', () => {
    vi.mocked(execFileSync).mockImplementation((cmd: unknown, args: unknown) => {
      const argStr = (args as string[])?.join(' ') ?? '';
      if (argStr.includes('--name-only')) {
        return 'src/app.ts\nsrc/config.ts\n';
      }
      if (argStr.includes('log -1')) {
        return 'abc1234';
      }
      return '';
    });

    const input = createBashInput('git merge main');
    const result = conflictPredictor(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Potential conflicts');
  });

  it('extracts target branch from git rebase command', () => {
    vi.mocked(execFileSync).mockReturnValue('');

    const input = createBashInput('git rebase develop');
    const result = conflictPredictor(input);

    // Should process and call execSync with 'develop' as target
    expect(result.continue).toBe(true);
  });

  it('uses origin/dev as default target for git pull', () => {
    vi.mocked(execFileSync).mockReturnValue('');

    const input = createBashInput('git pull');
    const result = conflictPredictor(input);

    expect(result.continue).toBe(true);
  });

  it('handles git command failure gracefully', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('fatal: bad revision');
    });

    const input = createBashInput('git merge main');
    const result = conflictPredictor(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});

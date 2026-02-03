/**
 * Unit tests for changelog-generator hook
 * Tests changelog suggestion generation from git commits
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
  execSync: vi.fn(() => ''),
}));

import { changelogGenerator } from '../../pretool/bash/changelog-generator.js';
import type { HookInput } from '../../types.js';
import { execSync } from 'node:child_process';

function createBashInput(command: string): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { command },
  };
}

describe('changelog-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns silent success for non-version commands', () => {
    const input = createBashInput('npm run build');
    const result = changelogGenerator(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success when no commits found', () => {
    vi.mocked(execSync).mockReturnValue('');

    const input = createBashInput('npm version patch');
    const result = changelogGenerator(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('generates changelog sections for feature and fix commits', () => {
    vi.mocked(execSync).mockReturnValue(
      'feat: add user authentication\nfix: resolve login timeout\nfeat: add password reset'
    );

    const input = createBashInput('npm version minor');
    const result = changelogGenerator(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Features');
    expect(result.hookSpecificOutput?.additionalContext).toContain('Bug Fixes');
    expect(result.hookSpecificOutput?.additionalContext).toContain('CHANGELOG.md');
  });

  it('groups refactor and chore commits under Maintenance', () => {
    vi.mocked(execSync).mockReturnValue(
      'refactor: simplify auth flow\nchore: update dependencies\nperf: optimize query'
    );

    const input = createBashInput('poetry version patch');
    const result = changelogGenerator(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Maintenance');
  });

  it('returns silent success when commits have no conventional type prefix', () => {
    vi.mocked(execSync).mockReturnValue('update readme\nmerge branch main');

    const input = createBashInput('npm version patch');
    const result = changelogGenerator(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('handles git command failure gracefully', () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('not a git repository');
    });

    const input = createBashInput('npm version major');
    const result = changelogGenerator(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});

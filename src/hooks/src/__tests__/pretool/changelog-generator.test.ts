/**
 * Unit tests for changelog-generator hook
 * Tests changelog suggestion generation from git commits
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => mockCommonBasic());

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => ''),
}));

import { changelogGenerator } from '../../pretool/bash/changelog-generator.js';
import type { HookInput } from '../../types.js';
import { execFileSync } from 'node:child_process';
import { createTestContext } from '../fixtures/test-context.js';

function createBashInput(command: string): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { command },
  };
}

let testCtx: ReturnType<typeof createTestContext>;
describe('changelog-generator', () => {
  beforeEach(() => {
    testCtx = createTestContext();
    vi.clearAllMocks();
  });

  it('returns silent success for non-version commands', () => {
    const input = createBashInput('npm run build');
    const result = changelogGenerator(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success when no commits found', () => {
    vi.mocked(execFileSync).mockReturnValue('');

    const input = createBashInput('npm version patch');
    const result = changelogGenerator(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('generates changelog sections for feature and fix commits', () => {
    vi.mocked(execFileSync).mockReturnValue(
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
    vi.mocked(execFileSync).mockReturnValue(
      'refactor: simplify auth flow\nchore: update dependencies\nperf: optimize query'
    );

    const input = createBashInput('poetry version patch');
    const result = changelogGenerator(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Maintenance');
  });

  it('returns silent success when commits have no conventional type prefix', () => {
    vi.mocked(execFileSync).mockReturnValue('update readme\nmerge branch main');

    const input = createBashInput('npm version patch');
    const result = changelogGenerator(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('handles git command failure gracefully', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('not a git repository');
    });

    const input = createBashInput('npm version major');
    const result = changelogGenerator(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});

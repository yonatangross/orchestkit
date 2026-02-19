import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

const mockExecSync = vi.fn();
vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

vi.mock('node:os', () => ({
  tmpdir: vi.fn(() => '/tmp'),
  homedir: vi.fn(() => '/home/test'),
  default: { tmpdir: () => '/tmp', homedir: () => '/home/test' },
}));

vi.mock('node:path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:path')>();
  return { ...actual, default: actual, dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')) };
});

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getField: vi.fn((input: Record<string, unknown>, path: string) => {
    const parts = path.split('.');
    let val: unknown = input;
    for (const p of parts) {
      if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
      else return undefined;
    }
    return val;
  }),
  getSessionId: vi.fn(() => 'test-session-id'),
}));

import { issueProgressCommenter } from '../../posttool/bash/issue-progress-commenter.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'git commit -m "fix(#123): resolve login bug"' },
    exit_code: 0,
    ...overrides,
  };
}

describe('issueProgressCommenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    // Default: gh exists, github remote, on issue branch
    mockExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('which gh')) return '/usr/local/bin/gh';
      if (typeof cmd === 'string' && cmd.includes('git remote')) return 'git@github.com:user/repo.git';
      if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) return 'fix/123-login-bug';
      if (typeof cmd === 'string' && cmd.includes('git rev-parse --short')) return 'abc1234';
      if (typeof cmd === 'string' && cmd.includes('git log -1 --pretty=%s')) return 'fix(#123): resolve login bug';
      if (typeof cmd === 'string' && cmd.includes('git log -1 --pretty=%cI')) return '2026-01-15T10:00:00Z';
      if (typeof cmd === 'string' && cmd.includes('gh issue view')) return '{"number": 123}';
      return '';
    });
  });

  it('returns silent success for non-Bash tools', () => {
    const result = issueProgressCommenter(makeInput({ tool_name: 'Write' }));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success for non-git-commit commands', () => {
    const result = issueProgressCommenter(makeInput({
      tool_input: { command: 'npm test' },
    }));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success for failed git commits', () => {
    const result = issueProgressCommenter(makeInput({ exit_code: 1 }));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('extracts issue number from branch name and queues progress', () => {
    // After initProgressFile writes, queueCommitProgress reads it back
    mockReadFileSync.mockReturnValue(JSON.stringify({
      session_id: 'test-session',
      issues: {},
    }));

    issueProgressCommenter(makeInput());

    // The second write should include the issue number
    const writeCall = mockWriteFileSync.mock.calls.find(
      (call: unknown[]) => String(call[1]).includes('"123"')
    );
    expect(writeCall).toBeDefined();
    expect(writeCall![0]).toContain('issue-progress.json');
  });

  it('skips when gh CLI is not available', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('which gh')) throw new Error('not found');
      return '';
    });
    const result = issueProgressCommenter(makeInput());
    expect(result.continue).toBe(true);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('skips when remote is not a GitHub repository', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('which gh')) return '/usr/local/bin/gh';
      if (typeof cmd === 'string' && cmd.includes('git remote')) return 'git@gitlab.com:user/repo.git';
      return '';
    });
    const result = issueProgressCommenter(makeInput());
    expect(result.continue).toBe(true);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });
});

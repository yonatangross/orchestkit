import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

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

const mockExecFileSync = vi.fn();
vi.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
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

vi.mock('../../lib/common.js', () => mockCommonBasic({
  getSessionId: vi.fn(() => 'test-session-id'),
}));

import { issueProgressCommenter } from '../../posttool/bash/issue-progress-commenter.js';
import type { HookInput } from '../../types.js';
import { createTestContext } from '../fixtures/test-context.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'git commit -m "fix(#123): resolve login bug"' },
    exit_code: 0,
    ...overrides,
  };
}

let testCtx: ReturnType<typeof createTestContext>;
describe('issueProgressCommenter', () => {
  beforeEach(() => {
    testCtx = createTestContext({ sessionId: 'test-session-id' });
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    // Default: gh exists, github remote, on issue branch
    mockExecFileSync.mockImplementation((cmd: unknown, args: unknown) => {
      const argStr = (args as string[])?.join(' ') ?? '';
      if (cmd === 'which' && argStr.includes('gh')) return '/usr/local/bin/gh';
      if (cmd === 'git' && argStr.includes('remote')) return 'git@github.com:user/repo.git';
      if (cmd === 'git' && argStr.includes('branch --show-current')) return 'fix/123-login-bug';
      if (cmd === 'git' && argStr.includes('rev-parse --short')) return 'abc1234';
      if (cmd === 'git' && argStr.includes('log -1 --pretty=%s')) return 'fix(#123): resolve login bug';
      if (cmd === 'git' && argStr.includes('log -1 --pretty=%cI')) return '2026-01-15T10:00:00Z';
      if (cmd === 'gh' && argStr.includes('issue view')) return '{"number": 123}';
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
    mockExecFileSync.mockImplementation((cmd: unknown, args: unknown) => {
      const argStr = (args as string[])?.join(' ') ?? '';
      if (cmd === 'which' && argStr.includes('gh')) throw new Error('not found');
      return '';
    });
    const result = issueProgressCommenter(makeInput());
    expect(result.continue).toBe(true);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('skips when remote is not a GitHub repository', () => {
    mockExecFileSync.mockImplementation((cmd: unknown, args: unknown) => {
      const argStr = (args as string[])?.join(' ') ?? '';
      if (cmd === 'which' && argStr.includes('gh')) return '/usr/local/bin/gh';
      if (cmd === 'git' && argStr.includes('remote')) return 'git@gitlab.com:user/repo.git';
      return '';
    });
    const result = issueProgressCommenter(makeInput());
    expect(result.continue).toBe(true);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });
});

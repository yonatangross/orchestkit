/**
 * Tests for Issue Work Summary Hook
 *
 * Tests GitHub issue progress comment posting at session end.
 * Covers: no progress file, gh CLI not available, non-GitHub repos,
 * valid issue posting, and cleanup.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PathLike } from 'node:fs';
import { mockCommonBasic } from '../fixtures/mock-common.js';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  rmdirSync: vi.fn(),
}));

// Mock node:child_process
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => ''),
}));

// Mock common utilities
vi.mock('../../lib/common.js', () => mockCommonBasic({
  getSessionId: vi.fn(() => 'test-session-id'),
}));

import { issueWorkSummary } from '../../stop/issue-work-summary.js';
import { existsSync, readFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { logHook, } from '../../lib/common.js';
import type { HookInput } from '../../types.js';
import { createTestContext } from '../fixtures/test-context.js';

let testCtx: ReturnType<typeof createTestContext>;
describe('Issue Work Summary Hook', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const _mockUnlinkSync = vi.mocked(unlinkSync);
  const _mockRmdirSync = vi.mocked(rmdirSync);
  const mockExecFileSync = vi.mocked(execFileSync);
  const mockLogHook = vi.mocked(logHook);

  const defaultInput: HookInput = {
    hook_event: 'Stop',
    tool_name: '',
    session_id: 'test-session-id',
    tool_input: {},
  };

  beforeEach(() => {
    testCtx = createTestContext({ sessionId: 'test-session-id' });
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  // ===========================================================================
  // SECTION 1: No Progress File
  // ===========================================================================
  describe('No Progress File', () => {
    it('should return silent success when no progress file exists', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      const result = issueWorkSummary(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should log message about missing progress file', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      issueWorkSummary(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'issue-work-summary',
        expect.stringContaining('No progress file found')
      );
    });

    it('should not attempt gh commands when no progress file', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      issueWorkSummary(defaultInput);

      // Assert
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // SECTION 2: gh CLI Not Available
  // ===========================================================================
  describe('gh CLI Not Available', () => {
    it('should skip when gh CLI is not available', () => {
      // Arrange - progress file exists, gh check fails
      const _callIdx = 0;
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('issue-progress.json')) return true;
        return false;
      });
      mockExecFileSync.mockImplementation((cmd: unknown, args: unknown) => {
        const argStr = (args as string[])?.join(' ') ?? '';
        if (cmd === 'which' && argStr.includes('gh')) {
          throw new Error('gh not found');
        }
        return Buffer.from('');
      });

      // Act
      const result = issueWorkSummary(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'issue-work-summary',
        'gh CLI not available or not authenticated, skipping'
      );
    });

    it('should skip when gh auth status fails', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('issue-progress.json')) return true;
        return false;
      });
      mockExecFileSync.mockImplementation((cmd: unknown, args: unknown) => {
        const argStr = (args as string[])?.join(' ') ?? '';
        if (cmd === 'which' && argStr.includes('gh')) return Buffer.from('/usr/bin/gh');
        if (cmd === 'gh' && argStr.includes('auth status')) throw new Error('not authenticated');
        return Buffer.from('');
      });

      // Act
      const result = issueWorkSummary(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });

  // ===========================================================================
  // SECTION 3: Non-GitHub Repository
  // ===========================================================================
  describe('Non-GitHub Repository', () => {
    it('should skip when not a GitHub repository', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('issue-progress.json')) return true;
        return false;
      });
      mockExecFileSync.mockImplementation((cmd: unknown, args: unknown) => {
        const argStr = (args as string[])?.join(' ') ?? '';
        if (cmd === 'which' && argStr.includes('gh')) return Buffer.from('/usr/bin/gh');
        if (cmd === 'gh' && argStr.includes('auth')) return Buffer.from('');
        if (cmd === 'git' && argStr.includes('remote')) return Buffer.from('git@gitlab.com:user/repo.git');
        return Buffer.from('');
      });

      // Act
      const result = issueWorkSummary(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'issue-work-summary',
        'Not a GitHub repository, skipping'
      );
    });

    it('should skip when git remote fails', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('issue-progress.json')) return true;
        return false;
      });
      mockExecFileSync.mockImplementation((cmd: unknown, args: unknown) => {
        const argStr = (args as string[])?.join(' ') ?? '';
        if (cmd === 'which' && argStr.includes('gh')) return Buffer.from('/usr/bin/gh');
        if (cmd === 'gh' && argStr.includes('auth')) return Buffer.from('');
        if (cmd === 'git' && argStr.includes('remote')) throw new Error('not a git repo');
        return Buffer.from('');
      });

      // Act
      const result = issueWorkSummary(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });

  // ===========================================================================
  // SECTION 4: Valid Issue Posting
  // ===========================================================================
  describe('Valid Issue Posting', () => {
    beforeEach(() => {
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('issue-progress.json')) return true;
        return false;
      });
      // gh is available and we're in a github repo
      mockExecFileSync.mockImplementation((cmd: unknown, args: unknown) => {
        const argStr = (args as string[])?.join(' ') ?? '';
        if (cmd === 'which' && argStr.includes('gh')) return Buffer.from('/usr/bin/gh');
        if (cmd === 'gh' && argStr.includes('auth')) return Buffer.from('');
        if (cmd === 'git' && argStr.includes('remote')) return Buffer.from('git@github.com:user/repo.git');
        if (cmd === 'gh' && argStr.includes('issue view')) return Buffer.from('{"number": 42}');
        if (cmd === 'gh' && argStr.includes('issue comment')) return Buffer.from('');
        return Buffer.from('');
      });
    });

    it('should post comments for valid issues with commits', () => {
      // Arrange
      const progressData = {
        issues: {
          '42': {
            branch: 'feat/my-feature',
            commits: [{ sha: 'abc1234', message: 'Initial commit' }],
            tasks_completed: ['Task 1'],
          },
        },
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(progressData));

      // Act
      const result = issueWorkSummary(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'issue-work-summary',
        expect.stringContaining('Successfully posted comment to issue #42')
      );
    });

    it('should skip issues with no commits', () => {
      // Arrange
      const progressData = {
        issues: {
          '42': {
            branch: 'feat/empty',
            commits: [],
            tasks_completed: [],
          },
        },
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(progressData));

      // Act
      issueWorkSummary(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'issue-work-summary',
        'No commits for issue #42, skipping'
      );
    });

    it('should handle failed progress file read gracefully', () => {
      // Arrange
      mockReadFileSync.mockReturnValue('invalid json');

      // Act
      const result = issueWorkSummary(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'issue-work-summary',
        'Failed to read progress file'
      );
    });

    it('should handle empty issues object', () => {
      // Arrange
      mockReadFileSync.mockReturnValue(JSON.stringify({ issues: {} }));

      // Act
      const result = issueWorkSummary(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'issue-work-summary',
        'No issues to process'
      );
    });
  });

  // ===========================================================================
  // SECTION 5: Session ID Sanitization
  // ===========================================================================
  describe('Session ID Sanitization', () => {
    it('should sanitize session ID for path safety', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const inputWithSpecialChars: HookInput = {
        ...defaultInput,
        session_id: 'session/../../../etc/passwd',
      };

      // Act - should not throw
      const result = issueWorkSummary(inputWithSpecialChars);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });
});

/**
 * Unit tests for pr-status-enricher lifecycle hook
 * Tests PR detection and environment enrichment at session start (CC 2.1.20)
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST be before imports
// =============================================================================

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('../../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/common.js')>();
  return {
    ...actual,
    logHook: vi.fn(),
    getProjectDir: vi.fn(() => process.env.CLAUDE_PROJECT_DIR || '/test/project'),
    getCachedBranch: vi.fn(() => 'feature-branch'),
    outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  };
});

// Import after mocks
import { prStatusEnricher } from '../../lifecycle/pr-status-enricher.js';
import { execSync } from 'node:child_process';
import { logHook, getProjectDir, getCachedBranch, outputSilentSuccess } from '../../lib/common.js';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = join(tmpdir(), 'pr-status-enricher-test');

/**
 * Create realistic HookInput for testing
 */
function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: 'test-pr-enricher-123',
    project_dir: TEST_PROJECT_DIR,
    tool_input: {},
    ...overrides,
  };
}

/**
 * Create mock PR response
 */
function createPrResponse(overrides: Partial<{
  state: string;
  url: string;
  title: string;
  isDraft: boolean;
  reviewDecision: string | null;
}> = {}): string {
  return JSON.stringify({
    state: 'OPEN',
    url: 'https://github.com/org/repo/pull/123',
    title: 'Test PR Title',
    isDraft: false,
    reviewDecision: null,
    ...overrides,
  });
}

/**
 * Create mock review threads response
 */
function createThreadsResponse(threads: { isResolved: boolean }[] = []): string {
  return JSON.stringify({
    reviewThreads: threads,
  });
}

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();

  // Set environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;

  // Reset PR-related env vars
  delete process.env.ORCHESTKIT_PR_URL;
  delete process.env.ORCHESTKIT_PR_STATE;
});

afterEach(() => {
  // Clean up environment
  delete process.env.CLAUDE_PROJECT_DIR;
  delete process.env.ORCHESTKIT_PR_URL;
  delete process.env.ORCHESTKIT_PR_STATE;
});

// =============================================================================
// Tests
// =============================================================================

describe('pr-status-enricher', () => {
  describe('basic behavior', () => {
    test('returns silent success when no PR found', () => {
      // Arrange
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('no pull requests found');
      });
      const input = createHookInput();

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success when PR found', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('logs PR checking message', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'pr-status-enricher',
        'Checking for open PR on current branch'
      );
    });
  });

  describe('branch skipping', () => {
    test.each([
      ['main'],
      ['master'],
      ['dev'],
      ['develop'],
    ])('skips PR detection for branch "%s"', (branch) => {
      // Arrange
      vi.mocked(getCachedBranch).mockReturnValueOnce(branch);
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(execSync).not.toHaveBeenCalled();
      expect(logHook).toHaveBeenCalledWith(
        'pr-status-enricher',
        `Branch "${branch}" skipped for PR detection`
      );
    });

    test('skips when branch is empty', () => {
      // Arrange
      vi.mocked(getCachedBranch).mockReturnValueOnce('');
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(execSync).not.toHaveBeenCalled();
    });

    test('does not skip feature branches', () => {
      // Arrange
      vi.mocked(getCachedBranch).mockReturnValueOnce('feature/new-feature');
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(execSync).toHaveBeenCalled();
    });
  });

  describe('branch detection failure', () => {
    test('skips PR check when branch detection fails', () => {
      // Arrange
      vi.mocked(getCachedBranch).mockImplementationOnce(() => {
        throw new Error('Not a git repository');
      });
      const input = createHookInput();

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(logHook).toHaveBeenCalledWith(
        'pr-status-enricher',
        'Could not determine branch, skipping'
      );
    });
  });

  describe('environment variable setting', () => {
    test('sets ORCHESTKIT_PR_URL when PR found', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(
        createPrResponse({ url: 'https://github.com/org/repo/pull/456' })
      );
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(process.env.ORCHESTKIT_PR_URL).toBe('https://github.com/org/repo/pull/456');
    });

    test('sets ORCHESTKIT_PR_STATE when PR found', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(
        createPrResponse({ state: 'OPEN' })
      );
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(process.env.ORCHESTKIT_PR_STATE).toBe('OPEN');
    });

    test('does not set env vars when PR has no URL', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(
        JSON.stringify({ state: 'OPEN', url: '', title: 'Test' })
      );
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(process.env.ORCHESTKIT_PR_URL).toBeUndefined();
      expect(process.env.ORCHESTKIT_PR_STATE).toBeUndefined();
    });
  });

  describe('PR status logging', () => {
    test('logs PR title and state', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(
        createPrResponse({ title: 'Add new feature', state: 'OPEN' })
      );
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'pr-status-enricher',
        expect.stringContaining('Add new feature')
      );
      expect(logHook).toHaveBeenCalledWith(
        'pr-status-enricher',
        expect.stringContaining('[OPEN')
      );
    });

    test('logs DRAFT label when PR is draft', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(
        createPrResponse({ isDraft: true, title: 'WIP Feature' })
      );
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'pr-status-enricher',
        expect.stringContaining('(DRAFT)')
      );
    });

    test('does not log DRAFT label when PR is not draft', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(
        createPrResponse({ isDraft: false })
      );
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      const logCalls = vi.mocked(logHook).mock.calls;
      const prLogCall = logCalls.find(call => call[1].includes('PR:'));
      expect(prLogCall?.[1]).not.toContain('(DRAFT)');
    });

    test('logs review decision when present', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(
        createPrResponse({ reviewDecision: 'APPROVED' })
      );
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'pr-status-enricher',
        expect.stringContaining('Review: APPROVED')
      );
    });

    test('does not log review when reviewDecision is null', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(
        createPrResponse({ reviewDecision: null })
      );
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      const logCalls = vi.mocked(logHook).mock.calls;
      const prLogCall = logCalls.find(call => call[1].includes('PR:'));
      expect(prLogCall?.[1]).not.toContain('Review:');
    });

    test('logs unresolved comment count when > 0', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(
        createThreadsResponse([
          { isResolved: false },
          { isResolved: false },
          { isResolved: true },
        ])
      );
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'pr-status-enricher',
        expect.stringContaining('2 unresolved')
      );
    });

    test('does not log unresolved count when 0', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(
        createThreadsResponse([
          { isResolved: true },
          { isResolved: true },
        ])
      );
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      const logCalls = vi.mocked(logHook).mock.calls;
      const prLogCall = logCalls.find(call => call[1].includes('PR:'));
      expect(prLogCall?.[1]).not.toContain('unresolved');
    });

    test('logs PR URL', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(
        createPrResponse({ url: 'https://github.com/org/repo/pull/789' })
      );
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'pr-status-enricher',
        'URL: https://github.com/org/repo/pull/789'
      );
    });
  });

  describe('gh CLI commands', () => {
    test('calls gh pr view with correct flags', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(execSync).toHaveBeenCalledWith(
        'gh pr view --json state,reviewDecision,url,title,isDraft',
        expect.objectContaining({
          cwd: TEST_PROJECT_DIR,
          timeout: 10000,
          encoding: 'utf-8',
        })
      );
    });

    test('calls gh pr view for review threads', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(execSync).toHaveBeenCalledWith(
        'gh pr view --json reviewThreads',
        expect.objectContaining({
          cwd: TEST_PROJECT_DIR,
        })
      );
    });

    test('uses project_dir from input for cwd', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput({ project_dir: '/custom/project' });

      // Act
      prStatusEnricher(input);

      // Assert
      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cwd: '/custom/project',
        })
      );
    });
  });

  describe('error handling', () => {
    test('continues when gh pr view fails', () => {
      // Arrange
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('gh: command not found');
      });
      const input = createHookInput();

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('logs message when gh CLI unavailable', () => {
      // Arrange
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('gh: command not found');
      });
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'pr-status-enricher',
        'No PR found or gh CLI unavailable'
      );
    });

    test('continues when review threads query fails', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('Network error');
      });
      const input = createHookInput();

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result.continue).toBe(true);
      // Should still log PR info
      expect(logHook).toHaveBeenCalledWith(
        'pr-status-enricher',
        expect.stringContaining('PR:')
      );
    });

    test('never blocks session start', () => {
      // Arrange
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('Critical error');
      });
      const input = createHookInput();

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });

    test('handles invalid JSON from gh CLI', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce('invalid json {');
      const input = createHookInput();

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles missing reviewThreads field gracefully', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(JSON.stringify({}));
      const input = createHookInput();

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('suppressOutput', true);
    });

    test('always returns continue: true for non-blocking hook', () => {
      // Arrange - various scenarios
      const scenarios = [
        () => vi.mocked(getCachedBranch).mockReturnValueOnce('main'),
        () => vi.mocked(getCachedBranch).mockImplementationOnce(() => { throw new Error(); }),
        () => vi.mocked(execSync).mockImplementationOnce(() => { throw new Error(); }),
      ];

      // Act & Assert
      for (const setup of scenarios) {
        vi.clearAllMocks();
        vi.mocked(getCachedBranch).mockReturnValue('feature-branch');
        setup();
        const input = createHookInput();
        const result = prStatusEnricher(input);
        expect(result.continue).toBe(true);
      }
    });

    test('always suppresses output', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('parametric tests', () => {
    test.each([
      ['OPEN', 'OPEN'],
      ['CLOSED', 'CLOSED'],
      ['MERGED', 'MERGED'],
    ])('sets PR state "%s" correctly', (state, expected) => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse({ state }));
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(process.env.ORCHESTKIT_PR_STATE).toBe(expected);
    });

    test.each([
      ['APPROVED'],
      ['CHANGES_REQUESTED'],
      ['REVIEW_REQUIRED'],
    ])('logs review decision "%s"', (reviewDecision) => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(
        createPrResponse({ reviewDecision })
      );
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'pr-status-enricher',
        expect.stringContaining(`Review: ${reviewDecision}`)
      );
    });

    test.each([
      [0, false],
      [1, true],
      [5, true],
      [10, true],
    ])('handles %d unresolved threads (shows: %s)', (unresolvedCount, shouldShow) => {
      // Arrange
      const threads = Array(unresolvedCount).fill({ isResolved: false });
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse(threads));
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      const logCalls = vi.mocked(logHook).mock.calls;
      const prLogCall = logCalls.find(call => call[1].includes('PR:'));
      if (shouldShow) {
        expect(prLogCall?.[1]).toContain(`${unresolvedCount} unresolved`);
      } else {
        expect(prLogCall?.[1]).not.toContain('unresolved');
      }
    });

    test.each([
      ['feature/test'],
      ['bugfix/fix-123'],
      ['release/v1.0.0'],
      ['hotfix/urgent'],
    ])('processes branch "%s" normally', (branch) => {
      // Arrange
      vi.mocked(getCachedBranch).mockReturnValueOnce(branch);
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(execSync).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    test('handles very long PR titles', () => {
      // Arrange
      const longTitle = 'A'.repeat(500);
      vi.mocked(execSync).mockReturnValueOnce(
        createPrResponse({ title: longTitle })
      );
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles PR with all review threads resolved', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(
        createThreadsResponse([
          { isResolved: true },
          { isResolved: true },
          { isResolved: true },
        ])
      );
      const input = createHookInput();

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles PR with empty reviewThreads array', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse([]));
      const input = createHookInput();

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles timeout on gh pr view', () => {
      // Arrange
      vi.mocked(execSync).mockImplementationOnce(() => {
        const error = new Error('Command timed out');
        (error as NodeJS.ErrnoException).code = 'ETIMEDOUT';
        throw error;
      });
      const input = createHookInput();

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles special characters in PR title', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(
        createPrResponse({ title: 'feat: Add "quotes" & <special> chars' })
      );
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles project_dir with spaces', () => {
      // Arrange
      const pathWithSpaces = '/home/user/my project';
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput({ project_dir: pathWithSpaces });

      // Act
      const result = prStatusEnricher(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cwd: pathWithSpaces,
        })
      );
    });
  });

  describe('integration with common utilities', () => {
    test('calls outputSilentSuccess for return value', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('calls getCachedBranch with project directory', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput({ project_dir: '/custom/path' });

      // Act
      prStatusEnricher(input);

      // Assert
      expect(getCachedBranch).toHaveBeenCalledWith('/custom/path');
    });

    test('uses correct hook name in all log calls', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(createPrResponse());
      vi.mocked(execSync).mockReturnValueOnce(createThreadsResponse());
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      const allLogCalls = vi.mocked(logHook).mock.calls;
      for (const call of allLogCalls) {
        expect(call[0]).toBe('pr-status-enricher');
      }
    });
  });

  describe('no PR found scenarios', () => {
    test('logs "No PR found" when url is empty', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(
        JSON.stringify({ state: 'OPEN', url: '', title: 'Test' })
      );
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'pr-status-enricher',
        'No PR found for current branch'
      );
    });

    test('does not set env vars when url is missing', () => {
      // Arrange
      vi.mocked(execSync).mockReturnValueOnce(
        JSON.stringify({ state: 'OPEN', title: 'Test' })
      );
      const input = createHookInput();

      // Act
      prStatusEnricher(input);

      // Assert
      expect(process.env.ORCHESTKIT_PR_URL).toBeUndefined();
    });
  });
});

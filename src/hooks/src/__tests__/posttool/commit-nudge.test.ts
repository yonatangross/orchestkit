/**
 * Unit tests for commit-nudge PostToolUse hook
 *
 * Tests escalating commit reminders based on dirty file count
 * and time since last commit.
 *
 * @hook PostToolUse (Write|Edit|MultiEdit|Bash)
 * @since v7.2.0
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputWithContext: vi.fn((ctx: string) => ({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: { additionalContext: ctx },
  })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

vi.mock('../../lib/git.js', () => ({
  getDirtyFileCount: vi.fn(() => 0),
}));

vi.mock('../../lib/atomic-write.js', () => ({
  atomicWriteSync: vi.fn(),
}));

vi.mock('../../lib/paths.js', () => ({
  getLogDir: vi.fn(() => '/tmp/test-logs'),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  mkdirSync: vi.fn(),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
  dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
}));

import { commitNudge } from '../../posttool/commit-nudge.js';
import { outputSilentSuccess, outputWithContext, getProjectDir, logHook } from '../../lib/common.js';
import { getDirtyFileCount } from '../../lib/git.js';
import { existsSync, readFileSync } from 'node:fs';
import { atomicWriteSync } from '../../lib/atomic-write.js';
import type { HookInput } from '../../types.js';

// =============================================================================
// Helpers
// =============================================================================

function createPostToolInput(toolName: string, command?: string): HookInput {
  return {
    tool_name: toolName,
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: command ? { command } : {},
  };
}

function mockStateFile(state: Record<string, unknown>): void {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readFileSync).mockReturnValue(JSON.stringify(state));
}

// =============================================================================
// Tests
// =============================================================================

describe('commit-nudge', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ORCHESTKIT_AUTO_COMMIT_NUDGE;
    vi.mocked(getProjectDir).mockReturnValue('/test/project');
    vi.mocked(getDirtyFileCount).mockReturnValue(0);
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue('{}');
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  // ---------------------------------------------------------------------------
  // Env disable
  // ---------------------------------------------------------------------------

  describe('env disable', () => {
    test('returns silent success when ORCHESTKIT_AUTO_COMMIT_NUDGE=false', () => {
      process.env.ORCHESTKIT_AUTO_COMMIT_NUDGE = 'false';
      const input = createPostToolInput('Write');

      const result = commitNudge(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(getDirtyFileCount).not.toHaveBeenCalled();
    });

    test('does not disable for any other env value', () => {
      process.env.ORCHESTKIT_AUTO_COMMIT_NUDGE = 'true';
      vi.mocked(getDirtyFileCount).mockReturnValue(5);
      const input = createPostToolInput('Write');

      commitNudge(input);

      expect(getDirtyFileCount).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // No project dir
  // ---------------------------------------------------------------------------

  describe('no projectDir', () => {
    test('returns silent when getProjectDir returns empty', () => {
      vi.mocked(getProjectDir).mockReturnValue('');
      const input = createPostToolInput('Write');

      const result = commitNudge(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Git commit resets state
  // ---------------------------------------------------------------------------

  describe('git commit resets state', () => {
    test('resets state and returns silent when tool is Bash with git commit', () => {
      const input = createPostToolInput('Bash', 'git commit -m "feat: done"');

      const result = commitNudge(input);

      expect(result.continue).toBe(true);
      expect(atomicWriteSync).toHaveBeenCalledOnce();
      const state = JSON.parse(vi.mocked(atomicWriteSync).mock.calls[0][1] as string);
      expect(state.last_nudge_level).toBe('none');
    });

    test('does not reset for git push', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(0);
      const input = createPostToolInput('Bash', 'git push origin main');

      commitNudge(input);

      // atomicWriteSync should NOT be called for state reset (no dirty files → silent)
      expect(atomicWriteSync).not.toHaveBeenCalled();
    });

    test('does not reset for git commit --amend (no new work saved)', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(5);
      const input = createPostToolInput('Bash', 'git commit --amend --no-edit');

      commitNudge(input);

      // Should NOT reset state — amend doesn't reduce dirty files
      // Instead should evaluate dirty file count normally
      expect(stderrSpy).toHaveBeenCalled(); // info nudge at 5 files
    });

    test('does not reset for git commit --allow-empty', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(5);
      const input = createPostToolInput('Bash', 'git commit --allow-empty -m "empty"');

      commitNudge(input);

      // Should NOT reset — allow-empty doesn't reduce dirty files
      expect(stderrSpy).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Untracked tools pass through
  // ---------------------------------------------------------------------------

  describe('untracked tools', () => {
    test('returns silent for Read tool', () => {
      const input = createPostToolInput('Read');

      const result = commitNudge(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(getDirtyFileCount).not.toHaveBeenCalled();
    });

    test('returns silent for Grep tool', () => {
      const input = createPostToolInput('Grep');

      const result = commitNudge(input);

      expect(result.continue).toBe(true);
      expect(getDirtyFileCount).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 0 dirty files → silent
  // ---------------------------------------------------------------------------

  describe('zero dirty files', () => {
    test('returns silent when no dirty files', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(0);
      const input = createPostToolInput('Write');

      const result = commitNudge(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputWithContext).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Escalation thresholds
  // ---------------------------------------------------------------------------

  describe('escalation thresholds', () => {
    test('info nudge at 5 dirty files (stderr only, not additionalContext)', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(5);
      const input = createPostToolInput('Edit');

      const result = commitNudge(input);

      // Info level: stderr only, returns silent success
      expect(stderrSpy).toHaveBeenCalledOnce();
      expect(stderrSpy.mock.calls[0][0]).toContain('5');
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputWithContext).not.toHaveBeenCalled();
    });

    test('warn nudge at 10 dirty files (additionalContext)', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(10);
      const input = createPostToolInput('Write');

      commitNudge(input);

      expect(outputWithContext).toHaveBeenCalledOnce();
      const ctx = vi.mocked(outputWithContext).mock.calls[0][0];
      expect(ctx).toContain('10');
      expect(ctx).toContain('uncommitted');
    });

    test('urgent nudge at 15 dirty files (additionalContext with strong language)', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(15);
      const input = createPostToolInput('MultiEdit');

      commitNudge(input);

      expect(outputWithContext).toHaveBeenCalledOnce();
      const ctx = vi.mocked(outputWithContext).mock.calls[0][0];
      expect(ctx).toContain('15');
      expect(ctx).toContain('NOW');
    });

    test('no nudge below info threshold (4 dirty files)', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(4);
      const input = createPostToolInput('Write');

      const result = commitNudge(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputWithContext).not.toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Cooldown prevents re-nudging
  // ---------------------------------------------------------------------------

  describe('cooldown', () => {
    test('suppresses nudge within 3-minute cooldown window', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(10);
      // State: last nudge was 1 minute ago
      mockStateFile({
        last_commit_ts: Date.now() - 600000,
        last_nudge_level: 'warn',
        last_nudge_ts: Date.now() - 60000, // 1 min ago < 3 min cooldown
      });
      const input = createPostToolInput('Write');

      const result = commitNudge(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputWithContext).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Escalation transitions
  // ---------------------------------------------------------------------------

  describe('escalation transitions', () => {
    test('escalates info → warn when dirty count reaches 10', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(10);
      mockStateFile({
        last_commit_ts: Date.now() - 60000,
        last_nudge_level: 'info',
        last_nudge_ts: 0,
      });
      const input = createPostToolInput('Write');

      commitNudge(input);

      expect(outputWithContext).toHaveBeenCalledOnce();
      const ctx = vi.mocked(outputWithContext).mock.calls[0][0];
      expect(ctx).toContain('10');
      expect(ctx).toContain('uncommitted');
      // Verify state saved as 'warn'
      const state = JSON.parse(vi.mocked(atomicWriteSync).mock.calls[0][1] as string);
      expect(state.last_nudge_level).toBe('warn');
    });

    test('escalates warn → urgent when dirty count reaches 15', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(15);
      mockStateFile({
        last_commit_ts: Date.now() - 60000,
        last_nudge_level: 'warn',
        last_nudge_ts: 0,
      });
      const input = createPostToolInput('Edit');

      commitNudge(input);

      expect(outputWithContext).toHaveBeenCalledOnce();
      const ctx = vi.mocked(outputWithContext).mock.calls[0][0];
      expect(ctx).toContain('NOW');
      const state = JSON.parse(vi.mocked(atomicWriteSync).mock.calls[0][1] as string);
      expect(state.last_nudge_level).toBe('urgent');
    });

    test('does NOT escalate warn → info (no downgrade)', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(5);
      mockStateFile({
        last_commit_ts: Date.now() - 60000,
        last_nudge_level: 'warn',
        last_nudge_ts: 0,
      });
      const input = createPostToolInput('Write');

      const result = commitNudge(input);

      // At 5 files with state=warn, info threshold (state=none) doesn't match
      // No file-count nudge should fire at warn level for 5 files
      expect(outputWithContext).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Time-based nudge
  // ---------------------------------------------------------------------------

  describe('time-based nudge', () => {
    test('nudges when 15+ minutes since last commit with dirty files', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(3);
      mockStateFile({
        last_commit_ts: Date.now() - 16 * 60 * 1000, // 16 min ago
        last_nudge_level: 'none',
        last_nudge_ts: 0,
      });
      const input = createPostToolInput('Edit');

      commitNudge(input);

      expect(outputWithContext).toHaveBeenCalledOnce();
      const ctx = vi.mocked(outputWithContext).mock.calls[0][0];
      expect(ctx).toContain('minutes since last commit');
    });

    test('time-nudge blocked when state is urgent (urgent takes priority)', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(3);
      mockStateFile({
        last_commit_ts: Date.now() - 20 * 60 * 1000, // 20 min ago
        last_nudge_level: 'urgent',
        last_nudge_ts: 0,
      });
      const input = createPostToolInput('Write');

      const result = commitNudge(input);

      // Time nudge is gated by last_nudge_level !== 'urgent'
      expect(outputWithContext).not.toHaveBeenCalled();
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // State persistence
  // ---------------------------------------------------------------------------

  describe('state persistence', () => {
    test('persists state after info nudge', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(5);
      const input = createPostToolInput('Write');

      commitNudge(input);

      expect(atomicWriteSync).toHaveBeenCalledOnce();
      const state = JSON.parse(vi.mocked(atomicWriteSync).mock.calls[0][1] as string);
      expect(state.last_nudge_level).toBe('info');
    });

    test('handles corrupt state file gracefully', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('NOT VALID JSON');
      vi.mocked(getDirtyFileCount).mockReturnValue(5);
      const input = createPostToolInput('Write');

      expect(() => commitNudge(input)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  describe('logging', () => {
    test('logs at warn nudge level', () => {
      vi.mocked(getDirtyFileCount).mockReturnValue(10);
      const input = createPostToolInput('Write');

      commitNudge(input);

      expect(logHook).toHaveBeenCalledWith(
        'commit-nudge',
        expect.stringContaining('10'),
      );
    });
  });
});

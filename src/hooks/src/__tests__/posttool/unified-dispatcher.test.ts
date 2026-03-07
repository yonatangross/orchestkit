import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputWithContext: vi.fn((ctx: string) => ({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: { additionalContext: ctx },
  })),
}));

vi.mock('../../lib/analytics.js', () => ({
  appendAnalytics: vi.fn(),
  hashProject: vi.fn(() => 'hashed-project'),
  getTeamContext: vi.fn(() => ({ agent: 'test-agent' })),
}));

// Mock all individual hooks to prevent side effects
// After #897 slimming + CC 2.1.71: 4 hooks in posttool dispatcher
vi.mock('../../skill/redact-secrets.js', () => ({ redactSecrets: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/config-change/security-auditor.js', () => ({ configChangeAuditor: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/task/team-member-start.js', () => ({ teamMemberStart: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/commit-nudge.js', () => ({ commitNudge: vi.fn(() => ({ continue: true, suppressOutput: true })) }));

import { unifiedDispatcher, matchesTool, registeredHookNames, } from '../../posttool/unified-dispatcher.js';
import { commitNudge } from '../../posttool/commit-nudge.js';
import { outputWithContext } from '../../lib/common.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'ls' },
    ...overrides,
  };
}

describe('unifiedDispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns silent success for all dispatches', async () => {
    const result = await unifiedDispatcher(makeInput());
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success when no hooks match', async () => {
    const result = await unifiedDispatcher(makeInput({ tool_name: 'UnknownTool' }));
    expect(result.continue).toBe(true);
  });

  it('handles individual hook failures gracefully', async () => {
    // Import one of the mocked hooks and make it throw
    const { redactSecrets } = await import('../../skill/redact-secrets.js');
    vi.mocked(redactSecrets).mockImplementation(() => { throw new Error('boom'); });

    const result = await unifiedDispatcher(makeInput());
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('forwards additionalContext when a hook returns it', async () => {
    vi.mocked(commitNudge).mockReturnValue({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { additionalContext: '[Commit Nudge] 15 uncommitted files' },
    });

    const result = await unifiedDispatcher(makeInput({ tool_name: 'Write' }));

    expect(outputWithContext).toHaveBeenCalledWith('[Commit Nudge] 15 uncommitted files');
    expect(result.hookSpecificOutput?.additionalContext).toContain('15 uncommitted files');
  });

  it('concatenates additionalContext from multiple hooks', async () => {
    const { configChangeAuditor } = await import('../../posttool/config-change/security-auditor.js');
    vi.mocked(configChangeAuditor).mockReturnValue({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { additionalContext: '[Config] drift detected' },
    });
    vi.mocked(commitNudge).mockReturnValue({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { additionalContext: '[Commit Nudge] 10 files' },
    });

    const result = await unifiedDispatcher(makeInput({ tool_name: 'Edit' }));

    expect(outputWithContext).toHaveBeenCalledOnce();
    const ctx = vi.mocked(outputWithContext).mock.calls[0][0];
    expect(ctx).toContain('[Config] drift detected');
    expect(ctx).toContain('[Commit Nudge] 10 files');
  });

  it('returns silent success when hooks return context but all fail', async () => {
    const { redactSecrets } = await import('../../skill/redact-secrets.js');
    vi.mocked(redactSecrets).mockImplementation(() => { throw new Error('boom'); });

    const result = await unifiedDispatcher(makeInput({ tool_name: 'Bash' }));

    // Only redact-secrets matches Bash (plus commit-nudge which returns silent)
    // Failed hooks don't contribute context
    expect(result.continue).toBe(true);
  });
});

describe('matchesTool', () => {
  it('matches wildcard "*" to any tool', () => {
    expect(matchesTool('Bash', '*')).toBe(true);
    expect(matchesTool('Write', '*')).toBe(true);
    expect(matchesTool('anything', '*')).toBe(true);
  });

  it('matches exact string matcher', () => {
    expect(matchesTool('Bash', 'Bash')).toBe(true);
    expect(matchesTool('Write', 'Bash')).toBe(false);
  });

  it('matches array of matchers', () => {
    expect(matchesTool('Write', ['Write', 'Edit'])).toBe(true);
    expect(matchesTool('Edit', ['Write', 'Edit'])).toBe(true);
    expect(matchesTool('Bash', ['Write', 'Edit'])).toBe(false);
  });
});

describe('registeredHookNames', () => {
  it('returns all registered hook names', () => {
    const names = registeredHookNames();
    // After #897 slimming + CC 2.1.71: 4 hooks
    expect(names).toContain('redact-secrets');
    expect(names).toContain('config-change-auditor');
    expect(names).toContain('team-member-start');
    expect(names).toContain('commit-nudge');
    expect(names.length).toBe(4);
  });
});

// TaskUpdate analytics tracking removed in #897 slimming — no longer in posttool dispatcher

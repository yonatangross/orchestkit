import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
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
    // After #897 slimming + CC 2.1.71: 4 hooks + #1191 fingerprint-saver: 5
    expect(names).toContain('redact-secrets');
    expect(names).toContain('config-change-auditor');
    expect(names).toContain('team-member-start');
    expect(names).toContain('commit-nudge');
    expect(names).toContain('fingerprint-saver');
    expect(names.length).toBe(5);
  });
});

// TaskUpdate analytics tracking removed in #897 slimming — no longer in posttool dispatcher

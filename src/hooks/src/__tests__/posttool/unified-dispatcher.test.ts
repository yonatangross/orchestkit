import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

// Mock all individual hooks to prevent side effects
vi.mock('../../posttool/session-metrics.js', () => ({ sessionMetrics: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/audit-logger.js', () => ({ auditLogger: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/calibration-tracker.js', () => ({ calibrationTracker: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/bash/pattern-extractor.js', () => ({ patternExtractor: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/write/code-style-learner.js', () => ({ codeStyleLearner: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/write/naming-convention-learner.js', () => ({ namingConventionLearner: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/skill-edit-tracker.js', () => ({ skillEditTracker: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/skill/skill-usage-optimizer.js', () => ({ skillUsageOptimizer: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/memory-bridge.js', () => ({ memoryBridge: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/realtime-sync.js', () => ({ realtimeSync: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/bash/issue-progress-commenter.js', () => ({ issueProgressCommenter: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/bash/issue-subtask-updater.js', () => ({ issueSubtaskUpdater: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/user-tracking.js', () => ({ userTracking: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/solution-detector.js', () => ({ solutionDetector: vi.fn(() => ({ continue: true, suppressOutput: true })) }));
vi.mock('../../posttool/tool-preference-learner.js', () => ({ toolPreferenceLearner: vi.fn(() => ({ continue: true, suppressOutput: true })) }));

import { unifiedDispatcher, matchesTool, registeredHookNames, registeredHookMatchers } from '../../posttool/unified-dispatcher.js';
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
    // Import the mocked module and make it throw
    const { sessionMetrics } = await import('../../posttool/session-metrics.js');
    vi.mocked(sessionMetrics).mockImplementation(() => { throw new Error('boom'); });

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
    expect(names).toContain('session-metrics');
    expect(names).toContain('audit-logger');
    expect(names).toContain('tool-preference-learner');
    expect(names.length).toBeGreaterThan(10);
  });

  it('includes solution-detector (GAP-011)', () => {
    const names = registeredHookNames();
    expect(names).toContain('solution-detector');
  });
});

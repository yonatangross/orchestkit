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

import { unifiedDispatcher, matchesTool, registeredHookNames, } from '../../posttool/unified-dispatcher.js';
import { appendAnalytics } from '../../lib/analytics.js';
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

describe('TaskUpdate analytics tracking (Issue #740)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks TaskUpdate with status "completed"', async () => {
    await unifiedDispatcher(makeInput({
      tool_name: 'TaskUpdate',
      tool_input: { taskId: 'task-42', status: 'completed' },
    }));

    expect(appendAnalytics).toHaveBeenCalledWith('task-usage.jsonl', expect.objectContaining({
      task_id: 'task-42',
      task_status: 'completed',
      source: 'tool',
      pid: 'hashed-project',
    }));
  });

  it('tracks TaskUpdate with status "in_progress"', async () => {
    await unifiedDispatcher(makeInput({
      tool_name: 'TaskUpdate',
      tool_input: { taskId: 'task-7', status: 'in_progress' },
    }));

    expect(appendAnalytics).toHaveBeenCalledWith('task-usage.jsonl', expect.objectContaining({
      task_id: 'task-7',
      task_status: 'in_progress',
      source: 'tool',
    }));
  });

  it('does not track TaskUpdate with status "pending"', async () => {
    await unifiedDispatcher(makeInput({
      tool_name: 'TaskUpdate',
      tool_input: { taskId: 'task-1', status: 'pending' },
    }));

    expect(appendAnalytics).not.toHaveBeenCalledWith('task-usage.jsonl', expect.anything());
  });

  it('does not track TaskUpdate with status "deleted"', async () => {
    await unifiedDispatcher(makeInput({
      tool_name: 'TaskUpdate',
      tool_input: { taskId: 'task-1', status: 'deleted' },
    }));

    expect(appendAnalytics).not.toHaveBeenCalledWith('task-usage.jsonl', expect.anything());
  });

  it('uses "unknown" when taskId is missing', async () => {
    await unifiedDispatcher(makeInput({
      tool_name: 'TaskUpdate',
      tool_input: { status: 'completed' },
    }));

    expect(appendAnalytics).toHaveBeenCalledWith('task-usage.jsonl', expect.objectContaining({
      task_id: 'unknown',
      task_status: 'completed',
    }));
  });

  it('does not track when status is missing', async () => {
    await unifiedDispatcher(makeInput({
      tool_name: 'TaskUpdate',
      tool_input: { taskId: 'task-1' },
    }));

    expect(appendAnalytics).not.toHaveBeenCalledWith('task-usage.jsonl', expect.anything());
  });
});

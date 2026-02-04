import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getSessionId: vi.fn(() => 'test-session-id'),
}));

const mockTrackToolUsed = vi.fn();
const mockTrackSkillInvoked = vi.fn();
const mockTrackAgentSpawned = vi.fn();
vi.mock('../../lib/session-tracker.js', () => ({
  trackToolUsed: (...args: unknown[]) => mockTrackToolUsed(...args),
  trackSkillInvoked: (...args: unknown[]) => mockTrackSkillInvoked(...args),
  trackAgentSpawned: (...args: unknown[]) => mockTrackAgentSpawned(...args),
}));

const mockGetToolCategory = vi.fn(() => 'general');
vi.mock('../../lib/tool-categories.js', () => ({
  getToolCategory: (...args: unknown[]) => mockGetToolCategory(...args),
}));

const mockTrackToolAction = vi.fn();
vi.mock('../../lib/decision-flow-tracker.js', () => ({
  trackToolAction: (...args: unknown[]) => mockTrackToolAction(...args),
}));

import { userTracking } from '../../posttool/user-tracking.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'npm test' },
    ...overrides,
  };
}

describe('userTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks all tool usage with category', () => {
    mockGetToolCategory.mockReturnValue('build');
    userTracking(makeInput({ tool_name: 'Bash' }));
    expect(mockTrackToolUsed).toHaveBeenCalledWith('Bash', true, undefined, 'build');
  });

  it('tracks skill invocations specifically', () => {
    userTracking(makeInput({
      tool_name: 'Skill',
      tool_input: { skill: 'error-handling' },
    }));
    expect(mockTrackSkillInvoked).toHaveBeenCalledWith('error-handling', undefined, true);
  });

  it('tracks agent spawns with prompt summary', () => {
    userTracking(makeInput({
      tool_name: 'Task',
      tool_input: { subagent_type: 'code-reviewer', prompt: 'Review the authentication module' },
    }));
    expect(mockTrackAgentSpawned).toHaveBeenCalledWith(
      'code-reviewer',
      'Review the authentication module',
      true,
    );
  });

  it('marks tool as failed when tool_error is present', () => {
    userTracking(makeInput({ tool_error: 'command failed' }));
    expect(mockTrackToolUsed).toHaveBeenCalledWith('Bash', false, undefined, expect.any(String));
  });

  it('tracks tool action for decision flow', () => {
    userTracking(makeInput({
      tool_name: 'Write',
      tool_input: { file_path: '/src/index.ts', content: 'code' },
    }));
    expect(mockTrackToolAction).toHaveBeenCalledWith(
      'test-session',
      'Write',
      undefined, // no command for Write
      '/src/index.ts',
      0, // success = exit code 0
    );
  });

  it('handles errors gracefully without crashing', () => {
    mockTrackToolUsed.mockImplementation(() => { throw new Error('tracker error'); });
    const result = userTracking(makeInput());
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});

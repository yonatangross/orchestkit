import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const mockPairSolutionWithProblems = vi.fn();
const mockHasSolutionIndicators = vi.fn();
vi.mock('../../lib/problem-tracker.js', () => ({
  pairSolutionWithProblems: (...args: unknown[]) => mockPairSolutionWithProblems(...args),
  hasSolutionIndicators: (...args: unknown[]) => mockHasSolutionIndicators(...args),
}));

import { solutionDetector } from '../../posttool/solution-detector.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'npm test' },
    tool_result: 'All 42 tests passed. Everything is now fixed and working.',
    ...overrides,
  };
}

describe('solutionDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasSolutionIndicators.mockReturnValue(true);
    mockPairSolutionWithProblems.mockReturnValue(1);
  });

  it('returns silent success for non-solution tools (e.g., Read)', () => {
    // Act
    const result = solutionDetector(makeInput({ tool_name: 'Read' }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(mockPairSolutionWithProblems).not.toHaveBeenCalled();
  });

  it('returns silent success when tool output is too short', () => {
    // Act
    const result = solutionDetector(makeInput({ tool_result: 'ok' }));

    // Assert
    expect(result.continue).toBe(true);
    expect(mockPairSolutionWithProblems).not.toHaveBeenCalled();
  });

  it('returns silent success when no solution indicators found', () => {
    // Arrange
    mockHasSolutionIndicators.mockReturnValue(false);

    // Act
    const result = solutionDetector(makeInput());

    // Assert
    expect(result.continue).toBe(true);
    expect(mockPairSolutionWithProblems).not.toHaveBeenCalled();
  });

  it('pairs solution with problems when indicators are found', () => {
    // Act
    solutionDetector(makeInput());

    // Assert
    expect(mockPairSolutionWithProblems).toHaveBeenCalledWith(
      expect.stringContaining('fixed and working'),
      'Bash',
      undefined, // file_path not in Bash input
      undefined, // exit_code not explicitly set
      'test-session',
    );
  });

  it('extracts output from tool_output object with content field', () => {
    // Act
    const result = solutionDetector(makeInput({
      tool_result: undefined,
      tool_output: { content: 'The build error is now resolved and all tests pass correctly' },
    }));

    // Assert
    expect(result.continue).toBe(true);
    expect(mockPairSolutionWithProblems).toHaveBeenCalled();
  });

  it('handles pairing errors gracefully', () => {
    // Arrange
    mockPairSolutionWithProblems.mockImplementation(() => { throw new Error('tracker error'); });

    // Act
    const result = solutionDetector(makeInput());

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});

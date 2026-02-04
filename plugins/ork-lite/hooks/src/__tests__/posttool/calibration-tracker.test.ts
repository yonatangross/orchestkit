import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

const mockRecordOutcome = vi.fn();
vi.mock('../../lib/calibration-engine.js', () => ({
  recordOutcome: (...args: unknown[]) => mockRecordOutcome(...args),
}));

const mockGetTaskById = vi.fn();
vi.mock('../../lib/task-integration.js', () => ({
  getTaskById: (...args: unknown[]) => mockGetTaskById(...args),
}));

const mockGetLastClassification = vi.fn();
const mockLoadConfig = vi.fn();
vi.mock('../../lib/orchestration-state.js', () => ({
  getLastClassification: () => mockGetLastClassification(),
  loadConfig: () => mockLoadConfig(),
}));

import { calibrationTracker } from '../../posttool/calibration-tracker.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'TaskUpdate',
    session_id: 'test-session',
    tool_input: { taskId: 'task-1', status: 'completed' },
    ...overrides,
  };
}

describe('calibrationTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadConfig.mockReturnValue({ enableCalibration: true });
    mockGetTaskById.mockReturnValue({
      agent: 'test-agent',
      confidence: 0.85,
      createdAt: new Date(Date.now() - 5000).toISOString(),
    });
    mockGetLastClassification.mockReturnValue({
      agents: [{ agent: 'test-agent', matchedKeywords: ['test'], confidence: 0.85 }],
    });
  });

  it('returns silent success for non-TaskUpdate tools', () => {
    // Act
    const result = calibrationTracker(makeInput({ tool_name: 'Bash', tool_input: { command: 'ls' } }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(mockRecordOutcome).not.toHaveBeenCalled();
  });

  it('returns silent success when calibration is disabled', () => {
    // Arrange
    mockLoadConfig.mockReturnValue({ enableCalibration: false });

    // Act
    const result = calibrationTracker(makeInput());

    // Assert
    expect(result.continue).toBe(true);
    expect(mockRecordOutcome).not.toHaveBeenCalled();
  });

  it('records outcome for completed task with agent', () => {
    // Act
    const result = calibrationTracker(makeInput());

    // Assert
    expect(result.continue).toBe(true);
    expect(mockRecordOutcome).toHaveBeenCalledWith(
      '', // prompt not available
      'test-agent',
      ['test'],
      0.85,
      'success',
      expect.any(Number),
    );
  });

  it('skips non-completed status updates', () => {
    // Act
    const result = calibrationTracker(makeInput({
      tool_input: { taskId: 'task-1', status: 'in_progress' },
    }));

    // Assert
    expect(result.continue).toBe(true);
    expect(mockRecordOutcome).not.toHaveBeenCalled();
  });

  it('skips when task has no agent', () => {
    // Arrange
    mockGetTaskById.mockReturnValue({ confidence: 0.5 });

    // Act
    const result = calibrationTracker(makeInput());

    // Assert
    expect(result.continue).toBe(true);
    expect(mockRecordOutcome).not.toHaveBeenCalled();
  });

  it('skips when task is not found', () => {
    // Arrange
    mockGetTaskById.mockReturnValue(null);

    // Act
    const result = calibrationTracker(makeInput());

    // Assert
    expect(result.continue).toBe(true);
    expect(mockRecordOutcome).not.toHaveBeenCalled();
  });
});

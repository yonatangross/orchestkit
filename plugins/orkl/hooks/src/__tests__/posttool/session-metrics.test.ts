import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
}));

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

import { sessionMetrics } from '../../posttool/session-metrics.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'ls' },
    ...overrides,
  };
}

describe('sessionMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it('returns silent success for empty tool name', () => {
    // Act
    const result = sessionMetrics(makeInput({ tool_name: '' }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('creates new metrics file when none exists', () => {
    // Arrange
    mockExistsSync.mockReturnValue(false);

    // Act
    sessionMetrics(makeInput({ tool_name: 'Bash' }));

    // Assert
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('session-metrics'),
      expect.any(String),
    );
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.tools.Bash).toBe(1);
  });

  it('increments existing tool counter', () => {
    // Arrange
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      tools: { Bash: 5, Read: 3 },
      errors: 0,
      warnings: 0,
    }));

    // Act
    sessionMetrics(makeInput({ tool_name: 'Bash' }));

    // Assert
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.tools.Bash).toBe(6);
    expect(written.tools.Read).toBe(3);
  });

  it('handles corrupted metrics file by reinitializing', () => {
    // Arrange
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not valid json');

    // Act
    sessionMetrics(makeInput({ tool_name: 'Write' }));

    // Assert
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.tools.Write).toBe(1);
    expect(written.errors).toBe(0);
  });

  it('tracks different tool names independently', () => {
    // Arrange
    mockExistsSync.mockReturnValue(false);

    // Act
    sessionMetrics(makeInput({ tool_name: 'Glob' }));

    // Assert
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.tools.Glob).toBe(1);
    expect(written.tools.Bash).toBeUndefined();
  });
});

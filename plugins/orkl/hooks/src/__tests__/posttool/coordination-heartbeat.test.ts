import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

const mockExecSync = vi.fn();
vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

const mockGetOrGenerateSessionId = vi.fn(() => 'generated-session-id');
vi.mock('../../lib/session-id-generator.js', () => ({
  getOrGenerateSessionId: () => mockGetOrGenerateSessionId(),
}));

import { coordinationHeartbeat } from '../../posttool/coordination-heartbeat.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'ls' },
    ...overrides,
  };
}

describe('coordinationHeartbeat', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns silent success when coordination lib does not exist', () => {
    // Arrange
    mockExistsSync.mockReturnValue(false);

    // Act
    const result = coordinationHeartbeat(makeInput());

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('executes heartbeat when coordination lib exists', () => {
    // Arrange
    mockExistsSync.mockImplementation((path: string) => {
      if (path.includes('coordination.sh')) return true;
      return false;
    });

    // Act
    coordinationHeartbeat(makeInput());

    // Assert
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('coord_heartbeat'),
      expect.objectContaining({ shell: '/bin/bash', timeout: 5000 }),
    );
  });

  it('uses instance_env override when present', () => {
    // Arrange
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('CLAUDE_INSTANCE_ID="custom-instance-42"');

    // Act
    coordinationHeartbeat(makeInput());

    // Assert
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('custom-instance-42'),
      expect.any(Object),
    );
  });

  it('handles heartbeat execution failure gracefully', () => {
    // Arrange
    mockExistsSync.mockImplementation((path: string) => {
      if (path.includes('coordination.sh')) return true;
      return false;
    });
    mockExecSync.mockImplementation(() => { throw new Error('exec failed'); });

    // Act
    const result = coordinationHeartbeat(makeInput());

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('uses generated session ID from session-id-generator', () => {
    // Arrange
    mockExistsSync.mockImplementation((path: string) => {
      if (path.includes('coordination.sh')) return true;
      if (path.includes('.instance_env')) return false;
      return false;
    });
    mockGetOrGenerateSessionId.mockReturnValue('smart-session-abc123');

    // Act
    coordinationHeartbeat(makeInput());

    // Assert
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('smart-session-abc123'),
      expect.any(Object),
    );
  });
});

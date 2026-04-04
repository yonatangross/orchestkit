import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
}));

// Mock atomic-write so atomicWriteSync delegates to mockWriteFileSync
vi.mock('../../lib/atomic-write.js', () => ({
  atomicWriteSync: (path: string, content: string) => mockWriteFileSync(path, content),
}));

vi.mock('../../lib/common.js', () => mockCommonBasic());

import { sessionMetrics } from '../../posttool/session-metrics.js';
import type { HookInput } from '../../types.js';
import { createTestContext } from '../fixtures/test-context.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'ls' },
    ...overrides,
  };
}

let testCtx: ReturnType<typeof createTestContext>;
describe('sessionMetrics', () => {
  beforeEach(() => {
    testCtx = createTestContext();
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

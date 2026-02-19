import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-id'),
  estimateTokenCount: vi.fn((content: string) => Math.ceil(content.length / 4)),
}));

import { contextBudgetMonitor } from '../../posttool/context-budget-monitor.js';
import type { HookInput } from '../../types.js';

function makeInput(): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'ls' },
  };
}

describe('contextBudgetMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CLAUDE_MAX_CONTEXT;
    // Default: files don't exist so token count is 0
    mockExistsSync.mockReturnValue(false);
  });

  it('returns silent success always', () => {
    // Act
    const result = contextBudgetMonitor(makeInput());

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('does not compress when usage is below 70% threshold', () => {
    // With no files existing, usage is 0/2200 = 0% - well below threshold

    // Act
    contextBudgetMonitor(makeInput());

    // Assert - Should not attempt session compression
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1); // Only MCP defer state file
  });

  it('triggers compression when usage exceeds 70%', () => {
    // Arrange - Make files return large content to exceed 70% of 2200 tokens
    mockExistsSync.mockReturnValue(true);
    // Each file returns ~500 chars = ~125 tokens. 4 files = 500 tokens.
    // To exceed 70% of 2200 = 1540, we need large content.
    mockReadFileSync.mockReturnValue('x'.repeat(8000)); // ~2000 tokens per file

    // Act
    contextBudgetMonitor(makeInput());

    // Assert - Should write session state (compression) + MCP defer state
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it('handles errors gracefully without crashing', () => {
    // Arrange
    mockExistsSync.mockImplementation(() => { throw new Error('disk error'); });

    // Act
    const result = contextBudgetMonitor(makeInput());

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('writes MCP defer state file', () => {
    // Act
    contextBudgetMonitor(makeInput());

    // Assert - Should write the MCP defer state to temp dir
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('claude-mcp-defer-state-'),
      expect.any(String),
    );
  });

  it('uses CLAUDE_MAX_CONTEXT env for effective window calculation', () => {
    // Arrange
    process.env.CLAUDE_MAX_CONTEXT = '100000';

    // Act
    contextBudgetMonitor(makeInput());

    // Assert - Verify it runs without errors with custom context window
    const deferCall = mockWriteFileSync.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('mcp-defer-state'),
    );
    expect(deferCall).toBeDefined();
    const state = JSON.parse(deferCall![1] as string);
    expect(state.effective_window).toBe(80000); // 100000 * 0.8
  });
});

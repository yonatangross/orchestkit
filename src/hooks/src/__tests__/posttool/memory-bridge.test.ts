import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}));

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
  getPluginRoot: vi.fn(() => '/test/plugin'),
}));

import { memoryBridge } from '../../posttool/memory-bridge.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'mcp__memory__create_entities',
    session_id: 'test-session',
    tool_input: { entities: [] },
    ...overrides,
  };
}

describe('memoryBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns silent success for non-memory tools', () => {
    // Act
    const result = memoryBridge(makeInput({ tool_name: 'Bash', tool_input: { command: 'ls' } }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success for mcp__memory__create_entities (already in primary)', () => {
    // Act
    const result = memoryBridge(makeInput({
      tool_name: 'mcp__memory__create_entities',
      tool_input: { entities: [] },
    }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success for unknown tools', () => {
    // Act
    const result = memoryBridge(makeInput({
      tool_name: 'unknown_tool',
      tool_input: {},
    }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  // Note: mcp__mem0__add_memory tests removed - mem0 now uses CLI scripts
  // CLI scripts don't trigger PostToolUse hooks
});

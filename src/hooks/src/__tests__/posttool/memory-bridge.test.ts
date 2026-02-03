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
    tool_name: 'mcp__mem0__add_memory',
    session_id: 'test-session',
    tool_input: { text: 'We decided to use FastAPI with PostgreSQL for the backend' },
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

  it('extracts entities from mem0 add_memory and suggests graph sync', () => {
    // Act
    const result = memoryBridge(makeInput());

    // Assert
    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBeDefined();
    expect(result.systemMessage).toContain('Memory Bridge');
    expect(result.systemMessage).toContain('mcp__memory__create_entities');
  });

  it('skips memory text shorter than 20 characters', () => {
    // Act
    const result = memoryBridge(makeInput({
      tool_input: { text: 'short' },
    }));

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

  it('detects technology entities like FastAPI and PostgreSQL', () => {
    // Act
    const result = memoryBridge(makeInput({
      tool_input: { text: 'We decided to use FastAPI with PostgreSQL for the backend service' },
    }));

    // Assert
    expect(result.systemMessage).toContain('Fastapi');
    expect(result.systemMessage).toContain('Postgresql');
  });

  it('returns silent success when no entities are extracted', () => {
    // Act
    const result = memoryBridge(makeInput({
      tool_input: { text: 'This is a plain text with no known technology references at all here' },
    }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});

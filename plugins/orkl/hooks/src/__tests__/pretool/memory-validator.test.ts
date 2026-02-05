/**
 * Unit tests for memory-validator hook
 * Tests validation of memory MCP operations to prevent data loss
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  logPermissionFeedback: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputWarning: vi.fn((msg: string) => ({ continue: true, systemMessage: `\u26a0 ${msg}` })),
}));

import { memoryValidator } from '../../pretool/mcp/memory-validator.js';
import type { HookInput } from '../../types.js';

function createMcpInput(
  toolName: string,
  toolInput: Record<string, unknown> = {}
): HookInput {
  return {
    tool_name: toolName,
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: toolInput,
  };
}

describe('memory-validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns silent success for non-memory MCP tools', () => {
    const input = createMcpInput('Bash', { command: 'ls' });
    const result = memoryValidator(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('warns on bulk entity deletion (more than 5)', () => {
    const entityNames = ['entity1', 'entity2', 'entity3', 'entity4', 'entity5', 'entity6'];
    const input = createMcpInput('mcp__memory__delete_entities', { entityNames });
    const result = memoryValidator(input);

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toContain('Deleting 6 entities');
  });

  it('allows small entity deletion without warning', () => {
    const entityNames = ['entity1', 'entity2'];
    const input = createMcpInput('mcp__memory__delete_entities', { entityNames });
    const result = memoryValidator(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('warns on bulk relation deletion (more than 10)', () => {
    const relations = Array.from({ length: 12 }, (_, i) => ({
      from: `a${i}`,
      to: `b${i}`,
      relationType: 'USES',
    }));
    const input = createMcpInput('mcp__memory__delete_relations', { relations });
    const result = memoryValidator(input);

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toContain('Deleting 12 relations');
  });

  it('warns when creating entities with missing required fields', () => {
    const entities = [
      { name: 'valid', entityType: 'Technology' },
      { name: '', entityType: 'Technology' },
      { name: 'noType', entityType: '' },
    ];
    const input = createMcpInput('mcp__memory__create_entities', { entities });
    const result = memoryValidator(input);

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toContain('2 entities missing required fields');
  });

  it('allows valid entity creation silently', () => {
    const entities = [
      { name: 'PostgreSQL', entityType: 'Technology', observations: ['Used for DB'] },
    ];
    const input = createMcpInput('mcp__memory__create_entities', { entities });
    const result = memoryValidator(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('allows read operations silently', () => {
    const input = createMcpInput('mcp__memory__search_nodes', { query: 'database' });
    const result = memoryValidator(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});

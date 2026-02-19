/**
 * Graph Memory Inject - SubagentStart Hook Test Suite
 *
 * Tests the graph-memory-inject hook which injects knowledge graph
 * context instructions before agent spawn. Skips injection when
 * graph is empty or too small (<100 bytes).
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';

// ---------------------------------------------------------------------------
// Mock node:fs at module level before any hook imports
// ---------------------------------------------------------------------------
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ size: 500 }),
  renameSync: vi.fn(),
  readSync: vi.fn().mockReturnValue(0),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue('main\n'),
  spawn: vi.fn().mockReturnValue({
    unref: vi.fn(),
    on: vi.fn(),
    stderr: { on: vi.fn() },
    stdout: { on: vi.fn() },
    pid: 12345,
  }),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------
import { graphMemoryInject } from '../../subagent-start/graph-memory-inject.js';
import { existsSync, statSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal HookInput for SubagentStart */
function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'test-session-001',
    tool_input: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('graphMemoryInject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: graph file exists and is large enough
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 500 });
  });

  // -----------------------------------------------------------------------
  // Silent success cases (passthrough)
  // -----------------------------------------------------------------------

  describe('silent success cases', () => {
    test('returns silent success when tool_input has no subagent_type or type', () => {
      const input = makeInput({ tool_input: {} });

      const result = graphMemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    test('returns silent success when tool_input is empty object', () => {
      const input = makeInput({ tool_input: {} });

      const result = graphMemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles missing tool_input gracefully (undefined)', () => {
      // tool_input defaults to {} inside the hook when undefined
      const input = makeInput();
      (input as any).tool_input = undefined;

      const result = graphMemoryInject(input);

      expect(result.continue).toBe(true);
    });

    test('returns silent success for empty string subagent_type', () => {
      const input = makeInput({
        tool_input: { subagent_type: '' },
      });

      const result = graphMemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Valid agent type detection
  // -----------------------------------------------------------------------

  describe('agent type detection via subagent_type', () => {
    test('returns additionalContext with graph memory instructions for known agent', () => {
      const input = makeInput({
        tool_input: { subagent_type: 'database-engineer' },
      });

      const result = graphMemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBeUndefined();
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
    });

    test('output includes mcp__memory__search_nodes instruction', () => {
      const input = makeInput({
        tool_input: { subagent_type: 'backend-system-architect' },
      });

      const result = graphMemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('mcp__memory__search_nodes');
    });

    test('output includes agent type in search query', () => {
      const input = makeInput({
        tool_input: { subagent_type: 'security-auditor' },
      });

      const result = graphMemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('security-auditor');
      expect(ctx).toContain('security OWASP vulnerability audit authentication');
    });

    test('output includes formatted agent ID', () => {
      const input = makeInput({
        tool_input: { subagent_type: 'test-generator' },
      });

      const result = graphMemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('Agent ID: ork:test-generator');
    });

    test('systemMessage includes agent type and agent ID', () => {
      const input = makeInput({
        tool_input: { subagent_type: 'frontend-ui-developer' },
      });

      const result = graphMemoryInject(input);

      expect(result.systemMessage).toContain('frontend-ui-developer');
      expect(result.systemMessage).toContain('ork:frontend-ui-developer');
    });
  });

  // -----------------------------------------------------------------------
  // Fallback: type field
  // -----------------------------------------------------------------------

  describe('agent type detection via type field (removed in CC 2.1.47)', () => {
    test('no longer falls back to type field — returns silent success', () => {
      const input = makeInput({
        tool_input: { type: 'workflow-architect' },
      });

      const result = graphMemoryInject(input);

      // CC 2.1.47: removed legacy toolInput.type fallback and prompt-scan
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Fallback: prompt extraction
  // -----------------------------------------------------------------------

  describe('agent type detection via prompt fallback (removed in CC 2.1.47)', () => {
    test('no longer extracts agent type from prompt — returns silent success', () => {
      const input = makeInput({
        tool_input: {
          prompt: 'I need the database-engineer to review the schema',
        },
      });

      const result = graphMemoryInject(input);

      // CC 2.1.47: subagent_type is reliably set, prompt-scan removed
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success when prompt does not contain known agent', () => {
      const input = makeInput({
        tool_input: {
          prompt: 'I need help with some random task',
        },
      });

      const result = graphMemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Unknown agent types
  // -----------------------------------------------------------------------

  describe('unknown agent types', () => {
    test('still returns context for unknown agent types (uses agent type as domain)', () => {
      const input = makeInput({
        tool_input: { subagent_type: 'custom-agent-xyz' },
      });

      const result = graphMemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toContain('custom-agent-xyz');
      // When agent is not in AGENT_DOMAINS, domain defaults to agent type itself
      expect(result.hookSpecificOutput!.additionalContext).toContain('Domain: custom-agent-xyz');
    });
  });

  // -----------------------------------------------------------------------
  // AGENT_DOMAINS coverage
  // -----------------------------------------------------------------------

  describe('AGENT_DOMAINS mapping covers expected agent types', () => {
    const expectedAgents = [
      'database-engineer',
      'backend-system-architect',
      'frontend-ui-developer',
      'security-auditor',
      'test-generator',
      'workflow-architect',
      'llm-integrator',
      'data-pipeline-engineer',
      'metrics-architect',
      'ux-researcher',
      'code-quality-reviewer',
      'infrastructure-architect',
      'ci-cd-engineer',
      'accessibility-specialist',
      'product-strategist',
    ];

    test.each(expectedAgents)(
      'produces context with domain keywords for %s',
      (agentType) => {
        const input = makeInput({
          tool_input: { subagent_type: agentType },
        });

        const result = graphMemoryInject(input);

        expect(result.continue).toBe(true);
        expect(result.hookSpecificOutput).toBeDefined();
        expect(result.hookSpecificOutput!.additionalContext).toContain(agentType);
        // Domain should NOT equal the agent type itself for known agents
        expect(result.hookSpecificOutput!.additionalContext).not.toContain(
          `Domain: ${agentType}`,
        );
      },
    );
  });

  // -----------------------------------------------------------------------
  // Output structure
  // -----------------------------------------------------------------------

  describe('output structure', () => {
    test('result has correct HookResult shape', () => {
      const input = makeInput({
        tool_input: { subagent_type: 'database-engineer' },
      });

      const result = graphMemoryInject(input);

      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('systemMessage');
      expect(result).toHaveProperty('hookSpecificOutput');
      expect(result.hookSpecificOutput).toHaveProperty('additionalContext');
    });

    test('additionalContext contains integration instructions', () => {
      const input = makeInput({
        tool_input: { subagent_type: 'llm-integrator' },
      });

      const result = graphMemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('Integration Instructions');
      expect(ctx).toContain('Execute the graph search');
      expect(ctx).toContain('Review entities for patterns');
    });

    test('additionalContext contains Graph Memory header', () => {
      const input = makeInput({
        tool_input: { subagent_type: 'data-pipeline-engineer' },
      });

      const result = graphMemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('[Graph Memory - Agent Context Load]');
    });
  });

  // -----------------------------------------------------------------------
  // Graph size guard
  // -----------------------------------------------------------------------

  describe('graph size guard', () => {
    test('returns silent success when graph file does not exist', () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const input = makeInput({
        tool_input: { subagent_type: 'database-engineer' },
      });

      const result = graphMemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    test('returns silent success when graph file is too small (<100 bytes)', () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 50 });

      const input = makeInput({
        tool_input: { subagent_type: 'database-engineer' },
      });

      const result = graphMemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('injects context when graph file is large enough (>=100 bytes)', () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 500 });

      const input = makeInput({
        tool_input: { subagent_type: 'database-engineer' },
      });

      const result = graphMemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toContain('database-engineer');
    });

    test('returns silent success when statSync throws', () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (statSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('EACCES');
      });

      const input = makeInput({
        tool_input: { subagent_type: 'database-engineer' },
      });

      const result = graphMemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles null tool_input fields without throwing', () => {
      const input = makeInput({
        tool_input: { subagent_type: null as any, type: null as any },
      });

      // Should not throw; falsy values should lead to silent success
      const result = graphMemoryInject(input);
      expect(result.continue).toBe(true);
    });

    test('handles numeric subagent_type gracefully', () => {
      const input = makeInput({
        tool_input: { subagent_type: 123 as any },
      });

      // Non-string truthy value - behavior depends on implementation
      const result = graphMemoryInject(input);
      expect(result.continue).toBe(true);
    });

    test('prefers subagent_type over type when both present', () => {
      const input = makeInput({
        tool_input: {
          subagent_type: 'database-engineer',
          type: 'security-auditor',
        },
      });

      const result = graphMemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('database-engineer');
      expect(ctx).not.toContain('security-auditor');
    });
  });
});

/**
 * Mem0 Memory Inject - SubagentStart Hook Test Suite
 *
 * Tests the mem0-memory-inject hook which injects mem0 cloud memory
 * context instructions before agent spawn. This hook is gated by
 * MEM0_API_KEY and includes cross-agent federation.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';

// ---------------------------------------------------------------------------
// Mock node:fs at module level before any hook imports
// ---------------------------------------------------------------------------
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ size: 0 }),
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
import { mem0MemoryInject } from '../../subagent-start/mem0-memory-inject.js';

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

describe('mem0MemoryInject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  // -----------------------------------------------------------------------
  // MEM0_API_KEY gating
  // -----------------------------------------------------------------------

  describe('MEM0_API_KEY gating', () => {
    test('returns silent success when MEM0_API_KEY is not set', () => {
      // Ensure MEM0_API_KEY is not in the environment
      vi.stubEnv('MEM0_API_KEY', '');

      const input = makeInput({
        tool_input: { subagent_type: 'database-engineer' },
      });

      const result = mem0MemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    test('returns silent success when MEM0_API_KEY is empty string', () => {
      vi.stubEnv('MEM0_API_KEY', '');

      const input = makeInput({
        tool_input: { subagent_type: 'database-engineer' },
      });

      const result = mem0MemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns additionalContext when MEM0_API_KEY is set', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key-12345');

      const input = makeInput({
        tool_input: { subagent_type: 'database-engineer' },
      });

      const result = mem0MemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Silent success - no agent type
  // -----------------------------------------------------------------------

  describe('no agent type detected', () => {
    test('returns silent success when tool_input has no subagent_type or type', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({ tool_input: {} });

      const result = mem0MemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for empty string subagent_type', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: '' },
      });

      const result = mem0MemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles missing tool_input gracefully', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput();
      (input as any).tool_input = undefined;

      const result = mem0MemoryInject(input);

      expect(result.continue).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Output contains CLI script instructions
  // -----------------------------------------------------------------------

  describe('mem0 CLI search instructions', () => {
    test('output includes CLI script path', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'backend-system-architect' },
      });

      const result = mem0MemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('search-memories.py');
      expect(ctx).toContain('python3');
    });

    test('output includes agent-specific, decisions, and global search sections', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'security-auditor' },
      });

      const result = mem0MemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('Agent-Specific Patterns');
      expect(ctx).toContain('Project Decisions');
      expect(ctx).toContain('Cross-Project Best Practices');
    });

    test('output includes correct agent ID in footer', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'test-generator' },
      });

      const result = mem0MemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('Agent ID: ork:test-generator');
    });

    test('output includes domain keywords in search query', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'frontend-ui-developer' },
      });

      const result = mem0MemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('React frontend UI component TypeScript Tailwind');
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
      'produces mem0 context with domain keywords for %s',
      (agentType) => {
        vi.stubEnv('MEM0_API_KEY', 'test-api-key');

        const input = makeInput({
          tool_input: { subagent_type: agentType },
        });

        const result = mem0MemoryInject(input);

        expect(result.continue).toBe(true);
        expect(result.hookSpecificOutput).toBeDefined();
        expect(result.hookSpecificOutput!.additionalContext).toContain(agentType);
        expect(result.hookSpecificOutput!.additionalContext).toContain(
          'search-memories.py',
        );
      },
    );
  });

  // -----------------------------------------------------------------------
  // RELATED_AGENTS cross-agent federation
  // -----------------------------------------------------------------------

  describe('RELATED_AGENTS cross-agent federation', () => {
    test('includes cross-agent section for agents with related agents', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'database-engineer' },
      });

      const result = mem0MemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('Cross-Agent Knowledge');
      expect(ctx).toContain('backend-system-architect');
      expect(ctx).toContain('security-auditor');
      expect(ctx).toContain('data-pipeline-engineer');
    });

    test('cross-agent section includes related agent names', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'backend-system-architect' },
      });

      const result = mem0MemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      // The cross-agent section lists related agents in header and footer
      expect(ctx).toContain('Related: database-engineer');
      expect(ctx).toContain('frontend-ui-developer');
      expect(ctx).toContain('security-auditor');
      expect(ctx).toContain('llm-integrator');
    });

    test('frontend-ui-developer includes rapid-ui-designer in related agents', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'frontend-ui-developer' },
      });

      const result = mem0MemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('rapid-ui-designer');
    });

    test('agent without related agents shows "Related: none"', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'product-strategist' },
      });

      const result = mem0MemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      // product-strategist is not in RELATED_AGENTS mapping
      expect(ctx).toContain('Related: none');
      expect(ctx).not.toContain('Cross-Agent Knowledge');
    });

    test('agents with relations listed in footer of context', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'test-generator' },
      });

      const result = mem0MemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain(
        'Related: backend-system-architect, frontend-ui-developer, code-quality-reviewer',
      );
    });
  });

  // -----------------------------------------------------------------------
  // Fallback: type field
  // -----------------------------------------------------------------------

  describe('agent type detection via type field', () => {
    test('falls back to type field when subagent_type is absent', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { type: 'workflow-architect' },
      });

      const result = mem0MemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toContain('workflow-architect');
    });
  });

  // -----------------------------------------------------------------------
  // Fallback: prompt extraction
  // -----------------------------------------------------------------------

  describe('agent type detection via prompt fallback', () => {
    test('extracts agent type from prompt when subagent_type and type are missing', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: {
          prompt: 'Spin up the llm-integrator to handle embeddings',
        },
      });

      const result = mem0MemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toContain('llm-integrator');
    });

    test('returns silent success when prompt does not contain known agent', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: {
          prompt: 'Just do something with no agent mention',
        },
      });

      const result = mem0MemoryInject(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Output structure
  // -----------------------------------------------------------------------

  describe('output structure', () => {
    test('result has correct HookResult shape', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'database-engineer' },
      });

      const result = mem0MemoryInject(input);

      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('systemMessage');
      expect(result).toHaveProperty('hookSpecificOutput');
      expect(result.hookSpecificOutput).toHaveProperty('additionalContext');
    });

    test('systemMessage includes agent type, ID, and related agents', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'database-engineer' },
      });

      const result = mem0MemoryInject(input);

      expect(result.systemMessage).toContain('database-engineer');
      expect(result.systemMessage).toContain('ork:database-engineer');
      expect(result.systemMessage).toContain('[Mem0 Cloud]');
    });

    test('additionalContext includes integration instructions', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'ci-cd-engineer' },
      });

      const result = mem0MemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('Integration Instructions');
      expect(ctx).toContain('Execute the above CLI scripts');
      expect(ctx).toContain('Avoid known anti-patterns');
    });

    test('additionalContext contains Mem0 Cloud header', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'metrics-architect' },
      });

      const result = mem0MemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('[Mem0 Cloud - Agent Context Load]');
    });

    test('CLI script includes --enable-graph flag', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'database-engineer' },
      });

      const result = mem0MemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('--enable-graph');
    });

    test('CLI script includes --limit 5 flag', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'database-engineer' },
      });

      const result = mem0MemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('--limit 5');
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles null tool_input fields without throwing', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: null as any, type: null as any },
      });

      const result = mem0MemoryInject(input);
      expect(result.continue).toBe(true);
    });

    test('prefers subagent_type over type when both present', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: {
          subagent_type: 'database-engineer',
          type: 'security-auditor',
        },
      });

      const result = mem0MemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('database-engineer');
      expect(ctx).toContain('ork:database-engineer');
    });

    test('unknown agent type uses agent name as domain fallback', () => {
      vi.stubEnv('MEM0_API_KEY', 'test-api-key');

      const input = makeInput({
        tool_input: { subagent_type: 'custom-unknown-agent' },
      });

      const result = mem0MemoryInject(input);
      const ctx = result.hookSpecificOutput!.additionalContext!;

      expect(ctx).toContain('custom-unknown-agent');
      expect(ctx).toContain('Domain: custom-unknown-agent');
      expect(ctx).toContain('Related: none');
    });
  });
});

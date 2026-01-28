/**
 * Agent Memory Store - SubagentStop Hook Test Suite
 *
 * Tests the agent-memory-store hook which extracts and stores
 * successful patterns after agent completion. Writes patterns
 * to a JSONL log file with category detection and mem0 metadata.
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
  statSync: vi.fn().mockReturnValue({ size: 500 }),
  renameSync: vi.fn(),
  readSync: vi.fn().mockReturnValue(0),
  unlinkSync: vi.fn(),
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
import { agentMemoryStore } from '../../subagent-stop/agent-memory-store.js';
import { appendFileSync, mkdirSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal HookInput for SubagentStop */
function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'test-session-ams',
    tool_input: {},
    ...overrides,
  };
}

/** Long output with a decision pattern (>50 chars, pattern line >20 chars) */
function makeOutputWithPattern(pattern: string, padding = ''): string {
  return `${padding}The agent analyzed the codebase and ${pattern} for the implementation. This approach ensures maintainability and scalability across the project.`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('agentMemoryStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set project dir for predictable paths
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
  });

  // -----------------------------------------------------------------------
  // Guard: no agent type
  // -----------------------------------------------------------------------

  describe('guard: no agent type', () => {
    test('returns silent success when no subagent_type or type', () => {
      const input = makeInput({ tool_input: {} });

      const result = agentMemoryStore(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for empty string subagent_type', () => {
      const input = makeInput({
        subagent_type: '',
        tool_input: { subagent_type: '' },
      });

      const result = agentMemoryStore(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles undefined tool_input gracefully', () => {
      const input = makeInput();
      (input as any).tool_input = undefined;

      const result = agentMemoryStore(input);

      expect(result.continue).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Guard: error/failure
  // -----------------------------------------------------------------------

  describe('guard: error/failure', () => {
    test('returns silent success when input.error is set (no patterns extracted)', () => {
      const input = makeInput({
        subagent_type: 'test-generator',
        error: 'Agent failed with timeout',
        tool_result: makeOutputWithPattern('decided to use vitest'),
      });

      const result = agentMemoryStore(input);

      // When error is set, success=false, so no patterns are extracted
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Pattern extraction
  // -----------------------------------------------------------------------

  describe('pattern extraction', () => {
    test('extracts "decided to" from output', () => {
      const input = makeInput({
        subagent_type: 'database-engineer',
        tool_result: makeOutputWithPattern('decided to use PostgreSQL with connection pooling'),
      });

      const result = agentMemoryStore(input);

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Pattern Extraction');
      expect(result.systemMessage).toContain('database-engineer');
      expect(appendFileSync).toHaveBeenCalled();
    });

    test('extracts "implemented using" from output', () => {
      const input = makeInput({
        subagent_type: 'backend-system-architect',
        tool_result: makeOutputWithPattern('implemented using the repository pattern for data access'),
      });

      const result = agentMemoryStore(input);

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Pattern Extraction');
    });

    test('returns silent success for no patterns found', () => {
      const input = makeInput({
        subagent_type: 'test-generator',
        tool_result: 'This is a long output that does not contain any recognized decision pattern keywords in it whatsoever.',
      });

      const result = agentMemoryStore(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips short output (< 50 chars)', () => {
      const input = makeInput({
        subagent_type: 'test-generator',
        tool_result: 'decided to use vitest',
      });

      const result = agentMemoryStore(input);

      // Output <50 chars → extractPatterns returns []
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('extracts multiple patterns from output', () => {
      const longOutput = [
        'The team decided to use TypeScript for type safety across the entire codebase.',
        'After analysis, they selected PostgreSQL as the primary database engine.',
        'The architecture opted for microservices with event-driven communication.',
        'Some filler text to ensure the output is long enough for processing.',
      ].join('\n');

      const input = makeInput({
        subagent_type: 'backend-system-architect',
        tool_result: longOutput,
      });

      const result = agentMemoryStore(input);

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Pattern Extraction');
      // Multiple patterns extracted → multiple appendFileSync calls
      const appendCalls = (appendFileSync as ReturnType<typeof vi.fn>).mock.calls;
      expect(appendCalls.length).toBeGreaterThanOrEqual(2);
    });

    test('deduplicates identical patterns', () => {
      const longOutput = [
        'The team decided to use TypeScript for the entire project.',
        'The team decided to use TypeScript for the entire project.',
        'Some additional filler to exceed the minimum length requirement.',
      ].join('\n');

      const input = makeInput({
        subagent_type: 'test-generator',
        tool_result: longOutput,
      });

      const result = agentMemoryStore(input);

      expect(result.continue).toBe(true);
      // Should deduplicate, so only 1 pattern written
      const appendCalls = (appendFileSync as ReturnType<typeof vi.fn>).mock.calls;
      expect(appendCalls.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Pattern categorization
  // -----------------------------------------------------------------------

  describe('pattern categorization via appendFileSync', () => {
    test('security: "vulnerability" -> category=security', () => {
      const input = makeInput({
        subagent_type: 'security-auditor',
        tool_result: 'After thorough analysis, the team decided to fix the SQL injection vulnerability in the authentication module with proper parameterized queries.',
      });

      const result = agentMemoryStore(input);

      expect(result.continue).toBe(true);
      const appendCalls = (appendFileSync as ReturnType<typeof vi.fn>).mock.calls;
      expect(appendCalls.length).toBeGreaterThanOrEqual(1);
      const entry = JSON.parse(appendCalls[0][1].toString().trim());
      expect(entry.category).toBe('security');
    });

    test('database: "postgres" -> category=database', () => {
      const input = makeInput({
        subagent_type: 'database-engineer',
        tool_result: 'The implementation chose postgres with pgvector extension for vector similarity search across the document embeddings store.',
      });

      const result = agentMemoryStore(input);

      const appendCalls = (appendFileSync as ReturnType<typeof vi.fn>).mock.calls;
      expect(appendCalls.length).toBeGreaterThanOrEqual(1);
      const entry = JSON.parse(appendCalls[0][1].toString().trim());
      expect(entry.category).toBe('database');
    });

    test('api: "endpoint" -> category=api', () => {
      const input = makeInput({
        subagent_type: 'backend-system-architect',
        tool_result: 'The system decided to use REST endpoint versioning with path-based routing to maintain backward compatibility.',
      });

      const result = agentMemoryStore(input);

      const appendCalls = (appendFileSync as ReturnType<typeof vi.fn>).mock.calls;
      expect(appendCalls.length).toBeGreaterThanOrEqual(1);
      const entry = JSON.parse(appendCalls[0][1].toString().trim());
      expect(entry.category).toBe('api');
    });

    test('testing: "vitest" -> category=testing', () => {
      const input = makeInput({
        subagent_type: 'test-generator',
        tool_result: 'The project decided to adopt vitest as the primary test runner with built-in coverage and snapshot testing support.',
      });

      const result = agentMemoryStore(input);

      const appendCalls = (appendFileSync as ReturnType<typeof vi.fn>).mock.calls;
      expect(appendCalls.length).toBeGreaterThanOrEqual(1);
      const entry = JSON.parse(appendCalls[0][1].toString().trim());
      expect(entry.category).toBe('testing');
    });

    test('decision: "decided" -> category=decision (not deployment) with \\b fix', () => {
      // With word-boundary fix, "decided" no longer matches /\bcd\b/
      const input = makeInput({
        subagent_type: 'workflow-architect',
        tool_result: 'After the full review, the team decided to use a straightforward simple method for all processing workloads.',
      });

      agentMemoryStore(input);

      const appendCalls = (appendFileSync as ReturnType<typeof vi.fn>).mock.calls;
      expect(appendCalls.length).toBeGreaterThanOrEqual(1);
      const entry = JSON.parse(appendCalls[0][1].toString().trim());
      expect(entry.category).toBe('decision');
    });
  });

  // -----------------------------------------------------------------------
  // tool_result union type
  // -----------------------------------------------------------------------

  describe('tool_result union type', () => {
    test('string tool_result -> uses directly', () => {
      const input = makeInput({
        subagent_type: 'database-engineer',
        tool_result: makeOutputWithPattern('decided to normalize the schema'),
      });

      const result = agentMemoryStore(input);

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Pattern Extraction');
    });

    test('object { content } -> extracts content', () => {
      const input = makeInput({
        subagent_type: 'database-engineer',
        tool_result: {
          content: makeOutputWithPattern('decided to use connection pooling'),
        },
      });

      const result = agentMemoryStore(input);

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Pattern Extraction');
    });

    test('undefined tool_result -> falls back to agent_output', () => {
      const input = makeInput({
        subagent_type: 'database-engineer',
        agent_output: makeOutputWithPattern('decided to implement sharding'),
      });

      const result = agentMemoryStore(input);

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Pattern Extraction');
    });

    test('undefined tool_result and agent_output -> falls back to output', () => {
      const input = makeInput({
        subagent_type: 'database-engineer',
        output: makeOutputWithPattern('decided to add read replicas'),
      });

      const result = agentMemoryStore(input);

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Pattern Extraction');
    });

    test('all output fields empty -> silent success (no patterns)', () => {
      const input = makeInput({
        subagent_type: 'database-engineer',
      });

      const result = agentMemoryStore(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Output structure
  // -----------------------------------------------------------------------

  describe('output structure', () => {
    test('systemMessage includes pattern count', () => {
      const input = makeInput({
        subagent_type: 'test-generator',
        tool_result: makeOutputWithPattern('decided to use snapshot testing'),
      });

      const result = agentMemoryStore(input);

      expect(result.systemMessage).toMatch(/\d+ patterns? extracted/);
    });

    test('systemMessage includes agent type', () => {
      const input = makeInput({
        subagent_type: 'frontend-ui-developer',
        tool_result: makeOutputWithPattern('decided to use React Server Components'),
      });

      const result = agentMemoryStore(input);

      expect(result.systemMessage).toContain('frontend-ui-developer');
    });

    test('systemMessage includes mem0 user_id suggestion', () => {
      const input = makeInput({
        subagent_type: 'ci-cd-engineer',
        tool_result: makeOutputWithPattern('decided to use GitHub Actions for CI'),
      });

      const result = agentMemoryStore(input);

      expect(result.systemMessage).toContain('mcp__mem0__add_memory');
      expect(result.systemMessage).toContain('decisions');
    });

    test('continue is always true', () => {
      // With patterns
      const input1 = makeInput({
        subagent_type: 'database-engineer',
        tool_result: makeOutputWithPattern('decided to use indexes'),
      });
      expect(agentMemoryStore(input1).continue).toBe(true);

      // Without patterns (silent success)
      const input2 = makeInput({ tool_input: {} });
      expect(agentMemoryStore(input2).continue).toBe(true);

      // With error
      const input3 = makeInput({
        subagent_type: 'test-generator',
        error: 'timeout',
      });
      expect(agentMemoryStore(input3).continue).toBe(true);
    });

    test('JSONL entry includes required fields', () => {
      const input = makeInput({
        subagent_type: 'security-auditor',
        tool_result: 'The security review decided to implement rate limiting across all public API endpoints to prevent abuse.',
      });

      agentMemoryStore(input);

      const appendCalls = (appendFileSync as ReturnType<typeof vi.fn>).mock.calls;
      expect(appendCalls.length).toBeGreaterThanOrEqual(1);

      const entry = JSON.parse(appendCalls[0][1].toString().trim());
      expect(entry).toHaveProperty('agent', 'security-auditor');
      expect(entry).toHaveProperty('agent_id', 'ork:security-auditor');
      expect(entry).toHaveProperty('pattern');
      expect(entry).toHaveProperty('project');
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('category');
      expect(entry).toHaveProperty('enable_graph', true);
      expect(entry).toHaveProperty('pending_sync', true);
    });

    test('mkdirSync is called for log directory', () => {
      const input = makeInput({
        subagent_type: 'test-generator',
        tool_result: makeOutputWithPattern('decided to organize tests by feature'),
      });

      agentMemoryStore(input);

      expect(mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.claude/logs'),
        { recursive: true },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    test('reads subagent_type from input.subagent_type first', () => {
      const input = makeInput({
        subagent_type: 'database-engineer',
        tool_input: { subagent_type: 'security-auditor' },
        tool_result: makeOutputWithPattern('decided to use PostgreSQL'),
      });

      const result = agentMemoryStore(input);

      expect(result.systemMessage).toContain('database-engineer');
    });

    test('falls back to tool_input.subagent_type', () => {
      const input = makeInput({
        tool_input: { subagent_type: 'security-auditor' },
        tool_result: makeOutputWithPattern('decided to add input validation'),
      });

      const result = agentMemoryStore(input);

      expect(result.systemMessage).toContain('security-auditor');
    });

    test('falls back to tool_input.type', () => {
      const input = makeInput({
        tool_input: { type: 'workflow-architect' },
        tool_result: makeOutputWithPattern('decided to use event sourcing'),
      });

      const result = agentMemoryStore(input);

      expect(result.systemMessage).toContain('workflow-architect');
    });
  });
});

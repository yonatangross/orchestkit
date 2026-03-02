/**
 * Agent Memory Store - SubagentStop Hook Test Suite
 *
 * Tests pattern extraction after agent completion. Patterns surfaced via
 * systemMessage for graph storage. v7: JSONL writes removed (#919).
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  unlinkSync: vi.fn(),
}));

vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  logHook: vi.fn(),
  getProjectDir: vi.fn(() => process.env.CLAUDE_PROJECT_DIR || '/test/project'),
  lineContainsAll: vi.fn((content: string, ...terms: string[]) =>
    terms.every(t => content.includes(t))
  ),
}));

import { agentMemoryStore } from '../../subagent-stop/agent-memory-store.js';
import { existsSync, unlinkSync } from 'node:fs';
import { logHook } from '../../lib/common.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return { tool_name: 'Task', session_id: 'test-session-ams', tool_input: {}, ...overrides };
}

function makeOutputWithPattern(pattern: string): string {
  return `The agent analyzed the codebase and ${pattern} for the implementation. This approach ensures maintainability and scalability across the project.`;
}

/** Extract category from first "Extracted pattern" logHook call */
function extractCategory(toolResult: string): string {
  vi.clearAllMocks();
  agentMemoryStore(makeInput({ subagent_type: 'test-agent', tool_result: toolResult }));
  const calls = (logHook as ReturnType<typeof vi.fn>).mock.calls;
  const hit = calls.find((c: unknown[]) => String(c[1]).includes('Extracted pattern'));
  if (!hit) return '__no_pattern__';
  const m = String(hit[1]).match(/Extracted pattern \(([^)]+)\)/);
  return m ? m[1] : '__no_pattern__';
}

/** Count patterns extracted (via logHook) */
function patternsExtracted(toolResult: string): number {
  vi.clearAllMocks();
  agentMemoryStore(makeInput({ subagent_type: 'test-agent', tool_result: toolResult }));
  return (logHook as ReturnType<typeof vi.fn>).mock.calls
    .filter((c: unknown[]) => String(c[1]).includes('Extracted pattern')).length;
}

describe('agentMemoryStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
  });

  // -- Guards -------------------------------------------------------------

  describe('guard: no agent type', () => {
    test('returns silent success when no subagent_type or type', () => {
      const result = agentMemoryStore(makeInput({ tool_input: {} }));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for empty string subagent_type', () => {
      const result = agentMemoryStore(makeInput({ subagent_type: '', tool_input: { subagent_type: '' } }));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles undefined tool_input gracefully', () => {
      const input = makeInput();
      (input as any).tool_input = undefined;
      expect(agentMemoryStore(input).continue).toBe(true);
    });
  });

  describe('guard: error/failure', () => {
    test('returns silent success when input.error is set', () => {
      const result = agentMemoryStore(makeInput({
        subagent_type: 'test-generator',
        error: 'Agent failed with timeout',
        tool_result: makeOutputWithPattern('decided to use vitest'),
      }));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -- Pattern extraction -------------------------------------------------

  describe('pattern extraction', () => {
    test('extracts "decided to" from output', () => {
      const result = agentMemoryStore(makeInput({
        subagent_type: 'database-engineer',
        tool_result: makeOutputWithPattern('decided to use PostgreSQL with connection pooling'),
      }));
      expect(result.systemMessage).toContain('Pattern Extraction');
      expect(result.systemMessage).toContain('database-engineer');
    });

    test('extracts "implemented using" from output', () => {
      const result = agentMemoryStore(makeInput({
        subagent_type: 'backend-system-architect',
        tool_result: makeOutputWithPattern('implemented using the repository pattern for data access'),
      }));
      expect(result.systemMessage).toContain('Pattern Extraction');
    });

    test('returns silent success for no patterns found', () => {
      const result = agentMemoryStore(makeInput({
        subagent_type: 'test-generator',
        tool_result: 'This is a long output that does not contain any recognized decision pattern keywords in it whatsoever.',
      }));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips short output (< 50 chars)', () => {
      const result = agentMemoryStore(makeInput({
        subagent_type: 'test-generator',
        tool_result: 'decided to use vitest',
      }));
      expect(result.suppressOutput).toBe(true);
    });

    test('extracts multiple patterns from output', () => {
      agentMemoryStore(makeInput({
        subagent_type: 'backend-system-architect',
        tool_result: [
          'The team decided to use TypeScript for type safety across the entire codebase.',
          'After analysis, they selected PostgreSQL as the primary database engine.',
          'The architecture opted for microservices with event-driven communication.',
          'Some filler text to ensure the output is long enough for processing.',
        ].join('\n'),
      }));
      const patternCalls = (logHook as ReturnType<typeof vi.fn>).mock.calls
        .filter((c: unknown[]) => String(c[1]).includes('Extracted pattern'));
      expect(patternCalls.length).toBeGreaterThanOrEqual(2);
    });

    test('deduplicates identical patterns', () => {
      agentMemoryStore(makeInput({
        subagent_type: 'test-generator',
        tool_result: [
          'The team decided to use TypeScript for the entire project.',
          'The team decided to use TypeScript for the entire project.',
          'Some additional filler to exceed the minimum length requirement.',
        ].join('\n'),
      }));
      const patternCalls = (logHook as ReturnType<typeof vi.fn>).mock.calls
        .filter((c: unknown[]) => String(c[1]).includes('Extracted pattern'));
      expect(patternCalls.length).toBe(1);
    });
  });

  // -- Categorization (all 14 + default) ----------------------------------

  describe('pattern categorization', () => {
    test.each([
      ['pagination', 'The team decided to use cursor pagination for the user listing endpoint to handle large result sets.'],
      ['security', 'The team decided to fix the XSS vulnerability by adding proper output encoding to all user-facing fields.'],
      ['database', 'The team decided to use postgres with connection pooling for better throughput on read-heavy workloads.'],
      ['api', 'The team decided to expose a new endpoint for health checks alongside the existing GraphQL gateway.'],
      ['authentication', 'The team decided to use JWT auth with short-lived tokens and refresh rotation for the login flow.'],
      ['testing', 'The team decided to use vitest for running the full coverage suite on every pull request automatically.'],
      ['deployment', 'The team decided to deploy with docker containers orchestrated by kubernetes in the production cluster.'],
      ['observability', 'The team decided to add prometheus metrics and grafana dashboards for real-time monitoring of latency.'],
      ['frontend', 'The team decided to build the dashboard component using react with server-side rendering for speed.'],
      ['performance', 'The team decided to add a cache layer with optimization for the hot-path read queries on the homepage.'],
      ['ai-ml', 'The team decided to use embedding vectors with openai for semantic search across the knowledge base.'],
      ['data-pipeline', 'The team decided to build an etl job with spark for batch processing of daily transaction data.'],
      ['architecture', 'The team decided to restructure into a hexagonal architecture design for better separation of concerns.'],
      ['decision', 'After the full review the team chose a straightforward method for handling the workload going forward.'],
    ])('%s category detected correctly', (expectedCategory, toolResult) => {
      expect(extractCategory(toolResult)).toBe(expectedCategory);
    });

    test('default "pattern" category when no keywords match', () => {
      expect(extractCategory(
        'The group opted for a brand new method of organizing the weekly reports for the management board.',
      )).toBe('pattern');
    });

    test('word boundaries prevent false positives from substrings', () => {
      expect(extractCategory(
        'After the full review, the team decided to use a straightforward simple method for all processing workloads.',
      )).toBe('decision');
    });
  });

  // -- All 13 DECISION_PATTERNS -------------------------------------------

  describe('DECISION_PATTERNS — all 13 triggers', () => {
    test.each([
      ['decided to', 'The engineering group decided to adopt a new branching strategy for the monorepo going forward.'],
      ['chose', 'After evaluation the engineering group chose the newer framework for building the web application.'],
      ['implemented using', 'The feature was implemented using the observer pattern to decouple the event handlers from the core.'],
      ['selected', 'The engineering group selected a hybrid approach for storing both structured and unstructured data.'],
      ['opted for', 'The engineering group opted for lazy loading to reduce the initial bundle payload on slow networks.'],
      ['will use', 'Going forward the engineering group will use conventional commits to generate changelogs every release.'],
      ['pattern:', 'The review surfaced a key finding. pattern: use retry with exponential backoff on transient network faults.'],
      ['approach:', 'The review surfaced a key finding. approach: split the monolith into bounded contexts over the next quarter.'],
      ['architecture:', 'The review surfaced a key finding. architecture: hexagonal with ports and adapters for the new payment flow.'],
      ['recommends', 'The senior engineer recommends adding integration tests for every external service boundary in the system.'],
      ['best practice', 'Following best practice the team added structured logging with correlation headers to every outbound request.'],
      ['anti-pattern', 'The review flagged an anti-pattern where the controller directly queries the database bypassing the service.'],
      ['learned that', 'The team learned that connection pool exhaustion happens under load when transactions hold locks too long.'],
    ])('extracts pattern for "%s"', (_name, toolResult) => {
      expect(patternsExtracted(toolResult)).toBeGreaterThanOrEqual(1);
    });
  });

  // -- Limits and edge cases ----------------------------------------------

  describe('extractPatterns limits', () => {
    test('limits to max 5 unique patterns', () => {
      agentMemoryStore(makeInput({
        subagent_type: 'backend-system-architect',
        tool_result: [
          'Line 1: The team decided to use TypeScript for the entire codebase going forward.',
          'Line 2: The team chose PostgreSQL as the primary relational database engine for the project.',
          'Line 3: The feature was implemented using the repository pattern for all data access operations.',
          'Line 4: The team selected Redis as the caching layer for session management across all services.',
          'Line 5: The team opted for server-side rendering to improve initial page load for end users.',
          'Line 6: Going forward the team will use feature flags to control rollout of every new feature.',
          'Line 7: The review surfaced pattern: always validate input at the boundary of the system first.',
        ].join('\n'),
      }));
      const patternCalls = (logHook as ReturnType<typeof vi.fn>).mock.calls
        .filter((c: unknown[]) => String(c[1]).includes('Extracted pattern'));
      expect(patternCalls.length).toBeLessThanOrEqual(5);
    });

    test('filters out patterns shorter than 20 chars', () => {
      agentMemoryStore(makeInput({
        subagent_type: 'test-agent',
        tool_result: 'chose X.\nSome padding to make the total output exceed the 50-character minimum length requirement for extraction.',
      }));
      const patternCalls = (logHook as ReturnType<typeof vi.fn>).mock.calls
        .filter((c: unknown[]) => String(c[1]).includes('Extracted pattern'));
      expect(patternCalls.length).toBe(0);
    });

    test('extractPatterns works on output beyond 10240 chars', () => {
      const padding = 'Some filler text that does not contain any patterns.\n'.repeat(250);
      const lateLine = 'The team decided to refactor the entire codebase for better readability and long-term health.';
      const toolResult = padding + lateLine;
      expect(toolResult.length).toBeGreaterThan(10240);
      vi.clearAllMocks();
      agentMemoryStore(makeInput({ subagent_type: 'test-agent', tool_result: toolResult }));
      const patternCalls = (logHook as ReturnType<typeof vi.fn>).mock.calls
        .filter((c: unknown[]) => String(c[1]).includes('Extracted pattern'));
      expect(patternCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -- tool_result union type ---------------------------------------------

  describe('tool_result union type', () => {
    test('string tool_result -> uses directly', () => {
      const result = agentMemoryStore(makeInput({
        subagent_type: 'database-engineer',
        tool_result: makeOutputWithPattern('decided to normalize the schema'),
      }));
      expect(result.systemMessage).toContain('Pattern Extraction');
    });

    test('object { content } -> extracts content', () => {
      const result = agentMemoryStore(makeInput({
        subagent_type: 'database-engineer',
        tool_result: { content: makeOutputWithPattern('decided to use connection pooling') },
      }));
      expect(result.systemMessage).toContain('Pattern Extraction');
    });

    test('falls back to agent_output then output field', () => {
      const r1 = agentMemoryStore(makeInput({
        subagent_type: 'database-engineer',
        agent_output: makeOutputWithPattern('decided to implement sharding'),
      }));
      expect(r1.systemMessage).toContain('Pattern Extraction');

      vi.clearAllMocks();
      const r2 = agentMemoryStore(makeInput({
        subagent_type: 'database-engineer',
        output: makeOutputWithPattern('decided to add read replicas'),
      }));
      expect(r2.systemMessage).toContain('Pattern Extraction');
    });

    test('all output fields empty -> silent success', () => {
      const result = agentMemoryStore(makeInput({ subagent_type: 'database-engineer' }));
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -- Output structure ---------------------------------------------------

  describe('output structure', () => {
    test('systemMessage includes pattern count and agent type', () => {
      const result = agentMemoryStore(makeInput({
        subagent_type: 'frontend-ui-developer',
        tool_result: makeOutputWithPattern('decided to use React Server Components'),
      }));
      expect(result.systemMessage).toMatch(/\d+ patterns? extracted/);
      expect(result.systemMessage).toContain('frontend-ui-developer');
    });

    test('systemMessage includes mcp__memory__create_entities suggestion', () => {
      const result = agentMemoryStore(makeInput({
        subagent_type: 'ci-cd-engineer',
        tool_result: makeOutputWithPattern('decided to use GitHub Actions for CI'),
      }));
      expect(result.systemMessage).toContain('mcp__memory__create_entities');
      expect(result.systemMessage).toContain('Pattern');
    });

    test('continue is always true', () => {
      expect(agentMemoryStore(makeInput({
        subagent_type: 'db-eng', tool_result: makeOutputWithPattern('decided to use indexes'),
      })).continue).toBe(true);
      expect(agentMemoryStore(makeInput({ tool_input: {} })).continue).toBe(true);
      expect(agentMemoryStore(makeInput({ subagent_type: 'x', error: 'timeout' })).continue).toBe(true);
    });
  });

  // -- Edge cases ---------------------------------------------------------

  describe('edge cases', () => {
    test('reads subagent_type from input.subagent_type first', () => {
      const result = agentMemoryStore(makeInput({
        subagent_type: 'database-engineer',
        tool_input: { subagent_type: 'security-auditor' },
        tool_result: makeOutputWithPattern('decided to use PostgreSQL'),
      }));
      expect(result.systemMessage).toContain('database-engineer');
    });

    test('falls back to tool_input.subagent_type then tool_input.type', () => {
      const r1 = agentMemoryStore(makeInput({
        tool_input: { subagent_type: 'security-auditor' },
        tool_result: makeOutputWithPattern('decided to add input validation'),
      }));
      expect(r1.systemMessage).toContain('security-auditor');

      vi.clearAllMocks();
      const r2 = agentMemoryStore(makeInput({
        tool_input: { type: 'workflow-architect' },
        tool_result: makeOutputWithPattern('decided to use event sourcing'),
      }));
      expect(r2.systemMessage).toContain('workflow-architect');
    });
  });

  // -- P3.1: is_error field -----------------------------------------------

  describe('tool_result is_error field (P3.1)', () => {
    test('skips extraction when is_error: true', () => {
      const result = agentMemoryStore(makeInput({
        subagent_type: 'database-engineer',
        tool_result: { is_error: true, content: makeOutputWithPattern('decided to use PostgreSQL') },
      }));
      expect(result.suppressOutput).toBe(true);
    });

    test('extracts normally when is_error: false', () => {
      const result = agentMemoryStore(makeInput({
        subagent_type: 'database-engineer',
        tool_result: { is_error: false, content: makeOutputWithPattern('decided to use connection pooling') },
      }));
      expect(result.systemMessage).toContain('Pattern Extraction');
    });

    test('is_error takes precedence even without input.error', () => {
      const result = agentMemoryStore(makeInput({
        subagent_type: 'test-generator',
        tool_result: { is_error: true, content: makeOutputWithPattern('decided to retry') },
      }));
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -- P3.2: unlinkSync cleanup ------------------------------------------

  describe('unlinkSync tracking file cleanup (P3.2)', () => {
    test('deletes tracking file when it exists', () => {
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) =>
        typeof p === 'string' && p.includes('current-agent-id'));
      agentMemoryStore(makeInput({
        subagent_type: 'test-generator',
        tool_result: makeOutputWithPattern('decided to organize tests by domain'),
      }));
      expect(unlinkSync).toHaveBeenCalledWith(expect.stringContaining('current-agent-id'));
    });

    test('handles unlinkSync ENOENT without crash', () => {
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) =>
        typeof p === 'string' && p.includes('current-agent-id'));
      (unlinkSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      });
      const result = agentMemoryStore(makeInput({
        subagent_type: 'test-generator',
        tool_result: makeOutputWithPattern('decided to add snapshot tests'),
      }));
      expect(result.continue).toBe(true);
    });
  });
});

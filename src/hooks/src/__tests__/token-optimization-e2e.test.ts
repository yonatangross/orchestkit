/**
 * End-to-end tests for Memory System Token Optimization
 *
 * Simulates complete hook execution flows:
 * 1. Graph memory inject with empty/populated graph
 * 2. Skill resolver tiered injection flow
 * 3. Budget enforcement suppressing content
 * 4. Full session lifecycle (multiple prompts, subagent spawns)
 *
 * Uses real filesystem and real hook implementations.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { graphMemoryInject } from '../subagent-start/graph-memory-inject.js';
import { estimateTokenCount, outputPromptContextBudgeted } from '../lib/common.js';
import { trackTokenUsage, getCategoryUsage, getTotalUsage, getTokenState } from '../lib/token-tracker.js';
import { TOKEN_BUDGETS, shouldThrottle, isPriorityThrottlingEnabled, isOverBudget } from '../lib/hook-priorities.js';
import type { HookInput } from '../types.js';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = '/tmp/token-opt-e2e-test';
const TEST_SESSION_ID = 'e2e-test-' + Date.now();

function makeSubagentInput(agentType: string): HookInput {
  return {
    tool_name: 'Task',
    session_id: TEST_SESSION_ID,
    tool_input: { subagent_type: agentType },
  };
}

function makePromptInput(prompt: string): HookInput {
  return {
    hook_event: 'UserPromptSubmit',
    tool_name: 'UserPromptSubmit',
    session_id: TEST_SESSION_ID,
    project_dir: TEST_PROJECT_DIR,
    tool_input: {},
    prompt,
  };
}

beforeEach(() => {
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;
  process.env.CLAUDE_SESSION_ID = TEST_SESSION_ID;

  mkdirSync(join(TEST_PROJECT_DIR, '.claude/orchestration'), { recursive: true });
  mkdirSync(join(TEST_PROJECT_DIR, '.claude/memory'), { recursive: true });
});

afterEach(() => {
  try {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup
  }
  delete process.env.CLAUDE_PROJECT_DIR;
  delete process.env.CLAUDE_SESSION_ID;
});

// =============================================================================
// E2E: Graph Memory Inject
// =============================================================================

describe('E2E: Graph Memory Inject', () => {
  test('skips injection when no graph file exists', () => {
    const input = makeSubagentInput('database-engineer');
    const result = graphMemoryInject(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  test('skips injection when graph file is empty', () => {
    const graphFile = join(TEST_PROJECT_DIR, '.claude/memory/knowledge-graph.jsonl');
    writeFileSync(graphFile, '');

    const input = makeSubagentInput('database-engineer');
    const result = graphMemoryInject(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('skips injection when graph file is too small (<100 bytes)', () => {
    const graphFile = join(TEST_PROJECT_DIR, '.claude/memory/knowledge-graph.jsonl');
    writeFileSync(graphFile, '{"name":"test"}'); // ~15 bytes

    const input = makeSubagentInput('database-engineer');
    const result = graphMemoryInject(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('injects context when graph has sufficient data', () => {
    const graphFile = join(TEST_PROJECT_DIR, '.claude/memory/knowledge-graph.jsonl');
    // Write enough data to exceed MIN_GRAPH_SIZE (100 bytes)
    const entities = Array.from({ length: 5 }, (_, i) =>
      JSON.stringify({ name: `entity-${i}`, type: 'decision', content: `Decision about architecture pattern ${i}` })
    ).join('\n');
    writeFileSync(graphFile, entities);

    const input = makeSubagentInput('database-engineer');
    const result = graphMemoryInject(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput).toBeDefined();
    expect(result.hookSpecificOutput!.additionalContext).toContain('database-engineer');
    expect(result.hookSpecificOutput!.additionalContext).toContain('mcp__memory__search_nodes');
    expect(result.systemMessage).toContain('database-engineer');
  });

  test('injects context for different agent types with correct domain keywords', () => {
    const graphFile = join(TEST_PROJECT_DIR, '.claude/memory/knowledge-graph.jsonl');
    writeFileSync(graphFile, 'x'.repeat(200)); // big enough

    const agents = ['security-auditor', 'frontend-ui-developer', 'test-generator'];
    const expectedDomains = [
      'security OWASP vulnerability audit authentication',
      'React frontend UI component TypeScript Tailwind',
      'testing unit integration coverage pytest MSW',
    ];

    for (let i = 0; i < agents.length; i++) {
      const result = graphMemoryInject(makeSubagentInput(agents[i]));
      expect(result.hookSpecificOutput!.additionalContext).toContain(expectedDomains[i]);
    }
  });

  test('handles missing agent type gracefully with populated graph', () => {
    const graphFile = join(TEST_PROJECT_DIR, '.claude/memory/knowledge-graph.jsonl');
    writeFileSync(graphFile, 'x'.repeat(200));

    const input: HookInput = {
      tool_name: 'Task',
      session_id: TEST_SESSION_ID,
      tool_input: {}, // no subagent_type
    };

    const result = graphMemoryInject(input);
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});

// =============================================================================
// E2E: Budgeted Output Helper
// =============================================================================

describe('E2E: Budgeted Output', () => {
  const budgetChecker = { isOverBudget };
  const tracker = { trackTokenUsage };

  test('outputPromptContextBudgeted allows content under budget', () => {
    const content = 'Some skill content for injection';
    const result = outputPromptContextBudgeted(content, 'test-hook', 'skill-injection', budgetChecker, tracker);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toBe(content);
  });

  test('outputPromptContextBudgeted tracks token usage', () => {
    const content = 'Skill content that should be tracked';
    outputPromptContextBudgeted(content, 'test-hook', 'skill-injection', budgetChecker, tracker);

    const tokens = estimateTokenCount(content);
    expect(getCategoryUsage('skill-injection')).toBe(tokens);
    expect(getTotalUsage()).toBe(tokens);
  });

  test('outputPromptContextBudgeted suppresses when over budget', () => {
    // Fill up skill-injection budget
    trackTokenUsage('filler', 'skill-injection', TOKEN_BUDGETS['skill-injection']);

    const content = 'This should be suppressed';
    const result = outputPromptContextBudgeted(content, 'test-hook', 'skill-injection', budgetChecker, tracker);

    // Should return silent success (suppressed)
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
  });
});

// =============================================================================
// E2E: Priority Throttling
// =============================================================================

describe('E2E: Priority Throttling', () => {
  test('disabled by default - no hooks throttled', () => {
    expect(isPriorityThrottlingEnabled()).toBe(false);

    // Even with high usage, nothing should throttle
    trackTokenUsage('filler', 'skill-injection', 5000);

    expect(shouldThrottle('posttool/context-budget-monitor')).toBe(false);
    expect(shouldThrottle('prompt/skill-resolver')).toBe(false);
  });

  test('enabling throttling via config file works', () => {
    const configFile = join(TEST_PROJECT_DIR, '.claude/orchestration/config.json');
    writeFileSync(configFile, JSON.stringify({ enablePriorityThrottling: true }));

    expect(isPriorityThrottlingEnabled()).toBe(true);
  });

  test('progressive throttling: P3 first, then P2, then P1', () => {
    const configFile = join(TEST_PROJECT_DIR, '.claude/orchestration/config.json');
    writeFileSync(configFile, JSON.stringify({ enablePriorityThrottling: true }));

    // Budget is 2600 total. Thresholds: P3=50% (1300), P2=70% (1820), P1=90% (2340)

    // Phase 1: under 50% - nothing throttled
    trackTokenUsage('fill', 'skill-injection', 1200); // 46% < 50%
    expect(shouldThrottle('posttool/context-budget-monitor')).toBe(false); // P3
    expect(shouldThrottle('subagent-start/mem0-memory-inject')).toBe(false); // P2
    expect(shouldThrottle('prompt/skill-resolver')).toBe(false); // P1

    // Phase 2: above 50% - P3 throttled
    trackTokenUsage('fill', 'skill-injection', 200); // total 1400 = 54% > 50%
    expect(shouldThrottle('posttool/context-budget-monitor')).toBe(true); // P3 throttled
    expect(shouldThrottle('subagent-start/mem0-memory-inject')).toBe(false); // P2 OK
    expect(shouldThrottle('prompt/skill-resolver')).toBe(false); // P1 OK

    // Phase 3: above 70% - P2 throttled too
    trackTokenUsage('fill', 'skill-injection', 500); // total 1900 = 73% > 70%
    expect(shouldThrottle('subagent-start/mem0-memory-inject')).toBe(true); // P2 throttled
    expect(shouldThrottle('prompt/skill-resolver')).toBe(false); // P1 OK

    // Phase 4: above 90% - P1 throttled
    trackTokenUsage('fill', 'skill-injection', 500); // total 2400 = 92% > 90%
    expect(shouldThrottle('prompt/skill-resolver')).toBe(true); // P1 throttled

    // P0 NEVER throttled
    expect(shouldThrottle('pretool/bash/dangerous-command-blocker')).toBe(false);
  });
});

// =============================================================================
// E2E: Full Session Lifecycle
// =============================================================================

describe('E2E: Full Session Lifecycle', () => {
  test('simulates a complete session with multiple hooks firing', () => {
    // Populate graph for memory injection
    const graphFile = join(TEST_PROJECT_DIR, '.claude/memory/knowledge-graph.jsonl');
    writeFileSync(graphFile, 'x'.repeat(200));

    // 1. First prompt triggers skill resolver
    const prompt1Content = 'Suggested: api-design-framework (80% confidence)';
    const tokens1 = estimateTokenCount(prompt1Content);
    trackTokenUsage('skill-resolver', 'skill-injection', tokens1);

    expect(getTotalUsage()).toBe(tokens1);

    // 2. Subagent spawn triggers graph memory inject
    const memResult = graphMemoryInject(makeSubagentInput('backend-system-architect'));
    expect(memResult.hookSpecificOutput).toBeDefined();

    // Track the injected context
    const memContent = memResult.hookSpecificOutput!.additionalContext!;
    const memTokens = estimateTokenCount(memContent);
    trackTokenUsage('graph-memory-inject', 'memory-inject', memTokens);

    expect(getTotalUsage()).toBe(tokens1 + memTokens);

    // 3. Second prompt - more skill suggestions
    const prompt2Content = 'Hint: auth-patterns';
    const tokens2 = estimateTokenCount(prompt2Content);
    trackTokenUsage('skill-resolver', 'skill-injection', tokens2);

    // 4. Verify final state
    const state = getTokenState();
    expect(state.totalTokensInjected).toBe(tokens1 + memTokens + tokens2);
    expect(state.byCategory['skill-injection']).toBe(tokens1 + tokens2);
    expect(state.byCategory['memory-inject']).toBe(memTokens);
    expect(state.byHook['skill-resolver']).toBe(tokens1 + tokens2);
    expect(state.byHook['graph-memory-inject']).toBe(memTokens);
    expect(state.records.length).toBe(3);
  });

  test('token state file is valid JSON after session', () => {
    trackTokenUsage('hook-1', 'cat-1', 100);
    trackTokenUsage('hook-2', 'cat-2', 200);

    const stateFile = join(TEST_PROJECT_DIR, '.claude/orchestration',
      `token-usage-${TEST_SESSION_ID}.json`);
    expect(existsSync(stateFile)).toBe(true);

    // Should be valid JSON
    const raw = readFileSync(stateFile, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.sessionId).toBe(TEST_SESSION_ID);
    expect(parsed.totalTokensInjected).toBe(300);
  });
});

/**
 * Integration tests for Memory System Token Optimization
 *
 * Tests cross-module interactions between:
 * - estimateTokenCount (common.ts)
 * - token-tracker (session usage tracking)
 * - hook-priorities (budget enforcement + priority throttling)
 * - skill-resolver (tiered injection)
 * - graph-memory-inject (conditional injection)
 *
 * Uses real filesystem (tmpdir) for state persistence.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { estimateTokenCount } from '../lib/common.js';
import { trackTokenUsage, getCategoryUsage, getTotalUsage, getTokenState } from '../lib/token-tracker.js';
import {
  isOverBudget,
  remainingBudget,
  shouldThrottle,
  getHookPriority,
  isPriorityThrottlingEnabled,
  TOKEN_BUDGETS,
} from '../lib/hook-priorities.js';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = join(tmpdir(), 'token-optimization-integration-test');
const TEST_SESSION_ID = 'token-opt-test-' + Date.now();

beforeEach(() => {
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;
  process.env.CLAUDE_SESSION_ID = TEST_SESSION_ID;

  if (!existsSync(TEST_PROJECT_DIR)) {
    mkdirSync(TEST_PROJECT_DIR, { recursive: true });
  }
  mkdirSync(join(TEST_PROJECT_DIR, '.claude/orchestration'), { recursive: true });
});

afterEach(() => {
  try {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
  delete process.env.CLAUDE_PROJECT_DIR;
  delete process.env.CLAUDE_SESSION_ID;
});

// =============================================================================
// Token Estimation Integration
// =============================================================================

describe('Token Estimation Integration', () => {
  test('estimateTokenCount returns consistent results for same content', () => {
    const content = 'This is a sample prompt about designing a REST API endpoint';
    const first = estimateTokenCount(content);
    const second = estimateTokenCount(content);
    expect(first).toBe(second);
    expect(first).toBeGreaterThan(0);
  });

  test('code content produces more tokens than prose of same length', () => {
    const prose = 'The quick brown fox jumps over the lazy dog again and again';
    const code = 'function foo() { if (x > 0) { return bar(x); } else {} }';
    // Ensure similar lengths
    expect(Math.abs(prose.length - code.length)).toBeLessThan(10);

    const proseTokens = estimateTokenCount(prose);
    const codeTokens = estimateTokenCount(code);

    // Code has more tokens per character
    expect(codeTokens).toBeGreaterThan(proseTokens);
  });

  test('empty and whitespace-only content handled correctly', () => {
    expect(estimateTokenCount('')).toBe(0);
    expect(estimateTokenCount('   ')).toBeGreaterThan(0); // whitespace still has chars
  });
});

// =============================================================================
// Token Tracker Integration
// =============================================================================

describe('Token Tracker Integration', () => {
  test('tracks usage across multiple hooks and persists to file', () => {
    trackTokenUsage('skill-resolver', 'skill-injection', 500);
    trackTokenUsage('graph-memory-inject', 'memory-inject', 300);
    trackTokenUsage('skill-resolver', 'skill-injection', 200);

    // Verify category totals
    expect(getCategoryUsage('skill-injection')).toBe(700);
    expect(getCategoryUsage('memory-inject')).toBe(300);
    expect(getTotalUsage()).toBe(1000);

    // Verify state file exists and is valid JSON
    const stateFile = join(TEST_PROJECT_DIR, '.claude/orchestration',
      `token-usage-${TEST_SESSION_ID}.json`);
    expect(existsSync(stateFile)).toBe(true);

    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    expect(state.totalTokensInjected).toBe(1000);
    expect(state.byHook['skill-resolver']).toBe(700);
    expect(state.byHook['graph-memory-inject']).toBe(300);
    expect(state.records).toHaveLength(3);
  });

  test('getTokenState returns full session state', () => {
    trackTokenUsage('hook-a', 'cat-a', 100);
    trackTokenUsage('hook-b', 'cat-b', 200);

    const state = getTokenState();
    expect(state.sessionId).toBe(TEST_SESSION_ID);
    expect(state.totalTokensInjected).toBe(300);
    expect(Object.keys(state.byCategory)).toEqual(expect.arrayContaining(['cat-a', 'cat-b']));
  });

  test('handles concurrent-like rapid tracking without corruption', () => {
    // Simulate rapid successive calls
    for (let i = 0; i < 20; i++) {
      trackTokenUsage(`hook-${i % 3}`, 'rapid-test', 50);
    }

    expect(getTotalUsage()).toBe(1000);
    expect(getCategoryUsage('rapid-test')).toBe(1000);
  });
});

// =============================================================================
// Budget Enforcement Integration
// =============================================================================

describe('Budget Enforcement Integration', () => {
  test('isOverBudget returns false when under budget', () => {
    trackTokenUsage('test-hook', 'skill-injection', 100);
    expect(isOverBudget('skill-injection')).toBe(false);
    expect(remainingBudget('skill-injection')).toBe(TOKEN_BUDGETS['skill-injection'] - 100);
  });

  test('isOverBudget returns true when at or over budget', () => {
    // Fill up the skill-injection budget (1200)
    trackTokenUsage('test-hook', 'skill-injection', 1200);
    expect(isOverBudget('skill-injection')).toBe(true);
    expect(remainingBudget('skill-injection')).toBe(0);
  });

  test('category budgets are independent', () => {
    trackTokenUsage('hook-a', 'skill-injection', 1200); // at budget
    trackTokenUsage('hook-b', 'memory-inject', 100);     // under budget

    expect(isOverBudget('skill-injection')).toBe(true);
    expect(isOverBudget('memory-inject')).toBe(false);
    expect(remainingBudget('memory-inject')).toBe(TOKEN_BUDGETS['memory-inject'] - 100);
  });

  test('total usage tracked across all categories', () => {
    trackTokenUsage('h1', 'skill-injection', 500);
    trackTokenUsage('h2', 'memory-inject', 300);
    trackTokenUsage('h3', 'suggestions', 200);

    expect(getTotalUsage()).toBe(1000);
  });
});

// =============================================================================
// Hook Priority Integration
// =============================================================================

describe('Hook Priority Integration', () => {
  test('priority throttling disabled by default (no config file)', () => {
    expect(isPriorityThrottlingEnabled()).toBe(false);
    // Should never throttle when disabled
    expect(shouldThrottle('prompt/skill-resolver')).toBe(false);
    expect(shouldThrottle('posttool/context-budget-monitor')).toBe(false);
  });

  test('P0 hooks never throttled even when enabled and over budget', () => {
    // Enable throttling
    const configFile = join(TEST_PROJECT_DIR, '.claude/orchestration/config.json');
    writeFileSync(configFile, JSON.stringify({ enablePriorityThrottling: true }));

    // Fill up budget completely
    trackTokenUsage('filler', 'skill-injection', 2500);

    expect(isPriorityThrottlingEnabled()).toBe(true);
    expect(shouldThrottle('pretool/bash/dangerous-command-blocker')).toBe(false);
    expect(shouldThrottle('pretool/write-edit/file-guard')).toBe(false);
  });

  test('P3 hooks throttled at 50% budget when enabled', () => {
    const configFile = join(TEST_PROJECT_DIR, '.claude/orchestration/config.json');
    writeFileSync(configFile, JSON.stringify({ enablePriorityThrottling: true }));

    // Fill to 60% of total budget (2600 * 0.6 = 1560)
    trackTokenUsage('filler', 'skill-injection', 1560);

    // P3 throttles at 50%, so should be throttled at 60%
    expect(shouldThrottle('posttool/context-budget-monitor')).toBe(true);
    // P1 throttles at 90%, so should NOT be throttled at 60%
    expect(shouldThrottle('prompt/skill-resolver')).toBe(false);
  });

  test('P2 hooks throttled at 70% budget when enabled', () => {
    const configFile = join(TEST_PROJECT_DIR, '.claude/orchestration/config.json');
    writeFileSync(configFile, JSON.stringify({ enablePriorityThrottling: true }));

    // Fill to 75% of total budget (2600 * 0.75 = 1950)
    trackTokenUsage('filler', 'skill-injection', 1950);

    // P2 throttles at 70%
    expect(shouldThrottle('subagent-start/mem0-memory-inject')).toBe(true);
    // P1 still OK at 90%
    expect(shouldThrottle('prompt/skill-resolver')).toBe(false);
  });

  test('priority assignments are correct for all known hooks', () => {
    expect(getHookPriority('pretool/bash/dangerous-command-blocker')).toBe('P0');
    expect(getHookPriority('prompt/skill-resolver')).toBe('P1');
    expect(getHookPriority('subagent-start/mem0-memory-inject')).toBe('P2');
    expect(getHookPriority('posttool/context-budget-monitor')).toBe('P3');
    expect(getHookPriority('unknown-hook')).toBe('P2'); // default
  });
});

// =============================================================================
// Cross-Module Workflow Integration
// =============================================================================

describe('Cross-Module Workflow', () => {
  test('full token tracking + budget check lifecycle', () => {
    // 1. Start session - nothing tracked
    expect(getTotalUsage()).toBe(0);
    expect(isOverBudget('skill-injection')).toBe(false);

    // 2. Skill resolver injects content
    const skillContent = 'Here is the full skill content for api-design-framework...';
    const skillTokens = estimateTokenCount(skillContent);
    trackTokenUsage('skill-resolver', 'skill-injection', skillTokens);

    expect(getTotalUsage()).toBe(skillTokens);
    expect(getCategoryUsage('skill-injection')).toBe(skillTokens);

    // 3. Graph memory injects
    const memoryContent = 'Knowledge graph entities for database-engineer agent...';
    const memoryTokens = estimateTokenCount(memoryContent);
    trackTokenUsage('graph-memory-inject', 'memory-inject', memoryTokens);

    expect(getTotalUsage()).toBe(skillTokens + memoryTokens);

    // 4. Verify budget tracking
    expect(remainingBudget('skill-injection')).toBe(TOKEN_BUDGETS['skill-injection'] - skillTokens);
    expect(remainingBudget('memory-inject')).toBe(TOKEN_BUDGETS['memory-inject'] - memoryTokens);
  });

  test('estimateTokenCount feeds accurate data to tracker', () => {
    const contents = [
      'Simple prose content about API design',
      'function handler(req, res) { return res.json({ ok: true }); }',
      '# Heading\n\n- Bullet 1\n- Bullet 2\n\nParagraph text.',
    ];

    let expectedTotal = 0;
    for (const content of contents) {
      const tokens = estimateTokenCount(content);
      expectedTotal += tokens;
      trackTokenUsage('test-hook', 'test-category', tokens);
    }

    expect(getTotalUsage()).toBe(expectedTotal);
    expect(getCategoryUsage('test-category')).toBe(expectedTotal);
  });

  test('budget enforcement prevents over-injection', () => {
    // Fill skill-injection to capacity
    trackTokenUsage('hook-1', 'skill-injection', TOKEN_BUDGETS['skill-injection']);

    // Verify budget exhausted
    expect(isOverBudget('skill-injection')).toBe(true);
    expect(remainingBudget('skill-injection')).toBe(0);

    // Other categories still have budget
    expect(isOverBudget('memory-inject')).toBe(false);
    expect(remainingBudget('memory-inject')).toBe(TOKEN_BUDGETS['memory-inject']);
  });
});

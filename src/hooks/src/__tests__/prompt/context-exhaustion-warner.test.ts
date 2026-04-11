/**
 * Unit tests for Session Quality Governor (context-exhaustion-warner)
 *
 * Tests multi-signal quality scoring, behavioral directives, threshold
 * escalation, and the always-on quality line injection.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';
import { mockCommonBasic } from '../fixtures/mock-common.js';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../../lib/paths.js', () => ({
  getTempDir: vi.fn(() => '/tmp'),
}));

vi.mock('../../lib/sanitize-shell.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/sanitize-shell.js')>();
  return {
    ...actual,
    sanitizeSessionId: actual.sanitizeSessionId,
  };
});

vi.mock('../../lib/common.js', () => mockCommonBasic({
  getSessionId: vi.fn(() => 'test-fallback-session'),
  getLogDir: vi.fn(() => '/tmp/test-logs'),
  getProjectDir: vi.fn(() => '/test/project'),
}));

import { existsSync, readFileSync } from 'node:fs';
import {
  contextExhaustionWarner,
  readContextPercentage,
  getContextPctFilePath,
  TIERS,
  computeQualityScore,
  computeFillPenalty,
  toGrade,
  formatQualityLine,
  _resetForTesting,
  _setSessionStartForTesting,
} from '../../prompt/context-exhaustion-warner.js';
import { createTestContext } from '../fixtures/test-context.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

// =============================================================================
// Test Utilities
// =============================================================================

function createPromptInput(prompt: string, overrides: Partial<HookInput> = {}): HookInput {
  return {
    hook_event: 'UserPromptSubmit',
    tool_name: 'UserPromptSubmit',
    session_id: 'test-session-abc',
    project_dir: '/test/project',
    tool_input: {},
    prompt,
    ...overrides,
  };
}

function mockContextFile(content: string): void {
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue(content);
}

function mockNoContextFile(): void {
  mockExistsSync.mockReturnValue(false);
}

// =============================================================================
// Tests
// =============================================================================

let testCtx: ReturnType<typeof createTestContext>;
describe('prompt/context-exhaustion-warner (quality governor)', () => {
  beforeEach(() => {
    testCtx = createTestContext({ sessionId: 'test-fallback-session' });
    _resetForTesting();
    _setSessionStartForTesting(Date.now() - 10 * 60000); // 10 min ago
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // computeQualityScore
  // ---------------------------------------------------------------------------

  describe('computeQualityScore', () => {
    test('fresh session scores 100/S', () => {
      const q = computeQualityScore(5, 0, 5, 0);
      expect(q.score).toBe(100);
      expect(q.grade).toBe('S');
    });

    test('mid-session with fill + age drops from S', () => {
      // 60% fill + 40min age = 5 fill penalty + 5 age penalty = 90
      const q = computeQualityScore(60, 0, 40, 2);
      expect(q.score).toBe(90);
      expect(q.grade).toBe('A');
    });

    test('high fill + age + compaction scores C', () => {
      // 83% fill + 65min age + 1 compaction = 23 + 10 + 8 = 41 penalty, score 59
      const q = computeQualityScore(83, 1, 65, 5);
      expect(q.score).toBeLessThan(70);
      expect(['C', 'D']).toContain(q.grade);
    });

    test('compaction penalty is -8 per compaction (isolated)', () => {
      // Use 0 decisions at 0 age to avoid bonus interference, 60% ctx for baseline
      const q0 = computeQualityScore(60, 0, 0, 0);
      const q1 = computeQualityScore(60, 1, 0, 0);
      const q2 = computeQualityScore(60, 2, 0, 0);
      expect(q0.score - q1.score).toBe(8);
      expect(q1.score - q2.score).toBe(8);
    });

    test('compaction penalty caps at 3', () => {
      const q3 = computeQualityScore(60, 3, 0, 0);
      const q5 = computeQualityScore(60, 5, 0, 0);
      expect(q3.score).toBe(q5.score);
    });

    test('age penalty kicks in at 30+ min (isolated)', () => {
      // 60% ctx, 0 compactions, 0 decisions — only age varies
      const young = computeQualityScore(60, 0, 20, 0);
      const mid = computeQualityScore(60, 0, 45, 0);
      expect(young.score - mid.score).toBe(5);
    });

    test('decision density bonus +5 when > 3/hr (isolated)', () => {
      // 60% ctx, 0 compactions, 60min age — only decisions vary
      // 10 decisions in 60 min = 10/hr → bonus
      const productive = computeQualityScore(60, 0, 60, 10);
      // 1 decision in 60 min = 1/hr → no bonus
      const idle = computeQualityScore(60, 0, 60, 1);
      expect(productive.score - idle.score).toBe(5);
    });

    test('score clamps to 0-100', () => {
      const bad = computeQualityScore(100, 3, 180, 0);
      expect(bad.score).toBeGreaterThanOrEqual(0);
      const good = computeQualityScore(0, 0, 0, 100);
      expect(good.score).toBeLessThanOrEqual(100);
    });

    test('dying session (88% ctx, 2 compactions, 140min) scores D', () => {
      const q = computeQualityScore(88, 2, 140, 25);
      expect(q.grade).toBe('D');
    });
  });

  // ---------------------------------------------------------------------------
  // computeFillPenalty
  // ---------------------------------------------------------------------------

  describe('computeFillPenalty', () => {
    test('no penalty below 50%', () => {
      expect(computeFillPenalty(0)).toBe(0);
      expect(computeFillPenalty(49)).toBe(0);
    });

    test('light penalty 50-70%', () => {
      expect(computeFillPenalty(60)).toBe(5);
      expect(computeFillPenalty(70)).toBe(10);
    });

    test('medium penalty 70-85%', () => {
      expect(computeFillPenalty(80)).toBe(20);
      expect(computeFillPenalty(85)).toBe(25);
    });

    test('heavy penalty above 85%', () => {
      expect(computeFillPenalty(90)).toBeCloseTo(32.5);
      expect(computeFillPenalty(100)).toBeCloseTo(47.5);
    });
  });

  // ---------------------------------------------------------------------------
  // toGrade
  // ---------------------------------------------------------------------------

  describe('toGrade', () => {
    test('maps scores to correct grades', () => {
      expect(toGrade(100)).toBe('S');
      expect(toGrade(95)).toBe('S');
      expect(toGrade(94)).toBe('A');
      expect(toGrade(85)).toBe('A');
      expect(toGrade(84)).toBe('B');
      expect(toGrade(70)).toBe('B');
      expect(toGrade(69)).toBe('C');
      expect(toGrade(50)).toBe('C');
      expect(toGrade(49)).toBe('D');
      expect(toGrade(30)).toBe('D');
      expect(toGrade(29)).toBe('F');
      expect(toGrade(0)).toBe('F');
    });
  });

  // ---------------------------------------------------------------------------
  // formatQualityLine
  // ---------------------------------------------------------------------------

  describe('formatQualityLine', () => {
    test('includes all signals', () => {
      const line = formatQualityLine({
        score: 84, grade: 'B', contextPct: 73, compactions: 2, ageMinutes: 47, decisions: 16,
      });
      expect(line).toContain('Q:84/B');
      expect(line).toContain('73% ctx');
      expect(line).toContain('2C');
      expect(line).toContain('47m');
      expect(line).toContain('16 decisions');
    });

    test('omits compaction count when 0', () => {
      const line = formatQualityLine({
        score: 100, grade: 'S', contextPct: 10, compactions: 0, ageMinutes: 5, decisions: 0,
      });
      expect(line).not.toContain('C');
      expect(line).toContain('Q:100/S');
    });
  });

  // ---------------------------------------------------------------------------
  // readContextPercentage (preserved from v1)
  // ---------------------------------------------------------------------------

  describe('readContextPercentage', () => {
    test('returns null when temp file does not exist', () => {
      mockNoContextFile();
      expect(readContextPercentage('test-session')).toBeNull();
    });

    test('returns parsed integer when file contains valid percentage', () => {
      mockContextFile('75');
      expect(readContextPercentage('test-session')).toBe(75);
    });

    test('returns null for NaN content', () => {
      mockContextFile('not-a-number');
      expect(readContextPercentage('test-session')).toBeNull();
    });

    test('returns null for percentage > 100', () => {
      mockContextFile('150');
      expect(readContextPercentage('test-session')).toBeNull();
    });

    test('returns null for negative percentage', () => {
      mockContextFile('-5');
      expect(readContextPercentage('test-session')).toBeNull();
    });

    test('handles whitespace around value', () => {
      mockContextFile('  82  \n');
      expect(readContextPercentage('test-session')).toBe(82);
    });

    test('rounds float values correctly', () => {
      mockContextFile('79.9');
      expect(readContextPercentage('test-session')).toBe(80);
      vi.clearAllMocks();
      mockContextFile('79.4');
      expect(readContextPercentage('test-session')).toBe(79);
    });

    test('returns null for empty session ID', () => {
      expect(readContextPercentage('')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getContextPctFilePath (preserved from v1)
  // ---------------------------------------------------------------------------

  describe('getContextPctFilePath', () => {
    test('uses getTempDir() and sanitized session ID', () => {
      expect(getContextPctFilePath('my-session')).toBe('/tmp/ork-ctx-pct-my-session.txt');
    });

    test('returns empty string for empty session ID', () => {
      expect(getContextPctFilePath('')).toBe('');
    });

    test('sanitizes path separators in session ID', () => {
      const path = getContextPctFilePath('../../etc/evil');
      expect(path).not.toContain('/etc/');
      expect(path).toMatch(/^\/tmp\/ork-ctx-pct-/);
    });
  });

  // ---------------------------------------------------------------------------
  // TIERS constant (preserved from v1)
  // ---------------------------------------------------------------------------

  describe('TIERS', () => {
    test('are sorted descending by pct', () => {
      for (let i = 1; i < TIERS.length; i++) {
        expect(TIERS[i - 1].pct).toBeGreaterThan(TIERS[i].pct);
      }
    });

    test('has 3 tiers: CRITICAL, WARNING, NOTICE', () => {
      expect(TIERS.map(t => t.level)).toEqual(['CRITICAL', 'WARNING', 'NOTICE']);
    });
  });

  // ---------------------------------------------------------------------------
  // Hook: always-on quality line
  // ---------------------------------------------------------------------------

  describe('always-on quality line', () => {
    test('injects quality line even below 70%', () => {
      mockContextFile('45');
      const input = createPromptInput('hello');
      const result = contextExhaustionWarner(input, testCtx);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('[Session Q:');
      expect(result.hookSpecificOutput?.additionalContext).toContain('45% ctx');
    });

    test('injects quality line at 15% (fresh session)', () => {
      mockContextFile('15');
      const input = createPromptInput('hello');
      const result = contextExhaustionWarner(input, testCtx);

      expect(result.hookSpecificOutput?.additionalContext).toMatch(/\[Session Q:\d+\/S/);
    });

    test('returns silent success when no temp file exists', () => {
      mockNoContextFile();
      const input = createPromptInput('hello');
      const result = contextExhaustionWarner(input, testCtx);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    test('returns silent success when session_id is missing', () => {
      const input = createPromptInput('hello', { session_id: '' });
      const result = contextExhaustionWarner(input, testCtx);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Hook: threshold escalation (preserved behavior)
  // ---------------------------------------------------------------------------

  describe('threshold escalation', () => {
    test('adds NOTICE warning at 70%', () => {
      mockContextFile('70');
      const result = contextExhaustionWarner(createPromptInput('hello'), testCtx);
      expect(result.hookSpecificOutput?.additionalContext).toContain('[Context NOTICE]');
    });

    test('adds WARNING at 80%', () => {
      mockContextFile('80');
      const result = contextExhaustionWarner(createPromptInput('hello'), testCtx);
      expect(result.hookSpecificOutput?.additionalContext).toContain('[Context WARNING]');
    });

    test('adds CRITICAL at 90%', () => {
      mockContextFile('90');
      const result = contextExhaustionWarner(createPromptInput('hello'), testCtx);
      expect(result.hookSpecificOutput?.additionalContext).toContain('[Context CRITICAL]');
    });

    test('escalation includes quality score', () => {
      mockContextFile('85');
      const result = contextExhaustionWarner(createPromptInput('hello'), testCtx);
      const ctx = result.hookSpecificOutput?.additionalContext as string;
      expect(ctx).toMatch(/Quality: [A-F] \(\d+\/100\)/);
    });

    test('does NOT repeat same tier', () => {
      mockContextFile('75');
      contextExhaustionWarner(createPromptInput('hello'), testCtx);

      // Second call at same tier — no escalation, but quality line still present
      const result2 = contextExhaustionWarner(createPromptInput('hello'), testCtx);
      expect(result2.hookSpecificOutput?.additionalContext).toContain('[Session Q:');
      expect(result2.hookSpecificOutput?.additionalContext).not.toContain('[Context NOTICE]');
    });

    test('escalates from NOTICE to WARNING', () => {
      mockContextFile('72');
      const r1 = contextExhaustionWarner(createPromptInput('hello'), testCtx);
      expect(r1.hookSpecificOutput?.additionalContext).toContain('[Context NOTICE]');

      mockContextFile('82');
      const r2 = contextExhaustionWarner(createPromptInput('hello'), testCtx);
      expect(r2.hookSpecificOutput?.additionalContext).toContain('[Context WARNING]');
    });

    test('resets after context drop below 70%', () => {
      mockContextFile('80');
      contextExhaustionWarner(createPromptInput('hello'), testCtx);

      mockContextFile('40');
      contextExhaustionWarner(createPromptInput('hello'), testCtx);

      mockContextFile('75');
      const result = contextExhaustionWarner(createPromptInput('hello'), testCtx);
      expect(result.hookSpecificOutput?.additionalContext).toContain('[Context NOTICE]');
    });
  });

  // ---------------------------------------------------------------------------
  // Hook: behavioral directives
  // ---------------------------------------------------------------------------

  describe('behavioral directives', () => {
    test('no directive at grade S/A/B', () => {
      mockContextFile('15'); // S grade
      const result = contextExhaustionWarner(createPromptInput('hello'), testCtx);
      const ctx = result.hookSpecificOutput?.additionalContext as string;
      expect(ctx).not.toContain('[Quality');
    });

    test('conservation directive at grade C', () => {
      // Force grade C: 83% ctx + 65min age + 0 compactions = ~54 score
      _setSessionStartForTesting(Date.now() - 65 * 60000);
      mockContextFile('83');
      const result = contextExhaustionWarner(createPromptInput('hello'), testCtx);
      const ctx = result.hookSpecificOutput?.additionalContext as string;
      expect(ctx).toContain('[Quality C — Conservation]');
      expect(ctx).toContain('Do not start new work');
    });

    test('emergency directive at grade D', () => {
      // Force grade D: 88% ctx + 2 compactions + 140min
      _setSessionStartForTesting(Date.now() - 140 * 60000);
      mockExistsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('state.json')) return true;
        if (typeof p === 'string' && p.includes('ork-ctx-pct')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('state.json')) return JSON.stringify({ compactionCount: 2 });
        return '88';
      });
      const result = contextExhaustionWarner(createPromptInput('hello'), testCtx);
      const ctx = result.hookSpecificOutput?.additionalContext as string;
      expect(ctx).toContain('[Quality D — Emergency]');
      expect(ctx).toContain('STOP');
    });
  });

  // ---------------------------------------------------------------------------
  // Hook: always continues (never blocks)
  // ---------------------------------------------------------------------------

  describe('never blocks', () => {
    test('always continues execution', () => {
      for (const pct of ['0', '50', '70', '80', '90', 'abc', '-1', '200']) {
        _resetForTesting();
        vi.clearAllMocks();
        mockContextFile(pct);
        const result = contextExhaustionWarner(createPromptInput('hello'), testCtx);
        expect(result.continue).toBe(true);
      }
    });
  });
});

/**
 * Hook Priority Queue Tests
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock node:fs
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
}));

import {
  getHookPriority,
  shouldThrottle,
  isOverBudget,
  remainingBudget,
  isPriorityThrottlingEnabled,
  TOKEN_BUDGETS,
} from '../../lib/hook-priorities.js';
import { existsSync, readFileSync } from 'node:fs';

describe('hook-priorities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  describe('getHookPriority', () => {
    test('returns P0 for security hooks', () => {
      expect(getHookPriority('pretool/bash/dangerous-command-blocker')).toBe('P0');
      expect(getHookPriority('pretool/write-edit/file-guard')).toBe('P0');
    });

    test('returns P1 for core injection hooks', () => {
      expect(getHookPriority('prompt/skill-resolver')).toBe('P1');
      expect(getHookPriority('subagent-start/graph-memory-inject')).toBe('P1');
    });

    test('returns P2 for supplementary hooks', () => {
      expect(getHookPriority('subagent-start/mem0-memory-inject')).toBe('P2');
      expect(getHookPriority('prompt/agent-auto-suggest')).toBe('P2');
    });

    test('returns P3 for monitoring hooks', () => {
      expect(getHookPriority('posttool/context-budget-monitor')).toBe('P3');
    });

    test('returns P2 as default for unknown hooks', () => {
      expect(getHookPriority('unknown/hook')).toBe('P2');
    });
  });

  describe('isPriorityThrottlingEnabled', () => {
    test('returns false when no config file exists', () => {
      expect(isPriorityThrottlingEnabled()).toBe(false);
    });

    test('returns false when config does not enable throttling', () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify({
        enablePriorityThrottling: false,
      }));
      expect(isPriorityThrottlingEnabled()).toBe(false);
    });

    test('returns true when config enables throttling', () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify({
        enablePriorityThrottling: true,
      }));
      expect(isPriorityThrottlingEnabled()).toBe(true);
    });
  });

  describe('shouldThrottle', () => {
    test('returns false when throttling is disabled', () => {
      // No config file = disabled
      expect(shouldThrottle('prompt/skill-resolver')).toBe(false);
    });

    test('never throttles P0 hooks even when enabled', () => {
      // Enable throttling
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify({
        enablePriorityThrottling: true,
        // Token state: way over budget
        sessionId: 'test',
        totalTokensInjected: 99999,
        byCategory: {},
        byHook: {},
        records: [],
      }));

      expect(shouldThrottle('pretool/bash/dangerous-command-blocker')).toBe(false);
    });
  });

  describe('TOKEN_BUDGETS', () => {
    test('has expected categories', () => {
      expect(TOKEN_BUDGETS['skill-injection']).toBe(1200);
      expect(TOKEN_BUDGETS['memory-inject']).toBe(800);
      expect(TOKEN_BUDGETS['suggestions']).toBe(400);
      expect(TOKEN_BUDGETS['monitoring']).toBe(200);
      expect(TOKEN_BUDGETS['total']).toBe(2600);
    });
  });

  describe('isOverBudget', () => {
    test('returns false for unknown category', () => {
      expect(isOverBudget('nonexistent')).toBe(false);
    });

    test('returns false when usage is under budget', () => {
      // Token state with low usage
      const tokenState = {
        sessionId: 'test',
        totalTokensInjected: 100,
        byCategory: { 'skill-injection': 100 },
        byHook: {},
        records: [],
      };

      // existsSync needs to return true for token state file, false for config
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        return (path as string).includes('token-usage');
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(tokenState));

      expect(isOverBudget('skill-injection')).toBe(false);
    });
  });

  describe('remainingBudget', () => {
    test('returns full budget when no usage', () => {
      expect(remainingBudget('skill-injection')).toBe(1200);
    });

    test('returns 0 for unknown category', () => {
      expect(remainingBudget('nonexistent')).toBe(0);
    });
  });
});

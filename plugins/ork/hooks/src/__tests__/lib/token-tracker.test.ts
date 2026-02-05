/**
 * Session Token Tracker Tests
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

// Mock common.js using shared fixture (prevents session-id-generator I/O)
vi.mock('../../lib/common.js', () => mockCommonBasic());

// Mock node:fs before imports
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

import { trackTokenUsage, getCategoryUsage, getTotalUsage, getHookUsage, getTokenState } from '../../lib/token-tracker.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

describe('token-tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing state file
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  describe('trackTokenUsage', () => {
    test('writes state file after tracking', () => {
      trackTokenUsage('skill-resolver', 'skill-injection', 500);

      expect(writeFileSync).toHaveBeenCalledTimes(1);
      const written = JSON.parse((writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string);
      expect(written.totalTokensInjected).toBe(500);
      expect(written.byCategory['skill-injection']).toBe(500);
      expect(written.byHook['skill-resolver']).toBe(500);
      expect(written.records).toHaveLength(1);
      expect(written.records[0].hookName).toBe('skill-resolver');
    });

    test('accumulates usage across calls when state file exists', () => {
      // First call creates state
      trackTokenUsage('hook-a', 'cat-a', 100);

      // Mock that the file now exists with previous state
      const prevState = JSON.parse((writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string);
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(prevState));

      // Second call accumulates
      trackTokenUsage('hook-b', 'cat-b', 200);

      const written = JSON.parse((writeFileSync as ReturnType<typeof vi.fn>).mock.calls[1][1] as string);
      expect(written.totalTokensInjected).toBe(300);
      expect(written.byCategory['cat-a']).toBe(100);
      expect(written.byCategory['cat-b']).toBe(200);
    });

    test('trims records to 80 when exceeding 100', () => {
      // Create state with 101 records (over the 100 threshold)
      const existingState = {
        sessionId: 'test',
        totalTokensInjected: 10100,
        byCategory: { 'cat': 10100 },
        byHook: { 'hook': 10100 },
        records: Array.from({ length: 101 }, () => ({
          hookName: 'hook',
          category: 'cat',
          tokens: 100,
          timestamp: new Date().toISOString(),
        })),
      };

      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(existingState));

      trackTokenUsage('hook', 'cat', 100);

      const written = JSON.parse((writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string);
      // 101 records >= 100, trimmed to last 80 + 1 new = 81
      expect(written.records.length).toBe(81);
    });
  });

  describe('getCategoryUsage', () => {
    test('returns 0 for unknown category', () => {
      expect(getCategoryUsage('nonexistent')).toBe(0);
    });

    test('returns tracked value when state exists', () => {
      const state = {
        sessionId: 'test',
        totalTokensInjected: 500,
        byCategory: { 'skill-injection': 500 },
        byHook: {},
        records: [],
      };
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(state));

      expect(getCategoryUsage('skill-injection')).toBe(500);
    });
  });

  describe('getTotalUsage', () => {
    test('returns 0 when no state file', () => {
      expect(getTotalUsage()).toBe(0);
    });

    test('returns total from state', () => {
      const state = {
        sessionId: 'test',
        totalTokensInjected: 1500,
        byCategory: {},
        byHook: {},
        records: [],
      };
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(state));

      expect(getTotalUsage()).toBe(1500);
    });
  });

  describe('getHookUsage', () => {
    test('returns empty object when no state', () => {
      expect(getHookUsage()).toEqual({});
    });
  });

  describe('getTokenState', () => {
    test('returns default state when no file exists', () => {
      const state = getTokenState();
      expect(state.totalTokensInjected).toBe(0);
      expect(state.byCategory).toEqual({});
      expect(state.records).toEqual([]);
    });
  });
});

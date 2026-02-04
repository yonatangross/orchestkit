/**
 * Tests for Queue Recovery Hook
 *
 * Validates:
 * - No orphaned queues (silent success)
 * - Orphaned graph queue recovery
 * - Orphaned mem0 queue recovery
 * - Stale queue archival
 * - Empty queue files
 * - Corrupted lines handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queueRecovery } from '../../prompt/queue-recovery.js';
import type { HookInput } from '../../types.js';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock('../../lib/common.js', () => ({
  getProjectDir: vi.fn(() => '/test/project'),
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

vi.mock('../../lib/memory-writer.js', () => ({
  isMem0Configured: vi.fn(() => false),
}));

import { existsSync, readFileSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { isMem0Configured } from '../../lib/memory-writer.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockStatSync = vi.mocked(statSync);
const mockUnlinkSync = vi.mocked(unlinkSync);
const mockRenameSync = vi.mocked(renameSync);
const mockIsMem0Configured = vi.mocked(isMem0Configured);

function createInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: 'test-session',
    tool_input: {},
    project_dir: '/test/project',
    ...overrides,
  };
}

function mockFreshStat(): ReturnType<typeof statSync> {
  return {
    mtime: new Date(),
    size: 100,
    isFile: () => true,
    isDirectory: () => false,
  } as unknown as ReturnType<typeof statSync>;
}

function mockStaleStat(): ReturnType<typeof statSync> {
  return {
    mtime: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
    size: 100,
    isFile: () => true,
    isDirectory: () => false,
  } as unknown as ReturnType<typeof statSync>;
}

describe('queueRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockIsMem0Configured.mockReturnValue(false);
  });

  it('returns silent success when no orphaned queues', () => {
    mockExistsSync.mockReturnValue(false);

    const result = queueRecovery(createInput());

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBeUndefined();
  });

  it('recovers orphaned graph queue', () => {
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path);
      return p.includes('graph-queue.jsonl');
    });
    mockStatSync.mockReturnValue(mockFreshStat());
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        type: 'create_entities',
        payload: {
          entities: [{ name: 'PostgreSQL', entityType: 'Technology', observations: ['Chosen for DB'] }],
        },
        timestamp: new Date().toISOString(),
      }) + '\n'
    );

    const result = queueRecovery(createInput());

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBeDefined();
    expect(result.systemMessage).toContain('Graph Memory Recovery');
    expect(result.systemMessage).toContain('PostgreSQL');
    expect(result.systemMessage).toContain('mcp__memory__create_entities');
  });

  it('recovers orphaned mem0 queue when mem0 configured', () => {
    mockIsMem0Configured.mockReturnValue(true);
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path);
      return p.includes('mem0-queue.jsonl');
    });
    mockStatSync.mockReturnValue(mockFreshStat());
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        text: 'Use PostgreSQL for database',
        user_id: 'project-test',
        metadata: { category: 'database' },
        queued_at: new Date().toISOString(),
      }) + '\n'
    );

    const result = queueRecovery(createInput());

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBeDefined();
    expect(result.systemMessage).toContain('Mem0 Memory Recovery');
    expect(result.systemMessage).toContain('mcp__mem0__add_memory');
  });

  it('archives stale graph queue instead of processing', () => {
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path);
      return p.includes('graph-queue.jsonl');
    });
    mockStatSync.mockReturnValue(mockStaleStat());

    const result = queueRecovery(createInput());

    // Should not have a recovery message (archived instead)
    expect(result.systemMessage).toBeUndefined();
  });

  it('handles empty queue files', () => {
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path);
      return p.includes('graph-queue.jsonl');
    });
    mockStatSync.mockReturnValue(mockFreshStat());
    mockReadFileSync.mockReturnValue('');

    const result = queueRecovery(createInput());

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBeUndefined();
  });

  it('skips corrupted lines gracefully', () => {
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path);
      return p.includes('graph-queue.jsonl');
    });
    mockStatSync.mockReturnValue(mockFreshStat());
    mockReadFileSync.mockReturnValue(
      'NOT VALID JSON\n' +
      JSON.stringify({
        type: 'create_entities',
        payload: {
          entities: [{ name: 'Redis', entityType: 'Technology', observations: ['Cache layer'] }],
        },
        timestamp: new Date().toISOString(),
      }) + '\n'
    );

    const result = queueRecovery(createInput());

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBeDefined();
    expect(result.systemMessage).toContain('Redis');
  });

  it('does not process mem0 queue when mem0 not configured', () => {
    mockIsMem0Configured.mockReturnValue(false);
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path);
      return p.includes('mem0-queue.jsonl');
    });

    const result = queueRecovery(createInput());

    // mem0 queue ignored when not configured
    expect(result.systemMessage).toBeUndefined();
  });

  it('recovers both queues in single message', () => {
    mockIsMem0Configured.mockReturnValue(true);
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path);
      return p.includes('graph-queue.jsonl') || p.includes('mem0-queue.jsonl');
    });
    mockStatSync.mockReturnValue(mockFreshStat());
    mockReadFileSync.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.toString().includes('graph-queue.jsonl')) {
        return JSON.stringify({
          type: 'create_entities',
          payload: {
            entities: [{ name: 'FastAPI', entityType: 'Technology', observations: ['Web framework'] }],
          },
          timestamp: new Date().toISOString(),
        }) + '\n';
      }
      if (p.toString().includes('mem0-queue.jsonl')) {
        return JSON.stringify({
          text: 'Use FastAPI for APIs',
          user_id: 'project-test',
          metadata: { category: 'api' },
          queued_at: new Date().toISOString(),
        }) + '\n';
      }
      return '';
    });

    const result = queueRecovery(createInput());

    expect(result.systemMessage).toBeDefined();
    expect(result.systemMessage).toContain('Graph Memory Recovery');
    expect(result.systemMessage).toContain('Mem0 Memory Recovery');
  });

  // --- Additional coverage tests (from coverage gap analysis) ---

  it('archives stale mem0 queue instead of processing', () => {
    mockIsMem0Configured.mockReturnValue(true);
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path);
      return p.includes('mem0-queue.jsonl');
    });
    mockStatSync.mockReturnValue(mockStaleStat());

    const result = queueRecovery(createInput());

    // Stale mem0 queue should be archived, not processed
    expect(result.systemMessage).toBeUndefined();
    expect(mockRenameSync).toHaveBeenCalled();
  });

  it('clears graph queue file after recovery', () => {
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path);
      return p.includes('graph-queue.jsonl');
    });
    mockStatSync.mockReturnValue(mockFreshStat());
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        type: 'create_entities',
        payload: {
          entities: [{ name: 'TestEntity', entityType: 'Technology', observations: ['test'] }],
        },
        timestamp: new Date().toISOString(),
      }) + '\n'
    );

    queueRecovery(createInput());

    // Queue file should be cleared after processing
    expect(mockUnlinkSync).toHaveBeenCalled();
  });

  it('clears mem0 queue file after recovery', () => {
    mockIsMem0Configured.mockReturnValue(true);
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path);
      return p.includes('mem0-queue.jsonl');
    });
    mockStatSync.mockReturnValue(mockFreshStat());
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        text: 'test memory',
        user_id: 'project-test',
        metadata: {},
        queued_at: new Date().toISOString(),
      }) + '\n'
    );

    queueRecovery(createInput());

    expect(mockUnlinkSync).toHaveBeenCalled();
  });

  it('recovers relations-only graph queue', () => {
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path);
      return p.includes('graph-queue.jsonl');
    });
    mockStatSync.mockReturnValue(mockFreshStat());
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        type: 'create_relations',
        payload: {
          relations: [{ from: 'PostgreSQL', to: 'Redis', relationType: 'RELATES_TO' }],
        },
        timestamp: new Date().toISOString(),
      }) + '\n'
    );

    const result = queueRecovery(createInput());

    expect(result.systemMessage).toBeDefined();
    expect(result.systemMessage).toContain('Create Relations');
    expect(result.systemMessage).toContain('mcp__memory__create_relations');
    expect(result.systemMessage).not.toContain('Create Entities');
  });

  it('recovers observations-only graph queue', () => {
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path);
      return p.includes('graph-queue.jsonl');
    });
    mockStatSync.mockReturnValue(mockFreshStat());
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        type: 'add_observations',
        payload: {
          observations: [{ entityName: 'PostgreSQL', contents: ['Supports JSONB'] }],
        },
        timestamp: new Date().toISOString(),
      }) + '\n'
    );

    const result = queueRecovery(createInput());

    expect(result.systemMessage).toBeDefined();
    expect(result.systemMessage).toContain('Add Observations');
    expect(result.systemMessage).toContain('mcp__memory__add_observations');
    expect(result.systemMessage).not.toContain('Create Entities');
  });

  it('recovers multiple mem0 memories with numbered labels', () => {
    mockIsMem0Configured.mockReturnValue(true);
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path);
      return p.includes('mem0-queue.jsonl');
    });
    mockStatSync.mockReturnValue(mockFreshStat());
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        text: 'First memory',
        user_id: 'project-test',
        metadata: { category: 'general' },
        queued_at: new Date().toISOString(),
      }) + '\n' +
      JSON.stringify({
        text: 'Second memory',
        user_id: 'project-test',
        metadata: { category: 'api' },
        queued_at: new Date().toISOString(),
      }) + '\n'
    );

    const result = queueRecovery(createInput());

    expect(result.systemMessage).toBeDefined();
    expect(result.systemMessage).toContain('Memory 1:');
    expect(result.systemMessage).toContain('Memory 2:');
    expect(result.systemMessage).toContain('First memory');
    expect(result.systemMessage).toContain('Second memory');
  });

  it('returns silent success when all graph queue lines are corrupt', () => {
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path);
      return p.includes('graph-queue.jsonl');
    });
    mockStatSync.mockReturnValue(mockFreshStat());
    mockReadFileSync.mockReturnValue('CORRUPT1\nCORRUPT2\nCORRUPT3\n');

    const result = queueRecovery(createInput());

    expect(result.continue).toBe(true);
    // No valid operations -> no recovery message
    expect(result.systemMessage).toBeUndefined();
    // Queue should still be cleared
    expect(mockUnlinkSync).toHaveBeenCalled();
  });
});

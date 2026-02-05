/**
 * Tests for Memory Health Check
 *
 * Validates:
 * - All healthy scenario
 * - Missing memory directory
 * - Corrupted JSONL lines
 * - MEM0_API_KEY present/absent
 * - Empty vs populated queues
 * - High queue depth detection
 * - Last sync timestamp extraction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkMemoryHealth, analyzeJsonlFile } from '../../lib/memory-health.js';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock('../../lib/common.js', () => ({
  getProjectDir: vi.fn(() => '/test/project'),
  logHook: vi.fn(),
}));

import { existsSync, readFileSync, statSync } from 'node:fs';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockStatSync = vi.mocked(statSync);

// Helper to create mock stat
function mockStat(size: number, mtime: Date = new Date('2025-01-15T10:00:00Z')): ReturnType<typeof statSync> {
  return {
    size,
    mtime,
    isFile: () => true,
    isDirectory: () => false,
  } as unknown as ReturnType<typeof statSync>;
}

describe('analyzeJsonlFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty result for non-existent file', () => {
    mockExistsSync.mockReturnValue(false);

    const result = analyzeJsonlFile('/test/missing.jsonl');

    expect(result.exists).toBe(false);
    expect(result.lineCount).toBe(0);
    expect(result.corruptLines).toBe(0);
  });

  it('analyzes valid JSONL file', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue(mockStat(200));
    mockReadFileSync.mockReturnValue(
      '{"type":"decision","content":"Use PostgreSQL"}\n{"type":"pattern","content":"CQRS"}\n'
    );

    const result = analyzeJsonlFile('/test/decisions.jsonl');

    expect(result.exists).toBe(true);
    expect(result.lineCount).toBe(2);
    expect(result.corruptLines).toBe(0);
    expect(result.sizeBytes).toBe(200);
  });

  it('detects corrupt lines', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue(mockStat(100));
    mockReadFileSync.mockReturnValue(
      '{"valid":"json"}\nnot json at all\n{"also":"valid"}\n'
    );

    const result = analyzeJsonlFile('/test/mixed.jsonl');

    expect(result.lineCount).toBe(3);
    expect(result.corruptLines).toBe(1);
  });

  it('handles empty file', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue(mockStat(0));
    mockReadFileSync.mockReturnValue('');

    const result = analyzeJsonlFile('/test/empty.jsonl');

    expect(result.exists).toBe(true);
    expect(result.lineCount).toBe(0);
    expect(result.corruptLines).toBe(0);
  });
});

describe('checkMemoryHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all paths don't exist
    mockExistsSync.mockReturnValue(false);
    // Remove MEM0_API_KEY
    delete process.env.MEM0_API_KEY;
  });

  it('returns unavailable when memory directory missing', () => {
    mockExistsSync.mockReturnValue(false);

    const report = checkMemoryHealth('/test/project');

    expect(report.overall).toBe('unavailable');
    expect(report.tiers.graph.status).toBe('unavailable');
    expect(report.tiers.graph.memoryDir).toBe(false);
  });

  it('returns healthy when all tiers operational', () => {
    // Memory directory exists
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path).replace(/\\/g, '/');
      if (p.includes('.claude/memory')) return true;
      if (p.includes('decisions.jsonl')) return true;
      if (p.includes('mem0-analytics.jsonl')) return true;
      return false;
    });
    mockStatSync.mockReturnValue(mockStat(100));
    mockReadFileSync.mockImplementation((path: unknown) => {
      const p = String(path).replace(/\\/g, '/');
      if (p.includes('decisions.jsonl')) {
        return '{"type":"decision"}\n';
      }
      if (p.includes('mem0-analytics.jsonl')) {
        return '{"timestamp":"2025-01-15T10:00:00Z","event":"session_start"}\n';
      }
      return '';
    });
    process.env.MEM0_API_KEY = 'test-key';

    const report = checkMemoryHealth('/test/project');

    expect(report.overall).toBe('healthy');
    expect(report.tiers.graph.status).toBe('healthy');
    expect(report.tiers.mem0.status).toBe('healthy');
    expect(report.tiers.mem0.apiKeyPresent).toBe(true);
    expect(report.tiers.fabric.status).toBe('healthy');
    expect(report.tiers.fabric.bothTiersAvailable).toBe(true);

    delete process.env.MEM0_API_KEY;
  });

  it('reports degraded when decisions.jsonl has corrupt lines', () => {
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path).replace(/\\/g, '/');
      return p.includes('.claude/memory') || p.includes('decisions.jsonl');
    });
    mockStatSync.mockReturnValue(mockStat(100));
    mockReadFileSync.mockReturnValue('{"valid":"json"}\nCORRUPT LINE\n');

    const report = checkMemoryHealth('/test/project');

    expect(report.overall).toBe('degraded');
    expect(report.tiers.graph.status).toBe('degraded');
    expect(report.tiers.graph.decisions.corruptLines).toBe(1);
  });

  it('reports mem0 unavailable without API key', () => {
    mockExistsSync.mockImplementation((path: unknown) => {
      return String(path).replace(/\\/g, '/').includes('.claude/memory');
    });

    delete process.env.MEM0_API_KEY;

    const report = checkMemoryHealth('/test/project');

    expect(report.tiers.mem0.status).toBe('unavailable');
    expect(report.tiers.mem0.apiKeyPresent).toBe(false);
    expect(report.tiers.mem0.message).toContain('not configured');
  });

  it('reports fabric unavailable when graph missing', () => {
    mockExistsSync.mockReturnValue(false);

    const report = checkMemoryHealth('/test/project');

    expect(report.tiers.fabric.status).toBe('unavailable');
    expect(report.tiers.fabric.bothTiersAvailable).toBe(false);
  });

  it('reports degraded with high queue depth', () => {
    // Generate 60 valid JSONL lines
    const queueLines = Array.from({ length: 60 }, (_, i) =>
      JSON.stringify({ type: 'create_entities', index: i })
    ).join('\n') + '\n';

    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue(mockStat(5000));
    mockReadFileSync.mockImplementation((path: unknown) => {
      const p = String(path).replace(/\\/g, '/');
      if (p.includes('graph-queue.jsonl')) return queueLines;
      if (p.includes('decisions.jsonl')) return '{"type":"decision"}\n';
      return '';
    });

    const report = checkMemoryHealth('/test/project');

    expect(report.tiers.graph.status).toBe('degraded');
    expect(report.tiers.graph.graphQueue.lineCount).toBe(60);
    expect(report.tiers.graph.message).toContain('queue depth high');
  });

  it('extracts last sync timestamp from analytics', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue(mockStat(100));
    mockReadFileSync.mockImplementation((path: unknown) => {
      const p = String(path).replace(/\\/g, '/');
      if (p.includes('mem0-analytics.jsonl')) {
        return '{"timestamp":"2025-01-10T08:00:00Z"}\n{"timestamp":"2025-01-15T12:00:00Z"}\n';
      }
      if (p.includes('decisions.jsonl')) return '{"type":"decision"}\n';
      return '';
    });
    process.env.MEM0_API_KEY = 'test-key';

    const report = checkMemoryHealth('/test/project');

    expect(report.tiers.mem0.lastSyncTimestamp).toBe('2025-01-15T12:00:00Z');

    delete process.env.MEM0_API_KEY;
  });
});

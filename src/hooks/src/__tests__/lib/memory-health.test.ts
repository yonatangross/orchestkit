/**
 * Tests for Memory Health Check
 *
 * Validates:
 * - All healthy scenario
 * - Missing memory directory
 * - analyzeJsonlFile for corrupt lines, empty files, etc.
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
  });

  it('returns unavailable when memory directory missing', () => {
    mockExistsSync.mockReturnValue(false);

    const report = checkMemoryHealth('/test/project');

    expect(report.overall).toBe('unavailable');
    expect(report.tiers.graph.status).toBe('unavailable');
    expect(report.tiers.graph.memoryDir).toBe(false);
  });

  it('returns healthy when memory directory exists', () => {
    // Memory directory exists
    mockExistsSync.mockImplementation((path: unknown) => {
      const p = String(path).replace(/\\/g, '/');
      if (p.includes('.claude/memory')) return true;
      return false;
    });

    const report = checkMemoryHealth('/test/project');

    expect(report.overall).toBe('healthy');
    expect(report.tiers.graph.status).toBe('healthy');
    expect(report.tiers.graph.memoryDir).toBe(true);
  });

  it('has expected report structure', () => {
    mockExistsSync.mockReturnValue(true);

    const report = checkMemoryHealth('/test/project');

    expect(report.timestamp).toBeDefined();
    expect(report.overall).toBeDefined();
    expect(report.tiers).toBeDefined();
    expect(report.tiers.graph).toBeDefined();
    expect(report.tiers.graph.status).toBeDefined();
    expect(report.tiers.graph.message).toBeDefined();
    expect(typeof report.tiers.graph.memoryDir).toBe('boolean');
  });
});

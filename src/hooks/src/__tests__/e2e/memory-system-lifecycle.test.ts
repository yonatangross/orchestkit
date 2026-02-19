/**
 * E2E Test: Memory System Lifecycle
 *
 * Tests the full pipeline using real filesystem (tmpdir):
 *   health check → metrics collection → analyzeJsonlFile
 *
 * No mocks - validates actual file I/O and data flow.
 *
 * Note: queue-processor.ts tests removed in v7 (module deleted).
 * Note: checkMemoryHealth simplified in v7 - no longer inspects individual files,
 *       only checks if .claude/memory/ directory exists. Use analyzeJsonlFile for
 *       detailed file inspection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkMemoryHealth, analyzeJsonlFile } from '../../lib/memory-health.js';
import { collectMemoryMetrics, appendMetricSnapshot } from '../../lib/memory-metrics.js';

// =============================================================================
// HELPERS
// =============================================================================

let testDir: string;

function setupTestDir(): string {
  const dir = join(tmpdir(), `orchestkit-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(join(dir, '.claude', 'memory'), { recursive: true });
  mkdirSync(join(dir, '.claude', 'logs'), { recursive: true });
  return dir;
}

function writeDecisions(dir: string, decisions: Array<Record<string, unknown>>): void {
  const path = join(dir, '.claude', 'memory', 'decisions.jsonl');
  writeFileSync(path, `${decisions.map(d => JSON.stringify(d)).join('\n')}\n`);
}

// =============================================================================
// TESTS
// =============================================================================

describe('E2E: Memory System Lifecycle', () => {
  beforeEach(() => {
    testDir = setupTestDir();
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Cleanup best-effort
    }
  });

  // ---------------------------------------------------------------------------
  // Phase 1: Health Check on fresh project
  // ---------------------------------------------------------------------------

  describe('Phase 1: Fresh project health check', () => {
    it('reports healthy with empty memory directory', () => {
      const report = checkMemoryHealth(testDir);

      expect(report.overall).toBe('healthy');
      expect(report.tiers.graph.memoryDir).toBe(true);
      expect(report.tiers.graph.status).toBe('healthy');
    });

    it('reports unavailable when memory dir is missing', () => {
      const emptyDir = join(tmpdir(), `orchestkit-e2e-empty-${Date.now()}`);
      mkdirSync(emptyDir, { recursive: true });

      try {
        const report = checkMemoryHealth(emptyDir);
        expect(report.overall).toBe('unavailable');
        expect(report.tiers.graph.status).toBe('unavailable');
        expect(report.tiers.graph.memoryDir).toBe(false);
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 2: Populate decisions, verify analyzeJsonlFile + metrics
  // ---------------------------------------------------------------------------

  describe('Phase 2: Populated project analysis + metrics', () => {
    beforeEach(() => {
      writeDecisions(testDir, [
        {
          type: 'decision',
          content: { what: 'Use PostgreSQL for database', why: 'ACID compliance' },
          entities: ['PostgreSQL'],
          metadata: { category: 'database', timestamp: '2025-01-15T10:00:00Z' },
        },
        {
          type: 'preference',
          content: { what: 'Prefer TypeScript strict mode', why: 'Type safety' },
          entities: ['TypeScript'],
          metadata: { category: 'language', timestamp: '2025-01-16T10:00:00Z' },
        },
        {
          type: 'decision',
          content: { what: 'Use FastAPI for API layer', why: 'Performance' },
          entities: ['FastAPI', 'Python'],
          metadata: { category: 'api', timestamp: '2025-01-17T10:00:00Z' },
        },
        {
          type: 'pattern',
          content: { what: 'Implement CQRS pattern', why: 'Separation of concerns' },
          entities: ['CQRS'],
          metadata: { category: 'architecture', timestamp: '2025-01-18T10:00:00Z' },
        },
        {
          type: 'problem-solution',
          content: { what: 'N+1 query in user list', resolution: 'DataLoader batching' },
          entities: ['PostgreSQL', 'DataLoader'],
          metadata: { category: 'database', timestamp: '2025-01-19T10:00:00Z' },
        },
      ]);
    });

    it('analyzeJsonlFile reports valid decisions correctly', () => {
      const decisionsPath = join(testDir, '.claude', 'memory', 'decisions.jsonl');
      const analysis = analyzeJsonlFile(decisionsPath);

      expect(analysis.exists).toBe(true);
      expect(analysis.lineCount).toBe(5);
      expect(analysis.corruptLines).toBe(0);
      expect(analysis.sizeBytes).toBeGreaterThan(0);
      expect(analysis.lastModified).toBeTruthy();
    });

    it('health check reports healthy with populated memory dir', () => {
      const report = checkMemoryHealth(testDir);

      expect(report.overall).toBe('healthy');
      expect(report.tiers.graph.status).toBe('healthy');
    });

    it('appendMetricSnapshot writes to metrics log', () => {
      const metrics = collectMemoryMetrics(testDir);
      appendMetricSnapshot(testDir, metrics);

      const metricsPath = join(testDir, '.claude', 'logs', 'memory-metrics.jsonl');
      expect(existsSync(metricsPath)).toBe(true);

      const content = readFileSync(metricsPath, 'utf8');
      const parsed = JSON.parse(content.trim());
      expect(parsed.decisions).toBeDefined();
      expect(parsed.queues.graphQueueDepth).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 3: analyzeJsonlFile detects corrupt data
  // ---------------------------------------------------------------------------

  describe('Phase 3: Corrupt data detection via analyzeJsonlFile', () => {
    it('detects corrupt lines in decisions', () => {
      const decisionsPath = join(testDir, '.claude', 'memory', 'decisions.jsonl');
      writeFileSync(decisionsPath, `${[
        JSON.stringify({ type: 'decision', content: { what: 'Valid' } }),
        'NOT VALID JSON',
        JSON.stringify({ type: 'decision', content: { what: 'Also valid' } }),
        '{broken json...',
      ].join('\n')}\n`);

      const analysis = analyzeJsonlFile(decisionsPath);
      expect(analysis.exists).toBe(true);
      expect(analysis.lineCount).toBe(4);
      expect(analysis.corruptLines).toBe(2);
    });

    it('analyzeJsonlFile returns correct metrics for mixed content', () => {
      const filePath = join(testDir, '.claude', 'memory', 'test.jsonl');
      writeFileSync(filePath, `${[
        JSON.stringify({ valid: true }),
        'corrupt',
        JSON.stringify({ valid: true }),
      ].join('\n')}\n`);

      const health = analyzeJsonlFile(filePath);
      expect(health.exists).toBe(true);
      expect(health.lineCount).toBe(3);
      expect(health.corruptLines).toBe(1);
      expect(health.sizeBytes).toBeGreaterThan(0);
      expect(health.lastModified).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 5: Queue depth in metrics
  // ---------------------------------------------------------------------------

  describe('Phase 5: Queue depth in metrics', () => {
    it('metrics reflect queue depth', () => {
      // Write many queue entries
      const manyOps = Array.from({ length: 55 }, (_, i) => ({
        type: 'create_entities',
        payload: {
          entities: [{ name: `Entity${i}`, entityType: 'Technology', observations: ['test'] }],
        },
        timestamp: new Date().toISOString(),
      }));
      const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
      writeFileSync(queuePath, `${manyOps.map(o => JSON.stringify(o)).join('\n')}\n`);

      // Metrics should reflect queue depth
      const metrics = collectMemoryMetrics(testDir);
      expect(metrics.queues.graphQueueDepth).toBe(55);
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 7: Edge cases
  // ---------------------------------------------------------------------------

  describe('Phase 7: Edge cases', () => {
    it('handles completely empty JSONL files', () => {
      writeFileSync(join(testDir, '.claude', 'memory', 'decisions.jsonl'), '');
      writeFileSync(join(testDir, '.claude', 'memory', 'graph-queue.jsonl'), '');

      const report = checkMemoryHealth(testDir);
      expect(report.overall).toBe('healthy');

      const decisionsAnalysis = analyzeJsonlFile(join(testDir, '.claude', 'memory', 'decisions.jsonl'));
      expect(decisionsAnalysis.lineCount).toBe(0);

      const metrics = collectMemoryMetrics(testDir);
      expect(metrics.decisions.total).toBe(0);
      expect(metrics.queues.graphQueueDepth).toBe(0);
    });

    it('handles whitespace-only JSONL files', () => {
      writeFileSync(join(testDir, '.claude', 'memory', 'decisions.jsonl'), '  \n\n  \n');

      const analysis = analyzeJsonlFile(join(testDir, '.claude', 'memory', 'decisions.jsonl'));
      expect(analysis.lineCount).toBe(0);
    });

    it('handles graph queue with mixed valid and corrupt lines', () => {
      const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
      writeFileSync(queuePath, `${[
        JSON.stringify({
          type: 'create_entities',
          payload: { entities: [{ name: 'Valid', entityType: 'Tech', observations: ['ok'] }] },
          timestamp: new Date().toISOString(),
        }),
        'NOT_JSON',
        JSON.stringify({
          type: 'create_entities',
          payload: { entities: [{ name: 'AlsoValid', entityType: 'Tech', observations: ['ok'] }] },
          timestamp: new Date().toISOString(),
        }),
      ].join('\n')}\n`);

      // analyzeJsonlFile should detect the corrupt line
      const health = analyzeJsonlFile(queuePath);
      expect(health.lineCount).toBe(3);
      expect(health.corruptLines).toBe(1);
    });
  });
});

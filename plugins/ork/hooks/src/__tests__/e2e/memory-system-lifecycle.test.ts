/**
 * E2E Test: Memory System Lifecycle
 *
 * Tests the full pipeline using real filesystem (tmpdir):
 *   health check → metrics collection → queue recovery
 *
 * No mocks - validates actual file I/O and data flow.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkMemoryHealth, analyzeJsonlFile } from '../../lib/memory-health.js';
import { collectMemoryMetrics, appendMetricSnapshot } from '../../lib/memory-metrics.js';
import {
  readGraphQueue,
  readMem0Queue,
  aggregateGraphOperations,
  deduplicateMem0Memories,
  clearQueueFile,
  isQueueStale,
  archiveQueue,
} from '../../lib/queue-processor.js';

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
  writeFileSync(path, decisions.map(d => JSON.stringify(d)).join('\n') + '\n');
}

function writeGraphQueue(dir: string, operations: Array<Record<string, unknown>>): void {
  const path = join(dir, '.claude', 'memory', 'graph-queue.jsonl');
  writeFileSync(path, operations.map(o => JSON.stringify(o)).join('\n') + '\n');
}

function writeMem0Queue(dir: string, memories: Array<Record<string, unknown>>): void {
  const path = join(dir, '.claude', 'memory', 'mem0-queue.jsonl');
  writeFileSync(path, memories.map(m => JSON.stringify(m)).join('\n') + '\n');
}

function writeAnalytics(dir: string, entries: Array<Record<string, unknown>>): void {
  const path = join(dir, '.claude', 'logs', 'mem0-analytics.jsonl');
  writeFileSync(path, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
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
      expect(report.tiers.graph.decisions.exists).toBe(false);
      expect(report.tiers.graph.decisions.lineCount).toBe(0);
      expect(report.tiers.graph.graphQueue.exists).toBe(false);
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
  // Phase 2: Populate decisions, verify health + metrics
  // ---------------------------------------------------------------------------

  describe('Phase 2: Populated project health + metrics', () => {
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

      writeAnalytics(testDir, [
        { event: 'session_start', timestamp: '2025-01-15T09:00:00Z', session_id: 'sess-001' },
        { event: 'session_start', timestamp: '2025-01-16T09:00:00Z', session_id: 'sess-002' },
        { event: 'session_start', timestamp: '2025-01-17T09:00:00Z', session_id: 'sess-003' },
      ]);
    });

    it('health check reports healthy with valid decisions', () => {
      const report = checkMemoryHealth(testDir);

      expect(report.overall).toBe('healthy');
      expect(report.tiers.graph.status).toBe('healthy');
      expect(report.tiers.graph.decisions.exists).toBe(true);
      expect(report.tiers.graph.decisions.lineCount).toBe(5);
      expect(report.tiers.graph.decisions.corruptLines).toBe(0);
    });

    it('metrics collection counts decisions correctly', () => {
      const metrics = collectMemoryMetrics(testDir);

      expect(metrics.decisions.total).toBe(5);
      expect(metrics.decisions.byCategory).toEqual({
        database: 2,
        language: 1,
        api: 1,
        architecture: 1,
      });
      expect(metrics.decisions.byType).toEqual({
        decision: 2,
        preference: 1,
        pattern: 1,
        'problem-solution': 1,
      });
    });

    it('metrics collection counts sessions from analytics', () => {
      const metrics = collectMemoryMetrics(testDir);
      expect(metrics.sessionCount).toBe(3);
    });

    it('health check detects last sync timestamp', () => {
      const report = checkMemoryHealth(testDir);
      expect(report.tiers.mem0.lastSyncTimestamp).toBe('2025-01-17T09:00:00Z');
    });

    it('appendMetricSnapshot writes to metrics log', () => {
      const metrics = collectMemoryMetrics(testDir);
      appendMetricSnapshot(testDir, metrics);

      const metricsPath = join(testDir, '.claude', 'logs', 'memory-metrics.jsonl');
      expect(existsSync(metricsPath)).toBe(true);

      const content = readFileSync(metricsPath, 'utf8');
      const parsed = JSON.parse(content.trim());
      expect(parsed.decisions.total).toBe(5);
      expect(parsed.queues.graphQueueDepth).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 3: Degraded state detection
  // ---------------------------------------------------------------------------

  describe('Phase 3: Degraded state detection', () => {
    it('detects corrupt lines in decisions', () => {
      const decisionsPath = join(testDir, '.claude', 'memory', 'decisions.jsonl');
      writeFileSync(decisionsPath, [
        JSON.stringify({ type: 'decision', content: { what: 'Valid' } }),
        'NOT VALID JSON',
        JSON.stringify({ type: 'decision', content: { what: 'Also valid' } }),
        '{broken json...',
      ].join('\n') + '\n');

      const report = checkMemoryHealth(testDir);
      expect(report.overall).toBe('degraded');
      expect(report.tiers.graph.status).toBe('degraded');
      expect(report.tiers.graph.decisions.corruptLines).toBe(2);
      expect(report.tiers.graph.decisions.lineCount).toBe(4);
    });

    it('analyzeJsonlFile returns correct metrics for mixed content', () => {
      const filePath = join(testDir, '.claude', 'memory', 'test.jsonl');
      writeFileSync(filePath, [
        JSON.stringify({ valid: true }),
        'corrupt',
        JSON.stringify({ valid: true }),
      ].join('\n') + '\n');

      const health = analyzeJsonlFile(filePath);
      expect(health.exists).toBe(true);
      expect(health.lineCount).toBe(3);
      expect(health.corruptLines).toBe(1);
      expect(health.sizeBytes).toBeGreaterThan(0);
      expect(health.lastModified).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 4: Queue operations end-to-end
  // ---------------------------------------------------------------------------

  describe('Phase 4: Queue processor end-to-end', () => {
    it('reads and aggregates graph queue operations', () => {
      writeGraphQueue(testDir, [
        {
          type: 'create_entities',
          payload: {
            entities: [
              { name: 'PostgreSQL', entityType: 'Technology', observations: ['Chosen for DB'] },
              { name: 'Redis', entityType: 'Technology', observations: ['Cache layer'] },
            ],
          },
          timestamp: '2025-01-15T10:00:00Z',
        },
        {
          type: 'create_relations',
          payload: {
            relations: [
              { from: 'PostgreSQL', to: 'Redis', relationType: 'RELATES_TO' },
            ],
          },
          timestamp: '2025-01-15T10:01:00Z',
        },
        {
          type: 'create_entities',
          payload: {
            entities: [
              { name: 'PostgreSQL', entityType: 'Technology', observations: ['Duplicate'] },
              { name: 'FastAPI', entityType: 'Technology', observations: ['Web framework'] },
            ],
          },
          timestamp: '2025-01-15T10:02:00Z',
        },
      ]);

      const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
      const operations = readGraphQueue(queuePath);
      expect(operations).toHaveLength(3);

      const aggregated = aggregateGraphOperations(operations);
      // PostgreSQL deduplicated
      expect(aggregated.entities).toHaveLength(3);
      expect(aggregated.entities.map(e => e.name)).toEqual(['PostgreSQL', 'Redis', 'FastAPI']);
      expect(aggregated.relations).toHaveLength(1);
      expect(aggregated.relations[0].from).toBe('PostgreSQL');
      expect(aggregated.relations[0].to).toBe('Redis');
    });

    it('reads and deduplicates mem0 queue', () => {
      writeMem0Queue(testDir, [
        {
          text: 'Use PostgreSQL for database',
          user_id: 'project-test',
          metadata: { category: 'database' },
          queued_at: '2025-01-15T10:00:00Z',
        },
        {
          text: 'use postgresql for database', // duplicate (case-insensitive)
          user_id: 'project-test',
          metadata: { category: 'database' },
          queued_at: '2025-01-15T11:00:00Z', // newer
        },
        {
          text: 'Use FastAPI for API layer',
          user_id: 'project-test',
          metadata: { category: 'api' },
          queued_at: '2025-01-15T10:30:00Z',
        },
      ]);

      const queuePath = join(testDir, '.claude', 'memory', 'mem0-queue.jsonl');
      const memories = readMem0Queue(queuePath);
      expect(memories).toHaveLength(3);

      const deduped = deduplicateMem0Memories(memories);
      expect(deduped).toHaveLength(2);
      // Should keep the newer duplicate
      const pgMemory = deduped.find(m => m.text.toLowerCase().includes('postgresql'));
      expect(pgMemory?.queued_at).toBe('2025-01-15T11:00:00Z');
    });

    it('clears queue file', () => {
      const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
      writeFileSync(queuePath, 'test\n');
      expect(existsSync(queuePath)).toBe(true);

      clearQueueFile(queuePath);
      expect(existsSync(queuePath)).toBe(false);
    });

    it('detects stale vs fresh queues', () => {
      const freshPath = join(testDir, '.claude', 'memory', 'fresh-queue.jsonl');
      writeFileSync(freshPath, 'test\n');

      // Fresh file should not be stale
      expect(isQueueStale(freshPath, 24 * 60 * 60 * 1000)).toBe(false);

      // Non-existent file
      expect(isQueueStale(join(testDir, 'nonexistent'), 24 * 60 * 60 * 1000)).toBe(false);
    });

    it('archives queue to archive directory', () => {
      const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
      writeFileSync(queuePath, JSON.stringify({ type: 'test' }) + '\n');

      const archiveDir = join(testDir, '.claude', 'memory', 'archive');
      archiveQueue(queuePath, archiveDir);

      // Original should be gone
      expect(existsSync(queuePath)).toBe(false);
      // Archive dir should exist with the archived file
      expect(existsSync(archiveDir)).toBe(true);

      const files = readdirSync(archiveDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('graph-queue.jsonl');
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 5: Queue depth affects health + metrics
  // ---------------------------------------------------------------------------

  describe('Phase 5: Queue depth integration', () => {
    it('high queue depth degrades health and shows in metrics', () => {
      // Write many queue entries (>50)
      const manyOps = Array.from({ length: 55 }, (_, i) => ({
        type: 'create_entities',
        payload: {
          entities: [{ name: `Entity${i}`, entityType: 'Technology', observations: ['test'] }],
        },
        timestamp: new Date().toISOString(),
      }));
      writeGraphQueue(testDir, manyOps);

      // Health check should show degraded
      const report = checkMemoryHealth(testDir);
      expect(report.tiers.graph.status).toBe('degraded');
      expect(report.tiers.graph.graphQueue.lineCount).toBe(55);

      // Metrics should reflect queue depth
      const metrics = collectMemoryMetrics(testDir);
      expect(metrics.queues.graphQueueDepth).toBe(55);
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 6: Full lifecycle - health → metrics → queue ops
  // ---------------------------------------------------------------------------

  describe('Phase 6: Full lifecycle pipeline', () => {
    it('simulates complete session flow', () => {
      // Step 1: Start with decisions and queued items from previous session
      writeDecisions(testDir, [
        {
          type: 'decision',
          content: { what: 'Use Redis for caching', why: 'Low latency' },
          entities: ['Redis'],
          metadata: { category: 'infrastructure', timestamp: '2025-01-20T10:00:00Z' },
        },
      ]);

      writeGraphQueue(testDir, [
        {
          type: 'create_entities',
          payload: {
            entities: [{ name: 'Kafka', entityType: 'Technology', observations: ['Event streaming'] }],
          },
          timestamp: '2025-01-20T11:00:00Z',
        },
      ]);

      writeAnalytics(testDir, [
        { event: 'session_start', timestamp: '2025-01-20T09:00:00Z', session_id: 'sess-prev' },
      ]);

      // Step 2: Health check on session start
      const healthReport = checkMemoryHealth(testDir);
      expect(healthReport.overall).toBe('healthy');
      expect(healthReport.tiers.graph.decisions.lineCount).toBe(1);
      expect(healthReport.tiers.graph.graphQueue.lineCount).toBe(1);

      // Step 3: Collect and persist metrics
      const metrics = collectMemoryMetrics(testDir);
      expect(metrics.decisions.total).toBe(1);
      expect(metrics.queues.graphQueueDepth).toBe(1);
      expect(metrics.sessionCount).toBe(1);

      appendMetricSnapshot(testDir, metrics);
      const metricsPath = join(testDir, '.claude', 'logs', 'memory-metrics.jsonl');
      expect(existsSync(metricsPath)).toBe(true);

      // Step 4: Process orphaned graph queue
      const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
      const operations = readGraphQueue(queuePath);
      expect(operations).toHaveLength(1);

      const aggregated = aggregateGraphOperations(operations);
      expect(aggregated.entities).toHaveLength(1);
      expect(aggregated.entities[0].name).toBe('Kafka');

      clearQueueFile(queuePath);
      expect(existsSync(queuePath)).toBe(false);

      // Step 5: Verify queue depth is now 0
      const postMetrics = collectMemoryMetrics(testDir);
      expect(postMetrics.queues.graphQueueDepth).toBe(0);

      // Step 6: Health check should still be healthy
      const postHealth = checkMemoryHealth(testDir);
      expect(postHealth.overall).toBe('healthy');
      expect(postHealth.tiers.graph.graphQueue.lineCount).toBe(0);
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
      expect(report.tiers.graph.decisions.lineCount).toBe(0);

      const metrics = collectMemoryMetrics(testDir);
      expect(metrics.decisions.total).toBe(0);
      expect(metrics.queues.graphQueueDepth).toBe(0);
    });

    it('handles whitespace-only JSONL files', () => {
      writeFileSync(join(testDir, '.claude', 'memory', 'decisions.jsonl'), '  \n\n  \n');

      const report = checkMemoryHealth(testDir);
      expect(report.tiers.graph.decisions.lineCount).toBe(0);
    });

    it('handles graph queue with mixed valid and corrupt lines', () => {
      const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
      writeFileSync(queuePath, [
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
      ].join('\n') + '\n');

      const operations = readGraphQueue(queuePath);
      expect(operations).toHaveLength(2); // Corrupt line skipped

      const aggregated = aggregateGraphOperations(operations);
      expect(aggregated.entities.map(e => e.name)).toEqual(['Valid', 'AlsoValid']);
    });

    it('handles mem0 queue with missing required fields', () => {
      const queuePath = join(testDir, '.claude', 'memory', 'mem0-queue.jsonl');
      writeFileSync(queuePath, [
        JSON.stringify({ text: 'Valid memory', user_id: 'test', metadata: {}, queued_at: new Date().toISOString() }),
        JSON.stringify({ text: 'Missing user_id', metadata: {} }), // invalid: no user_id
        JSON.stringify({ user_id: 'test', metadata: {} }), // invalid: no text
        JSON.stringify({ text: 'Also valid', user_id: 'test', metadata: {}, queued_at: new Date().toISOString() }),
      ].join('\n') + '\n');

      const memories = readMem0Queue(queuePath);
      expect(memories).toHaveLength(2); // Only entries with both text and user_id
    });

    it('handles concurrent queue file operations gracefully', () => {
      const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');

      // Write, read, clear in sequence
      writeFileSync(queuePath, JSON.stringify({ type: 'create_entities', payload: { entities: [] }, timestamp: '' }) + '\n');
      const ops = readGraphQueue(queuePath);
      expect(ops).toHaveLength(1);

      clearQueueFile(queuePath);
      expect(existsSync(queuePath)).toBe(false);

      // Reading cleared file should return empty
      const opsAfterClear = readGraphQueue(queuePath);
      expect(opsAfterClear).toHaveLength(0);
    });
  });
});

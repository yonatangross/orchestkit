/**
 * Integration Test: Queue Processor Refactoring
 *
 * Validates that graph-queue-sync and mem0-queue-sync work correctly
 * through the shared queue-processor.ts module.
 *
 * Tests:
 * - readGraphQueue + aggregateGraphOperations pipeline
 * - readMem0Queue + deduplicateMem0Memories pipeline
 * - clearQueueFile + isQueueStale + archiveQueue operations
 * - Entity deduplication across multiple operations
 * - Relation deduplication with composite keys
 * - Observation aggregation for same entity
 * - Mixed operation types in single queue
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  readGraphQueue,
  readMem0Queue,
  aggregateGraphOperations,
  deduplicateMem0Memories,
  clearQueueFile,
  isQueueStale,
  archiveQueue,
  type QueuedMem0Memory,
} from '../../lib/queue-processor.js';

// =============================================================================
// HELPERS
// =============================================================================

let testDir: string;

function setup(): string {
  const dir = join(tmpdir(), `orchestkit-integ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(join(dir, 'memory'), { recursive: true });
  mkdirSync(join(dir, 'archive'), { recursive: true });
  return dir;
}

function writeQueueFile(dir: string, filename: string, lines: Array<Record<string, unknown>>): string {
  const path = join(dir, 'memory', filename);
  writeFileSync(path, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
  return path;
}

// =============================================================================
// GRAPH QUEUE INTEGRATION
// =============================================================================

describe('Integration: Graph Queue Pipeline', () => {
  beforeEach(() => { testDir = setup(); });
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }); });

  it('processes single create_entities operation', () => {
    const queuePath = writeQueueFile(testDir, 'graph-queue.jsonl', [
      {
        type: 'create_entities',
        payload: {
          entities: [
            { name: 'PostgreSQL', entityType: 'Technology', observations: ['Primary DB'] },
            { name: 'Redis', entityType: 'Technology', observations: ['Cache'] },
          ],
        },
        timestamp: '2025-01-15T10:00:00Z',
      },
    ]);

    const ops = readGraphQueue(queuePath);
    const aggregated = aggregateGraphOperations(ops);

    expect(aggregated.entities).toHaveLength(2);
    expect(aggregated.entities[0].name).toBe('PostgreSQL');
    expect(aggregated.entities[1].name).toBe('Redis');
    expect(aggregated.relations).toHaveLength(0);
    expect(aggregated.observations).toHaveLength(0);
  });

  it('deduplicates entities across multiple operations', () => {
    const queuePath = writeQueueFile(testDir, 'graph-queue.jsonl', [
      {
        type: 'create_entities',
        payload: {
          entities: [
            { name: 'PostgreSQL', entityType: 'Technology', observations: ['DB'] },
            { name: 'Redis', entityType: 'Technology', observations: ['Cache'] },
          ],
        },
        timestamp: '2025-01-15T10:00:00Z',
      },
      {
        type: 'create_entities',
        payload: {
          entities: [
            { name: 'PostgreSQL', entityType: 'Technology', observations: ['Duplicate'] },
            { name: 'FastAPI', entityType: 'Technology', observations: ['Web'] },
          ],
        },
        timestamp: '2025-01-15T10:01:00Z',
      },
      {
        type: 'create_entities',
        payload: {
          entities: [
            { name: 'Redis', entityType: 'Technology', observations: ['Also duplicate'] },
          ],
        },
        timestamp: '2025-01-15T10:02:00Z',
      },
    ]);

    const ops = readGraphQueue(queuePath);
    const aggregated = aggregateGraphOperations(ops);

    // PostgreSQL and Redis should only appear once each
    expect(aggregated.entities).toHaveLength(3);
    expect(aggregated.entities.map(e => e.name)).toEqual(['PostgreSQL', 'Redis', 'FastAPI']);
  });

  it('deduplicates relations by composite key (from|type|to)', () => {
    const queuePath = writeQueueFile(testDir, 'graph-queue.jsonl', [
      {
        type: 'create_relations',
        payload: {
          relations: [
            { from: 'PostgreSQL', to: 'Redis', relationType: 'RELATES_TO' },
            { from: 'PostgreSQL', to: 'FastAPI', relationType: 'CHOSE' },
          ],
        },
        timestamp: '2025-01-15T10:00:00Z',
      },
      {
        type: 'create_relations',
        payload: {
          relations: [
            { from: 'PostgreSQL', to: 'Redis', relationType: 'RELATES_TO' }, // duplicate
            { from: 'PostgreSQL', to: 'Redis', relationType: 'CONSTRAINT' }, // different type, not duplicate
          ],
        },
        timestamp: '2025-01-15T10:01:00Z',
      },
    ]);

    const ops = readGraphQueue(queuePath);
    const aggregated = aggregateGraphOperations(ops);

    expect(aggregated.relations).toHaveLength(3);
    const keys = aggregated.relations.map(r => `${r.from}|${r.relationType}|${r.to}`);
    expect(keys).toEqual([
      'PostgreSQL|RELATES_TO|Redis',
      'PostgreSQL|CHOSE|FastAPI',
      'PostgreSQL|CONSTRAINT|Redis',
    ]);
  });

  it('aggregates observations for same entity', () => {
    const queuePath = writeQueueFile(testDir, 'graph-queue.jsonl', [
      {
        type: 'add_observations',
        payload: {
          observations: [
            { entityName: 'PostgreSQL', contents: ['Primary database', 'ACID compliant'] },
            { entityName: 'Redis', contents: ['Cache layer'] },
          ],
        },
        timestamp: '2025-01-15T10:00:00Z',
      },
      {
        type: 'add_observations',
        payload: {
          observations: [
            { entityName: 'PostgreSQL', contents: ['Supports JSONB'] },
          ],
        },
        timestamp: '2025-01-15T10:01:00Z',
      },
    ]);

    const ops = readGraphQueue(queuePath);
    const aggregated = aggregateGraphOperations(ops);

    expect(aggregated.observations).toHaveLength(2);

    const pgObs = aggregated.observations.find(o => o.entityName === 'PostgreSQL');
    expect(pgObs?.contents).toEqual(['Primary database', 'ACID compliant', 'Supports JSONB']);

    const redisObs = aggregated.observations.find(o => o.entityName === 'Redis');
    expect(redisObs?.contents).toEqual(['Cache layer']);
  });

  it('handles mixed operation types in single queue', () => {
    const queuePath = writeQueueFile(testDir, 'graph-queue.jsonl', [
      {
        type: 'create_entities',
        payload: {
          entities: [
            { name: 'PostgreSQL', entityType: 'Technology', observations: ['DB'] },
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
        type: 'add_observations',
        payload: {
          observations: [
            { entityName: 'PostgreSQL', contents: ['Production ready'] },
          ],
        },
        timestamp: '2025-01-15T10:02:00Z',
      },
    ]);

    const ops = readGraphQueue(queuePath);
    const aggregated = aggregateGraphOperations(ops);

    expect(aggregated.entities).toHaveLength(1);
    expect(aggregated.relations).toHaveLength(1);
    expect(aggregated.observations).toHaveLength(1);
    expect(aggregated.observations[0].contents).toEqual(['Production ready']);
  });

  it('returns empty aggregation for empty queue', () => {
    const queuePath = join(testDir, 'memory', 'nonexistent.jsonl');
    const ops = readGraphQueue(queuePath);
    expect(ops).toHaveLength(0);

    const aggregated = aggregateGraphOperations(ops);
    expect(aggregated.entities).toHaveLength(0);
    expect(aggregated.relations).toHaveLength(0);
    expect(aggregated.observations).toHaveLength(0);
  });

  it('skips corrupt JSON lines and processes valid ones', () => {
    const queuePath = join(testDir, 'memory', 'graph-queue.jsonl');
    writeFileSync(queuePath, [
      JSON.stringify({
        type: 'create_entities',
        payload: { entities: [{ name: 'Valid1', entityType: 'Tech', observations: ['ok'] }] },
        timestamp: '',
      }),
      '{{CORRUPT_LINE',
      '',
      'ANOTHER_CORRUPT',
      JSON.stringify({
        type: 'create_entities',
        payload: { entities: [{ name: 'Valid2', entityType: 'Tech', observations: ['ok'] }] },
        timestamp: '',
      }),
    ].join('\n') + '\n');

    const ops = readGraphQueue(queuePath);
    expect(ops).toHaveLength(2);

    const aggregated = aggregateGraphOperations(ops);
    expect(aggregated.entities.map(e => e.name)).toEqual(['Valid1', 'Valid2']);
  });
});

// =============================================================================
// MEM0 QUEUE INTEGRATION
// =============================================================================

describe('Integration: Mem0 Queue Pipeline', () => {
  beforeEach(() => { testDir = setup(); });
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }); });

  it('reads valid mem0 memories', () => {
    const queuePath = writeQueueFile(testDir, 'mem0-queue.jsonl', [
      {
        text: 'Use PostgreSQL for database',
        user_id: 'project-test',
        metadata: { category: 'database', type: 'decision' },
        queued_at: '2025-01-15T10:00:00Z',
      },
      {
        text: 'Prefer TypeScript strict mode',
        user_id: 'project-test',
        metadata: { category: 'language', type: 'preference' },
        queued_at: '2025-01-15T11:00:00Z',
      },
    ]);

    const memories = readMem0Queue(queuePath);
    expect(memories).toHaveLength(2);
    expect(memories[0].text).toBe('Use PostgreSQL for database');
    expect(memories[1].text).toBe('Prefer TypeScript strict mode');
  });

  it('deduplicates by text (case-insensitive), keeping most recent', () => {
    const memories: QueuedMem0Memory[] = [
      { text: 'Use PostgreSQL', user_id: 'test', metadata: {}, queued_at: '2025-01-15T10:00:00Z' },
      { text: 'use postgresql', user_id: 'test', metadata: {}, queued_at: '2025-01-15T12:00:00Z' },
      { text: 'USE POSTGRESQL', user_id: 'test', metadata: {}, queued_at: '2025-01-15T11:00:00Z' },
      { text: 'Use Redis', user_id: 'test', metadata: {}, queued_at: '2025-01-15T10:30:00Z' },
    ];

    const deduped = deduplicateMem0Memories(memories);
    expect(deduped).toHaveLength(2);

    // Most recent PostgreSQL entry (12:00:00Z) should win
    const pgMemory = deduped.find(m => m.text.toLowerCase() === 'use postgresql');
    expect(pgMemory?.queued_at).toBe('2025-01-15T12:00:00Z');
  });

  it('deduplicates with trailing whitespace normalization', () => {
    const memories: QueuedMem0Memory[] = [
      { text: '  Use PostgreSQL  ', user_id: 'test', metadata: {}, queued_at: '2025-01-15T10:00:00Z' },
      { text: 'Use PostgreSQL', user_id: 'test', metadata: {}, queued_at: '2025-01-15T12:00:00Z' },
    ];

    const deduped = deduplicateMem0Memories(memories);
    // After trim+lowercase, these should match
    expect(deduped).toHaveLength(1);
    expect(deduped[0].queued_at).toBe('2025-01-15T12:00:00Z');
  });

  it('rejects entries missing required fields', () => {
    const queuePath = join(testDir, 'memory', 'mem0-queue.jsonl');
    writeFileSync(queuePath, [
      JSON.stringify({ text: 'Valid', user_id: 'test', metadata: {}, queued_at: '' }),
      JSON.stringify({ text: 'Missing user_id' }), // no user_id
      JSON.stringify({ user_id: 'test' }), // no text
      JSON.stringify({ text: '', user_id: 'test' }), // empty text
      JSON.stringify({ text: 'Also valid', user_id: 'test', metadata: {}, queued_at: '' }),
    ].join('\n') + '\n');

    const memories = readMem0Queue(queuePath);
    expect(memories).toHaveLength(2);
    expect(memories[0].text).toBe('Valid');
    expect(memories[1].text).toBe('Also valid');
  });

  it('handles empty queue file', () => {
    const queuePath = join(testDir, 'memory', 'mem0-queue.jsonl');
    writeFileSync(queuePath, '');

    const memories = readMem0Queue(queuePath);
    expect(memories).toHaveLength(0);
  });
});

// =============================================================================
// QUEUE MANAGEMENT INTEGRATION
// =============================================================================

describe('Integration: Queue Management Operations', () => {
  beforeEach(() => { testDir = setup(); });
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }); });

  describe('clearQueueFile', () => {
    it('removes existing file', () => {
      const path = join(testDir, 'memory', 'test.jsonl');
      writeFileSync(path, 'data\n');
      expect(existsSync(path)).toBe(true);

      clearQueueFile(path);
      expect(existsSync(path)).toBe(false);
    });

    it('handles non-existent file gracefully', () => {
      const path = join(testDir, 'memory', 'nonexistent.jsonl');
      expect(() => clearQueueFile(path)).not.toThrow();
    });
  });

  describe('isQueueStale', () => {
    it('returns false for fresh files', () => {
      const path = join(testDir, 'memory', 'fresh.jsonl');
      writeFileSync(path, 'data\n');

      expect(isQueueStale(path, 24 * 60 * 60 * 1000)).toBe(false);
    });

    it('returns false for non-existent files', () => {
      expect(isQueueStale(join(testDir, 'memory', 'nope'), 1000)).toBe(false);
    });
  });

  describe('archiveQueue', () => {
    it('moves file to archive directory', () => {
      const queuePath = join(testDir, 'memory', 'graph-queue.jsonl');
      const archiveDir = join(testDir, 'archive');
      const content = JSON.stringify({ type: 'test' }) + '\n';
      writeFileSync(queuePath, content);

      archiveQueue(queuePath, archiveDir);

      expect(existsSync(queuePath)).toBe(false);
      const archivedFiles = readdirSync(archiveDir);
      expect(archivedFiles.length).toBe(1);
      expect(archivedFiles[0]).toContain('graph-queue.jsonl');

      // Verify archived content is the same
      const archivedContent = readFileSync(join(archiveDir, archivedFiles[0]), 'utf8');
      expect(archivedContent).toBe(content);
    });

    it('creates archive directory if not exists', () => {
      const queuePath = join(testDir, 'memory', 'test.jsonl');
      const newArchiveDir = join(testDir, 'new-archive');
      writeFileSync(queuePath, 'data\n');

      expect(existsSync(newArchiveDir)).toBe(false);
      archiveQueue(queuePath, newArchiveDir);
      expect(existsSync(newArchiveDir)).toBe(true);
    });

    it('handles non-existent queue file gracefully', () => {
      const archiveDir = join(testDir, 'archive');
      expect(() => archiveQueue(join(testDir, 'nope'), archiveDir)).not.toThrow();
    });
  });
});

// =============================================================================
// FULL PIPELINE INTEGRATION
// =============================================================================

describe('Integration: Full Queue Pipeline (read → process → clear)', () => {
  beforeEach(() => { testDir = setup(); });
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }); });

  it('graph queue: read → aggregate → clear pipeline', () => {
    const queuePath = writeQueueFile(testDir, 'graph-queue.jsonl', [
      {
        type: 'create_entities',
        payload: {
          entities: [
            { name: 'PostgreSQL', entityType: 'Technology', observations: ['DB'] },
            { name: 'Redis', entityType: 'Technology', observations: ['Cache'] },
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
    ]);

    // Read
    const operations = readGraphQueue(queuePath);
    expect(operations).toHaveLength(2);

    // Aggregate
    const aggregated = aggregateGraphOperations(operations);
    expect(aggregated.entities).toHaveLength(2);
    expect(aggregated.relations).toHaveLength(1);

    // Clear
    clearQueueFile(queuePath);
    expect(existsSync(queuePath)).toBe(false);

    // Verify empty after clear
    const opsAfterClear = readGraphQueue(queuePath);
    expect(opsAfterClear).toHaveLength(0);
  });

  it('mem0 queue: read → deduplicate → clear pipeline', () => {
    const queuePath = writeQueueFile(testDir, 'mem0-queue.jsonl', [
      { text: 'Use PostgreSQL', user_id: 'test', metadata: { category: 'database' }, queued_at: '2025-01-15T10:00:00Z' },
      { text: 'use postgresql', user_id: 'test', metadata: { category: 'database' }, queued_at: '2025-01-15T12:00:00Z' },
      { text: 'Use Redis for caching', user_id: 'test', metadata: { category: 'cache' }, queued_at: '2025-01-15T11:00:00Z' },
    ]);

    // Read
    const memories = readMem0Queue(queuePath);
    expect(memories).toHaveLength(3);

    // Deduplicate
    const deduped = deduplicateMem0Memories(memories);
    expect(deduped).toHaveLength(2);

    // Clear
    clearQueueFile(queuePath);
    expect(existsSync(queuePath)).toBe(false);
  });

  it('stale queue: detect → archive → verify removal', () => {
    const queuePath = join(testDir, 'memory', 'graph-queue.jsonl');
    const archiveDir = join(testDir, 'archive');
    const content = JSON.stringify({ type: 'create_entities', payload: { entities: [] }, timestamp: '' }) + '\n';
    writeFileSync(queuePath, content);

    // Fresh file should not be stale
    expect(isQueueStale(queuePath, 24 * 60 * 60 * 1000)).toBe(false);

    // Archive it
    archiveQueue(queuePath, archiveDir);

    // Original gone, archive has the file
    expect(existsSync(queuePath)).toBe(false);
    expect(readdirSync(archiveDir).length).toBe(1);
  });

  it('large queue: handles 100+ operations efficiently', () => {
    const manyOps = Array.from({ length: 100 }, (_, i) => ({
      type: 'create_entities',
      payload: {
        entities: [
          { name: `Entity_${i}`, entityType: 'Technology', observations: [`Observation ${i}`] },
          { name: `Shared_Entity`, entityType: 'Technology', observations: [`From op ${i}`] },
        ],
      },
      timestamp: new Date(Date.now() + i * 1000).toISOString(),
    }));

    const queuePath = writeQueueFile(testDir, 'graph-queue.jsonl', manyOps);

    const ops = readGraphQueue(queuePath);
    expect(ops).toHaveLength(100);

    const aggregated = aggregateGraphOperations(ops);
    // 100 unique Entity_N + 1 Shared_Entity = 101
    expect(aggregated.entities).toHaveLength(101);
    // Shared_Entity should appear only once (deduped)
    expect(aggregated.entities.filter(e => e.name === 'Shared_Entity')).toHaveLength(1);
  });
});

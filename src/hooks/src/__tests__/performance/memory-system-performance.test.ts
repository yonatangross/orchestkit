/**
 * Performance Tests for Memory System Modules
 *
 * Validates that memory system operations complete within acceptable time
 * thresholds under load. Uses real filesystem (tmpdir) for accurate I/O
 * measurement -- NO mocks.
 *
 * Modules under test:
 * - memory-health.ts: checkMemoryHealth, analyzeJsonlFile
 * - memory-metrics.ts: collectMemoryMetrics, appendMetricSnapshot
 * - queue-processor.ts: readGraphQueue, readMem0Queue, aggregateGraphOperations,
 *                       deduplicateMem0Memories, clearQueueFile, archiveQueue
 *
 * Thresholds are deliberately generous (2-5x expected) to avoid flaky CI
 * failures. The goal is regression detection, not exact benchmarking.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { analyzeJsonlFile, checkMemoryHealth } from '../../lib/memory-health.js';
import { collectMemoryMetrics, appendMetricSnapshot } from '../../lib/memory-metrics.js';
import {
  readGraphQueue,
  readMem0Queue,
  aggregateGraphOperations,
  deduplicateMem0Memories,
  clearQueueFile,
  archiveQueue,
} from '../../lib/queue-processor.js';
import type { QueuedMem0Memory } from '../../lib/queue-processor.js';

// =============================================================================
// HELPERS
// =============================================================================

let testDir: string;

/**
 * Create an isolated temporary directory with the expected memory system
 * directory structure (.claude/memory, .claude/logs, archive).
 */
function createTestDir(): string {
  const dir = join(
    tmpdir(),
    `orchestkit-perf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(join(dir, '.claude', 'memory'), { recursive: true });
  mkdirSync(join(dir, '.claude', 'logs'), { recursive: true });
  mkdirSync(join(dir, 'archive'), { recursive: true });
  return dir;
}

/**
 * Generate a single valid JSONL decision line.
 * Produces a realistic decision record with metadata, matching what
 * memory-writer.ts produces.
 */
function generateDecisionLine(index: number): string {
  return JSON.stringify({
    id: `decision-${index}`,
    type: index % 3 === 0 ? 'decision' : index % 3 === 1 ? 'preference' : 'pattern',
    content: {
      what: `Use technology-${index} for feature-${index}`,
      why: `It provides better performance for use-case-${index}`,
      alternatives: [`alt-a-${index}`, `alt-b-${index}`],
      constraints: [`constraint-${index}`],
    },
    entities: [`tech-${index}`, `pattern-${index % 50}`],
    relations: [],
    identity: {
      user_id: `user-${index % 10}`,
      anonymous_id: `anon-${index % 10}`,
      machine_id: 'test-machine',
    },
    metadata: {
      session_id: `session-${index % 5}`,
      timestamp: new Date(Date.now() - index * 60000).toISOString(),
      confidence: 0.7 + (index % 30) * 0.01,
      source: 'user_prompt',
      project: 'test-project',
      category: ['database', 'api', 'frontend', 'performance', 'architecture'][index % 5],
      importance: ['high', 'medium', 'low'][index % 3] as 'high' | 'medium' | 'low',
    },
  });
}

/**
 * Generate a JSONL string with N decision lines.
 */
function generateDecisionsJsonl(count: number): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(generateDecisionLine(i));
  }
  return lines.join('\n') + '\n';
}

/**
 * Generate a single graph queue operation line.
 * Cycles through create_entities, create_relations, and add_observations.
 */
function generateGraphQueueLine(index: number): string {
  const opType = index % 3;

  if (opType === 0) {
    return JSON.stringify({
      type: 'create_entities',
      payload: {
        entities: [
          {
            name: `Entity-${index}`,
            entityType: 'Technology',
            observations: [`Observation for entity ${index}`],
          },
          {
            name: `SharedEntity-${index % 20}`,
            entityType: 'Pattern',
            observations: [`Shared observation from op ${index}`],
          },
        ],
      },
      timestamp: new Date(Date.now() - index * 1000).toISOString(),
    });
  } else if (opType === 1) {
    return JSON.stringify({
      type: 'create_relations',
      payload: {
        relations: [
          {
            from: `Entity-${index}`,
            to: `Entity-${(index + 1) % 1000}`,
            relationType: 'RELATES_TO',
          },
          {
            from: `SharedEntity-${index % 20}`,
            to: `Entity-${index}`,
            relationType: 'CHOSE',
          },
        ],
      },
      timestamp: new Date(Date.now() - index * 1000).toISOString(),
    });
  } else {
    return JSON.stringify({
      type: 'add_observations',
      payload: {
        observations: [
          {
            entityName: `Entity-${index % 100}`,
            contents: [`Additional observation ${index}`, `Context note ${index}`],
          },
        ],
      },
      timestamp: new Date(Date.now() - index * 1000).toISOString(),
    });
  }
}

/**
 * Generate a graph queue JSONL string with N operation lines.
 */
function generateGraphQueueJsonl(count: number): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(generateGraphQueueLine(i));
  }
  return lines.join('\n') + '\n';
}

/**
 * Generate a single mem0 queue entry line.
 */
function generateMem0QueueLine(index: number): string {
  return JSON.stringify({
    text: `Memory entry about topic-${index}: decision regarding technology-${index % 100}`,
    user_id: `orchestkit-project-${index % 5}-decisions`,
    metadata: {
      type: index % 2 === 0 ? 'decision' : 'preference',
      category: ['database', 'api', 'frontend', 'security', 'testing'][index % 5],
      confidence: 0.6 + (index % 40) * 0.01,
      source: 'user_prompt',
      project: 'test-project',
      timestamp: new Date(Date.now() - index * 30000).toISOString(),
      entities: [`tech-${index}`, `pattern-${index % 30}`],
      importance: ['high', 'medium', 'low'][index % 3] as 'high' | 'medium' | 'low',
    },
    queued_at: new Date(Date.now() - index * 30000).toISOString(),
  });
}

/**
 * Generate a mem0 queue JSONL string with N entries.
 */
function generateMem0QueueJsonl(count: number): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(generateMem0QueueLine(i));
  }
  return lines.join('\n') + '\n';
}

/**
 * Generate a mem0 queue JSONL string with N entries where many are duplicates.
 * Produces ~50% duplicate text entries to stress deduplication.
 */
function generateMem0QueueWithDuplicates(count: number): QueuedMem0Memory[] {
  const memories: QueuedMem0Memory[] = [];
  for (let i = 0; i < count; i++) {
    // Use modulo to create duplicates: entries 0 and 500 will have same text, etc.
    const textIndex = i % Math.ceil(count / 2);
    memories.push({
      text: `Memory about topic-${textIndex}: decision regarding technology-${textIndex}`,
      user_id: `orchestkit-project-${textIndex % 5}-decisions`,
      metadata: {
        type: i % 2 === 0 ? 'decision' : 'preference',
        category: ['database', 'api', 'frontend', 'security', 'testing'][textIndex % 5],
        confidence: 0.7,
        source: 'user_prompt',
        project: 'test-project',
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
      },
      queued_at: new Date(Date.now() - i * 1000).toISOString(),
    });
  }
  return memories;
}

/**
 * Generate analytics log lines for session counting.
 */
function generateAnalyticsJsonl(count: number): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const event = i % 3 === 0 ? 'session_start' : i % 3 === 1 ? 'decision_stored' : 'mem0_sync';
    lines.push(
      JSON.stringify({
        event,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        session_id: `session-${i % 10}`,
      })
    );
  }
  return lines.join('\n') + '\n';
}

/**
 * Generate completed-flows JSONL lines.
 */
function generateCompletedFlowsJsonl(count: number): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(
      JSON.stringify({
        flow_id: `flow-${i}`,
        type: 'decision-capture',
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
      })
    );
  }
  return lines.join('\n') + '\n';
}

// =============================================================================
// LARGE JSONL PARSING PERFORMANCE
// =============================================================================

describe('Performance: Large JSONL Parsing', () => {
  beforeEach(() => {
    testDir = createTestDir();
  });
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('analyzeJsonlFile processes 10,000 lines within 500ms', () => {
    // Arrange
    const filePath = join(testDir, '.claude', 'memory', 'decisions.jsonl');
    const content = generateDecisionsJsonl(10_000);
    writeFileSync(filePath, content);

    // Act
    const start = performance.now();
    const result = analyzeJsonlFile(filePath);
    const elapsed = performance.now() - start;

    // Assert
    expect(result.exists).toBe(true);
    expect(result.lineCount).toBe(10_000);
    expect(result.corruptLines).toBe(0);
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.lastModified).toBeTruthy();
    expect(elapsed).toBeLessThan(500);
  });

  it('analyzeJsonlFile handles 10,000 lines with 5% corruption within 500ms', () => {
    // Arrange: inject 500 corrupt lines into 10,000
    const lines: string[] = [];
    for (let i = 0; i < 10_000; i++) {
      if (i % 20 === 0) {
        lines.push(`CORRUPT_LINE_${i}_NOT_JSON{{{`);
      } else {
        lines.push(generateDecisionLine(i));
      }
    }
    const filePath = join(testDir, '.claude', 'memory', 'decisions.jsonl');
    writeFileSync(filePath, lines.join('\n') + '\n');

    // Act
    const start = performance.now();
    const result = analyzeJsonlFile(filePath);
    const elapsed = performance.now() - start;

    // Assert
    expect(result.exists).toBe(true);
    expect(result.lineCount).toBe(10_000);
    expect(result.corruptLines).toBe(500);
    expect(elapsed).toBeLessThan(500);
  });

  it('collectMemoryMetrics processes project with 10,000 decisions within 500ms', () => {
    // Arrange: populate all memory files with realistic data
    const decisionsPath = join(testDir, '.claude', 'memory', 'decisions.jsonl');
    const graphQueuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    const mem0QueuePath = join(testDir, '.claude', 'memory', 'mem0-queue.jsonl');
    const completedFlowsPath = join(testDir, '.claude', 'memory', 'completed-flows.jsonl');
    const analyticsPath = join(testDir, '.claude', 'logs', 'mem0-analytics.jsonl');

    writeFileSync(decisionsPath, generateDecisionsJsonl(10_000));
    writeFileSync(graphQueuePath, generateGraphQueueJsonl(50));
    writeFileSync(mem0QueuePath, generateMem0QueueJsonl(30));
    writeFileSync(completedFlowsPath, generateCompletedFlowsJsonl(200));
    writeFileSync(analyticsPath, generateAnalyticsJsonl(500));

    // Act
    const start = performance.now();
    const metrics = collectMemoryMetrics(testDir);
    const elapsed = performance.now() - start;

    // Assert
    expect(metrics.decisions.total).toBe(10_000);
    expect(Object.keys(metrics.decisions.byCategory).length).toBeGreaterThan(0);
    expect(Object.keys(metrics.decisions.byType).length).toBeGreaterThan(0);
    expect(metrics.queues.graphQueueDepth).toBe(50);
    expect(metrics.queues.mem0QueueDepth).toBe(30);
    expect(metrics.completedFlows).toBe(200);
    expect(metrics.sessionCount).toBeGreaterThan(0);
    expect(metrics.timestamp).toBeTruthy();
    expect(elapsed).toBeLessThan(500);
  });

  it('checkMemoryHealth completes within 500ms on 10,000-line decisions file', () => {
    // Arrange
    const decisionsPath = join(testDir, '.claude', 'memory', 'decisions.jsonl');
    const graphQueuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    const mem0QueuePath = join(testDir, '.claude', 'memory', 'mem0-queue.jsonl');

    writeFileSync(decisionsPath, generateDecisionsJsonl(10_000));
    writeFileSync(graphQueuePath, generateGraphQueueJsonl(20));
    writeFileSync(mem0QueuePath, generateMem0QueueJsonl(10));

    // Act
    const start = performance.now();
    const report = checkMemoryHealth(testDir);
    const elapsed = performance.now() - start;

    // Assert
    expect(report.overall).toBeDefined();
    expect(report.tiers.graph.decisions.lineCount).toBe(10_000);
    expect(report.tiers.graph.decisions.corruptLines).toBe(0);
    expect(report.tiers.graph.graphQueue.lineCount).toBe(20);
    expect(report.tiers.mem0.mem0Queue.lineCount).toBe(10);
    expect(report.timestamp).toBeTruthy();
    expect(elapsed).toBeLessThan(500);
  });
});

// =============================================================================
// QUEUE PROCESSING UNDER LOAD
// =============================================================================

describe('Performance: Queue Processing Under Load', () => {
  beforeEach(() => {
    testDir = createTestDir();
  });
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('readGraphQueue + aggregateGraphOperations handles 1,000 operations with entity dedup in <200ms', () => {
    // Arrange: 1,000 operations with many duplicate entities
    const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    writeFileSync(queuePath, generateGraphQueueJsonl(1_000));

    // Act
    const start = performance.now();
    const operations = readGraphQueue(queuePath);
    const aggregated = aggregateGraphOperations(operations);
    const elapsed = performance.now() - start;

    // Assert
    expect(operations).toHaveLength(1_000);
    // Entities should be deduplicated (SharedEntity-0..19 appear many times)
    expect(aggregated.entities.length).toBeGreaterThan(0);
    expect(aggregated.entities.length).toBeLessThan(1_000 * 2); // Must be less than max possible
    expect(aggregated.relations.length).toBeGreaterThan(0);
    expect(aggregated.observations.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
  });

  it('readMem0Queue + deduplicateMem0Memories handles 1,000 entries with dedup in <200ms', () => {
    // Arrange: 1,000 mem0 entries, many with duplicate text
    const queuePath = join(testDir, '.claude', 'memory', 'mem0-queue.jsonl');
    // Write entries where many texts are duplicates
    const memories = generateMem0QueueWithDuplicates(1_000);
    writeFileSync(
      queuePath,
      memories.map(m => JSON.stringify(m)).join('\n') + '\n'
    );

    // Act
    const start = performance.now();
    const readMemories = readMem0Queue(queuePath);
    const deduped = deduplicateMem0Memories(readMemories);
    const elapsed = performance.now() - start;

    // Assert
    expect(readMemories).toHaveLength(1_000);
    // With ~50% duplicates, we should get roughly 500 unique entries
    expect(deduped.length).toBeLessThan(1_000);
    expect(deduped.length).toBeGreaterThan(0);
    expect(deduped.length).toBe(500); // Exactly ceil(1000/2) unique texts
    expect(elapsed).toBeLessThan(200);
  });

  it('handles 500 mixed operation types (entities, relations, observations) efficiently', () => {
    // Arrange: a balanced mix of all three operation types
    const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    const lines: string[] = [];

    // Generate ~167 of each type
    for (let i = 0; i < 500; i++) {
      lines.push(generateGraphQueueLine(i));
    }
    writeFileSync(queuePath, lines.join('\n') + '\n');

    // Act
    const start = performance.now();
    const operations = readGraphQueue(queuePath);
    const aggregated = aggregateGraphOperations(operations);
    const elapsed = performance.now() - start;

    // Assert
    expect(operations).toHaveLength(500);
    // ~167 create_entities ops, each with 2 entities (with dedup on SharedEntity)
    expect(aggregated.entities.length).toBeGreaterThan(100);
    // ~167 create_relations ops, each with 2 relations
    expect(aggregated.relations.length).toBeGreaterThan(100);
    // ~166 add_observations ops
    expect(aggregated.observations.length).toBeGreaterThan(50);
    expect(elapsed).toBeLessThan(200);
  });

  it('aggregateGraphOperations handles heavy entity deduplication (10,000 duplicate entities)', () => {
    // Arrange: create 1,000 operations, each with 10 entities drawn from a pool of 50 unique names.
    // Total raw entity count: 10,000, but only 50 unique names exist.
    const operations = Array.from({ length: 1_000 }, (_, i) => ({
      type: 'create_entities' as const,
      payload: {
        entities: Array.from({ length: 10 }, (_, j) => ({
          name: `DedupEntity-${(i * 10 + j) % 50}`, // 50 unique names across 10,000 entities
          entityType: 'Technology' as const,
          observations: [`Obs from batch ${i}, item ${j}`],
        })),
      },
      timestamp: new Date(Date.now() - i * 100).toISOString(),
    }));

    // Act
    const start = performance.now();
    const aggregated = aggregateGraphOperations(operations);
    const elapsed = performance.now() - start;

    // Assert: should deduplicate down to 50 unique entities
    expect(aggregated.entities).toHaveLength(50);
    expect(elapsed).toBeLessThan(300);
  });

  it('deduplicateMem0Memories handles heavy duplication (1,000 entries, 90% duplicates)', () => {
    // Arrange: 1,000 entries but only 100 unique texts
    const memories: QueuedMem0Memory[] = Array.from({ length: 1_000 }, (_, i) => ({
      text: `Unique memory text number ${i % 100}`,
      user_id: 'test-user',
      metadata: {
        category: 'test',
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
      },
      queued_at: new Date(Date.now() - i * 1000).toISOString(),
    }));

    // Act
    const start = performance.now();
    const deduped = deduplicateMem0Memories(memories);
    const elapsed = performance.now() - start;

    // Assert
    expect(deduped).toHaveLength(100);
    expect(elapsed).toBeLessThan(100);
  });
});

// =============================================================================
// HEALTH CHECK WITH BLOATED FILES
// =============================================================================

describe('Performance: Health Check with Bloated Files', () => {
  beforeEach(() => {
    testDir = createTestDir();
  });
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('checkMemoryHealth completes within 300ms with all JSONL files at max realistic size (1,000 lines each)', () => {
    // Arrange: populate every file the health check reads
    const memoryDir = join(testDir, '.claude', 'memory');
    const logsDir = join(testDir, '.claude', 'logs');

    writeFileSync(
      join(memoryDir, 'decisions.jsonl'),
      generateDecisionsJsonl(1_000)
    );
    writeFileSync(
      join(memoryDir, 'graph-queue.jsonl'),
      generateGraphQueueJsonl(1_000)
    );
    writeFileSync(
      join(memoryDir, 'mem0-queue.jsonl'),
      generateMem0QueueJsonl(1_000)
    );
    writeFileSync(
      join(logsDir, 'mem0-analytics.jsonl'),
      generateAnalyticsJsonl(1_000)
    );

    // Act
    const start = performance.now();
    const report = checkMemoryHealth(testDir);
    const elapsed = performance.now() - start;

    // Assert
    expect(report.overall).toBeDefined();
    expect(report.tiers.graph.decisions.lineCount).toBe(1_000);
    expect(report.tiers.graph.graphQueue.lineCount).toBe(1_000);
    expect(report.tiers.mem0.mem0Queue.lineCount).toBe(1_000);
    // Graph should be degraded due to high queue depth (>50)
    expect(report.tiers.graph.status).toBe('degraded');
    expect(elapsed).toBeLessThan(300);
  });

  it('collectMemoryMetrics handles project with many populated files within 500ms', () => {
    // Arrange: all files at realistic "heavy usage" sizes
    const memoryDir = join(testDir, '.claude', 'memory');
    const logsDir = join(testDir, '.claude', 'logs');

    writeFileSync(join(memoryDir, 'decisions.jsonl'), generateDecisionsJsonl(5_000));
    writeFileSync(join(memoryDir, 'graph-queue.jsonl'), generateGraphQueueJsonl(500));
    writeFileSync(join(memoryDir, 'mem0-queue.jsonl'), generateMem0QueueJsonl(500));
    writeFileSync(join(memoryDir, 'completed-flows.jsonl'), generateCompletedFlowsJsonl(1_000));
    writeFileSync(join(logsDir, 'mem0-analytics.jsonl'), generateAnalyticsJsonl(2_000));

    // Act
    const start = performance.now();
    const metrics = collectMemoryMetrics(testDir);
    const elapsed = performance.now() - start;

    // Assert
    expect(metrics.decisions.total).toBe(5_000);
    expect(metrics.queues.graphQueueDepth).toBe(500);
    expect(metrics.queues.mem0QueueDepth).toBe(500);
    expect(metrics.completedFlows).toBe(1_000);
    expect(metrics.sessionCount).toBeGreaterThan(0);
    // 5 categories in our generator: database, api, frontend, performance, architecture
    expect(Object.keys(metrics.decisions.byCategory).length).toBe(5);
    // 3 types in our generator: decision, preference, pattern
    expect(Object.keys(metrics.decisions.byType).length).toBe(3);
    expect(elapsed).toBeLessThan(500);
  });

  it('health check remains fast when decisions file has zero corrupt lines (best case)', () => {
    // Arrange: 5,000 perfectly valid lines
    const decisionsPath = join(testDir, '.claude', 'memory', 'decisions.jsonl');
    writeFileSync(decisionsPath, generateDecisionsJsonl(5_000));

    // Act
    const start = performance.now();
    const report = checkMemoryHealth(testDir);
    const elapsed = performance.now() - start;

    // Assert
    expect(report.tiers.graph.decisions.lineCount).toBe(5_000);
    expect(report.tiers.graph.decisions.corruptLines).toBe(0);
    expect(elapsed).toBeLessThan(300);
  });

  it('health check handles worst case: 50% corrupt lines in large file', () => {
    // Arrange: alternating valid and corrupt lines
    const lines: string[] = [];
    for (let i = 0; i < 5_000; i++) {
      if (i % 2 === 0) {
        lines.push(generateDecisionLine(i));
      } else {
        lines.push(`NOT_VALID_JSON_LINE_${i}`);
      }
    }
    const decisionsPath = join(testDir, '.claude', 'memory', 'decisions.jsonl');
    writeFileSync(decisionsPath, lines.join('\n') + '\n');

    // Act
    const start = performance.now();
    const report = checkMemoryHealth(testDir);
    const elapsed = performance.now() - start;

    // Assert
    expect(report.tiers.graph.decisions.lineCount).toBe(5_000);
    expect(report.tiers.graph.decisions.corruptLines).toBe(2_500);
    expect(report.tiers.graph.status).toBe('degraded');
    expect(elapsed).toBeLessThan(400);
  });
});

// =============================================================================
// METRICS PERSISTENCE PERFORMANCE
// =============================================================================

describe('Performance: Metrics Persistence', () => {
  beforeEach(() => {
    testDir = createTestDir();
  });
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('rapidly appends 100 metric snapshots and completes within 1000ms', () => {
    // Arrange: create minimal decision file so collectMemoryMetrics works
    const decisionsPath = join(testDir, '.claude', 'memory', 'decisions.jsonl');
    writeFileSync(decisionsPath, generateDecisionsJsonl(100));

    const metricsPath = join(testDir, '.claude', 'logs', 'memory-metrics.jsonl');

    // Act
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const metrics = collectMemoryMetrics(testDir);
      appendMetricSnapshot(testDir, metrics);
    }
    const elapsed = performance.now() - start;

    // Assert
    expect(existsSync(metricsPath)).toBe(true);
    const content = readFileSync(metricsPath, 'utf8');
    const writtenLines = content.trim().split('\n').filter(line => line.trim());
    expect(writtenLines).toHaveLength(100);

    // Verify each line is valid JSON
    let validCount = 0;
    for (const line of writtenLines) {
      const parsed = JSON.parse(line);
      expect(parsed.timestamp).toBeTruthy();
      expect(parsed.decisions).toBeDefined();
      expect(parsed.decisions.total).toBe(100);
      validCount++;
    }
    expect(validCount).toBe(100);

    expect(elapsed).toBeLessThan(1000);
  });

  it('appendMetricSnapshot creates logs directory if missing', () => {
    // Arrange: remove the logs directory
    const logsDir = join(testDir, '.claude', 'logs');
    rmSync(logsDir, { recursive: true, force: true });
    expect(existsSync(logsDir)).toBe(false);

    // Create minimal decisions file
    const decisionsPath = join(testDir, '.claude', 'memory', 'decisions.jsonl');
    writeFileSync(decisionsPath, generateDecisionsJsonl(10));

    // Act
    const metrics = collectMemoryMetrics(testDir);
    appendMetricSnapshot(testDir, metrics);

    // Assert
    expect(existsSync(logsDir)).toBe(true);
    const metricsPath = join(logsDir, 'memory-metrics.jsonl');
    expect(existsSync(metricsPath)).toBe(true);
    const content = readFileSync(metricsPath, 'utf8').trim();
    const parsed = JSON.parse(content);
    expect(parsed.decisions.total).toBe(10);
  });

  it('100 snapshots produce consistent incrementing timestamps', () => {
    // Arrange
    const decisionsPath = join(testDir, '.claude', 'memory', 'decisions.jsonl');
    writeFileSync(decisionsPath, generateDecisionsJsonl(10));

    // Act
    for (let i = 0; i < 100; i++) {
      const metrics = collectMemoryMetrics(testDir);
      appendMetricSnapshot(testDir, metrics);
    }

    // Assert
    const metricsPath = join(testDir, '.claude', 'logs', 'memory-metrics.jsonl');
    const content = readFileSync(metricsPath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    expect(lines).toHaveLength(100);

    // Timestamps should be non-decreasing
    let prevTimestamp = '';
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed.timestamp >= prevTimestamp).toBe(true);
      prevTimestamp = parsed.timestamp;
    }
  });
});

// =============================================================================
// QUEUE MANAGEMENT OPERATIONS UNDER LOAD
// =============================================================================

describe('Performance: Queue Management Operations', () => {
  beforeEach(() => {
    testDir = createTestDir();
  });
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('clearQueueFile removes a large file (1,000 lines) instantly', () => {
    // Arrange
    const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    writeFileSync(queuePath, generateGraphQueueJsonl(1_000));
    expect(existsSync(queuePath)).toBe(true);

    // Act
    const start = performance.now();
    clearQueueFile(queuePath);
    const elapsed = performance.now() - start;

    // Assert
    expect(existsSync(queuePath)).toBe(false);
    expect(elapsed).toBeLessThan(50);
  });

  it('archiveQueue moves a large file efficiently', () => {
    // Arrange
    const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    const archiveDir = join(testDir, 'archive');
    const content = generateGraphQueueJsonl(1_000);
    writeFileSync(queuePath, content);

    // Act
    const start = performance.now();
    archiveQueue(queuePath, archiveDir);
    const elapsed = performance.now() - start;

    // Assert
    expect(existsSync(queuePath)).toBe(false);
    const archivedFiles = readFileSync(
      join(archiveDir, readdirSync(archiveDir)[0]),
      'utf8'
    );
    expect(archivedFiles.length).toBe(content.length);
    expect(elapsed).toBeLessThan(100);
  });

  it('repeated clear + read cycle on non-existent file is fast', () => {
    // Arrange: path that does not exist
    const queuePath = join(testDir, '.claude', 'memory', 'nonexistent.jsonl');

    // Act: 1000 cycles of clear + read on missing file
    const start = performance.now();
    for (let i = 0; i < 1_000; i++) {
      clearQueueFile(queuePath);
      const ops = readGraphQueue(queuePath);
      expect(ops).toHaveLength(0);
    }
    const elapsed = performance.now() - start;

    // Assert
    expect(elapsed).toBeLessThan(500);
  });
});

// =============================================================================
// CONCURRENT-LIKE OPERATION PATTERNS
// =============================================================================

describe('Performance: Sustained Sequential Operations', () => {
  beforeEach(() => {
    testDir = createTestDir();
  });
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('50 sequential health checks on same project complete within 2000ms', () => {
    // Arrange: realistic project state
    const memoryDir = join(testDir, '.claude', 'memory');
    writeFileSync(join(memoryDir, 'decisions.jsonl'), generateDecisionsJsonl(500));
    writeFileSync(join(memoryDir, 'graph-queue.jsonl'), generateGraphQueueJsonl(30));
    writeFileSync(join(memoryDir, 'mem0-queue.jsonl'), generateMem0QueueJsonl(20));

    // Act
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      const report = checkMemoryHealth(testDir);
      expect(report.overall).toBeDefined();
    }
    const elapsed = performance.now() - start;

    // Assert
    expect(elapsed).toBeLessThan(2000);
  });

  it('50 sequential metric collections on same project complete within 2000ms', () => {
    // Arrange
    const memoryDir = join(testDir, '.claude', 'memory');
    const logsDir = join(testDir, '.claude', 'logs');
    writeFileSync(join(memoryDir, 'decisions.jsonl'), generateDecisionsJsonl(500));
    writeFileSync(join(memoryDir, 'graph-queue.jsonl'), generateGraphQueueJsonl(30));
    writeFileSync(join(memoryDir, 'mem0-queue.jsonl'), generateMem0QueueJsonl(20));
    writeFileSync(join(memoryDir, 'completed-flows.jsonl'), generateCompletedFlowsJsonl(100));
    writeFileSync(join(logsDir, 'mem0-analytics.jsonl'), generateAnalyticsJsonl(200));

    // Act
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      const metrics = collectMemoryMetrics(testDir);
      expect(metrics.decisions.total).toBe(500);
    }
    const elapsed = performance.now() - start;

    // Assert
    expect(elapsed).toBeLessThan(2000);
  });

  it('interleaved health check + metrics + queue processing within 3000ms', () => {
    // Arrange: set up a fully populated project
    const memoryDir = join(testDir, '.claude', 'memory');
    const logsDir = join(testDir, '.claude', 'logs');

    writeFileSync(join(memoryDir, 'decisions.jsonl'), generateDecisionsJsonl(1_000));
    writeFileSync(join(memoryDir, 'graph-queue.jsonl'), generateGraphQueueJsonl(200));
    writeFileSync(join(memoryDir, 'mem0-queue.jsonl'), generateMem0QueueJsonl(100));
    writeFileSync(join(memoryDir, 'completed-flows.jsonl'), generateCompletedFlowsJsonl(100));
    writeFileSync(join(logsDir, 'mem0-analytics.jsonl'), generateAnalyticsJsonl(300));

    // Act: simulate a realistic session with mixed operations
    const start = performance.now();

    for (let i = 0; i < 20; i++) {
      // Health check
      const health = checkMemoryHealth(testDir);
      expect(health.overall).toBeDefined();

      // Metrics collection
      const metrics = collectMemoryMetrics(testDir);
      expect(metrics.decisions.total).toBe(1_000);

      // Queue processing
      const graphOps = readGraphQueue(join(memoryDir, 'graph-queue.jsonl'));
      const aggregated = aggregateGraphOperations(graphOps);
      expect(aggregated.entities.length).toBeGreaterThan(0);

      const mem0Entries = readMem0Queue(join(memoryDir, 'mem0-queue.jsonl'));
      const deduped = deduplicateMem0Memories(mem0Entries);
      expect(deduped.length).toBeGreaterThan(0);
    }

    const elapsed = performance.now() - start;

    // Assert
    expect(elapsed).toBeLessThan(3000);
  });
});

// =============================================================================
// EDGE CASE PERFORMANCE
// =============================================================================

describe('Performance: Edge Cases', () => {
  beforeEach(() => {
    testDir = createTestDir();
  });
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('analyzeJsonlFile on empty file completes instantly', () => {
    // Arrange
    const filePath = join(testDir, '.claude', 'memory', 'empty.jsonl');
    writeFileSync(filePath, '');

    // Act
    const start = performance.now();
    const result = analyzeJsonlFile(filePath);
    const elapsed = performance.now() - start;

    // Assert
    expect(result.exists).toBe(true);
    expect(result.lineCount).toBe(0);
    expect(result.corruptLines).toBe(0);
    expect(elapsed).toBeLessThan(10);
  });

  it('analyzeJsonlFile on non-existent file completes instantly', () => {
    // Act
    const start = performance.now();
    const result = analyzeJsonlFile(join(testDir, 'nonexistent.jsonl'));
    const elapsed = performance.now() - start;

    // Assert
    expect(result.exists).toBe(false);
    expect(elapsed).toBeLessThan(10);
  });

  it('readGraphQueue on empty file returns empty array instantly', () => {
    // Arrange
    const queuePath = join(testDir, '.claude', 'memory', 'empty-queue.jsonl');
    writeFileSync(queuePath, '');

    // Act
    const start = performance.now();
    const ops = readGraphQueue(queuePath);
    const elapsed = performance.now() - start;

    // Assert
    expect(ops).toHaveLength(0);
    expect(elapsed).toBeLessThan(10);
  });

  it('aggregateGraphOperations on empty array completes instantly', () => {
    // Act
    const start = performance.now();
    const result = aggregateGraphOperations([]);
    const elapsed = performance.now() - start;

    // Assert
    expect(result.entities).toHaveLength(0);
    expect(result.relations).toHaveLength(0);
    expect(result.observations).toHaveLength(0);
    expect(elapsed).toBeLessThan(5);
  });

  it('deduplicateMem0Memories on empty array completes instantly', () => {
    // Act
    const start = performance.now();
    const result = deduplicateMem0Memories([]);
    const elapsed = performance.now() - start;

    // Assert
    expect(result).toHaveLength(0);
    expect(elapsed).toBeLessThan(5);
  });

  it('collectMemoryMetrics handles project with no memory files gracefully', () => {
    // Arrange: testDir exists but no files inside .claude/memory
    const emptyDir = join(
      tmpdir(),
      `orchestkit-empty-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    );
    mkdirSync(join(emptyDir, '.claude', 'memory'), { recursive: true });
    mkdirSync(join(emptyDir, '.claude', 'logs'), { recursive: true });

    // Act
    const start = performance.now();
    const metrics = collectMemoryMetrics(emptyDir);
    const elapsed = performance.now() - start;

    // Cleanup
    rmSync(emptyDir, { recursive: true, force: true });

    // Assert
    expect(metrics.decisions.total).toBe(0);
    expect(metrics.queues.graphQueueDepth).toBe(0);
    expect(metrics.queues.mem0QueueDepth).toBe(0);
    expect(metrics.completedFlows).toBe(0);
    expect(metrics.sessionCount).toBe(0);
    expect(elapsed).toBeLessThan(50);
  });

  it('checkMemoryHealth handles missing .claude directory gracefully', () => {
    // Arrange: a directory with no .claude subdirectory at all
    const bareDir = join(
      tmpdir(),
      `orchestkit-bare-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    );
    mkdirSync(bareDir, { recursive: true });

    // Act
    const start = performance.now();
    const report = checkMemoryHealth(bareDir);
    const elapsed = performance.now() - start;

    // Cleanup
    rmSync(bareDir, { recursive: true, force: true });

    // Assert
    expect(report.overall).toBe('unavailable');
    expect(report.tiers.graph.status).toBe('unavailable');
    expect(report.tiers.graph.memoryDir).toBe(false);
    expect(elapsed).toBeLessThan(50);
  });

  it('JSONL with very long lines (10KB each) parses within threshold', () => {
    // Arrange: 1,000 lines, each ~10KB
    const lines: string[] = [];
    for (let i = 0; i < 1_000; i++) {
      const longContent = 'x'.repeat(8_000);
      lines.push(
        JSON.stringify({
          id: `decision-${i}`,
          type: 'decision',
          content: { what: longContent },
          metadata: { category: 'test', timestamp: new Date().toISOString() },
        })
      );
    }
    const filePath = join(testDir, '.claude', 'memory', 'long-lines.jsonl');
    writeFileSync(filePath, lines.join('\n') + '\n');

    // Act
    const start = performance.now();
    const result = analyzeJsonlFile(filePath);
    const elapsed = performance.now() - start;

    // Assert
    expect(result.lineCount).toBe(1_000);
    expect(result.corruptLines).toBe(0);
    expect(result.sizeBytes).toBeGreaterThan(8_000_000); // ~8MB+
    expect(elapsed).toBeLessThan(500);
  });
});

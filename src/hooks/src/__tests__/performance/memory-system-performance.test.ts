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
 *
 * v7: Removed queue-processor tests (mem0 cloud integration removed)
 *
 * Thresholds are deliberately generous (2-5x expected) to avoid flaky CI
 * failures. The goal is regression detection, not exact benchmarking.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { analyzeJsonlFile, checkMemoryHealth } from '../../lib/memory-health.js';
import { collectMemoryMetrics, appendMetricSnapshot } from '../../lib/memory-metrics.js';

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
  return `${lines.join('\n')}\n`;
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
  return `${lines.join('\n')}\n`;
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
  return `${lines.join('\n')}\n`;
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
    writeFileSync(filePath, `${lines.join('\n')}\n`);

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

  it('collectMemoryMetrics processes project within 500ms', () => {
    // Arrange: populate memory files with realistic data
    const graphQueuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    const completedFlowsPath = join(testDir, '.claude', 'memory', 'completed-flows.jsonl');
    const analyticsPath = join(testDir, '.claude', 'logs', 'analytics.jsonl');

    // Generate graph queue lines
    const graphLines: string[] = [];
    for (let i = 0; i < 50; i++) {
      graphLines.push(JSON.stringify({ type: 'create_entities', payload: {}, timestamp: new Date().toISOString() }));
    }
    writeFileSync(graphQueuePath, `${graphLines.join('\n')}\n`);
    writeFileSync(completedFlowsPath, generateCompletedFlowsJsonl(200));
    writeFileSync(analyticsPath, generateAnalyticsJsonl(500));

    // Act
    const start = performance.now();
    const metrics = collectMemoryMetrics(testDir);
    const elapsed = performance.now() - start;

    // Assert
    expect(metrics.queues.graphQueueDepth).toBe(50);
    expect(metrics.completedFlows).toBe(200);
    expect(metrics.sessionCount).toBeGreaterThan(0);
    expect(metrics.timestamp).toBeTruthy();
    expect(elapsed).toBeLessThan(500);
  });

  it('checkMemoryHealth completes within 500ms', () => {
    // Arrange
    mkdirSync(join(testDir, '.claude', 'memory'), { recursive: true });

    // Act
    const start = performance.now();
    const report = checkMemoryHealth(testDir);
    const elapsed = performance.now() - start;

    // Assert
    expect(report.overall).toBeDefined();
    expect(report.tiers.graph).toBeDefined();
    expect(report.timestamp).toBeTruthy();
    expect(elapsed).toBeLessThan(500);
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

  it('checkMemoryHealth completes within 300ms', () => {
    // Arrange: populate memory directory
    mkdirSync(join(testDir, '.claude', 'memory'), { recursive: true });

    // Act
    const start = performance.now();
    const report = checkMemoryHealth(testDir);
    const elapsed = performance.now() - start;

    // Assert
    expect(report.overall).toBeDefined();
    expect(report.tiers.graph).toBeDefined();
    expect(report.tiers.graph.memoryDir).toBe(true);
    expect(elapsed).toBeLessThan(300);
  });

  it('collectMemoryMetrics handles project with populated files within 500ms', () => {
    // Arrange: all files at realistic "heavy usage" sizes
    const memoryDir = join(testDir, '.claude', 'memory');
    const logsDir = join(testDir, '.claude', 'logs');

    // Generate graph queue lines
    const graphLines: string[] = [];
    for (let i = 0; i < 500; i++) {
      graphLines.push(JSON.stringify({ type: 'create_entities', payload: {}, timestamp: new Date().toISOString() }));
    }
    writeFileSync(join(memoryDir, 'graph-queue.jsonl'), `${graphLines.join('\n')}\n`);
    writeFileSync(join(memoryDir, 'completed-flows.jsonl'), generateCompletedFlowsJsonl(1_000));
    writeFileSync(join(logsDir, 'analytics.jsonl'), generateAnalyticsJsonl(2_000));

    // Act
    const start = performance.now();
    const metrics = collectMemoryMetrics(testDir);
    const elapsed = performance.now() - start;

    // Assert
    expect(metrics.queues.graphQueueDepth).toBe(500);
    expect(metrics.completedFlows).toBe(1_000);
    expect(metrics.sessionCount).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });

  it('health check remains fast (best case)', () => {
    // Arrange: memory dir exists
    mkdirSync(join(testDir, '.claude', 'memory'), { recursive: true });

    // Act
    const start = performance.now();
    const report = checkMemoryHealth(testDir);
    const elapsed = performance.now() - start;

    // Assert
    expect(report.tiers.graph.status).toBe('healthy');
    expect(elapsed).toBeLessThan(300);
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

  it('rapidly appends 100 metric snapshots and completes within 2000ms', () => {
    // Arrange
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
      validCount++;
    }
    expect(validCount).toBe(100);

    expect(elapsed).toBeLessThan(2000);
  });

  it('appendMetricSnapshot creates logs directory if missing', () => {
    // Arrange: remove the logs directory
    const logsDir = join(testDir, '.claude', 'logs');
    rmSync(logsDir, { recursive: true, force: true });
    expect(existsSync(logsDir)).toBe(false);

    // Act
    const metrics = collectMemoryMetrics(testDir);
    appendMetricSnapshot(testDir, metrics);

    // Assert
    expect(existsSync(logsDir)).toBe(true);
    const metricsPath = join(logsDir, 'memory-metrics.jsonl');
    expect(existsSync(metricsPath)).toBe(true);
    const content = readFileSync(metricsPath, 'utf8').trim();
    const parsed = JSON.parse(content);
    expect(parsed.decisions).toBeDefined();
    expect(parsed.timestamp).toBeTruthy();
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
    mkdirSync(join(testDir, '.claude', 'memory'), { recursive: true });

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
    writeFileSync(join(memoryDir, 'completed-flows.jsonl'), generateCompletedFlowsJsonl(100));
    writeFileSync(join(logsDir, 'analytics.jsonl'), generateAnalyticsJsonl(200));

    // Act
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      const metrics = collectMemoryMetrics(testDir);
      expect(metrics.timestamp).toBeTruthy();
    }
    const elapsed = performance.now() - start;

    // Assert
    expect(elapsed).toBeLessThan(2000);
  });

  it('interleaved health check + metrics within 3000ms', () => {
    // Arrange: set up a populated project
    const memoryDir = join(testDir, '.claude', 'memory');
    const logsDir = join(testDir, '.claude', 'logs');

    writeFileSync(join(memoryDir, 'completed-flows.jsonl'), generateCompletedFlowsJsonl(100));
    writeFileSync(join(logsDir, 'analytics.jsonl'), generateAnalyticsJsonl(300));

    // Act: simulate a realistic session with mixed operations
    const start = performance.now();

    for (let i = 0; i < 20; i++) {
      // Health check
      const health = checkMemoryHealth(testDir);
      expect(health.overall).toBeDefined();

      // Metrics collection
      const metrics = collectMemoryMetrics(testDir);
      expect(metrics.timestamp).toBeTruthy();
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
    writeFileSync(filePath, `${lines.join('\n')}\n`);

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

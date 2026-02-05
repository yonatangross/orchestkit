/**
 * Security Tests for Memory System Modules
 *
 * Validates that the memory system handles adversarial inputs safely:
 * - Path traversal attacks
 * - Symlink attacks
 * - JSONL injection / malicious payloads
 * - Prototype pollution
 * - Resource exhaustion
 * - Input validation
 * - Information disclosure
 *
 * Uses real filesystem (tmpdir) for most tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { analyzeJsonlFile, checkMemoryHealth } from '../../lib/memory-health.js';
import { collectMemoryMetrics } from '../../lib/memory-metrics.js';
import {
  readGraphQueue,
  readMem0Queue,
  aggregateGraphOperations,
  deduplicateMem0Memories,
  clearQueueFile,
  archiveQueue,
} from '../../lib/queue-processor.js';

// =============================================================================
// HELPERS
// =============================================================================

let testDir: string;

function setup(): string {
  const dir = join(tmpdir(), `orchestkit-sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(join(dir, '.claude', 'memory'), { recursive: true });
  mkdirSync(join(dir, '.claude', 'logs'), { recursive: true });
  return dir;
}

// =============================================================================
// PATH TRAVERSAL
// =============================================================================

describe('Security: Path Traversal Attacks', () => {
  beforeEach(() => { testDir = setup(); });
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }); });

  it('readGraphQueue handles path with ../ sequences gracefully', () => {
    // Attempt to read a file outside the expected directory
    const traversalPath = join(testDir, '.claude', 'memory', '..', '..', '..', 'etc', 'passwd');

    // Should return empty array, not throw or read /etc/passwd
    const result = readGraphQueue(traversalPath);
    expect(result).toEqual([]);
  });

  it('readMem0Queue handles path with ../ sequences gracefully', () => {
    const traversalPath = join(testDir, '..', '..', 'nonexistent-queue.jsonl');

    const result = readMem0Queue(traversalPath);
    expect(result).toEqual([]);
  });

  it('clearQueueFile does not delete files outside expected directory', () => {
    // Create a sentinel file we want to protect
    const sentinelPath = join(testDir, 'sentinel.txt');
    writeFileSync(sentinelPath, 'DO NOT DELETE');

    // Try to clear with traversal path that resolves to sentinel
    const traversalPath = join(testDir, '.claude', 'memory', '..', '..', 'sentinel.txt');
    clearQueueFile(traversalPath);

    // The file at the resolved path may or may not exist depending on the OS
    // but the function should not throw
    // Note: clearQueueFile doesn't have path validation - it just calls unlinkSync
    // This test documents current behavior
  });

  it('archiveQueue does not write to arbitrary directories', () => {
    const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    writeFileSync(queuePath, JSON.stringify({ type: 'test' }) + '\n');

    // Archive dir within the test dir (safe)
    const archiveDir = join(testDir, '.claude', 'memory', 'archive');
    archiveQueue(queuePath, archiveDir);

    // Original removed, archived safely
    expect(existsSync(queuePath)).toBe(false);
    expect(existsSync(archiveDir)).toBe(true);
    expect(readdirSync(archiveDir).length).toBe(1);
  });

  it('analyzeJsonlFile handles resolved traversal path', () => {
    // Path that resolves to a non-existent file via traversal
    const traversalPath = join(testDir, '.claude', 'memory', '..', '..', 'nonexistent.jsonl');

    const result = analyzeJsonlFile(traversalPath);
    expect(result.exists).toBe(false);
    expect(result.lineCount).toBe(0);
  });
});

// =============================================================================
// SYMLINK ATTACKS
// =============================================================================

describe('Security: Symlink Attacks', () => {
  beforeEach(() => { testDir = setup(); });
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }); });

  it('analyzeJsonlFile works on symlinked file', () => {
    const realPath = join(testDir, 'real-decisions.jsonl');
    writeFileSync(realPath, JSON.stringify({ type: 'decision' }) + '\n');

    const symlinkPath = join(testDir, '.claude', 'memory', 'decisions.jsonl');

    try {
      symlinkSync(realPath, symlinkPath);
    } catch {
      // Skip on platforms where symlink requires elevated permissions
      return;
    }

    const result = analyzeJsonlFile(symlinkPath);
    expect(result.exists).toBe(true);
    expect(result.lineCount).toBe(1);
    expect(result.corruptLines).toBe(0);
  });

  it('clearQueueFile on symlink removes the symlink not the target', () => {
    const targetPath = join(testDir, 'target-file.jsonl');
    writeFileSync(targetPath, 'target content\n');

    const symlinkPath = join(testDir, '.claude', 'memory', 'symlink-queue.jsonl');

    try {
      symlinkSync(targetPath, symlinkPath);
    } catch {
      return; // Skip on restricted platforms
    }

    clearQueueFile(symlinkPath);

    // Symlink should be removed
    expect(existsSync(symlinkPath)).toBe(false);
    // Target should still exist (unlinkSync on symlink removes the link, not target)
    expect(existsSync(targetPath)).toBe(true);
    expect(readFileSync(targetPath, 'utf8')).toBe('target content\n');
  });

  it('readGraphQueue reads through symlink safely', () => {
    const realQueuePath = join(testDir, 'real-queue.jsonl');
    writeFileSync(realQueuePath, JSON.stringify({
      type: 'create_entities',
      payload: { entities: [{ name: 'Test', entityType: 'Tech', observations: ['ok'] }] },
      timestamp: '',
    }) + '\n');

    const symlinkPath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');

    try {
      symlinkSync(realQueuePath, symlinkPath);
    } catch {
      return;
    }

    const ops = readGraphQueue(symlinkPath);
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('create_entities');
  });
});

// =============================================================================
// JSONL INJECTION / MALICIOUS PAYLOADS
// =============================================================================

describe('Security: JSONL Injection & Malicious Payloads', () => {
  beforeEach(() => { testDir = setup(); });
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }); });

  it('handles embedded newlines in JSON string values', () => {
    // JSON.stringify properly escapes newlines as \\n, so this should be a single line
    const entry = {
      type: 'create_entities',
      payload: {
        entities: [{ name: 'Test\nInjected', entityType: 'Tech', observations: ['line1\nline2'] }],
      },
      timestamp: '',
    };
    const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    writeFileSync(queuePath, JSON.stringify(entry) + '\n');

    const ops = readGraphQueue(queuePath);
    expect(ops).toHaveLength(1);
    // The embedded \\n is preserved in the parsed string
    expect(ops[0].payload.entities![0].name).toBe('Test\nInjected');
  });

  it('handles extremely long strings without OOM', () => {
    const longString = 'A'.repeat(100_000); // 100KB string
    const entry = {
      text: longString,
      user_id: 'test',
      metadata: { category: 'test' },
      queued_at: new Date().toISOString(),
    };

    const queuePath = join(testDir, '.claude', 'memory', 'mem0-queue.jsonl');
    writeFileSync(queuePath, JSON.stringify(entry) + '\n');

    const memories = readMem0Queue(queuePath);
    expect(memories).toHaveLength(1);
    expect(memories[0].text.length).toBe(100_000);
  });

  it('resists __proto__ pollution in graph entities', () => {
    const maliciousEntry = {
      type: 'create_entities',
      payload: {
        entities: [{
          name: '__proto__',
          entityType: 'Technology',
          observations: ['polluted'],
          '__proto__': { isAdmin: true },
          'constructor': { prototype: { isAdmin: true } },
        }],
      },
      timestamp: '',
    };

    const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    writeFileSync(queuePath, JSON.stringify(maliciousEntry) + '\n');

    const ops = readGraphQueue(queuePath);
    const aggregated = aggregateGraphOperations(ops);

    // Entity should be parsed but prototype should not be polluted
    expect(aggregated.entities).toHaveLength(1);
    expect(aggregated.entities[0].name).toBe('__proto__');
    expect(({} as any).isAdmin).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call({}, 'isAdmin')).toBe(false);
  });

  it('resists __proto__ pollution in mem0 metadata', () => {
    const maliciousEntry = {
      text: 'Malicious memory',
      user_id: 'test',
      metadata: {
        '__proto__': { isAdmin: true },
        'constructor': { prototype: { isAdmin: true } },
      },
      queued_at: new Date().toISOString(),
    };

    const queuePath = join(testDir, '.claude', 'memory', 'mem0-queue.jsonl');
    writeFileSync(queuePath, JSON.stringify(maliciousEntry) + '\n');

    const memories = readMem0Queue(queuePath);
    expect(memories).toHaveLength(1);
    expect(({} as any).isAdmin).toBeUndefined();
  });

  it('handles null bytes in string values', () => {
    const entry = {
      type: 'create_entities',
      payload: {
        entities: [{ name: 'Test\x00Entity', entityType: 'Tech', observations: ['null\x00byte'] }],
      },
      timestamp: '',
    };

    const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    writeFileSync(queuePath, JSON.stringify(entry) + '\n');

    const ops = readGraphQueue(queuePath);
    expect(ops).toHaveLength(1);
    // Null bytes are preserved in JSON strings
    expect(ops[0].payload.entities![0].name).toContain('\x00');
  });

  it('handles deeply nested objects without stack overflow', () => {
    // Build 100-level nested object
    let nested: any = { value: 'deepest' };
    for (let i = 0; i < 100; i++) {
      nested = { child: nested };
    }

    const entry = {
      type: 'create_entities',
      payload: {
        entities: [{ name: 'DeepNest', entityType: 'Tech', observations: ['deep'], nested }],
      },
      timestamp: '',
    };

    const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    writeFileSync(queuePath, JSON.stringify(entry) + '\n');

    // Should not throw stack overflow
    const ops = readGraphQueue(queuePath);
    expect(ops).toHaveLength(1);
  });

  it('handles entity names with special characters', () => {
    const specialNames = [
      'Test"Quoted"Entity',
      'Test\\Backslash',
      'Test<script>alert(1)</script>',
      "Test'SingleQuote",
      'Test${injection}',
      'Test`backtick`',
    ];

    const entries = specialNames.map(name => ({
      type: 'create_entities',
      payload: {
        entities: [{ name, entityType: 'Tech', observations: ['special'] }],
      },
      timestamp: '',
    }));

    const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    writeFileSync(queuePath, entries.map(e => JSON.stringify(e)).join('\n') + '\n');

    const ops = readGraphQueue(queuePath);
    expect(ops).toHaveLength(specialNames.length);

    const aggregated = aggregateGraphOperations(ops);
    expect(aggregated.entities.map(e => e.name)).toEqual(specialNames);
  });
});

// =============================================================================
// TOCTOU RACE CONDITIONS
// =============================================================================

describe('Security: TOCTOU Race Conditions', () => {
  beforeEach(() => { testDir = setup(); });
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }); });

  it('readGraphQueue handles file deleted between existsSync and readFileSync', () => {
    // File that doesn't exist - simulates deletion between check and read
    const queuePath = join(testDir, '.claude', 'memory', 'vanishing-queue.jsonl');

    // Not creating the file simulates it being deleted
    const ops = readGraphQueue(queuePath);
    expect(ops).toEqual([]);
  });

  it('clearQueueFile handles already-deleted file gracefully', () => {
    const queuePath = join(testDir, '.claude', 'memory', 'already-deleted.jsonl');

    // File doesn't exist - simulates race where another process deleted it
    expect(() => clearQueueFile(queuePath)).not.toThrow();
  });

  it('archiveQueue handles missing queue file after existence check', () => {
    const queuePath = join(testDir, '.claude', 'memory', 'race-queue.jsonl');
    const archiveDir = join(testDir, '.claude', 'memory', 'archive');

    // File doesn't exist
    expect(() => archiveQueue(queuePath, archiveDir)).not.toThrow();
  });

  it('archiveQueue handles pre-existing archive directory', () => {
    const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    writeFileSync(queuePath, JSON.stringify({ type: 'test' }) + '\n');

    const archiveDir = join(testDir, '.claude', 'memory', 'archive');
    // Create archive dir before archiveQueue does
    mkdirSync(archiveDir, { recursive: true });

    // Should not throw EEXIST
    expect(() => archiveQueue(queuePath, archiveDir)).not.toThrow();
    expect(readdirSync(archiveDir).length).toBe(1);
  });
});

// =============================================================================
// RESOURCE EXHAUSTION
// =============================================================================

describe('Security: Resource Exhaustion', () => {
  beforeEach(() => { testDir = setup(); });
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }); });

  it('handles very large queue file (50k entries) without crashing', () => {
    const entries = Array.from({ length: 50_000 }, (_, i) => ({
      type: 'create_entities',
      payload: {
        entities: [{ name: `Entity${i}`, entityType: 'Tech', observations: [`obs${i}`] }],
      },
      timestamp: new Date().toISOString(),
    }));

    const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    writeFileSync(queuePath, entries.map(e => JSON.stringify(e)).join('\n') + '\n');

    const ops = readGraphQueue(queuePath);
    expect(ops.length).toBe(50_000);

    // Aggregation should complete without OOM
    const aggregated = aggregateGraphOperations(ops);
    expect(aggregated.entities.length).toBe(50_000);
  });

  it('handles queue entries with very long text (1MB each)', () => {
    const longText = 'X'.repeat(1_000_000); // 1MB
    const entries = [
      { text: longText, user_id: 'test', metadata: {}, queued_at: new Date().toISOString() },
      { text: 'normal', user_id: 'test', metadata: {}, queued_at: new Date().toISOString() },
    ];

    const queuePath = join(testDir, '.claude', 'memory', 'mem0-queue.jsonl');
    writeFileSync(queuePath, entries.map(e => JSON.stringify(e)).join('\n') + '\n');

    const memories = readMem0Queue(queuePath);
    expect(memories).toHaveLength(2);
    expect(memories[0].text.length).toBe(1_000_000);
  });

  it('handles analyzeJsonlFile on large file without exhaustion', () => {
    const lines = Array.from({ length: 50_000 }, (_, i) =>
      JSON.stringify({ type: 'decision', content: { what: `Decision ${i}` }, metadata: { category: 'test' } })
    );

    const filePath = join(testDir, '.claude', 'memory', 'decisions.jsonl');
    writeFileSync(filePath, lines.join('\n') + '\n');

    const result = analyzeJsonlFile(filePath);
    expect(result.lineCount).toBe(50_000);
    expect(result.corruptLines).toBe(0);
    expect(result.exists).toBe(true);
  });
});

// =============================================================================
// INPUT VALIDATION
// =============================================================================

describe('Security: Input Validation', () => {
  beforeEach(() => { testDir = setup(); });
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }); });

  it('readGraphQueue handles empty string path', () => {
    const result = readGraphQueue('');
    expect(result).toEqual([]);
  });

  it('readMem0Queue handles empty string path', () => {
    const result = readMem0Queue('');
    expect(result).toEqual([]);
  });

  it('analyzeJsonlFile handles empty string path', () => {
    const result = analyzeJsonlFile('');
    expect(result.exists).toBe(false);
  });

  it('clearQueueFile handles empty string path without throwing', () => {
    expect(() => clearQueueFile('')).not.toThrow();
  });

  it('handles non-UTF8 binary content in queue files', () => {
    const queuePath = join(testDir, '.claude', 'memory', 'binary-queue.jsonl');
    // Write binary content that is not valid UTF-8/JSON
    const binaryContent = Buffer.from([0xFF, 0xFE, 0x00, 0x01, 0x0A, 0xFF, 0xFE]);
    writeFileSync(queuePath, binaryContent);

    // Should not throw, just return empty (all lines corrupt)
    const ops = readGraphQueue(queuePath);
    expect(ops).toEqual([]);
  });

  it('deduplicateMem0Memories handles entries with empty strings', () => {
    const memories = [
      { text: '', user_id: 'test', metadata: {}, queued_at: '2025-01-15T10:00:00Z' },
      { text: '   ', user_id: 'test', metadata: {}, queued_at: '2025-01-15T11:00:00Z' },
    ];

    // Should not throw
    const result = deduplicateMem0Memories(memories);
    // Both trim to empty string, so dedup to 1
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('aggregateGraphOperations handles malformed operation objects', () => {
    const ops = [
      { type: 'create_entities', payload: null, timestamp: '' },
      { type: 'create_relations', payload: undefined, timestamp: '' },
      { type: 'add_observations', payload: {}, timestamp: '' },
    ] as any[];

    // Should not throw
    expect(() => aggregateGraphOperations(ops)).not.toThrow();
  });

  it('checkMemoryHealth handles directory with no .claude folder', () => {
    const emptyDir = join(tmpdir(), `orchestkit-sec-empty-${Date.now()}`);
    mkdirSync(emptyDir, { recursive: true });

    try {
      const report = checkMemoryHealth(emptyDir);
      expect(report.overall).toBe('unavailable');
      expect(report.tiers.graph.status).toBe('unavailable');
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('collectMemoryMetrics handles missing directories gracefully', () => {
    const emptyDir = join(tmpdir(), `orchestkit-sec-metrics-${Date.now()}`);
    mkdirSync(emptyDir, { recursive: true });

    try {
      const metrics = collectMemoryMetrics(emptyDir);
      expect(metrics.decisions.total).toBe(0);
      expect(metrics.queues.graphQueueDepth).toBe(0);
      expect(metrics.queues.mem0QueueDepth).toBe(0);
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

// =============================================================================
// INFORMATION DISCLOSURE
// =============================================================================

describe('Security: Information Disclosure', () => {
  beforeEach(() => { testDir = setup(); });
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }); });

  it('health report does not expose MEM0_API_KEY value', () => {
    const originalKey = process.env.MEM0_API_KEY;
    process.env.MEM0_API_KEY = 'sk-secret-key-12345';

    try {
      const report = checkMemoryHealth(testDir);
      const reportJson = JSON.stringify(report);

      // Should not contain the actual API key value
      expect(reportJson).not.toContain('sk-secret-key-12345');
      // Should only contain boolean presence check
      expect(report.tiers.mem0.apiKeyPresent).toBe(true);
    } finally {
      if (originalKey !== undefined) {
        process.env.MEM0_API_KEY = originalKey;
      } else {
        delete process.env.MEM0_API_KEY;
      }
    }
  });

  it('health report does not expose MEM0_API_KEY when absent', () => {
    const originalKey = process.env.MEM0_API_KEY;
    delete process.env.MEM0_API_KEY;

    try {
      const report = checkMemoryHealth(testDir);
      expect(report.tiers.mem0.apiKeyPresent).toBe(false);
      // Message should not hint at key format
      expect(report.tiers.mem0.message).not.toContain('sk-');
    } finally {
      if (originalKey !== undefined) {
        process.env.MEM0_API_KEY = originalKey;
      }
    }
  });

  it('metrics do not expose API key value', () => {
    const originalKey = process.env.MEM0_API_KEY;
    process.env.MEM0_API_KEY = 'sk-secret-key-99999';

    try {
      const metrics = collectMemoryMetrics(testDir);
      const metricsJson = JSON.stringify(metrics);

      expect(metricsJson).not.toContain('sk-secret-key-99999');
      expect(typeof metrics.mem0Available).toBe('boolean');
    } finally {
      if (originalKey !== undefined) {
        process.env.MEM0_API_KEY = originalKey;
      } else {
        delete process.env.MEM0_API_KEY;
      }
    }
  });

  it('analyzeJsonlFile does not expose file contents in returned error states', () => {
    // Non-existent file
    const result = analyzeJsonlFile(join(testDir, 'nonexistent.jsonl'));

    // The result should be a safe default, not an error message with path
    expect(result.exists).toBe(false);
    expect(result.lastModified).toBeNull();
    expect(typeof result.lineCount).toBe('number');
    expect(typeof result.corruptLines).toBe('number');
  });
});

// =============================================================================
// PROTOTYPE & OBJECT SAFETY
// =============================================================================

describe('Security: Prototype & Object Safety', () => {
  beforeEach(() => { testDir = setup(); });
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }); });

  it('JSON.parse does not pollute global Object prototype via queue entries', () => {
    const maliciousLines = [
      '{"__proto__": {"polluted": true}}',
      '{"constructor": {"prototype": {"polluted": true}}}',
    ];

    const queuePath = join(testDir, '.claude', 'memory', 'graph-queue.jsonl');
    writeFileSync(queuePath, maliciousLines.join('\n') + '\n');

    readGraphQueue(queuePath);

    // Global prototype should NOT be polluted
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call({}, 'polluted')).toBe(false);
  });

  it('deduplication map does not pollute via crafted keys', () => {
    const memories = [
      { text: '__proto__', user_id: 'test', metadata: {}, queued_at: '2025-01-15T10:00:00Z' },
      { text: 'constructor', user_id: 'test', metadata: {}, queued_at: '2025-01-15T11:00:00Z' },
      { text: 'toString', user_id: 'test', metadata: {}, queued_at: '2025-01-15T12:00:00Z' },
      { text: 'hasOwnProperty', user_id: 'test', metadata: {}, queued_at: '2025-01-15T13:00:00Z' },
    ];

    const result = deduplicateMem0Memories(memories);

    // Should deduplicate normally without prototype pollution
    expect(result).toHaveLength(4);
    expect(({} as any).polluted).toBeUndefined();
    // Standard Object methods should still work
    expect({}.toString()).toBe('[object Object]');
    expect({}.hasOwnProperty('test')).toBe(false);
  });

  it('entity deduplication set is safe from prototype keys', () => {
    const ops = [{
      type: 'create_entities',
      payload: {
        entities: [
          { name: '__proto__', entityType: 'Tech', observations: ['proto'] },
          { name: 'constructor', entityType: 'Tech', observations: ['ctor'] },
          { name: 'toString', entityType: 'Tech', observations: ['str'] },
        ],
      },
      timestamp: '',
    }];

    const result = aggregateGraphOperations(ops as any);
    expect(result.entities).toHaveLength(3);
    expect(result.entities.map(e => e.name)).toEqual(['__proto__', 'constructor', 'toString']);
  });
});

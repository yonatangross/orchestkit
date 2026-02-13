/**
 * Security Tests for Memory System Modules
 *
 * Validates that the memory system handles adversarial inputs safely:
 * - Path traversal attacks
 * - Symlink attacks
 * - JSONL injection / malicious payloads
 * - Resource exhaustion
 * - Input validation
 * - Information disclosure
 *
 * Uses real filesystem (tmpdir) for most tests.
 *
 * Note: queue-processor.ts tests removed in v7 (module deleted).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { analyzeJsonlFile, checkMemoryHealth } from '../../lib/memory-health.js';
import { collectMemoryMetrics } from '../../lib/memory-metrics.js';

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
});

// =============================================================================
// RESOURCE EXHAUSTION
// =============================================================================

describe('Security: Resource Exhaustion', () => {
  beforeEach(() => { testDir = setup(); });
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }); });

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

  it('analyzeJsonlFile handles empty string path', () => {
    const result = analyzeJsonlFile('');
    expect(result.exists).toBe(false);
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

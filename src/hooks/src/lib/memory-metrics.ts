/**
 * Memory Usage Metrics - Collect and persist memory system metrics
 *
 * Collects metrics from graph memory tier and CC Native MEMORY.md.
 */

import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { getProjectDir, logHook } from './common.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CategoryCount {
  [category: string]: number;
}

export interface TypeCount {
  [type: string]: number;
}

export interface MemoryMetrics {
  timestamp: string;
  decisions: {
    total: number;
    byCategory: CategoryCount;
    byType: TypeCount;
  };
  queues: {
    graphQueueDepth: number;
  };
  completedFlows: number;
  sessionCount: number;
}

// =============================================================================
// METRIC COLLECTION
// =============================================================================

/**
 * Count lines in a JSONL file
 */
function countJsonlLines(filePath: string): number {
  if (!existsSync(filePath)) return 0;
  try {
    const content = readFileSync(filePath, 'utf8');
    return content.trim().split('\n').filter(line => line.trim()).length;
  } catch {
    return 0;
  }
}

/**
 * Parse JSONL file and count by field values
 */
function countByField(filePath: string, field: string): Record<string, number> {
  const counts: Record<string, number> = {};

  if (!existsSync(filePath)) return counts;

  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        // Support nested fields like "metadata.category"
        const value = field.includes('.')
          ? field.split('.').reduce((obj, key) => obj?.[key], record)
          : record[field];
        if (value && typeof value === 'string') {
          counts[value] = (counts[value] || 0) + 1;
        }
      } catch {
        // Skip corrupt lines
      }
    }
  } catch {
    // File read error
  }

  return counts;
}

/**
 * Count sessions from analytics log
 */
function countSessions(analyticsPath: string): number {
  if (!existsSync(analyticsPath)) return 0;

  try {
    const content = readFileSync(analyticsPath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    let count = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.event === 'session_start') count++;
      } catch {
        // Skip corrupt lines
      }
    }

    return count;
  } catch {
    return 0;
  }
}

/**
 * Collect comprehensive memory metrics
 */
export function collectMemoryMetrics(projectDir?: string): MemoryMetrics {
  const dir = projectDir || getProjectDir();
  const memoryDir = join(dir, '.claude', 'memory');
  const logsDir = join(dir, '.claude', 'logs');

  const graphQueuePath = join(memoryDir, 'graph-queue.jsonl');
  const completedFlowsPath = join(memoryDir, 'completed-flows.jsonl');
  const analyticsPath = join(logsDir, 'analytics.jsonl');

  return {
    timestamp: new Date().toISOString(),
    decisions: {
      total: 0,
      byCategory: {},
      byType: {},
    },
    queues: {
      graphQueueDepth: countJsonlLines(graphQueuePath),
    },
    completedFlows: countJsonlLines(completedFlowsPath),
    sessionCount: countSessions(analyticsPath),
  };
}

/**
 * Append a timestamped metric snapshot to the metrics log
 */
export function appendMetricSnapshot(projectDir?: string, metrics?: MemoryMetrics): void {
  const dir = projectDir || getProjectDir();
  const metricsPath = join(dir, '.claude', 'logs', 'memory-metrics.jsonl');

  const snapshot = metrics || collectMemoryMetrics(dir);

  try {
    const metricsDir = dirname(metricsPath);
    if (!existsSync(metricsDir)) {
      mkdirSync(metricsDir, { recursive: true });
    }
    appendFileSync(metricsPath, JSON.stringify(snapshot) + '\n');
    logHook('memory-metrics', `Metrics snapshot appended: ${snapshot.decisions.total} decisions`, 'debug');
  } catch (error) {
    logHook('memory-metrics', `Failed to write metrics: ${error}`, 'warn');
  }
}

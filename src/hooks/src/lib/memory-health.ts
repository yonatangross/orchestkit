/**
 * Memory Health Check - Validate 3-tier memory architecture
 *
 * Checks:
 * - Tier 1 (Graph): .claude/memory/ exists, decisions.jsonl valid, queue depth
 * - Tier 2 (Mem0): MEM0_API_KEY env var, mem0-queue.jsonl depth, last sync
 * - Tier 3 (Fabric): Both tiers available, session registry
 * - Integrity: Parse each JSONL line, count corrupt lines
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectDir, logHook } from './common.js';

// =============================================================================
// TYPES
// =============================================================================

export type TierStatus = 'healthy' | 'degraded' | 'unavailable';

export interface FileHealth {
  exists: boolean;
  lineCount: number;
  corruptLines: number;
  sizeBytes: number;
  lastModified: string | null;
}

export interface TierHealth {
  status: TierStatus;
  message: string;
}

export interface MemoryHealthReport {
  overall: TierStatus;
  timestamp: string;
  tiers: {
    graph: TierHealth & {
      memoryDir: boolean;
      decisions: FileHealth;
      graphQueue: FileHealth;
    };
    mem0: TierHealth & {
      apiKeyPresent: boolean;
      mem0Queue: FileHealth;
      lastSyncTimestamp: string | null;
    };
    fabric: TierHealth & {
      bothTiersAvailable: boolean;
    };
  };
}

// =============================================================================
// FILE ANALYSIS
// =============================================================================

/**
 * Analyze a JSONL file for health metrics
 */
export function analyzeJsonlFile(filePath: string): FileHealth {
  if (!existsSync(filePath)) {
    return {
      exists: false,
      lineCount: 0,
      corruptLines: 0,
      sizeBytes: 0,
      lastModified: null,
    };
  }

  try {
    const stat = statSync(filePath);
    const content = readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    let corruptLines = 0;
    for (const line of lines) {
      try {
        JSON.parse(line);
      } catch {
        corruptLines++;
      }
    }

    return {
      exists: true,
      lineCount: lines.length,
      corruptLines,
      sizeBytes: stat.size,
      lastModified: stat.mtime.toISOString(),
    };
  } catch (error) {
    logHook('memory-health', `Failed to analyze ${filePath}: ${error}`, 'warn');
    return {
      exists: true,
      lineCount: 0,
      corruptLines: 0,
      sizeBytes: 0,
      lastModified: null,
    };
  }
}

// =============================================================================
// LAST SYNC DETECTION
// =============================================================================

/**
 * Find the most recent sync timestamp from analytics logs
 */
function findLastSyncTimestamp(projectDir: string): string | null {
  const analyticsPath = join(projectDir, '.claude', 'logs', 'mem0-analytics.jsonl');

  if (!existsSync(analyticsPath)) {
    return null;
  }

  try {
    const content = readFileSync(analyticsPath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    let lastTimestamp: string | null = null;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.timestamp) {
          lastTimestamp = entry.timestamp;
        }
      } catch {
        // Skip corrupt lines
      }
    }

    return lastTimestamp;
  } catch {
    return null;
  }
}

// =============================================================================
// MAIN HEALTH CHECK
// =============================================================================

/**
 * Run comprehensive memory health check
 */
export function checkMemoryHealth(projectDir?: string): MemoryHealthReport {
  const dir = projectDir || getProjectDir();
  const memoryDir = join(dir, '.claude', 'memory');
  const memoryDirExists = existsSync(memoryDir);

  // Analyze files
  const decisions = analyzeJsonlFile(join(memoryDir, 'decisions.jsonl'));
  const graphQueue = analyzeJsonlFile(join(memoryDir, 'graph-queue.jsonl'));
  const mem0Queue = analyzeJsonlFile(join(memoryDir, 'mem0-queue.jsonl'));
  const apiKeyPresent = !!process.env.MEM0_API_KEY;
  const lastSyncTimestamp = findLastSyncTimestamp(dir);

  // Tier 1: Graph
  let graphStatus: TierStatus = 'healthy';
  let graphMessage = 'Graph memory operational';

  if (!memoryDirExists) {
    graphStatus = 'unavailable';
    graphMessage = 'Memory directory .claude/memory/ does not exist';
  } else if (decisions.corruptLines > 0) {
    graphStatus = 'degraded';
    graphMessage = `${decisions.corruptLines} corrupt lines in decisions.jsonl`;
  } else if (graphQueue.lineCount > 50) {
    graphStatus = 'degraded';
    graphMessage = `Graph queue depth high: ${graphQueue.lineCount} pending operations`;
  }

  // Tier 2: Mem0
  let mem0Status: TierStatus = 'healthy';
  let mem0Message = 'Mem0 cloud available';

  if (!apiKeyPresent) {
    mem0Status = 'unavailable';
    mem0Message = 'MEM0_API_KEY not configured (optional)';
  } else if (mem0Queue.lineCount > 50) {
    mem0Status = 'degraded';
    mem0Message = `Mem0 queue depth high: ${mem0Queue.lineCount} pending operations`;
  }

  // Tier 3: Fabric
  const bothTiersAvailable = graphStatus !== 'unavailable' && mem0Status !== 'unavailable';
  let fabricStatus: TierStatus = bothTiersAvailable ? 'healthy' : 'unavailable';
  let fabricMessage = bothTiersAvailable
    ? 'Memory fabric active (graph + mem0)'
    : 'Fabric requires both graph and mem0 tiers';

  if (graphStatus === 'unavailable') {
    fabricStatus = 'unavailable';
    fabricMessage = 'Fabric unavailable: graph tier missing';
  }

  // Overall status
  let overall: TierStatus = 'healthy';
  if (graphStatus === 'unavailable') {
    overall = 'unavailable';
  } else if (graphStatus === 'degraded' || mem0Status === 'degraded') {
    overall = 'degraded';
  }

  return {
    overall,
    timestamp: new Date().toISOString(),
    tiers: {
      graph: {
        status: graphStatus,
        message: graphMessage,
        memoryDir: memoryDirExists,
        decisions,
        graphQueue,
      },
      mem0: {
        status: mem0Status,
        message: mem0Message,
        apiKeyPresent,
        mem0Queue,
        lastSyncTimestamp,
      },
      fabric: {
        status: fabricStatus,
        message: fabricMessage,
        bothTiersAvailable,
      },
    },
  };
}

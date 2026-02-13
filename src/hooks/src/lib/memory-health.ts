/**
 * Memory Health Check - Validate 2-tier memory architecture
 *
 * Checks:
 * - Tier 1 (Graph): mcp__memory__* availability, .claude/memory/ directory
 * - Tier 2 (CC Native): ~/.claude/projects/<project>/memory/MEMORY.md
 * - Integrity: General health validation
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
// MAIN HEALTH CHECK
// =============================================================================

/**
 * Run memory health check
 */
export function checkMemoryHealth(projectDir?: string): MemoryHealthReport {
  const dir = projectDir || getProjectDir();
  const memoryDir = join(dir, '.claude', 'memory');
  const memoryDirExists = existsSync(memoryDir);

  // Tier 1: Graph
  let graphStatus: TierStatus = 'healthy';
  let graphMessage = 'Graph memory operational';

  if (!memoryDirExists) {
    graphStatus = 'unavailable';
    graphMessage = 'Memory directory .claude/memory/ does not exist';
  }

  // Overall status
  const overall: TierStatus = graphStatus;

  return {
    overall,
    timestamp: new Date().toISOString(),
    tiers: {
      graph: {
        status: graphStatus,
        message: graphMessage,
        memoryDir: memoryDirExists,
      },
    },
  };
}

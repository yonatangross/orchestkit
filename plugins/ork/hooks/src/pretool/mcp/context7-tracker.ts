/**
 * Context7 Documentation Tracker Hook
 * Tracks context7 library lookups and injects cache state as additionalContext
 * CC 2.1.9 Enhanced
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputWithContext,
  logHook,
  logPermissionFeedback,
  getLogDir,
} from '../../lib/common.js';
import { existsSync, readFileSync, writeFileSync, appendFileSync, statSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const MAX_LOG_SIZE = 102400; // 100KB

/**
 * Get telemetry log path
 */
function getTelemetryLog(): string {
  const logDir = getLogDir();
  return join(logDir, 'context7-telemetry.log');
}

/**
 * Rotate log file if needed
 */
function rotateLogIfNeeded(logFile: string): void {
  try {
    if (existsSync(logFile)) {
      const stats = statSync(logFile);
      if (stats.size > MAX_LOG_SIZE) {
        renameSync(logFile, `${logFile}.old`);
      }
    }
  } catch {
    // Ignore rotation errors
  }
}

/**
 * Calculate cache context from telemetry
 */
function calculateCacheContext(logFile: string): string {
  if (!existsSync(logFile)) {
    return '';
  }

  try {
    const content = readFileSync(logFile, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);

    const totalQueries = lines.length;
    if (totalQueries === 0) {
      return '';
    }

    // Extract unique libraries
    const librarySet = new Set<string>();
    for (const line of lines) {
      const match = line.match(/library=([^| ]+)/);
      if (match && match[1] && match[1] !== '') {
        librarySet.add(match[1]);
      }
    }

    // Get recent unique libraries (last 3)
    const recentLibraries: string[] = [];
    for (let i = lines.length - 1; i >= 0 && recentLibraries.length < 3; i--) {
      const match = lines[i].match(/library=([^| ]+)/);
      if (match && match[1] && !recentLibraries.includes(match[1])) {
        recentLibraries.push(match[1]);
      }
    }

    const recentStr = recentLibraries.length > 0 ? recentLibraries.join(', ') : 'none';
    return `Context7: ${totalQueries} queries, ${librarySet.size} libraries. Recent: ${recentStr}`;
  } catch {
    return '';
  }
}

/**
 * Context7 tracker - tracks library lookups and injects cache state
 */
export function context7Tracker(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Only process context7 MCP calls
  if (!toolName.startsWith('mcp__context7__')) {
    return outputSilentSuccess();
  }

  const libraryId = (input.tool_input.libraryId as string) || '';
  const query = (input.tool_input.query as string) || '';

  // Get log file path
  const logDir = getLogDir();
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore mkdir errors
  }

  const telemetryLog = getTelemetryLog();
  rotateLogIfNeeded(telemetryLog);

  // Log the query
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | tool=${toolName} | library=${libraryId} | query_length=${query.length}\n`;

  try {
    appendFileSync(telemetryLog, logEntry);
  } catch {
    // Ignore log errors
  }

  // Calculate cache context
  const cacheContext = calculateCacheContext(telemetryLog);

  logPermissionFeedback('allow', `Documentation lookup: ${libraryId}`, input);
  logHook('context7-tracker', `Query: ${toolName} library=${libraryId}`);

  // CC 2.1.9: Inject cache context if available
  if (cacheContext) {
    return outputWithContext(cacheContext);
  }

  return outputSilentSuccess();
}

/**
 * Context7 Documentation Tracker Hook
 * Tracks context7 library lookups and injects cache state as additionalContext
 * CC 2.1.9 Enhanced
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
  outputWithContext,
  logHook,
  logPermissionFeedback,
  getLogDir,
} from '../../lib/common.js';
import { existsSync, readFileSync, statSync, renameSync, mkdirSync } from 'node:fs';
import { bufferWrite } from '../../lib/analytics-buffer.js';
import { join } from 'node:path';

const MAX_LOG_SIZE = 102400; // 100KB

// ---------------------------------------------------------------------------
// Rate limiting (OWASP ASI02/ASI06)
// ---------------------------------------------------------------------------
const MAX_QUERIES_PER_SESSION = 50;
const MAX_QUERIES_PER_MINUTE = 10;
const RATE_WINDOW_MS = 60_000; // 1 minute

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
      if (match?.[1] && match[1] !== '') {
        librarySet.add(match[1]);
      }
    }

    // Get recent unique libraries (last 3)
    const recentLibraries: string[] = [];
    for (let i = lines.length - 1; i >= 0 && recentLibraries.length < 3; i--) {
      const match = lines[i].match(/library=([^| ]+)/);
      if (match?.[1] && !recentLibraries.includes(match[1])) {
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
 * Check rate limits from telemetry log.
 * Returns null if within limits, or a deny message if exceeded.
 */
function checkRateLimits(logFile: string): string | null {
  if (!existsSync(logFile)) return null;

  try {
    const content = readFileSync(logFile, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const totalQueries = lines.length;

    // Session limit
    if (totalQueries >= MAX_QUERIES_PER_SESSION) {
      return `Context7 session limit reached (${MAX_QUERIES_PER_SESSION} queries). Rely on already-fetched documentation or use WebFetch for additional lookups.`;
    }

    // Per-minute limit: count lines with timestamps within the last minute
    const now = Date.now();
    let recentCount = 0;
    for (let i = lines.length - 1; i >= 0 && i >= lines.length - MAX_QUERIES_PER_MINUTE - 1; i--) {
      const tsMatch = lines[i].match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)/);
      if (tsMatch) {
        const ts = new Date(tsMatch[1]).getTime();
        if (now - ts < RATE_WINDOW_MS) {
          recentCount++;
        } else {
          break; // Lines are chronological, no need to check further
        }
      }
    }

    if (recentCount >= MAX_QUERIES_PER_MINUTE) {
      return `Context7 rate limit: ${MAX_QUERIES_PER_MINUTE} queries/minute exceeded. Wait a moment before querying again.`;
    }
  } catch {
    // If we can't read the log, allow the query
  }

  return null;
}

/**
 * Context7 tracker - tracks library lookups, enforces rate limits, and injects cache state
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

  // Rate limit check (before logging this query)
  const rateLimitMsg = checkRateLimits(telemetryLog);
  if (rateLimitMsg) {
    logPermissionFeedback('deny', `Context7 rate limited: ${rateLimitMsg}`, input);
    logHook('context7-tracker', `RATE LIMITED: ${rateLimitMsg}`);
    return outputDeny(rateLimitMsg);
  }

  // Log the query
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | tool=${toolName} | library=${libraryId} | query_length=${query.length}\n`;

  try {
    bufferWrite(telemetryLog, logEntry);
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

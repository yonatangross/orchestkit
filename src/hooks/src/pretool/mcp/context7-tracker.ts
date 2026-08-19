/**
 * Context7 Documentation Tracker Hook
 * Tracks context7 library lookups and injects cache state as additionalContext
 * CC 2.1.9 Enhanced
 */

import type { HookInput, HookResult , HookContext} from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
  outputWithContext,
  getLogDir,
} from '../../lib/common.js';
import { existsSync, readFileSync, statSync, renameSync, mkdirSync } from 'node:fs';
import { bufferWrite } from '../../lib/analytics-buffer.js';
import { join } from 'node:path';
import { NOOP_CTX } from '../../lib/context.js';

const MAX_LOG_SIZE = 102400; // 100KB

// ---------------------------------------------------------------------------
// Rate limiting (OWASP ASI02/ASI06)
// ---------------------------------------------------------------------------
const DEFAULT_MAX_QUERIES_PER_SESSION = 50;
const MAX_QUERIES_PER_MINUTE = 10;
const RATE_WINDOW_MS = 60_000; // 1 minute

/**
 * Per-session cap, overridable via ORK_CONTEXT7_MAX_QUERIES_PER_SESSION.
 *
 * A context7 Pro seat has no per-session reason for a 50 cap, and before #3542
 * there was no way to raise it short of editing a compiled artifact. Anything
 * that is not a positive integer falls back to the default rather than
 * disabling the cap, so a typo cannot silently remove the limit.
 */
function maxQueriesPerSession(): number {
  const raw = process.env.ORK_CONTEXT7_MAX_QUERIES_PER_SESSION;
  if (raw === undefined || raw.trim() === '') return DEFAULT_MAX_QUERIES_PER_SESSION;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_MAX_QUERIES_PER_SESSION;
  }
  return parsed;
}

/**
 * Lines belonging to one session.
 *
 * #3542: the cap called itself a SESSION limit while counting every line the
 * telemetry log had ever accumulated, and the log's own rotation is unreachable
 * relative to it (MAX_LOG_SIZE 100KB is ~950 lines at the observed ~108 B/line,
 * so rotation fires 19x later than the 50-line cap). The result was a permanent
 * estate-wide deny that only a human renaming the file could clear, which is
 * what happened on 2026-08-18.
 *
 * Lines written before this change carry no `session=` field. They are counted
 * as belonging to no session, so an existing log stops blocking the moment this
 * ships: no rotation, no manual rename.
 */
function linesForSession(lines: string[], sessionId: string): string[] {
  if (!sessionId) return [];
  const needle = `session=${sessionId}`;
  return lines.filter((line) => line.includes(needle));
}

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
function calculateCacheContext(logFile: string, sessionId: string): string {
  if (!existsSync(logFile)) {
    return '';
  }

  try {
    const content = readFileSync(logFile, 'utf8');
    const allLines = content.trim().split('\n').filter(Boolean);

    // Scoped to THIS session for the same reason as the cap (#3542). This
    // string is injected as additionalContext, so an unscoped count does not
    // merely overcount -- it tells the model "Context7: N queries" where N is a
    // LIFETIME total presented as the current session's.
    const lines = linesForSession(allLines, sessionId);

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
function checkRateLimits(
  logFile: string,
  sessionId: string,
  ctx: HookContext = NOOP_CTX
): string | null {
  if (!existsSync(logFile)) return null;

  try {
    const content = readFileSync(logFile, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);

    // Session limit. Scoped to THIS session (#3542) -- see linesForSession.
    // With no session identity the cap cannot be enforced honestly, and
    // enforcing it against the whole file is precisely the bug being fixed, so
    // it is skipped. The per-minute limit below still bounds bursts.
    const sessionLimit = maxQueriesPerSession();
    const sessionQueries = linesForSession(lines, sessionId).length;
    if (sessionId && sessionQueries >= sessionLimit) {
      return `Context7 session limit reached (${sessionLimit} queries this session). Rely on already-fetched documentation or use WebFetch for additional lookups. Raise it with ORK_CONTEXT7_MAX_QUERIES_PER_SESSION.`;
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
  } catch (err) {
    // Deliberate fail-open: an unreadable telemetry log must not block real
    // work. But it does disable BOTH limits, so it is logged rather than
    // swallowed -- an unreadable log used to look identical to a log showing
    // no traffic, which is the same class of defect as #3542 itself.
    ctx.log(
      'context7-tracker',
      `rate-limit check skipped, telemetry log unreadable (allowing query): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  return null;
}

/**
 * Context7 tracker - tracks library lookups, enforces rate limits, and injects cache state
 */
export function context7Tracker(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const toolName = input.tool_name || '';

  // Only process context7 MCP calls
  if (!toolName.startsWith('mcp__context7__')) {
    return outputSilentSuccess();
  }

  const libraryId = (input.tool_input.libraryId as string) || '';
  const query = (input.tool_input.query as string) || '';

  // Get log file path
  const logDir = ctx.logDir;
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore mkdir errors
  }

  const telemetryLog = getTelemetryLog();
  rotateLogIfNeeded(telemetryLog);

  const sessionId = input.session_id || '';

  // Rate limit check (before logging this query)
  const rateLimitMsg = checkRateLimits(telemetryLog, sessionId, ctx);
  if (rateLimitMsg) {
    ctx.logPermission('deny', `Context7 rate limited: ${rateLimitMsg}`, input);
    ctx.log('context7-tracker', `RATE LIMITED: ${rateLimitMsg}`);
    return outputDeny(rateLimitMsg);
  }

  // Log the query
  const timestamp = new Date().toISOString();
  // `session=` goes FIRST after the timestamp so the existing
  // library=([^| ]+) parsing is unaffected. Lines without it are pre-#3542.
  const logEntry = `${timestamp} | session=${sessionId} | tool=${toolName} | library=${libraryId} | query_length=${query.length}\n`;

  try {
    bufferWrite(telemetryLog, logEntry);
  } catch {
    // Ignore log errors
  }

  // Calculate cache context
  const cacheContext = calculateCacheContext(telemetryLog, sessionId);

  ctx.logPermission('allow', `Documentation lookup: ${libraryId}`, input);
  ctx.log('context7-tracker', `Query: ${toolName} library=${libraryId}`);

  // Skip cache context injection for first 2 queries — not useful yet (#token-reduction)
  if (cacheContext) {
    const queryCount = cacheContext.match(/(\d+) queries/);
    const totalQueries = queryCount ? parseInt(queryCount[1], 10) : 0;
    if (totalQueries >= 3) {
      return outputWithContext(cacheContext);
    }
  }

  return outputSilentSuccess();
}

/**
 * Side effects (I/O) — functions that write to filesystem or stderr.
 * Extracted from common.ts for separation of pure vs. effectful code.
 */

import { existsSync, statSync, renameSync, mkdirSync, readSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWriteSync } from './atomic-write.js';
import { bufferWrite } from './analytics-buffer.js';
import type { HookResult, HookInput } from '../types.js';
import { getLogDir, getSessionId, shouldLog } from './env.js';
import { fnv1aHash } from './output.js';

// -----------------------------------------------------------------------------
// Logging (with log level guard for performance)
// -----------------------------------------------------------------------------

const LOG_ROTATION_MAX_SIZE = 200 * 1024; // 200KB
const PERMISSION_LOG_MAX_SIZE = 100 * 1024; // 100KB

/**
 * Rotate log file if it exceeds size limit
 */
function rotateLogFile(logFile: string, maxSize: number): void {
  if (!existsSync(logFile)) return;

  try {
    const stats = statSync(logFile);
    if (stats.size > maxSize) {
      const rotated = `${logFile}.old.${new Date().toISOString().replace(/[:.]/g, '-')}`;
      renameSync(logFile, rotated);
    }
  } catch {
    // Ignore rotation errors
  }
}

/**
 * Ensure directory exists
 */
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Log to hook log file with automatic rotation
 * Respects ORCHESTKIT_LOG_LEVEL (default: warn, skips debug logs in production)
 */
export function logHook(hookName: string, message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'debug'): void {
  // Skip if below log level threshold (big perf win - avoids I/O)
  if (!shouldLog(level)) {
    return;
  }

  const logDir = getLogDir();
  const logFile = `${logDir}/hooks.log`;

  try {
    ensureDir(logDir);
    rotateLogFile(logFile, LOG_ROTATION_MAX_SIZE);

    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    bufferWrite(logFile, `[${timestamp}] [${level.toUpperCase()}] [${hookName}] ${message}\n`);
  } catch {
    // Ignore logging errors - don't block hook execution
  }
}

/**
 * Log permission decision for audit trail (CC 2.1.7 feature)
 * Always logs (security audit trail) - not affected by log level
 */
export function logPermissionFeedback(
  decision: 'allow' | 'deny' | 'ask' | 'warn',
  reason: string,
  input?: HookInput | Record<string, unknown>
): void {
  const logDir = getLogDir();
  const logFile = `${logDir}/permission-feedback.log`;

  try {
    ensureDir(logDir);
    rotateLogFile(logFile, PERMISSION_LOG_MAX_SIZE);

    const timestamp = new Date().toISOString();
    const toolName = (input as HookInput)?.tool_name || process.env.HOOK_TOOL_NAME || 'unknown';
    const sessionId = (input as HookInput)?.session_id || getSessionId();

    bufferWrite(
      logFile,
      `${timestamp} | ${decision} | ${reason} | tool=${toolName} | session=${sessionId}\n`
    );
  } catch {
    // Ignore logging errors
  }
}

/**
 * Output warning via stderr + exit(2) — visible to user only, Claude does NOT see it (CC 2.1.39).
 * Use this for informational warnings that should not influence Claude's behavior
 * (e.g., deprecation notices, non-actionable advisories).
 *
 * IMPORTANT: This function calls process.exit(2) and never returns.
 * Do NOT use inside unified dispatchers — it will crash the dispatcher process.
 * Only use in standalone hook entry points.
 */
export function outputStderrWarning(message: string): never {
  process.stderr.write(`\u26a0 ${message}\n`);
  process.exit(2);
}

// -----------------------------------------------------------------------------
// Rules File Utilities (Token Reduction — materialize to .claude/rules/)
// -----------------------------------------------------------------------------

/**
 * Write a rules file atomically with hash-guard skip.
 * Skips write if file content hash is unchanged (avoids unnecessary I/O).
 *
 * @param rulesDir - Directory to write to (e.g., ~/.claude/rules/ or {project}/.claude/rules/)
 * @param filename - File name (e.g., 'user-profile.md')
 * @param content - Content to write
 * @param hookName - Hook name for logging
 * @returns true if file was written, false if skipped (unchanged)
 */
export function writeRulesFile(
  rulesDir: string,
  filename: string,
  content: string,
  hookName: string,
): boolean {
  const filePath = join(rulesDir, filename);

  // Hash-guard: skip write if content unchanged (saves I/O on repeated SessionStart calls)
  if (existsSync(filePath)) {
    try {
      const existing = readFileSync(filePath, 'utf8');
      if (fnv1aHash(existing) === fnv1aHash(content)) {
        logHook(hookName, `Rules file ${filename} unchanged, skipping write`);
        return false;
      }
    } catch {
      // Can't read existing — proceed with write
    }
  }

  // Ensure directory exists
  if (!existsSync(rulesDir)) {
    mkdirSync(rulesDir, { recursive: true });
  }

  atomicWriteSync(filePath, content);
  logHook(hookName, `Wrote rules file: ${filePath}`);
  return true;
}

// -----------------------------------------------------------------------------
// Input Helpers
// -----------------------------------------------------------------------------

/**
 * Read hook input from stdin synchronously
 * Returns parsed JSON or empty object on failure
 */
export function readHookInput(): HookInput {
  try {
    // Read from stdin synchronously
    const chunks: Buffer[] = [];
    const BUFSIZE = 256;
    const buf = Buffer.allocUnsafe(BUFSIZE);

    let bytesRead: number;
    const fd = 0; // stdin

    while (true) {
      try {
        bytesRead = readSync(fd, buf, 0, BUFSIZE, null);
        if (bytesRead === 0) break;
        chunks.push(Buffer.from(buf.subarray(0, bytesRead)));
      } catch {
        break;
      }
    }

    const input = Buffer.concat(chunks).toString('utf8').trim();
    if (!input) {
      return { tool_name: '', session_id: getSessionId(), tool_input: {} };
    }

    return JSON.parse(input);
  } catch {
    return { tool_name: '', session_id: getSessionId(), tool_input: {} };
  }
}

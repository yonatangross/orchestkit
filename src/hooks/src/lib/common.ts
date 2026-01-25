/**
 * Common utilities for TypeScript hooks
 * Ported from hooks/_lib/common.sh
 */

import { appendFileSync, existsSync, statSync, renameSync, mkdirSync } from 'node:fs';
import type { HookResult, HookInput } from '../types.js';

// -----------------------------------------------------------------------------
// Environment and Paths
// All functions read env vars dynamically to support testing
// -----------------------------------------------------------------------------

/**
 * Get the log directory path
 */
export function getLogDir(): string {
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    return `${process.env.HOME}/.claude/logs/ork`;
  }
  return `${getProjectDir()}/.claude/logs`;
}

/**
 * Get the project directory
 * Read dynamically to support testing
 */
export function getProjectDir(): string {
  return process.env.CLAUDE_PROJECT_DIR || '.';
}

/**
 * Get the plugin root directory
 * Read dynamically to support testing
 */
export function getPluginRoot(): string {
  return process.env.CLAUDE_PLUGIN_ROOT || process.env.CLAUDE_PROJECT_DIR || '.';
}

/**
 * Get the session ID
 * CC 2.1.9+ should guarantee CLAUDE_SESSION_ID availability, but we add
 * a defensive fallback to prevent hook crashes during edge cases.
 * Read dynamically to support testing.
 */
export function getSessionId(): string {
  return process.env.CLAUDE_SESSION_ID || `fallback-${process.pid}-${Date.now()}`;
}

/**
 * Get cached git branch (set at session start or first call)
 * Caches result in process.env to avoid repeated execSync calls
 */
export function getCachedBranch(projectDir?: string): string {
  if (process.env.ORCHESTKIT_BRANCH) {
    return process.env.ORCHESTKIT_BRANCH;
  }

  const { execSync } = require('node:child_process');
  try {
    const branch = execSync('git branch --show-current', {
      cwd: projectDir || getProjectDir(),
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    process.env.ORCHESTKIT_BRANCH = branch;
    return branch;
  } catch {
    return 'unknown';
  }
}

/**
 * Get log level (debug|info|warn|error, default: warn)
 */
export function getLogLevel(): string {
  return process.env.ORCHESTKIT_LOG_LEVEL || 'warn';
}

/**
 * Check if should log at given level
 */
export function shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
  const levels = ['debug', 'info', 'warn', 'error'];
  return levels.indexOf(level) >= levels.indexOf(getLogLevel());
}

// -----------------------------------------------------------------------------
// Output Helpers (CC 2.1.7+ compliant)
// -----------------------------------------------------------------------------

/**
 * Output silent success - hook completed without errors, no user-visible output
 */
export function outputSilentSuccess(): HookResult {
  return { continue: true, suppressOutput: true };
}

/**
 * Output silent allow - permission hook approves silently
 */
export function outputSilentAllow(): HookResult {
  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: { permissionDecision: 'allow' },
  };
}

/**
 * Output block - stops the operation with an error
 */
export function outputBlock(reason: string): HookResult {
  return {
    continue: false,
    stopReason: reason,
    hookSpecificOutput: {
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

/**
 * Output with additionalContext - injects context before tool execution (CC 2.1.9)
 * For PostToolUse hooks (hookEventName optional)
 */
export function outputWithContext(ctx: string): HookResult {
  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: ctx,
    },
  };
}

/**
 * Output with additionalContext for UserPromptSubmit hooks (CC 2.1.9)
 * hookEventName is REQUIRED for UserPromptSubmit
 */
export function outputPromptContext(ctx: string): HookResult {
  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: ctx,
    },
  };
}

/**
 * Output allow with additionalContext - permission hook approves with context (CC 2.1.9)
 */
export function outputAllowWithContext(ctx: string, systemMessage?: string): HookResult {
  const result: HookResult = {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: ctx,
      permissionDecision: 'allow',
    },
  };

  if (systemMessage) {
    result.systemMessage = systemMessage;
  } else {
    result.suppressOutput = true;
  }

  return result;
}

/**
 * Output error message - only use when there's an actual problem
 */
export function outputError(message: string): HookResult {
  return { continue: true, systemMessage: message };
}

/**
 * Output warning message - CC 2.1.7 compliant (no ANSI in JSON)
 */
export function outputWarning(message: string): HookResult {
  return { continue: true, systemMessage: `\u26a0 ${message}` };
}

/**
 * Output deny with feedback logging (CC 2.1.7)
 */
export function outputDeny(reason: string): HookResult {
  return {
    continue: false,
    stopReason: reason,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

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
      const rotated = `${logFile}.old.${Date.now()}`;
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
    appendFileSync(logFile, `[${timestamp}] [${level.toUpperCase()}] [${hookName}] ${message}\n`);
  } catch {
    // Ignore logging errors - don't block hook execution
  }
}

/**
 * Log permission decision for audit trail (CC 2.1.7 feature)
 * Always logs (security audit trail) - not affected by log level
 */
export function logPermissionFeedback(
  decision: 'allow' | 'deny' | 'warn',
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

    appendFileSync(
      logFile,
      `${timestamp} | ${decision} | ${reason} | tool=${toolName} | session=${sessionId}\n`
    );
  } catch {
    // Ignore logging errors
  }
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

    // Use fs.readSync for synchronous stdin reading
    const { readSync } = require('node:fs');
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

/**
 * Get field from hook input using optional chaining
 */
export function getField<T>(input: HookInput, path: string): T | undefined {
  const parts = path.replace(/^\./, '').split('.');
  let value: unknown = input;

  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[part];
  }

  return value as T;
}

// -----------------------------------------------------------------------------
// String Utilities
// -----------------------------------------------------------------------------

/**
 * Normalize command: remove line continuations and collapse whitespace
 * Prevents bypassing detection with backslash-newline tricks (CC 2.1.6 fix)
 */
export function normalizeCommand(command: string): string {
  return command
    .replace(/\\\s*[\r\n]+/g, ' ') // Remove line continuations
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Escape string for use in regex
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

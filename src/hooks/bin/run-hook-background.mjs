#!/usr/bin/env node
/**
 * Background Hook Runner (Issue #243: Async hook spam reduction)
 *
 * This script is spawned by run-hook-silent.mjs in detached mode for fire-and-forget hooks.
 * It receives the hook name and input via command line args, executes the hook,
 * and exits silently without any output to the terminal.
 *
 * Features:
 * - Debug logging when enabled via .claude/hooks/debug.json
 * - PID tracking for health monitoring
 * - Execution metrics for /ork:doctor integration
 * - Execution timeout (60s) to prevent runaway processes
 * - Stale PID cleanup on startup
 *
 * Usage: run-hook-background.mjs <hook-name> <base64-encoded-input>
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, appendFileSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync, renameSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = join(__dirname, '..', 'dist');

// Directories for logging and PID tracking
const projectDir = process.env.CLAUDE_PROJECT_DIR || '.';
const claudeDir = join(projectDir, '.claude');
const logsDir = join(claudeDir, 'logs');
const pidsDir = join(claudeDir, 'hooks', 'pids');
const metricsFile = join(claudeDir, 'hooks', 'metrics.json');
const debugConfigFile = join(claudeDir, 'hooks', 'debug.json');

// Execution timeout (60 seconds) to prevent runaway processes
const HOOK_TIMEOUT_MS = 60000;

/**
 * Sanitize hook name for safe file system operations (SEC-001: path traversal prevention)
 * @param {string} hookName - Raw hook name
 * @returns {string} - Sanitized name safe for file paths
 */
function sanitizeHookName(hookName) {
  return hookName.replace(/[^a-zA-Z0-9-]/g, '-');
}

/**
 * Check if a process is still running
 * @param {number} pid - Process ID to check
 * @returns {boolean} - True if process exists
 */
function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clean up stale PID files from crashed processes
 * Called on startup to prevent accumulation of orphaned files
 */
function cleanStalePids() {
  try {
    if (!existsSync(pidsDir)) return;
    const files = readdirSync(pidsDir);
    for (const file of files) {
      if (!file.endsWith('.pid')) continue;
      try {
        const pidPath = join(pidsDir, file);
        const content = JSON.parse(readFileSync(pidPath, 'utf-8'));
        if (!isProcessRunning(content.pid)) {
          unlinkSync(pidPath);
        }
      } catch {
        // Malformed PID file - remove it
        try {
          unlinkSync(join(pidsDir, file));
        } catch {
          // Ignore cleanup failures
        }
      }
    }
  } catch (err) {
    // Log cleanup errors but don't fail
    logSilent('stale-pid-cleanup', 'warn', `Failed to clean stale PIDs: ${err.message}`);
  }
}

/**
 * Silent log helper for early logging before hookName is available
 */
function logSilent(context, level, message) {
  try {
    mkdirSync(logsDir, { recursive: true });
    const logFile = join(logsDir, 'background-hooks.log');
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      hook: context,
      message,
    };
    appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch {
    // Silent failure
  }
}

/**
 * Load debug configuration
 * @returns {{ enabled: boolean, verbose: boolean, includeInput: boolean, hookFilters: string[] }}
 */
function loadDebugConfig() {
  const defaults = { enabled: false, verbose: false, includeInput: false, hookFilters: [] };
  try {
    if (!existsSync(debugConfigFile)) return defaults;
    const config = JSON.parse(readFileSync(debugConfigFile, 'utf-8'));
    return { ...defaults, ...config };
  } catch (err) {
    logSilent('debug-config', 'warn', `Failed to load debug config: ${err.message}`);
    return defaults;
  }
}

/**
 * Check if debug is enabled for this hook
 */
function isDebugEnabled(hookName, debugConfig) {
  if (!debugConfig.enabled) return false;
  if (debugConfig.hookFilters.length === 0) return true;
  return debugConfig.hookFilters.some(filter => hookName.includes(filter));
}

/**
 * Write PID file for health monitoring
 * Uses sanitized hook name to prevent path traversal (SEC-001)
 * Uses idempotent mkdirSync to avoid TOCTOU race (SEC-002)
 */
function writePidFile(hookName) {
  try {
    // TOCTOU fix: mkdirSync with recursive is idempotent, just call it
    mkdirSync(pidsDir, { recursive: true });
    // Path sanitization: prevent traversal attacks
    const sanitized = sanitizeHookName(hookName);
    const pidFile = join(pidsDir, `${sanitized}-${process.pid}.pid`);
    writeFileSync(pidFile, JSON.stringify({
      pid: process.pid,
      hook: hookName,
      startTime: new Date().toISOString(),
    }));
    return pidFile;
  } catch (err) {
    logSilent(hookName, 'warn', `Failed to write PID file: ${err.message}`);
    return null;
  }
}

/**
 * Remove PID file on completion
 */
function removePidFile(pidFile) {
  try {
    if (pidFile && existsSync(pidFile)) unlinkSync(pidFile);
  } catch {
    // Silent - cleanup is best-effort
  }
}

/**
 * Update execution metrics with atomic file write
 * Uses idempotent mkdirSync to avoid TOCTOU race (SEC-002)
 * Uses temp file + rename pattern for atomicity (SEC-003: race condition fix)
 *
 * Note: renameSync is atomic on most filesystems (POSIX guarantee).
 * This prevents corruption when multiple hooks update metrics concurrently.
 */
function updateMetrics(hookName, durationMs, success) {
  try {
    // TOCTOU fix: mkdirSync with recursive is idempotent, just call it
    mkdirSync(join(claudeDir, 'hooks'), { recursive: true });

    let metrics = { hooks: {}, lastUpdated: null };
    if (existsSync(metricsFile)) {
      try {
        metrics = JSON.parse(readFileSync(metricsFile, 'utf-8'));
      } catch (err) {
        // Corrupted file, reset - but log the error
        logSilent(hookName, 'warn', `Corrupted metrics file, resetting: ${err.message}`);
      }
    }

    if (!metrics.hooks[hookName]) {
      metrics.hooks[hookName] = {
        totalRuns: 0,
        successCount: 0,
        errorCount: 0,
        avgDurationMs: 0,
        lastRun: null,
        lastError: null,
      };
    }

    const h = metrics.hooks[hookName];
    h.totalRuns++;
    if (success) {
      h.successCount++;
    } else {
      h.errorCount++;
    }
    // Running average
    h.avgDurationMs = Math.round(((h.avgDurationMs * (h.totalRuns - 1)) + durationMs) / h.totalRuns);
    h.lastRun = new Date().toISOString();
    metrics.lastUpdated = new Date().toISOString();

    // Atomic write: write to temp file then rename (SEC-003)
    // This prevents partial writes and reduces race condition window
    const tempFile = `${metricsFile}.${process.pid}.tmp`;
    writeFileSync(tempFile, JSON.stringify(metrics, null, 2));
    renameSync(tempFile, metricsFile);
  } catch (err) {
    // Metrics are optional, but log errors for diagnostics
    logSilent(hookName, 'warn', `Failed to update metrics: ${err.message}`);
    // Clean up temp file if rename failed
    try {
      const tempFile = `${metricsFile}.${process.pid}.tmp`;
      if (existsSync(tempFile)) unlinkSync(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Map hook name prefix to bundle name
 */
function getBundleName(hookName) {
  const prefix = hookName.split('/')[0];
  const bundleMap = {
    permission: 'permission',
    pretool: 'pretool',
    posttool: 'posttool',
    prompt: 'prompt',
    lifecycle: 'lifecycle',
    stop: 'stop',
    'subagent-start': 'subagent',
    'subagent-stop': 'subagent',
    notification: 'notification',
    setup: 'setup',
    skill: 'skill',
    agent: 'agent',
  };
  return bundleMap[prefix] || null;
}

/**
 * Load the appropriate split bundle for the hook
 */
async function loadBundle(hookName) {
  const bundleName = getBundleName(hookName);
  if (!bundleName) return null;

  const bundlePath = join(distDir, `${bundleName}.mjs`);
  if (!existsSync(bundlePath)) return null;

  return await import(bundlePath);
}

/**
 * Log to file (never to stdout/stderr to avoid terminal spam)
 * Uses idempotent mkdirSync to avoid TOCTOU race (SEC-002)
 */
function log(hookName, level, message, data = {}) {
  try {
    // TOCTOU fix: mkdirSync with recursive is idempotent, just call it
    mkdirSync(logsDir, { recursive: true });
    const logFile = join(logsDir, 'background-hooks.log');
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      hook: hookName,
      message,
      ...data,
    };
    appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch {
    // Silent failure - logging should never cause issues
    // (Can't log a logging failure!)
  }
}

/**
 * Log errors to file (never to stdout/stderr to avoid terminal spam)
 */
function logError(hookName, error) {
  log(hookName, 'error', error.message, {
    stack: error.stack?.split('\n').slice(0, 5).join('\n'),
  });
}

/**
 * Log debug info when debug mode is enabled
 */
function logDebug(hookName, message, data = {}, debugConfig = {}) {
  if (!debugConfig.enabled) return;
  log(hookName, 'debug', message, debugConfig.verbose ? data : {});
}

// Main execution
const hookName = process.argv[2];
const inputBase64 = process.argv[3];

if (!hookName) {
  process.exit(0);
}

// Clean up stale PID files from crashed processes on startup
cleanStalePids();

// Load debug configuration
const debugConfig = loadDebugConfig();
const debugEnabled = isDebugEnabled(hookName, debugConfig);
const startTime = Date.now();

// Write PID file for monitoring (must be before timeout setup)
const pidFile = writePidFile(hookName);

// Set execution timeout to prevent runaway processes
// NOTE: Must be after pidFile creation so timeout handler can clean it up
const timeoutId = setTimeout(() => {
  log(hookName, 'error', `Hook execution timeout after ${HOOK_TIMEOUT_MS}ms`);
  updateMetrics(hookName, HOOK_TIMEOUT_MS, false);
  removePidFile(pidFile);
  process.exit(1);
}, HOOK_TIMEOUT_MS);

let input = {};
if (inputBase64) {
  try {
    input = JSON.parse(Buffer.from(inputBase64, 'base64').toString('utf-8'));
  } catch {
    // Invalid input, use empty object
  }
}

// Normalize input
input.tool_input = input.tool_input || input.toolInput || {};
input.tool_name = input.tool_name || input.toolName || '';
input.session_id = input.session_id || input.sessionId || process.env.CLAUDE_SESSION_ID || '';
input.project_dir = input.project_dir || input.projectDir || process.env.CLAUDE_PROJECT_DIR || '.';

if (debugEnabled) {
  logDebug(hookName, 'Hook started', {
    input: debugConfig.includeInput ? input : { tool_name: input.tool_name },
    pid: process.pid,
  }, debugConfig);
}

// Load and execute hook
let success = false;
try {
  const hooks = await loadBundle(hookName);
  if (!hooks) {
    if (debugEnabled) {
      logDebug(hookName, 'Bundle not found', {}, debugConfig);
    }
    removePidFile(pidFile);
    process.exit(0);
  }

  const hookFn = hooks.hooks?.[hookName];
  if (!hookFn) {
    if (debugEnabled) {
      logDebug(hookName, 'Hook function not found in bundle', {}, debugConfig);
    }
    removePidFile(pidFile);
    process.exit(0);
  }

  // Execute hook - result is discarded (fire-and-forget)
  await hookFn(input);
  success = true;

  if (debugEnabled) {
    logDebug(hookName, 'Hook completed successfully', {
      durationMs: Date.now() - startTime,
    }, debugConfig);
  }
} catch (err) {
  logError(hookName, err);
  if (debugEnabled) {
    logDebug(hookName, 'Hook failed with error', {
      error: err.message,
      durationMs: Date.now() - startTime,
    }, debugConfig);
  }
}

// Clear timeout and cleanup
clearTimeout(timeoutId);
const durationMs = Date.now() - startTime;
updateMetrics(hookName, durationMs, success);
removePidFile(pidFile);

// Exit silently
process.exit(0);

// Export functions for testing (ESM exports are hoisted, so this works)
export {
  sanitizeHookName,
  isProcessRunning,
  cleanStalePids,
  logSilent,
  loadDebugConfig,
  isDebugEnabled,
  writePidFile,
  removePidFile,
  updateMetrics,
  getBundleName,
  loadBundle,
  log,
  logError,
  logDebug,
  HOOK_TIMEOUT_MS,
};

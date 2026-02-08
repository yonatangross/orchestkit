#!/usr/bin/env node
/**
 * Background Worker for Fire-and-Forget Hooks
 * Issue #243: Process hook work in detached background process
 *
 * This worker is spawned by fire-and-forget.ts and runs independently
 * of the main hook process. It reads work from a temp file, executes
 * the appropriate dispatcher, and cleans up.
 *
 * Usage: node background-worker.mjs <work-file-path>
 */

import { readFileSync, unlinkSync, existsSync, readdirSync, statSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Self-terminating timeout (5 minutes) - prevents worker from hanging indefinitely
const WORKER_TIMEOUT_MS = 5 * 60 * 1000;
const workerTimeout = setTimeout(() => {
  logToFile('Worker timeout reached (5min), terminating');
  process.exit(0);
}, WORKER_TIMEOUT_MS);

// Log file for debugging (optional, writes to .claude/logs/hooks/)
function logToFile(message) {
  try {
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const logDir = join(projectDir, '.claude', 'logs', 'hooks');
    mkdirSync(logDir, { recursive: true });
    const logFile = join(logDir, 'background-worker.log');
    const timestamp = new Date().toISOString();
    appendFileSync(logFile, `[${timestamp}] ${message}\n`);
  } catch {
    // Ignore logging errors
  }
}

// Clean up orphaned temp files (older than 10 minutes)
function cleanupOrphanedFiles() {
  try {
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const pendingDir = join(projectDir, '.claude', 'hooks', 'pending');
    if (!existsSync(pendingDir)) return;

    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    const files = readdirSync(pendingDir);
    for (const file of files) {
      const filePath = join(pendingDir, file);
      try {
        const stats = statSync(filePath);
        if (now - stats.mtimeMs > maxAge) {
          unlinkSync(filePath);
          logToFile(`Cleaned up orphaned file: ${file}`);
        }
      } catch {
        // Ignore individual file errors
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

// Dispatcher registry - maps hook names to their dispatcher functions
const DISPATCHERS = {
  'posttool': async (input) => {
    const { unifiedDispatcher } = await import('../dist/posttool.mjs');
    return unifiedDispatcher(input);
  },
  'lifecycle': async (input) => {
    const { unifiedSessionStartDispatcher } = await import('../dist/lifecycle.mjs');
    return unifiedSessionStartDispatcher(input);
  },
  'subagent-stop': async (input) => {
    const { unifiedSubagentStopDispatcher } = await import('../dist/subagent.mjs');
    return unifiedSubagentStopDispatcher(input);
  },
  'notification': async (input) => {
    const { unifiedNotificationDispatcher } = await import('../dist/notification.mjs');
    return unifiedNotificationDispatcher(input);
  },
  'setup': async (input) => {
    const { unifiedSetupDispatcher } = await import('../dist/setup.mjs');
    return unifiedSetupDispatcher(input);
  },
  'prompt': async (input) => {
    const { captureUserIntent } = await import('../dist/prompt.mjs');
    return captureUserIntent(input);
  },
  'stop': async (input) => {
    const { unifiedStopDispatcher } = await import('../dist/stop.mjs');
    return unifiedStopDispatcher(input);
  }
};

async function main() {
  // Clean up orphaned files from previous runs
  cleanupOrphanedFiles();

  const workFile = process.argv[2] || process.env.ORCHESTKIT_WORK_FILE;

  if (!workFile) {
    logToFile('No work file specified');
    process.exit(1);
  }

  if (!existsSync(workFile)) {
    logToFile(`Work file not found: ${workFile}`);
    process.exit(1);
  }

  let work;
  try {
    const content = readFileSync(workFile, 'utf-8');
    work = JSON.parse(content);
  } catch (error) {
    logToFile(`Failed to read work file: ${error.message}`);
    process.exit(1);
  }

  // Clean up work file immediately (we have the data in memory)
  try {
    unlinkSync(workFile);
  } catch {
    // Ignore cleanup errors
  }

  const { hook, input, id } = work;
  logToFile(`Processing ${hook} hook (id: ${id})`);

  const dispatcher = DISPATCHERS[hook];
  if (!dispatcher) {
    logToFile(`Unknown hook: ${hook}`);
    process.exit(1);
  }

  try {
    await dispatcher(input);
    logToFile(`${hook} hook completed successfully`);
  } catch (error) {
    // Log but don't fail - fire-and-forget is best-effort
    logToFile(`${hook} dispatcher failed: ${error.message}`);
  }

  // Clear timeout and exit cleanly
  clearTimeout(workerTimeout);
  process.exit(0);
}

main().catch(error => {
  console.error('[background-worker] Fatal error:', error);
  process.exit(1);
});

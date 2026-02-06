#!/usr/bin/env node
/**
 * Silent Hook Runner (Issue #243: Eliminate "Async hook X completed" messages)
 *
 * This is a SYNC hook that spawns a DETACHED background process.
 * Because it's sync (no "async": true in hooks.json), Claude Code
 * won't print "Async hook X completed" when it finishes.
 *
 * Usage: run-hook-silent.mjs <hook-name>
 *
 * Flow:
 * 1. Read stdin (hook input from Claude Code)
 * 2. Spawn run-hook-background.mjs in detached mode with input as base64 arg
 * 3. Output silent success immediately (don't wait for background)
 * 4. Exit (Claude Code sees sync hook completion, no message printed)
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { appendFileSync, mkdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directories for logging
const projectDir = process.env.CLAUDE_PROJECT_DIR || '.';
const logsDir = join(projectDir, '.claude', 'logs');

/**
 * Log errors to file (never to stdout/stderr to maintain silent behavior)
 */
function logError(context, message, error = null) {
  try {
    mkdirSync(logsDir, { recursive: true });
    const logFile = join(logsDir, 'background-hooks.log');
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      hook: context,
      message,
      ...(error && { error: error.message, stack: error.stack?.split('\n').slice(0, 3).join('\n') }),
    };
    appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch {
    // Silent failure - logging should never cause issues
  }
}

const hookName = process.argv[2];

// If no hook name, output silent success
if (!hookName) {
  console.log('{"continue":true,"suppressOutput":true}');
  process.exit(0);
}

// Read stdin with timeout
let input = '';
let stdinClosed = false;

const timeout = setTimeout(() => {
  if (!stdinClosed) {
    stdinClosed = true;
    spawnBackground({});
  }
}, 100);

process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  clearTimeout(timeout);
  input += chunk;
});

process.stdin.on('end', () => {
  clearTimeout(timeout);
  if (!stdinClosed) {
    stdinClosed = true;
    try {
      const parsedInput = input.trim() ? JSON.parse(input) : {};
      spawnBackground(parsedInput);
    } catch (err) {
      // JSON parse error - log it and spawn with empty input
      logError(hookName, 'Failed to parse stdin JSON', err);
      spawnBackground({});
    }
  }
});

process.stdin.on('error', (err) => {
  clearTimeout(timeout);
  if (!stdinClosed) {
    stdinClosed = true;
    logError(hookName, 'Stdin error', err);
    spawnBackground({});
  }
});

/**
 * Spawn the background hook runner in detached mode
 */
function spawnBackground(parsedInput) {
  const backgroundScript = join(__dirname, 'run-hook-background.mjs');
  const inputBase64 = Buffer.from(JSON.stringify(parsedInput)).toString('base64');

  // Spawn detached process
  const child = spawn('node', [backgroundScript, hookName, inputBase64], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      // Pass through important env vars
      CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID || '',
      CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR || '.',
      CLAUDE_PLUGIN_ROOT: process.env.CLAUDE_PLUGIN_ROOT || '',
    },
  });

  // Unref so this process can exit without waiting for child
  child.unref();

  // Output silent success immediately (sync return)
  console.log('{"continue":true,"suppressOutput":true}');
  process.exit(0);
}

// Export functions for testing (ESM exports are hoisted, so this works)
export {
  logError,
  spawnBackground,
};

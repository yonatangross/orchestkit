#!/usr/bin/env node
/**
 * Shared Windows-safe spawn helper for fire-and-forget hooks
 * Issue #648: Fix console window flashing + ENAMETOOLONG on Windows
 *
 * Two Windows-specific fixes:
 * 1. `detached: true` creates a visible cmd.exe window per spawn — even with
 *    `windowsHide: true` (unreliable in Node.js). On Windows, we skip `detached`
 *    entirely — `child.unref()` alone is sufficient to let the parent exit.
 * 2. Project-dir temp paths can exceed Windows MAX_PATH (260 chars).
 *    On Windows, we use `os.tmpdir()` for work files instead.
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IS_WINDOWS = process.platform === 'win32';

/**
 * Get the temp directory for work files.
 * On Windows, uses os.tmpdir() to avoid MAX_PATH issues.
 * On Unix, uses project-local .claude/hooks/pending/.
 */
function getTempDir() {
  if (IS_WINDOWS) {
    // os.tmpdir() is short (e.g., C:\Users\X\AppData\Local\Temp)
    const dir = join(tmpdir(), 'orchestkit-hooks', 'pending');
    mkdirSync(dir, { recursive: true });
    return dir;
  }
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const dir = join(projectDir, '.claude', 'hooks', 'pending');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Spawn the background worker in a platform-safe way.
 *
 * @param {string} hookName - e.g., 'posttool', 'lifecycle', 'prompt'
 * @param {object} input - The parsed hook input from stdin
 */
export function spawnWorker(hookName, input) {
  const tempDir = getTempDir();
  const workId = randomUUID();
  const workFile = join(tempDir, `${hookName}-${workId}.json`);

  writeFileSync(workFile, JSON.stringify({
    id: workId,
    hook: hookName,
    input,
    timestamp: Date.now()
  }));

  const workerPath = join(__dirname, 'background-worker.mjs');

  const child = spawn('node', [workerPath, workFile], {
    // On Windows, detached: true opens a visible console window.
    // unref() alone is enough to let the parent exit on all platforms.
    detached: !IS_WINDOWS,
    stdio: 'ignore',
    windowsHide: true,
    env: process.env
  });

  child.unref();
}

/**
 * Read all stdin input and parse as JSON.
 * Returns null on any error (fire-and-forget should never throw).
 */
export async function readStdinInput() {
  try {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

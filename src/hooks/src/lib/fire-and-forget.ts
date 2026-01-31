/**
 * Fire-and-Forget Utility
 * Issue #243: Eliminate "Async hook X completed" terminal spam
 *
 * Spawns a detached background process to do work without blocking
 * and without triggering Claude Code's async completion message.
 *
 * Pattern:
 * 1. Main hook process receives input
 * 2. Spawns detached worker with input serialized to temp file
 * 3. Returns immediately (sync) - no "Async hook completed" message
 * 4. Worker reads temp file, does actual work, cleans up
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { HookInput } from '../types.js';

// Get temp directory for work items
function getTempDir(): string {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const tempDir = join(projectDir, '.claude', 'hooks', 'pending');
  return tempDir;
}

// Get path to the background worker script
function getWorkerPath(): string {
  // Worker is in bin/ relative to hooks root
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || dirname(dirname(dirname(__filename)));
  return join(pluginRoot, 'bin', 'background-worker.mjs');
}

/**
 * Fire and forget - spawn a detached worker to process hook work
 *
 * @param hookName - Name of the hook/dispatcher (e.g., 'posttool', 'lifecycle')
 * @param input - The HookInput to process
 * @returns void - Returns immediately, work happens in background
 */
export function fireAndForget(hookName: string, input: HookInput): void {
  try {
    // Create temp directory if needed
    const tempDir = getTempDir();
    mkdirSync(tempDir, { recursive: true });

    // Write input to temp file (worker will read and delete)
    const workId = randomUUID();
    const workFile = join(tempDir, `${hookName}-${workId}.json`);
    writeFileSync(workFile, JSON.stringify({
      id: workId,
      hook: hookName,
      input,
      timestamp: Date.now()
    }));

    // Spawn detached worker
    const workerPath = getWorkerPath();
    const child = spawn('node', [workerPath, workFile], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        ORCHESTKIT_WORK_FILE: workFile,
        ORCHESTKIT_HOOK_NAME: hookName
      }
    });

    // Unref so parent can exit without waiting
    child.unref();
  } catch (error) {
    // Fire-and-forget should never throw - just log
    // Use console.error since logHook might not be available
    console.error(`[fire-and-forget] Failed to spawn worker for ${hookName}:`, error);
  }
}

/**
 * Check if fire-and-forget mode is enabled
 * Can be disabled via environment variable for debugging
 */
export function isFireAndForgetEnabled(): boolean {
  return process.env.ORCHESTKIT_DISABLE_FIRE_AND_FORGET !== 'true';
}

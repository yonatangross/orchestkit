/**
 * Cleanup Instance - Stop Hook
 * Releases all locks and unregisters instance when Claude Code exits
 * CC 2.1.6 Compliant
 *
 * Part of Multi-Worktree Coordination System
 */

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';

/**
 * Get instance ID from identity file
 */
function getInstanceId(projectDir: string): string | null {
  const idFile = `${projectDir}/.instance/id.json`;
  try {
    if (!existsSync(idFile)) {
      return null;
    }
    const content = JSON.parse(readFileSync(idFile, 'utf-8'));
    return content.instance_id || null;
  } catch {
    return null;
  }
}

/**
 * Execute SQLite command
 */
function runSqlite(dbPath: string, sql: string): void {
  try {
    execSync(`sqlite3 "${dbPath}" "${sql}"`, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    // Ignore SQLite errors
  }
}

/**
 * Cleanup instance on stop
 */
export function cleanupInstance(input: HookInput): HookResult {
  const projectDir = input.project_dir || getProjectDir();
  const dbPath = `${projectDir}/.claude/coordination/.claude.db`;

  // Check if coordination is enabled
  if (!existsSync(dbPath)) {
    logHook('cleanup-instance', 'No coordination database, skipping cleanup');
    return outputSilentSuccess();
  }

  // Get instance ID
  const instanceId = getInstanceId(projectDir);
  if (!instanceId) {
    logHook('cleanup-instance', 'No instance ID to clean up');
    return outputSilentSuccess();
  }

  logHook('cleanup-instance', `Cleaning up instance: ${instanceId}`);

  // Release all locks held by this instance
  logHook('cleanup-instance', 'Releasing all locks...');
  runSqlite(dbPath, `DELETE FROM file_locks WHERE instance_id = '${instanceId}';`);
  logHook('cleanup-instance', 'All locks released');

  // Handle work claims if table exists
  try {
    const hasTable = execSync(
      `sqlite3 "${dbPath}" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='work_claims';"`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    if (hasTable === '1') {
      runSqlite(
        dbPath,
        `UPDATE work_claims SET status = 'abandoned', completed_at = datetime('now') WHERE instance_id = '${instanceId}' AND status = 'active';`
      );
      logHook('cleanup-instance', 'Work claims handled');
    }
  } catch {
    // Ignore table check errors
  }

  // Update instance status if table exists
  try {
    const hasTable = execSync(
      `sqlite3 "${dbPath}" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='instances';"`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    if (hasTable === '1') {
      runSqlite(
        dbPath,
        `UPDATE instances SET status = 'terminated', last_heartbeat = datetime('now') WHERE id = '${instanceId}';`
      );
      logHook('cleanup-instance', 'Instance status updated to terminated');
    }
  } catch {
    // Ignore table check errors
  }

  logHook('cleanup-instance', 'Multi-instance cleanup completed');
  return outputSilentSuccess();
}

/**
 * Multi-Instance Cleanup Hook
 * Runs on session stop to release locks and update instance status
 * CC 2.1.7 Compliant: JSON output on all exit paths
 */

import { existsSync, readFileSync, unlinkSync, rmdirSync, readdirSync, rmSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';

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
 * Check if table exists
 */
function hasTable(dbPath: string, tableName: string): boolean {
  try {
    const result = execSync(
      `sqlite3 "${dbPath}" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='${tableName}';"`,
      { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    return result === '1';
  } catch {
    return false;
  }
}

/**
 * Stop heartbeat process
 */
function stopHeartbeat(instanceDir: string): void {
  const pidFile = `${instanceDir}/heartbeat.pid`;
  if (!existsSync(pidFile)) {
    return;
  }

  try {
    const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
    try {
      process.kill(pid, 0); // Check if process exists
      process.kill(pid); // Kill it
      logHook('multi-instance-cleanup', `Stopped heartbeat process (PID: ${pid})`);
    } catch {
      // Process doesn't exist
    }
    unlinkSync(pidFile);
  } catch {
    // Ignore errors
  }
}

/**
 * Release all locks held by this instance
 */
function releaseLocks(dbPath: string, instanceId: string): void {
  logHook('multi-instance-cleanup', 'Releasing all locks...');
  runSqlite(dbPath, `DELETE FROM file_locks WHERE instance_id = '${instanceId}';`);
  logHook('multi-instance-cleanup', 'All locks released');
}

/**
 * Handle work claims
 */
function handleWorkClaims(dbPath: string, instanceId: string): void {
  logHook('multi-instance-cleanup', 'Handling work claims...');

  if (hasTable(dbPath, 'work_claims')) {
    runSqlite(
      dbPath,
      `UPDATE work_claims SET status = 'abandoned', completed_at = datetime('now') WHERE instance_id = '${instanceId}' AND status = 'active';`
    );
    logHook('multi-instance-cleanup', 'Work claims handled');
  } else {
    logHook('multi-instance-cleanup', 'No work_claims table, skipping');
  }
}

/**
 * Update instance status
 */
function updateInstanceStatus(dbPath: string, instanceId: string): void {
  if (hasTable(dbPath, 'instances')) {
    runSqlite(
      dbPath,
      `UPDATE instances SET status = 'terminated', last_heartbeat = datetime('now') WHERE id = '${instanceId}';`
    );
    logHook('multi-instance-cleanup', 'Instance status updated to terminated');
  } else {
    logHook('multi-instance-cleanup', 'No instances table, skipping status update');
  }
}

/**
 * Broadcast shutdown message
 */
function broadcastShutdown(dbPath: string, instanceId: string): void {
  if (!hasTable(dbPath, 'messages')) {
    logHook('multi-instance-cleanup', 'No messages table, skipping broadcast');
    return;
  }

  const messageId = `msg-${Math.random().toString(36).slice(2, 18)}`;
  const timestamp = new Date().toISOString();
  const payload = JSON.stringify({ instance_id: instanceId, timestamp }).replace(/'/g, "''");

  runSqlite(
    dbPath,
    `INSERT INTO messages (message_id, from_instance, to_instance, message_type, payload, expires_at) VALUES ('${messageId}', '${instanceId}', NULL, 'shutdown', '${payload}', datetime('now', '+1 hour'));`
  );
  logHook('multi-instance-cleanup', 'Shutdown broadcast sent');
}

/**
 * Cleanup instance-specific files
 */
function cleanupInstanceFiles(instanceDir: string): void {
  const filesToRemove = ['knowledge_cache.json', 'claims.json', 'session_discoveries.json'];

  for (const file of filesToRemove) {
    const filePath = `${instanceDir}/${file}`;
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch {
      // Ignore
    }
  }

  logHook('multi-instance-cleanup', 'Instance files cleaned up');
}

/**
 * Multi-instance cleanup hook
 */
export function multiInstanceCleanup(input: HookInput): HookResult {
  const projectDir = input.project_dir || getProjectDir();
  const instanceDir = `${projectDir}/.instance`;
  const dbPath = `${projectDir}/.claude/coordination/.claude.db`;

  // Check if coordination is enabled
  if (!existsSync(dbPath)) {
    logHook('multi-instance-cleanup', 'No coordination database, skipping cleanup');
    return outputSilentSuccess();
  }

  // Check if we have instance identity
  const idFile = `${instanceDir}/id.json`;
  if (!existsSync(idFile)) {
    logHook('multi-instance-cleanup', 'No instance identity, skipping cleanup');
    return outputSilentSuccess();
  }

  // Get instance ID
  let instanceId: string;
  try {
    const idData = JSON.parse(readFileSync(idFile, 'utf-8'));
    instanceId = idData.instance_id;
  } catch {
    logHook('multi-instance-cleanup', 'Failed to read instance ID');
    return outputSilentSuccess();
  }

  logHook('multi-instance-cleanup', `Starting multi-instance cleanup for ${instanceId}...`);

  // Stop heartbeat first
  stopHeartbeat(instanceDir);

  // Release all locks
  releaseLocks(dbPath, instanceId);

  // Handle work claims
  handleWorkClaims(dbPath, instanceId);

  // Broadcast shutdown
  broadcastShutdown(dbPath, instanceId);

  // Update status
  updateInstanceStatus(dbPath, instanceId);

  // Cleanup files
  cleanupInstanceFiles(instanceDir);

  logHook('multi-instance-cleanup', '=== Cleanup Summary ===');
  logHook('multi-instance-cleanup', `Instance: ${instanceId}`);
  logHook('multi-instance-cleanup', 'Status: terminated');
  logHook('multi-instance-cleanup', 'Multi-instance cleanup completed');

  return outputSilentSuccess();
}

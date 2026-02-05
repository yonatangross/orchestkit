/**
 * Coordination Cleanup - Unregister instance at session end
 * Hook: SessionEnd
 * CC 2.1.6 Compliant: ensures JSON output on all code paths
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';

interface HeartbeatFile {
  status: string;
  [key: string]: unknown;
}

/**
 * Load instance ID from environment file
 */
function loadInstanceId(projectDir: string): string | null {
  const envFile = `${projectDir}/.claude/.instance_env`;

  if (!existsSync(envFile)) {
    return null;
  }

  try {
    const content = readFileSync(envFile, 'utf-8');
    const match = content.match(/CLAUDE_INSTANCE_ID=([^\n]+)/);
    if (match) {
      return match[1].trim();
    }
  } catch {
    // Ignore read errors
  }

  return null;
}

/**
 * Update heartbeat file to stopping status
 */
function updateHeartbeatStatus(projectDir: string, instanceId: string): void {
  const heartbeatsDir = `${projectDir}/.claude/coordination/heartbeats`;
  const heartbeatFile = `${heartbeatsDir}/${instanceId}.json`;

  if (!existsSync(heartbeatFile)) {
    return;
  }

  try {
    const content: HeartbeatFile = JSON.parse(readFileSync(heartbeatFile, 'utf-8'));
    content.status = 'stopping';
    writeFileSync(heartbeatFile, JSON.stringify(content, null, 2));
    logHook('coordination-cleanup', `Updated heartbeat status to 'stopping' for ${instanceId}`);
  } catch (err) {
    logHook('coordination-cleanup', `Failed to update heartbeat: ${err}`);
  }
}

/**
 * Unregister instance from coordination database
 */
function unregisterInstance(projectDir: string, instanceId: string): void {
  const dbPath = `${projectDir}/.claude/coordination/.claude.db`;

  if (!existsSync(dbPath)) {
    logHook('coordination-cleanup', 'No coordination database found');
    return;
  }

  // Note: In TypeScript, we would need sqlite3 package for actual DB operations
  // For now, we log the intent - the actual cleanup is done via bash fallback
  logHook('coordination-cleanup', `Would unregister instance: ${instanceId}`);
}

/**
 * Remove instance environment file
 */
function cleanupInstanceEnv(projectDir: string): void {
  const envFile = `${projectDir}/.claude/.instance_env`;

  try {
    if (existsSync(envFile)) {
      unlinkSync(envFile);
      logHook('coordination-cleanup', 'Removed instance environment file');
    }
  } catch (err) {
    logHook('coordination-cleanup', `Failed to remove instance env: ${err}`);
  }
}

/**
 * Coordination cleanup hook
 */
export function coordinationCleanup(input: HookInput): HookResult {
  logHook('coordination-cleanup', 'Starting coordination cleanup');

  const projectDir = input.project_dir || getProjectDir();
  const instanceId = loadInstanceId(projectDir);

  if (instanceId) {
    // Update heartbeat to stopping status
    updateHeartbeatStatus(projectDir, instanceId);

    // Unregister instance (releases all locks)
    unregisterInstance(projectDir, instanceId);
  }

  // Clean up instance env file
  cleanupInstanceEnv(projectDir);

  logHook('coordination-cleanup', 'Coordination cleanup complete');

  return outputSilentSuccess();
}

/**
 * Mem0 Cleanup Hook - Bulk cleanup of old memories
 * Hook: Setup (maintenance)
 * CC 2.1.7 Compliant
 *
 * Features:
 * - Uses batch-delete.py for efficient bulk cleanup
 * - Removes stale memories based on age criteria
 * - Queries memories via get-memories.py and filters by age
 */

import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, getPluginRoot, outputSilentSuccess } from '../lib/common.js';

/**
 * Check if mem0 is available
 */
function isMem0Available(): boolean {
  return !!process.env.MEM0_API_KEY;
}

/**
 * Calculate cutoff date (N days ago)
 */
function getCutoffDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

/**
 * Mem0 cleanup hook
 */
export function mem0Cleanup(input: HookInput): HookResult {
  logHook('mem0-cleanup', 'Mem0 cleanup starting');

  // Check if mem0 is available
  if (!isMem0Available()) {
    logHook('mem0-cleanup', 'Mem0 not available, skipping cleanup');
    return outputSilentSuccess();
  }

  const projectDir = input.project_dir || getProjectDir();
  const pluginRoot = getPluginRoot();
  const scriptsDir = `${pluginRoot}/skills/mem0-memory/scripts`;
  const batchDeleteScript = `${scriptsDir}/batch/batch-delete.py`;
  const getMemoriesScript = `${scriptsDir}/crud/get-memories.py`;

  // Check if required scripts exist
  if (!existsSync(batchDeleteScript)) {
    logHook('mem0-cleanup', `Batch delete script not found at ${batchDeleteScript}, skipping cleanup`);
    return outputSilentSuccess();
  }

  if (!existsSync(getMemoriesScript)) {
    logHook('mem0-cleanup', `Get memories script not found at ${getMemoriesScript}, skipping cleanup`);
    return outputSilentSuccess();
  }

  // Age threshold from environment
  const ageThreshold = parseInt(process.env.MEM0_CLEANUP_AGE_DAYS || '90', 10);
  const cutoffDate = getCutoffDate(ageThreshold);

  const logFile = `${projectDir}/.claude/logs/mem0-cleanup.log`;
  try {
    mkdirSync(`${projectDir}/.claude/logs`, { recursive: true });
  } catch {
    // Ignore
  }

  logHook('mem0-cleanup', `Querying memories older than ${cutoffDate} (${ageThreshold} days)`);

  const timestamp = new Date().toISOString();
  try {
    appendFileSync(logFile, `[${timestamp}] Cleanup started - threshold: ${cutoffDate}\n`);
  } catch {
    // Ignore
  }

  // Get all memories
  let memoriesJson: { memories: Array<{ id: string; created_at: string; metadata?: { protected?: boolean } }> };
  try {
    const result = execSync(`python3 "${getMemoriesScript}"`, {
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    memoriesJson = JSON.parse(result);
  } catch {
    logHook('mem0-cleanup', 'Failed to get memories');
    try {
      appendFileSync(logFile, `[${timestamp}] Failed to get memories\n`);
    } catch {
      // Ignore
    }
    return outputSilentSuccess();
  }

  // Filter stale memories (older than cutoff, not protected)
  const memories = memoriesJson.memories || [];
  const staleIds = memories
    .filter((m) => {
      const createdAt = m.created_at?.split('T')[0] || '';
      const isOld = createdAt < cutoffDate;
      const isProtected = m.metadata?.protected === true;
      return isOld && !isProtected;
    })
    .map((m) => m.id)
    .slice(0, 100); // Limit to 100 per run

  if (staleIds.length === 0) {
    logHook('mem0-cleanup', `No stale memories found older than ${cutoffDate}`);
    try {
      appendFileSync(logFile, `[${timestamp}] No stale memories found\n`);
    } catch {
      // Ignore
    }
    return outputSilentSuccess();
  }

  logHook('mem0-cleanup', `Found ${staleIds.length} stale memories to delete`);
  try {
    appendFileSync(logFile, `[${timestamp}] Found ${staleIds.length} stale memories\n`);
  } catch {
    // Ignore
  }

  // Execute batch delete
  try {
    const idsArray = JSON.stringify(staleIds);
    execSync(`python3 "${batchDeleteScript}" --memory-ids '${idsArray}'`, {
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    logHook('mem0-cleanup', `Successfully deleted ${staleIds.length} stale memories`);
    try {
      appendFileSync(logFile, `[${timestamp}] Deleted ${staleIds.length} memories successfully\n`);
    } catch {
      // Ignore
    }
  } catch (error) {
    logHook('mem0-cleanup', `Batch delete failed: ${error}`);
    try {
      appendFileSync(logFile, `[${timestamp}] Delete failed: ${error}\n`);
    } catch {
      // Ignore
    }
  }

  logHook('mem0-cleanup', `Mem0 cleanup complete (age threshold: ${ageThreshold} days)`);
  return outputSilentSuccess();
}

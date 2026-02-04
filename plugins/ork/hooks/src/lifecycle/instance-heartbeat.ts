/**
 * Instance Heartbeat - Lifecycle Hook
 * Updates heartbeat timestamp and cleans up stale instances
 * CC 2.1.7 Compliant: Self-guarding - only runs when CLAUDE_MULTI_INSTANCE=1
 *
 * Runs periodically to:
 * 1. Update this instance's heartbeat
 * 2. Clean up stale instances (no heartbeat > 5 min)
 * 3. Release orphaned locks
 *
 * Version: 1.1.0
 * Part of Multi-Worktree Coordination System
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, getSessionId, outputSilentSuccess } from '../lib/common.js';

interface HeartbeatInfo {
  instance_id: string;
  status: string;
  last_heartbeat: string;
  [key: string]: unknown;
}

/**
 * Check if multi-instance mode is enabled
 */
function isMultiInstanceEnabled(): boolean {
  return process.env.CLAUDE_MULTI_INSTANCE === '1';
}

/**
 * Check if slow hooks should be skipped
 */
function shouldSkipSlowHooks(): boolean {
  return process.env.ORCHESTKIT_SKIP_SLOW_HOOKS === '1';
}

/**
 * Get instance ID from environment
 */
function getInstanceId(): string {
  return process.env.CLAUDE_INSTANCE_ID || getSessionId();
}

/**
 * Load instance ID from environment file
 */
function loadInstanceIdFromFile(projectDir: string): string | null {
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
 * Update heartbeat timestamp
 */
function updateHeartbeat(projectDir: string, instanceId: string): void {
  const heartbeatsDir = `${projectDir}/.claude/coordination/heartbeats`;
  const heartbeatFile = `${heartbeatsDir}/${instanceId}.json`;

  if (!existsSync(heartbeatFile)) {
    // Create new heartbeat if doesn't exist
    mkdirSync(heartbeatsDir, { recursive: true });
    const heartbeat: HeartbeatInfo = {
      instance_id: instanceId,
      status: 'active',
      last_heartbeat: new Date().toISOString(),
    };
    writeFileSync(heartbeatFile, JSON.stringify(heartbeat, null, 2));
    logHook('instance-heartbeat', `Created heartbeat for ${instanceId}`);
    return;
  }

  try {
    const content: HeartbeatInfo = JSON.parse(readFileSync(heartbeatFile, 'utf-8'));
    content.last_heartbeat = new Date().toISOString();
    content.status = 'active';
    writeFileSync(heartbeatFile, JSON.stringify(content, null, 2));
    logHook('instance-heartbeat', `Updated heartbeat for ${instanceId}`);
  } catch (err) {
    logHook('instance-heartbeat', `Failed to update heartbeat: ${err}`);
  }
}

/**
 * Clean up stale instances (no heartbeat > 5 min)
 */
function cleanupStaleInstances(projectDir: string, currentInstanceId: string): number {
  const heartbeatsDir = `${projectDir}/.claude/coordination/heartbeats`;

  if (!existsSync(heartbeatsDir)) {
    return 0;
  }

  const staleThresholdMs = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();
  let cleanedCount = 0;

  try {
    const files = readdirSync(heartbeatsDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const filePath = `${heartbeatsDir}/${file}`;

      try {
        const content: HeartbeatInfo = JSON.parse(readFileSync(filePath, 'utf-8'));

        // Skip current instance
        if (content.instance_id === currentInstanceId) {
          continue;
        }

        // Check if stale
        const lastHeartbeat = new Date(content.last_heartbeat).getTime();
        const age = now - lastHeartbeat;

        if (age > staleThresholdMs) {
          unlinkSync(filePath);
          cleanedCount++;
          logHook('instance-heartbeat', `Cleaned up stale instance: ${content.instance_id}`);
        }
      } catch {
        // Skip files that can't be read
      }
    }
  } catch (err) {
    logHook('instance-heartbeat', `Failed to scan heartbeats: ${err}`);
  }

  return cleanedCount;
}

/**
 * Instance heartbeat hook
 */
export function instanceHeartbeat(input: HookInput): HookResult {
  // Self-guard: Only run when multi-instance mode is enabled
  if (!isMultiInstanceEnabled()) {
    return outputSilentSuccess();
  }

  // Bypass if slow hooks are disabled
  if (shouldSkipSlowHooks()) {
    logHook('instance-heartbeat', 'Skipping instance heartbeat (ORCHESTKIT_SKIP_SLOW_HOOKS=1)');
    return outputSilentSuccess();
  }

  const projectDir = input.project_dir || getProjectDir();

  // Get instance ID from environment or file
  let instanceId = getInstanceId();
  if (!instanceId || instanceId === 'unknown') {
    instanceId = loadInstanceIdFromFile(projectDir) || instanceId;
  }

  if (!instanceId) {
    logHook('instance-heartbeat', 'No instance ID available');
    return outputSilentSuccess();
  }

  // Update heartbeat
  updateHeartbeat(projectDir, instanceId);

  // Clean up stale instances
  const cleanedCount = cleanupStaleInstances(projectDir, instanceId);
  if (cleanedCount > 0) {
    logHook('instance-heartbeat', `Cleaned up ${cleanedCount} stale instance(s)`);
  }

  return outputSilentSuccess();
}

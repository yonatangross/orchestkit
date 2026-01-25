/**
 * Memory Fabric Lazy Initialization Hook
 * Triggered once on first memory MCP call (CC 2.1.0 once:true)
 *
 * Graph-First Architecture (v2.1):
 * - Knowledge graph is ALWAYS ready (no configuration needed)
 * - Mem0 is optional enhancement (only if MEM0_API_KEY set)
 * - No warnings for missing mem0 - it's an enhancement, not a requirement
 *
 * Purpose: Perform one-time setup when memory is first used, rather than at session start.
 * This avoids overhead for sessions that never use memory operations.
 *
 * CC 2.1.9: Uses additionalContext for initialization message
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputWithContext,
  logHook,
  getProjectDir,
  getSessionId,
} from '../../lib/common.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Check for orphaned sessions that might have pending syncs
 */
function checkOrphanedSessions(projectDir: string, currentSessionId: string): number {
  const logsDir = join(projectDir, '.claude', 'logs');
  let orphanedCount = 0;

  if (!existsSync(logsDir)) {
    return 0;
  }

  try {
    const files = readdirSync(logsDir);
    for (const file of files) {
      if (file.startsWith('.mem0-pending-sync-') && file.endsWith('.json')) {
        // Extract session ID from filename
        const sessionId = file.replace('.mem0-pending-sync-', '').replace('.json', '');
        if (sessionId !== currentSessionId && sessionId !== 'unknown') {
          orphanedCount++;
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return orphanedCount;
}

/**
 * Initialize memory directories if needed
 */
function initDirectories(projectDir: string): void {
  const dirs = [
    join(projectDir, '.claude', 'logs', 'mem0-processed'),
    join(projectDir, '.claude', 'context', 'session'),
  ];

  for (const dir of dirs) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore mkdir errors
    }
  }
}

/**
 * Validate MCP health (Graph-First architecture)
 */
function validateMcpHealth(): 'enhanced' | 'ready' {
  // Graph-First: graph is always ready, mem0 is optional enhancement
  if (process.env.MEM0_API_KEY) {
    return 'enhanced'; // Both graph and mem0 available
  }
  return 'ready'; // Graph-only mode (default, fully functional)
}

/**
 * Register this session as active
 */
function registerSession(projectDir: string, sessionId: string): void {
  const orphanCheckFile = join(projectDir, '.claude', 'logs', '.memory-fabric-sessions.json');
  const now = new Date().toISOString();

  try {
    mkdirSync(join(projectDir, '.claude', 'logs'), { recursive: true });

    let sessions: Record<string, { active: boolean; last_seen: string }> = {};

    if (existsSync(orphanCheckFile)) {
      const content = readFileSync(orphanCheckFile, 'utf8');
      const data = JSON.parse(content);
      sessions = data.sessions || {};
    }

    sessions[sessionId] = { active: true, last_seen: now };
    writeFileSync(orphanCheckFile, JSON.stringify({ sessions }, null, 2));
  } catch {
    // Ignore registration errors
  }
}

/**
 * Memory Fabric lazy initialization
 */
export function memoryFabricInit(input: HookInput): HookResult {
  const projectDir = input.project_dir || getProjectDir();
  const sessionId = input.session_id || getSessionId();

  logHook('memory-fabric-init', 'Memory Fabric lazy initialization triggered');

  // Run initialization tasks
  initDirectories(projectDir);
  registerSession(projectDir, sessionId);

  // Check for orphaned sessions
  const orphanedCount = checkOrphanedSessions(projectDir, sessionId);

  // Validate MCP health
  const health = validateMcpHealth();

  logHook('memory-fabric-init', `Initialization complete: health=${health}, orphaned=${orphanedCount}`);

  // Build initialization message (only for issues)
  let msg = '';

  // Only warn about orphaned sessions (actual issue that needs attention)
  if (orphanedCount > 0) {
    msg = `[Memory Fabric] Detected ${orphanedCount} orphaned session(s) with pending syncs.\nConsider running maintenance: claude --maintenance`;
  }

  // Graph-First: Log positive status
  if (health === 'enhanced') {
    logHook('memory-fabric-init', 'Memory Fabric ready (enhanced mode with mem0)');
  } else {
    logHook('memory-fabric-init', 'Memory Fabric ready (graph mode)');
  }

  // If there's something to report (only orphaned sessions), output it
  if (msg) {
    return outputWithContext(msg);
  }

  // Silent success - Memory Fabric ready (no issues to report)
  return outputSilentSuccess();
}

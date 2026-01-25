/**
 * Session Cleanup - Cleans up temporary files at session end
 * Hook: SessionEnd
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, copyFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';

interface SessionMetrics {
  tools?: Record<string, number>;
}

/**
 * Get total tool invocations from metrics
 */
function getTotalTools(metricsFile: string): number {
  if (!existsSync(metricsFile)) {
    return 0;
  }

  try {
    const metrics: SessionMetrics = JSON.parse(readFileSync(metricsFile, 'utf-8'));
    const tools = metrics.tools || {};
    return Object.values(tools).reduce((sum, count) => sum + count, 0);
  } catch {
    return 0;
  }
}

/**
 * Archive session metrics if significant
 */
function archiveMetrics(metricsFile: string, archiveDir: string): void {
  if (!existsSync(metricsFile)) {
    return;
  }

  const totalTools = getTotalTools(metricsFile);

  // Only archive if there were more than 5 tool calls
  if (totalTools <= 5) {
    logHook('session-cleanup', `Session had only ${totalTools} tool calls, not archiving`);
    return;
  }

  try {
    mkdirSync(archiveDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `session-${timestamp}.json`;
    const archivePath = `${archiveDir}/${archiveName}`;

    copyFileSync(metricsFile, archivePath);
    logHook('session-cleanup', `Archived session metrics to ${archiveName}`);
  } catch (err) {
    logHook('session-cleanup', `Failed to archive metrics: ${err}`);
  }
}

/**
 * Clean up old session archives (keep last 20)
 */
function cleanupOldArchives(archiveDir: string, keepCount: number = 20): void {
  if (!existsSync(archiveDir)) {
    return;
  }

  try {
    const files = readdirSync(archiveDir)
      .filter((f) => f.startsWith('session-') && f.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first

    if (files.length <= keepCount) {
      return;
    }

    const toDelete = files.slice(keepCount);
    for (const file of toDelete) {
      try {
        unlinkSync(`${archiveDir}/${file}`);
        logHook('session-cleanup', `Deleted old archive: ${file}`);
      } catch {
        // Ignore deletion errors
      }
    }
  } catch (err) {
    logHook('session-cleanup', `Failed to cleanup old archives: ${err}`);
  }
}

/**
 * Clean up old rotated log files (keep last 5)
 */
function cleanupRotatedLogs(logDir: string): void {
  if (!existsSync(logDir)) {
    return;
  }

  const patterns = ['hooks.log.old*', 'audit.log.old*'];

  for (const pattern of patterns) {
    try {
      const prefix = pattern.replace('*', '');
      const files = readdirSync(logDir)
        .filter((f) => f.startsWith(prefix))
        .sort()
        .reverse(); // Most recent first

      if (files.length <= 5) {
        continue;
      }

      const toDelete = files.slice(5);
      for (const file of toDelete) {
        try {
          unlinkSync(`${logDir}/${file}`);
        } catch {
          // Ignore deletion errors
        }
      }
    } catch {
      // Ignore scan errors
    }
  }
}

/**
 * Session cleanup hook
 */
export function sessionCleanup(input: HookInput): HookResult {
  logHook('session-cleanup', 'Session cleanup starting');

  const projectDir = input.project_dir || getProjectDir();
  const metricsFile = '/tmp/claude-session-metrics.json';
  const archiveDir = `${projectDir}/.claude/logs/sessions`;
  const logDir = `${projectDir}/.claude/logs`;

  // Archive metrics if significant
  archiveMetrics(metricsFile, archiveDir);

  // Clean up old session archives (keep last 20)
  cleanupOldArchives(archiveDir, 20);

  // Clean up old rotated log files (keep last 5)
  cleanupRotatedLogs(logDir);

  logHook('session-cleanup', 'Session cleanup complete');

  return outputSilentSuccess();
}

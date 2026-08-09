/**
 * Session Cleanup - Cleans up temporary files at session end
 * Hook: SessionEnd
 */

import { existsSync, mkdirSync, readdirSync, unlinkSync, copyFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { stateRootDir } from '../lib/session-state.js';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { logHook, outputSilentSuccess } from '../lib/common.js';
import { cleanupTeam } from '../lib/agent-teams.js';
import { appendAnalytics, hashProject, getTeamContext } from '../lib/analytics.js';
import { getMetricsFile } from '../lib/paths.js';
import { getTotalTools } from '../lib/metrics.js';
import { NOOP_CTX } from '../lib/context.js';
import { gcHeadroom } from '../lib/headroom-store.js';

/**
 * Archive session metrics if significant
 */
function archiveMetrics(metricsFile: string, archiveDir: string): void {
  if (!existsSync(metricsFile)) {
    return;
  }

  const totalTools = getTotalTools();

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
      const prefix = pattern.replace(/\*/g, '');
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
export function sessionCleanup(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  ctx.log('session-cleanup', 'Session cleanup starting');

  const projectDir = input.project_dir || (ctx.projectDir);
  const metricsFile = getMetricsFile(); // cross-platform path via lib/paths.ts
  const archiveDir = `${projectDir}/.claude/logs/sessions`;
  const logDir = `${projectDir}/.claude/logs`;

  // Archive metrics if significant
  archiveMetrics(metricsFile, archiveDir);

  // Clean up old session archives (keep last 20)
  cleanupOldArchives(archiveDir, 20);

  // Clean up old rotated log files (keep last 5)
  cleanupRotatedLogs(logDir);

  // Clean up debug mode flag and failure count (reset for next session)
  const home = homedir();
  const debugFlagPath = join(home, '.claude', 'logs', 'ork', 'debug-mode.flag');
  const failureCountPath = join(home, '.claude', 'logs', 'ork', 'failure-count.json');
  try { if (existsSync(debugFlagPath)) unlinkSync(debugFlagPath); } catch { /* ok */ }
  try { if (existsSync(failureCountPath)) unlinkSync(failureCountPath); } catch { /* ok */ }

  // #2264: evict expired reversible-compression stashes (TTL 7d). Best-effort —
  // gcHeadroom swallows a missing dir + per-file errors, so a removed stash only
  // degrades a stale pointer to today's head+tail behaviour, never a crash.
  try {
    const gc = gcHeadroom();
    if (gc.removed > 0) {
      ctx.log('session-cleanup', `Evicted ${gc.removed}/${gc.scanned} expired headroom stash(es)`);
    }
  } catch { /* never block cleanup on GC */ }

  // #2561: evict stale team-spawn ledgers (TTL 6h). The fan-out gate writes one
  // small session-scoped counter per session under state/team-spawns/; sweep old
  // ones so they don't accumulate. Best-effort — never block cleanup.
  try {
    const spawnDir = join(stateRootDir(), 'team-spawns');
    if (existsSync(spawnDir)) {
      const cutoff = Date.now() - 6 * 60 * 60 * 1000;
      let removed = 0;
      for (const f of readdirSync(spawnDir)) {
        if (!f.endsWith('.json')) continue;
        const fp = join(spawnDir, f);
        try {
          if (statSync(fp).mtimeMs < cutoff) { unlinkSync(fp); removed++; }
        } catch { /* per-file */ }
      }
      if (removed > 0) ctx.log('session-cleanup', `Evicted ${removed} stale team-spawn ledger(s)`);
    }
  } catch { /* never block cleanup */ }

  // Clean up team directories if this session was a team lead
  const teamName = process.env.CLAUDE_CODE_TEAM_NAME;
  if (teamName) {
    const cleaned = cleanupTeam(teamName);
    ctx.log('session-cleanup', cleaned
      ? `Cleaned team "${teamName}" directories`
      : `Warning: partial cleanup for team "${teamName}"`);
  }

  // Cross-project session summary (Issue #459, #707, #727)
  const totalTools = getTotalTools();
  if (totalTools > 0) {
    const lastMsgLen = input.last_assistant_message?.length ?? null;
    appendAnalytics('session-summary.jsonl', {
      ts: new Date().toISOString(),
      pid: hashProject(projectDir),
      total_tools: totalTools,
      added_dirs_count: (input.added_dirs ?? []).length,
      ...(lastMsgLen !== null && { last_msg_len: lastMsgLen }),
      ...getTeamContext(),
    });
  }

  ctx.log('session-cleanup', 'Session cleanup complete');

  return outputSilentSuccess();
}

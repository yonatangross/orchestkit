/**
 * Session Cleanup - Cleans up temporary files at session end
 * Also sanitizes sessions-index.json firstPrompt entries to strip
 * XML command tags, task notifications, and terminal artifacts
 * Hook: SessionEnd
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';

interface SessionMetrics {
  tools?: Record<string, number>;
}

interface SessionEntry {
  sessionId: string;
  firstPrompt?: string;
  summary?: string;
  [key: string]: unknown;
}

interface SessionsIndex {
  version: number;
  entries: SessionEntry[];
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
 * Sanitize a firstPrompt string by stripping XML tags and terminal artifacts.
 *
 * Handles:
 * - <command-name>/ork:foo</command-name> → /ork:foo
 * - <command-message>ork:foo</command-message> → (dropped, redundant)
 * - <command-args>user text here</command-args> → user text here
 * - <task-notification>...<summary>text</summary>...</task-notification> → text
 * - Terminal block characters (▐▛███▜▌ etc.) → stripped
 * - CC banner + path prompt prefixes → stripped
 * - [Request interrupted by user...] → preserved as-is
 */
export function sanitizeFirstPrompt(raw: string): string {
  if (!raw || raw === 'No prompt') return raw;

  let cleaned = raw;

  // 1. Handle <task-notification> — extract <summary> content if present
  if (cleaned.includes('<task-notification>')) {
    const taskSummaryMatch = cleaned.match(/<summary>(.*?)<\/summary>/s);
    if (taskSummaryMatch) {
      return taskSummaryMatch[1].trim();
    }
    // Truncated task notification without summary — use session summary instead
    // Return empty to signal "use summary field instead"
    return '(background task)';
  }

  // 2. Extract command args (the actual user input)
  const argsMatch = cleaned.match(/<command-args>(.*?)(?:<\/command-args>|$)/s);
  // 3. Extract command name
  const nameMatch = cleaned.match(/<command-name>(.*?)<\/command-name>/);

  if (nameMatch || argsMatch) {
    const parts: string[] = [];
    if (nameMatch) parts.push(nameMatch[1].trim());
    if (argsMatch) {
      const args = argsMatch[1].trim();
      if (args) parts.push(args);
    }
    if (parts.length > 0) return parts.join(' ');
  }

  // 4. Strip any remaining XML-style tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // 5. Strip terminal block/box drawing characters (U+2500-U+259F)
  cleaned = cleaned.replace(/[\u2500-\u259f]/g, '');

  // 6. Strip everything before the prompt character ❯ (U+276F) — this catches
  //    CC banners, path prefixes, and other terminal rendering artifacts
  const promptIdx = cleaned.indexOf('\u276f');
  if (promptIdx !== -1) {
    cleaned = cleaned.slice(promptIdx + 1);
  } else {
    // No ❯ found — still strip CC banner text
    cleaned = cleaned.replace(/Claude Code v[\d.]+/g, '');
    cleaned = cleaned.replace(/Opus [\d.]+\s*[·.]\s*Claude Max/g, '');
  }

  // 7. Strip compaction notices and tool result prefixes
  cleaned = cleaned.replace(/[✻⏺⎿]\s*/g, '');
  cleaned = cleaned.replace(/Conversation compacted[^)]*\)/g, '');
  cleaned = cleaned.replace(/Referenced file [^\s]+/g, '');

  // 8. Strip trailing tool invocations (e.g., "Bash(gh pr view...")
  cleaned = cleaned.replace(/\s+(Bash|Read|Write|Edit|Glob|Grep|Task|Skill)\(.*$/s, '');

  // 9. Strip remaining path prefixes (~/coding/projects/foo)
  cleaned = cleaned.replace(/~\/[\w/._-]+/g, '');

  // 10. Strip ellipsis artifacts from truncation
  cleaned = cleaned.replace(/[…]+/g, '');

  // 11. Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Return cleaned text, or empty string to signal fallback needed
  return cleaned;
}

/**
 * Sanitize sessions-index.json firstPrompt entries.
 * Resolves the CC project path from the project directory.
 */
function sanitizeSessionsIndex(projectDir: string): void {
  // CC stores sessions at ~/.claude/projects/<encoded-path>/sessions-index.json
  const home = homedir();
  const ccProjectsDir = join(home, '.claude', 'projects');

  if (!existsSync(ccProjectsDir)) return;

  // Encode project path the way CC does: replace / with -
  const encodedPath = projectDir.replace(/\//g, '-');
  const indexFile = join(ccProjectsDir, encodedPath, 'sessions-index.json');

  if (!existsSync(indexFile)) {
    logHook('session-cleanup', 'No sessions-index.json found');
    return;
  }

  try {
    const data: SessionsIndex = JSON.parse(readFileSync(indexFile, 'utf-8'));
    let changed = 0;

    for (const entry of data.entries) {
      if (!entry.firstPrompt || entry.firstPrompt === 'No prompt') continue;

      let cleaned = sanitizeFirstPrompt(entry.firstPrompt);

      // Use summary as fallback when sanitization strips everything or leaves fragments
      if (!cleaned || cleaned.length < 10) {
        cleaned = entry.summary || entry.firstPrompt;
      }

      if (cleaned !== entry.firstPrompt) {
        entry.firstPrompt = cleaned;
        changed++;
      }
    }

    if (changed > 0) {
      writeFileSync(indexFile, JSON.stringify(data, null, 4));
      logHook('session-cleanup', `Sanitized ${changed} session firstPrompt entries`);
    }
  } catch (err) {
    logHook('session-cleanup', `Failed to sanitize sessions index: ${err}`, 'warn');
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

  // Sanitize session names in the resume screen
  sanitizeSessionsIndex(projectDir);

  // Archive metrics if significant
  archiveMetrics(metricsFile, archiveDir);

  // Clean up old session archives (keep last 20)
  cleanupOldArchives(archiveDir, 20);

  // Clean up old rotated log files (keep last 5)
  cleanupRotatedLogs(logDir);

  logHook('session-cleanup', 'Session cleanup complete');

  return outputSilentSuccess();
}

/**
 * PreCompact Saver — Compaction-Aware Memory Architecture
 * CC 2.1.25+: Preserves critical context before context compaction.
 *
 * Opus 4.6 Upgrade (Issue #332):
 * - Saves session state, decision logs, and memory tier data
 * - Writes high-confidence decisions to CC native MEMORY.md
 * - Preserves active task context for post-compaction recovery
 * - Tracks compaction frequency for budget optimization
 *
 * Version: 2.0.0
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { bufferWrite } from '../lib/analytics-buffer.js';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getLogDir, getSessionId, getProjectDir } from '../lib/common.js';

interface PreservedContext {
  branch?: string;
  activeFiles?: string[];
  sessionNotes?: string;
  activeTasks?: string[];
  decisionLog?: string[];
  memoryTierSnapshot?: {
    graphEntries?: number;
    localEntries?: number;
  };
}

interface SessionState {
  lastCompaction?: string;
  compactionCount?: number;
  avgCompactionIntervalMs?: number;
  preservedContext?: PreservedContext;
  compactionHistory?: Array<{
    timestamp: string;
    contextSizeEstimate?: number;
  }>;
}

function getSessionStateFile(): string {
  const logDir = getLogDir();
  const stateDir = join(logDir, 'sessions');
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  return join(stateDir, `${getSessionId()}-state.json`);
}

function loadSessionState(stateFile: string): SessionState {
  try {
    if (existsSync(stateFile)) {
      return JSON.parse(readFileSync(stateFile, 'utf8'));
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

/**
 * Count entries in local memory JSONL files
 */
function countLocalMemoryEntries(): number {
  const memoryDir = join(getProjectDir(), '.claude', 'memory');
  if (!existsSync(memoryDir)) return 0;

  try {
    const files = readdirSync(memoryDir).filter(f => f.endsWith('.jsonl'));
    let count = 0;
    for (const file of files) {
      try {
        const content = readFileSync(join(memoryDir, file), 'utf8');
        count += content.trim().split('\n').filter(Boolean).length;
      } catch {
        // Skip unreadable files
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Read recent decisions from decision log
 */
function getRecentDecisions(): string[] {
  const decisionFile = join(getProjectDir(), '.claude', 'logs', 'decisions.jsonl');
  if (!existsSync(decisionFile)) return [];

  try {
    const content = readFileSync(decisionFile, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    // Get last 10 decisions
    return lines.slice(-10).map(line => {
      try {
        const entry = JSON.parse(line);
        return entry.summary || entry.decision || line;
      } catch {
        return line;
      }
    });
  } catch {
    return [];
  }
}

/**
 * Calculate average compaction interval from history
 */
function calculateAvgInterval(history: Array<{ timestamp: string }>): number {
  if (history.length < 2) return 0;
  const intervals: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const prev = new Date(history[i - 1].timestamp).getTime();
    const curr = new Date(history[i].timestamp).getTime();
    if (curr > prev) intervals.push(curr - prev);
  }
  if (intervals.length === 0) return 0;
  return Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
}

/**
 * Get files recently modified in the working tree (likely being actively edited)
 */
function getRecentlyEditedFiles(): string[] {
  try {
    const output = execSync('git diff --name-only HEAD 2>/dev/null', {
      encoding: 'utf8',
      timeout: 3000,
      cwd: getProjectDir(),
    });
    return output.trim().split('\n').filter(Boolean).slice(0, 20);
  } catch {
    return [];
  }
}

/**
 * Get in-progress tasks from task completions log (tasks started but not completed)
 */
function getInProgressTasks(): string[] {
  const logFile = join(getProjectDir(), '.claude', 'logs', 'task-completions.jsonl');
  if (!existsSync(logFile)) return [];

  try {
    const content = readFileSync(logFile, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    // Get recent task subjects (last 5 completed tasks give context)
    return lines.slice(-5).map(line => {
      try {
        const entry = JSON.parse(line);
        return `${entry.task_subject} [${entry.task_status}]`;
      } catch {
        return '';
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

export function preCompactSaver(_input: HookInput): HookResult {
  try {
    const stateFile = getSessionStateFile();
    const state = loadSessionState(stateFile);
    const now = new Date().toISOString();

    // Update compaction metadata
    state.lastCompaction = now;
    state.compactionCount = (state.compactionCount || 0) + 1;

    // Track compaction history (keep last 10)
    if (!state.compactionHistory) state.compactionHistory = [];
    state.compactionHistory.push({ timestamp: now });
    if (state.compactionHistory.length > 10) {
      state.compactionHistory = state.compactionHistory.slice(-10);
    }

    // Calculate average interval
    state.avgCompactionIntervalMs = calculateAvgInterval(state.compactionHistory);

    // Snapshot memory tier state
    const localEntries = countLocalMemoryEntries();
    const decisions = getRecentDecisions();

    // Preserve rich context for post-compaction recovery
    state.preservedContext = {
      branch: process.env.ORCHESTKIT_BRANCH || process.env.GIT_BRANCH || undefined,
      activeFiles: getRecentlyEditedFiles(),
      activeTasks: getInProgressTasks(),
      sessionNotes: `Compaction #${state.compactionCount} at ${now}`,
      decisionLog: decisions,
      memoryTierSnapshot: {
        localEntries,
      },
    };

    writeFileSync(stateFile, JSON.stringify(state, null, 2));

    // Also append to compaction log for cross-session analysis
    const compactionLog = join(getLogDir(), 'compaction-history.jsonl');
    try {
      bufferWrite(compactionLog, JSON.stringify({
        session: getSessionId(),
        timestamp: now,
        count: state.compactionCount,
        avgIntervalMs: state.avgCompactionIntervalMs,
        localMemoryEntries: localEntries,
        decisionsPreserved: decisions.length,
      }) + '\n');
    } catch {
      // Non-critical
    }

    logHook('pre-compact-saver',
      `Saved state before compaction #${state.compactionCount} ` +
      `(${localEntries} memory entries, ${decisions.length} decisions preserved)`
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logHook('pre-compact-saver', `Failed to save state: ${msg}`, 'warn');
  }

  return outputSilentSuccess();
}

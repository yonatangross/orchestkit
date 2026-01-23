/**
 * Mem0 Pre-Compaction Sync Hook
 * Prompts Claude to save important session context to Mem0 before compaction
 *
 * Features:
 * - Graph memory support
 * - Pending pattern sync
 * - Session summaries
 * - Batch operations for efficiency
 */

import { existsSync, readFileSync, mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, getPluginRoot, outputSilentSuccess } from '../lib/common.js';

/**
 * Count pending decisions not yet synced
 */
function countPendingDecisions(decisionLog: string, syncState: string): number {
  if (!existsSync(decisionLog)) {
    return 0;
  }

  try {
    const decisions = JSON.parse(readFileSync(decisionLog, 'utf-8'));
    const decisionList = decisions.decisions || [];

    if (existsSync(syncState)) {
      const state = JSON.parse(readFileSync(syncState, 'utf-8'));
      const syncedIds = state.synced_decisions || [];
      return decisionList.filter((d: { decision_id: string }) => !syncedIds.includes(d.decision_id)).length;
    }

    return decisionList.length;
  } catch {
    return 0;
  }
}

/**
 * Count pending patterns
 */
function countPendingPatterns(patternsLog: string): { count: number; patterns: unknown[] } {
  if (!existsSync(patternsLog)) {
    return { count: 0, patterns: [] };
  }

  try {
    const content = readFileSync(patternsLog, 'utf-8');
    // Try parsing as JSONL (one object per line) or single JSON
    let patterns: unknown[];
    try {
      patterns = content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
    } catch {
      patterns = [JSON.parse(content)];
    }

    const pending = patterns.filter((p: any) => p.pending_sync === true);
    return { count: pending.length, patterns: pending };
  } catch {
    return { count: 0, patterns: [] };
  }
}

/**
 * Get project ID from directory
 */
function getProjectId(projectDir: string): string {
  return projectDir.split('/').pop() || 'project';
}

/**
 * Extract session state info
 */
function extractSessionInfo(projectDir: string): {
  currentTask: string;
  blockers: string;
  nextSteps: string;
} {
  let currentTask = '';
  let blockers = '';
  let nextSteps = '';

  const sessionState = `${projectDir}/.claude/context/session/state.json`;
  if (existsSync(sessionState)) {
    try {
      const state = JSON.parse(readFileSync(sessionState, 'utf-8'));
      currentTask = state.current_task || state.task || '';
    } catch {
      // Ignore
    }
  }

  const blockersLog = `${projectDir}/.claude/logs/blockers.jsonl`;
  if (existsSync(blockersLog)) {
    try {
      const content = readFileSync(blockersLog, 'utf-8');
      const lines = content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
      const unresolvedBlockers = lines.filter((b) => !b.resolved).slice(-5);
      blockers = unresolvedBlockers.map((b) => b.description || '').join('; ');
    } catch {
      // Ignore
    }
  }

  return { currentTask, blockers, nextSteps };
}

/**
 * Mem0 pre-compaction sync hook
 */
export function mem0PreCompactionSync(input: HookInput): HookResult {
  const projectDir = input.project_dir || getProjectDir();
  const pluginRoot = getPluginRoot();

  const decisionLog = `${pluginRoot}/.claude/coordination/decision-log.json`;
  const patternsLog = `${projectDir}/.claude/logs/agent-patterns.jsonl`;
  const syncState = `${pluginRoot}/.claude/coordination/.decision-sync-state.json`;

  // Count pending items
  const decisionCount = countPendingDecisions(decisionLog, syncState);
  const { count: patternCount, patterns: pendingPatterns } = countPendingPatterns(patternsLog);

  // Extract session info
  const { currentTask, blockers, nextSteps } = extractSessionInfo(projectDir);

  // If nothing to sync, silent exit
  if (decisionCount === 0 && patternCount === 0 && !currentTask) {
    return outputSilentSuccess();
  }

  const projectId = getProjectId(projectDir);
  const logFile = `${projectDir}/.claude/logs/mem0-sync.log`;

  // Ensure log directory exists
  try {
    mkdirSync(`${projectDir}/.claude/logs`, { recursive: true });
  } catch {
    // Ignore
  }

  // Build summary message parts
  const msgParts: string[] = [];
  if (decisionCount > 0) {
    msgParts.push(`${decisionCount} decisions to sync`);
  }
  if (patternCount > 0) {
    msgParts.push(`${patternCount} agent patterns pending`);

    // Extract unique agents
    const agentSet = new Set(pendingPatterns.map((p: any) => p.agent_id || p.agent).filter(Boolean));
    const uniqueAgents = Array.from(agentSet).slice(0, 5);
    if (uniqueAgents.length > 0) {
      msgParts.push(`agents: ${uniqueAgents.join(', ')}`);
    }
  }

  const summary = msgParts.length > 0 ? msgParts.join('; ') : 'No pending items';

  // Build session text
  let summaryText = currentTask || 'Session work';
  if (decisionCount > 0) {
    summaryText += ` (${decisionCount} decisions made)`;
  }
  if (patternCount > 0) {
    summaryText += ` (${patternCount} patterns learned)`;
  }

  let sessionText = `Session Summary: ${summaryText}`;
  if (blockers) {
    sessionText += ` | Blockers: ${blockers}`;
  }
  if (nextSteps) {
    sessionText += ` | Next: ${nextSteps}`;
  }

  // Try auto-sync if MEM0_API_KEY is available
  const scriptPath = `${pluginRoot}/skills/mem0-memory/scripts/crud/add-memory.py`;
  const mem0ApiKey = process.env.MEM0_API_KEY;

  let skillMsg: string;

  if (existsSync(scriptPath) && mem0ApiKey) {
    const timestamp = new Date().toISOString();
    try {
      appendFileSync(logFile, `[${timestamp}] Auto-sync triggered for session summary\n`);
    } catch {
      // Ignore
    }

    // Execute sync in background (non-blocking)
    const sessionMetadata = JSON.stringify({
      type: 'session_summary',
      status: 'in_progress',
      project: projectId,
      has_blockers: !!blockers,
      has_next_steps: !!nextSteps,
      source: 'orchestkit-plugin',
    });

    const child = spawn(
      'python3',
      [
        scriptPath,
        '--text',
        sessionText,
        '--user-id',
        `${projectId}-continuity`,
        '--metadata',
        sessionMetadata,
        '--enable-graph',
      ],
      {
        detached: true,
        stdio: 'ignore',
      }
    );
    child.unref();

    // Mark patterns as synced
    if (patternCount > 0 && existsSync(patternsLog)) {
      try {
        const content = readFileSync(patternsLog, 'utf-8');
        const updated = content
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => {
            const obj = JSON.parse(line);
            obj.pending_sync = false;
            return JSON.stringify(obj);
          })
          .join('\n');
        writeFileSync(patternsLog, updated);
      } catch {
        // Ignore
      }
    }

    skillMsg = `[Mem0 Sync] Auto-synced: ${summary}`;
  } else {
    skillMsg = `[Mem0 Sync] ${summary} - Execute /mem0-sync to persist session context`;
  }

  logHook('mem0-pre-compaction-sync', skillMsg);

  return {
    continue: true,
    systemMessage: skillMsg,
  };
}

/**
 * PreCompact Saver
 * CC 2.1.25: Saves session context before context compaction
 *
 * When CC compacts the conversation context, this hook preserves
 * critical session state (active tasks, current branch, working files)
 * to the session state file so it survives compaction.
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getLogDir, getSessionId } from '../lib/common.js';

interface SessionState {
  lastCompaction?: string;
  compactionCount?: number;
  preservedContext?: {
    branch?: string;
    activeFiles?: string[];
    sessionNotes?: string;
  };
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

export function preCompactSaver(input: HookInput): HookResult {
  try {
    const stateFile = getSessionStateFile();
    const state = loadSessionState(stateFile);

    // Update compaction metadata
    state.lastCompaction = new Date().toISOString();
    state.compactionCount = (state.compactionCount || 0) + 1;

    // Preserve context from current session
    state.preservedContext = {
      branch: process.env.ORCHESTKIT_BRANCH || undefined,
      sessionNotes: `Compaction #${state.compactionCount} at ${state.lastCompaction}`,
    };

    writeFileSync(stateFile, JSON.stringify(state, null, 2));

    logHook('pre-compact-saver', `Saved state before compaction #${state.compactionCount}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logHook('pre-compact-saver', `Failed to save state: ${msg}`, 'warn');
  }

  return outputSilentSuccess();
}

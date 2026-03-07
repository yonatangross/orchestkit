/**
 * Task Progress Tracker — Numbered progress display for task workflows
 *
 * Maintains a running count of tasks per session and emits a progress bar
 * via stderr (user-visible) when tasks complete.
 *
 * Format: [######....] 3/7 phases complete
 *
 * State: persisted to log dir for cross-process recovery.
 *
 * @hook TaskCompleted
 * @since v7.2.0
 */

import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';
import { atomicWriteSync } from '../lib/atomic-write.js';
import { getLogDir } from '../lib/paths.js';

const HOOK_NAME = 'task-progress-tracker';

interface ProgressState {
  total: number;
  completed: number;
  task_ids: string[];
  session_id: string;
}

function getStatePath(): string {
  return join(getLogDir(), 'task-progress-state.json');
}

function loadState(sessionId: string): ProgressState {
  try {
    const path = getStatePath();
    if (existsSync(path)) {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<ProgressState>;
      if (!Array.isArray(parsed.task_ids)) throw new Error('invalid shape');
      // Reset state if session changed
      if (parsed.session_id && parsed.session_id !== sessionId) {
        return { total: 0, completed: 0, task_ids: [], session_id: sessionId };
      }
      return { total: parsed.total ?? 0, completed: parsed.completed ?? 0, task_ids: parsed.task_ids, session_id: sessionId };
    }
  } catch { /* start fresh */ }
  return { total: 0, completed: 0, task_ids: [], session_id: sessionId };
}

function saveState(state: ProgressState): void {
  try {
    const path = getStatePath();
    const dir = dirname(path);
    mkdirSync(dir, { recursive: true });
    atomicWriteSync(path, JSON.stringify(state));
  } catch {
    logHook(HOOK_NAME, 'Failed to persist state', 'warn');
  }
}

function renderProgressBar(completed: number, total: number): string {
  if (total === 0) return '';
  const width = 20;
  const displayCompleted = Math.min(completed, total);
  const filled = Math.round((displayCompleted / total) * width);
  const empty = width - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  const pct = Math.min(100, Math.round((displayCompleted / total) * 100));
  return `[${bar}] ${displayCompleted}/${total} (${pct}%)`;
}

/**
 * Track task progress and emit progress bar on completion
 */
export function taskProgressTracker(input: HookInput): HookResult {
  const taskStatus = input.task_status || '';
  const taskId = input.task_id || '';
  const taskSubject = input.task_subject || '';
  const sessionId = input.session_id || '';

  if (!taskId) return outputSilentSuccess();

  const state = loadState(sessionId);

  // Detect numbered task format: [3/7] or [N/M]
  const numberMatch = taskSubject.match(/^\[(\d+)\/(\d+)\]/);

  if (taskStatus === 'completed') {
    // Track completion
    if (!state.task_ids.includes(taskId)) {
      state.task_ids.push(taskId);
      state.completed = state.task_ids.length;
    }

    // Update total from numbered format if available
    if (numberMatch) {
      const total = parseInt(numberMatch[2], 10);
      if (total > state.total) state.total = total;
    }

    saveState(state);

    // Only show progress bar if we have a meaningful total
    if (state.total >= 2) {
      const bar = renderProgressBar(state.completed, state.total);
      process.stderr.write(`${bar} phases complete\n`);
      logHook(HOOK_NAME, `Progress: ${state.completed}/${state.total}`);
    }
  }

  return outputSilentSuccess();
}

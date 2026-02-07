/**
 * TaskCompleted Hook: Completion Tracker
 *
 * CC 2.1.33 TaskCompleted event fires when a task completes.
 * Logs completion metrics and suggests follow-up verification for code tasks.
 *
 * @hook TaskCompleted
 * @since CC 2.1.33
 */

import type { HookInput, HookResult } from '../types.js';
import { getProjectDir } from '../lib/common.js';
import { appendEventLog } from '../lib/event-logger.js';

/** Match code implementation tasks — require 2+ word subjects to avoid false positives */
const IMPLEMENTATION_PATTERN = /\b(?:implement|refactor|build|migrate)\b.{5,}/i;

export async function completionTracker(input: HookInput): Promise<HookResult> {
  if (!getProjectDir()) {
    return { continue: true };
  }

  const taskId = input.task_id || 'unknown';
  const taskSubject = input.task_subject || '';
  const taskStatus = input.task_status || 'completed';
  const duration = input.duration_ms || 0;

  appendEventLog('task-completions.jsonl', {
    timestamp: new Date().toISOString(),
    event: 'task_completed',
    task_id: taskId,
    task_subject: taskSubject,
    task_status: taskStatus,
    duration_ms: duration,
    session_id: input.session_id,
  });

  // Suggest verification only for substantial implementation tasks
  if (IMPLEMENTATION_PATTERN.test(taskSubject) && taskStatus === 'completed') {
    return {
      continue: true,
      hookSpecificOutput: {
        additionalContext: `Task "${taskSubject}" completed (${Math.round(duration / 1000)}s). Consider running tests to verify.`,
      },
    };
  }

  return { continue: true };
}

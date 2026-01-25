/**
 * Task Completion Check - Verifies tasks are properly completed before stop
 * Hook: Stop
 */

import { existsSync, readFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, outputSilentSuccess } from '../lib/common.js';

interface TodoItem {
  status: string;
  description?: string;
}

/**
 * Task completion check hook
 */
export function taskCompletionCheck(input: HookInput): HookResult {
  logHook('task-completion-check', 'Stop hook - checking task completion');

  const todosFile = '/tmp/claude-active-todos.json';

  if (!existsSync(todosFile)) {
    return outputSilentSuccess();
  }

  try {
    const todos: TodoItem[] = JSON.parse(readFileSync(todosFile, 'utf-8'));
    const inProgress = todos.filter((t) => t.status === 'in_progress');

    if (inProgress.length > 0) {
      logHook('task-completion-check', `WARNING: ${inProgress.length} tasks in progress at stop`);

      // Log task details
      for (const task of inProgress) {
        if (task.description) {
          logHook('task-completion-check', `  - ${task.description}`);
        }
      }

      // Return with warning but don't block
      return {
        continue: true,
        suppressOutput: true,
        // Note: We could add a systemMessage here if we want to warn the user
        // systemMessage: `Warning: ${inProgress.length} task(s) still in progress`,
      };
    }
  } catch (error) {
    logHook('task-completion-check', `Error reading todos: ${error}`);
  }

  return outputSilentSuccess();
}

/**
 * Task Completion Check - Verifies tasks are properly completed before stop
 * Hook: Stop
 * CC 2.1.20: Orphan detection and deletion support
 */

import { existsSync, readFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, getSessionId, outputSilentSuccess, outputWithContext } from '../lib/common.js';
import { getOrphanedTasks, formatTaskDeleteForClaude } from '../lib/task-integration.js';

interface TodoItem {
  status: string;
  description?: string;
}

/**
 * Task completion check hook
 */
export function taskCompletionCheck(input: HookInput): HookResult {
  logHook('task-completion-check', 'Stop hook - checking task completion');

  const warnings: string[] = [];

  // CC 2.1.20: Check orchestration registry for in_progress tasks
  const projectDir = input.project_dir || getProjectDir();
  const sessionId = input.session_id || getSessionId();
  const registryFile = `${projectDir}/.claude/orchestration/task-registry-${sessionId}.json`;

  if (existsSync(registryFile)) {
    try {
      const registry = JSON.parse(readFileSync(registryFile, 'utf-8'));
      const inProgress = (registry.tasks || []).filter(
        (t: { status: string }) => t.status === 'in_progress'
      );
      if (inProgress.length > 0) {
        logHook('task-completion-check', `WARNING: ${inProgress.length} orchestration tasks still in progress`);
        warnings.push(`${inProgress.length} orchestration task(s) still in progress at session stop`);
      }
    } catch (error) {
      logHook('task-completion-check', `Error reading registry: ${error}`);
    }
  }

  // CC 2.1.20: Check for orphaned tasks and generate deletion instructions
  const orphans = getOrphanedTasks();
  let orphanInstructions = '';
  if (orphans.length > 0) {
    logHook('task-completion-check', `Found ${orphans.length} orphaned tasks`);
    orphanInstructions = '\n\n## Orphaned Tasks\n\nThe following tasks are orphaned (all blockers failed) and should be deleted:\n';
    for (const orphan of orphans) {
      orphanInstructions += `\n${formatTaskDeleteForClaude(orphan.taskId, 'All blocking tasks have failed')}`;
    }
  }

  // Legacy fallback: check /tmp/claude-active-todos.json
  const todosFile = '/tmp/claude-active-todos.json';
  if (existsSync(todosFile)) {
    try {
      const todos: TodoItem[] = JSON.parse(readFileSync(todosFile, 'utf-8'));
      const inProgress = todos.filter((t) => t.status === 'in_progress');
      if (inProgress.length > 0) {
        logHook('task-completion-check', `WARNING: ${inProgress.length} legacy tasks in progress at stop`);
        warnings.push(`${inProgress.length} legacy task(s) still in progress`);
      }
    } catch (error) {
      logHook('task-completion-check', `Error reading legacy todos: ${error}`);
    }
  }

  if (warnings.length > 0 || orphanInstructions) {
    let context = `## Task Completion Warning\n\n${warnings.map(w => `- ${w}`).join('\n')}`;
    if (orphanInstructions) {
      context += orphanInstructions;
    }
    return outputWithContext(context);
  }

  return outputSilentSuccess();
}

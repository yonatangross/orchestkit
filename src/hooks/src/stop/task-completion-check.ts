/**
 * Task Completion Check - Verifies tasks are properly completed before stop
 * Hook: Stop
 * CC 2.1.20: Orphan detection and deletion support
 */

import { existsSync, readFileSync } from 'node:fs';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess, outputWithContext } from '../lib/common.js';
import { getOrphanedTasks, formatTaskDeleteForClaude } from '../lib/task-integration.js';
import { getActiveTodosFile } from '../lib/paths.js';
import { NOOP_CTX } from '../lib/context.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { appendEventLog } from '../lib/event-logger.js';
import { getSessionStorageDir } from '../lib/paths.js';
import { safeIdentifier } from '../lib/safe-fs.js';
import { sessionHasTasks } from '../lib/task-usage-signal.js';
import { qualifyingPromptCount } from '../prompt/multi-step-task-nudge.js';

interface TodoItem {
  status: string;
  description?: string;
}

/**
 * Task completion check hook
 */
export function taskCompletionCheck(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  ctx.log('task-completion-check', 'Stop hook - checking task completion');

  const warnings: string[] = [];

  // CC 2.1.20: Check orchestration registry for in_progress tasks
  const projectDir = input.project_dir || (ctx.projectDir);
  const sessionId = input.session_id || (ctx.sessionId);
  const registryFile = `${projectDir}/.claude/orchestration/task-registry-${sessionId}.json`;

  if (existsSync(registryFile)) {
    try {
      const registry = JSON.parse(readFileSync(registryFile, 'utf-8'));
      const inProgress = (registry.tasks || []).filter(
        (t: { status: string }) => t.status === 'in_progress'
      );
      if (inProgress.length > 0) {
        ctx.log('task-completion-check', `WARNING: ${inProgress.length} orchestration tasks still in progress`);
        warnings.push(`${inProgress.length} orchestration task(s) still in progress at session stop`);
      }
    } catch (error) {
      ctx.log('task-completion-check', `Error reading registry: ${error}`);
    }
  }

  // CC 2.1.20: Check for orphaned tasks and generate deletion instructions
  const orphans = getOrphanedTasks();
  let orphanInstructions = '';
  if (orphans.length > 0) {
    ctx.log('task-completion-check', `Found ${orphans.length} orphaned tasks`);
    orphanInstructions = '\n\n## Orphaned Tasks\n\nThe following tasks are orphaned (all blockers failed) and should be deleted:\n';
    for (const orphan of orphans) {
      orphanInstructions += `\n${formatTaskDeleteForClaude(orphan.taskId, 'All blocking tasks have failed')}`;
    }
  }

  // Legacy fallback: check platform-appropriate temp dir
  const todosFile = getActiveTodosFile();
  if (existsSync(todosFile)) {
    try {
      const todos: TodoItem[] = JSON.parse(readFileSync(todosFile, 'utf-8'));
      const inProgress = todos.filter((t) => t.status === 'in_progress');
      if (inProgress.length > 0) {
        ctx.log('task-completion-check', `WARNING: ${inProgress.length} legacy tasks in progress at stop`);
        warnings.push(`${inProgress.length} legacy task(s) still in progress`);
      }
    } catch (error) {
      ctx.log('task-completion-check', `Error reading legacy todos: ${error}`);
    }
  }

  // Task-usage telemetry (2026-08-01): CLAUDE.md's "TaskCreate for 3+ step
  // work" rule had no measurement, so compliance was anecdote. The prompt-side
  // multi-step-task-nudge counts qualifying prompts per session; here that
  // count is joined with whether the session ever created a task — the
  // denominator and numerator a future ratchet needs. Silent: this leg
  // measures, the prompt leg speaks.
  //
  // Stop fires on EVERY turn end (measured: 1,236 Stops across ~350 sessions),
  // so a naive append here would write per-turn spam. A state file keyed on
  // tasks_used caps it at two lines per session: the first qualifying Stop,
  // and the false->true conversion if the operator opens tasks later. The
  // LAST line per session_id is the session's verdict.
  try {
    const qualifying = qualifyingPromptCount(sessionId || '');
    if (qualifying > 0 && projectDir && sessionId) {
      const used = sessionHasTasks(projectDir, sessionId);
      const statePath = join(
        getSessionStorageDir(),
        `${safeIdentifier(sessionId, 'invalid')}-task-outcome.state`,
      );
      const prev = existsSync(statePath) ? readFileSync(statePath, 'utf8').trim() : '';
      const now = used ? 'true' : 'false';
      if (prev !== now && prev !== 'true') {
        appendEventLog('task-nudge-outcomes.jsonl', {
          timestamp: new Date().toISOString(),
          event: 'session_task_usage',
          session_id: sessionId,
          qualifying_prompts: qualifying,
          tasks_used: used,
        });
        mkdirSync(getSessionStorageDir(), { recursive: true });
        writeFileSync(statePath, now, 'utf8');
      }
    }
  } catch (error) {
    ctx.log('task-completion-check', `task-usage telemetry failed: ${error}`);
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

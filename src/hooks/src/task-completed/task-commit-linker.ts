/**
 * Task-Commit Linker — Suggest commit when a task completes
 *
 * When TaskCompleted fires with status "completed", injects context
 * suggesting the agent commit to preserve the milestone.
 *
 * Pairs with commit-nudge (dirty file tracking) to close the
 * task→commit gap. This hook fires on task completion events,
 * while commit-nudge fires on file modifications.
 *
 * @hook TaskCompleted
 * @since v7.2.0
 */

import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess, outputWithContext } from '../lib/common.js';
import { getDirtyFileCount } from '../lib/git.js';
import { NOOP_CTX } from '../lib/context.js';

const HOOK_NAME = 'task-commit-linker';

/**
 * Suggest commit on task completion when there are dirty files
 */
export function taskCommitLinker(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const taskStatus = input.task_status || '';
  const taskSubject = input.task_subject || '';

  // Only fire on completed tasks
  if (taskStatus !== 'completed') {
    return outputSilentSuccess();
  }

  const projectDir = ctx.projectDir;
  if (!projectDir) return outputSilentSuccess();

  const dirtyCount = getDirtyFileCount(projectDir);
  if (dirtyCount === 0) return outputSilentSuccess();

  const taskId = input.task_id || 'unknown';
  ctx.log(HOOK_NAME, `Task #${taskId} completed with ${dirtyCount} dirty files`);

  return outputWithContext(
    `[Task-Commit Link] Task #${taskId} "${taskSubject}" completed. You have ${dirtyCount} uncommitted file(s). Commit now to preserve this milestone — use /ork:commit to create a conventional commit referencing this work.`
  );
}

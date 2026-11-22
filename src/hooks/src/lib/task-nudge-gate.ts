/**
 * Task Nudge Gate: one task-tracking nudge per session, shared by every hook.
 *
 * Three hooks used to tell the model to use TaskCreate: the UserPromptSubmit
 * multi-step-task-nudge, the PreToolUse task-existence-gate and the
 * PostToolUse agent-task-auto-register. A noise audit (200 sessions) found
 * them stacking, including in sessions whose tool set has no TaskCreate (the
 * Claude desktop app uses a different task list tool).
 *
 * HookInput carries no tool list, so "TaskCreate is unavailable" cannot be
 * detected from the hook input. The best available proxies are used instead:
 *   1. the session already created a task (task-creations.jsonl) -> silent
 *   2. a nudge was already sent this session (any of the three) -> silent
 *
 * The claim is an exclusive-create marker file, so two hooks racing in the same
 * session cannot both win. Any filesystem problem fails CLOSED (no nudge).
 * Only injected text is gated here; side effects stay in the calling hooks.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSessionStorageDir } from './paths.js';
import { safeIdentifier } from './safe-fs.js';
import { sessionHasTasks } from './task-usage-signal.js';

function markerPath(sessionId: string): string {
  // session_id is untrusted hook input: sanitize before it becomes a filename.
  return join(getSessionStorageDir(), `${safeIdentifier(sessionId, 'invalid')}-task-nudge.sent`);
}

/**
 * True exactly once per session, and only when the session has no tasks yet.
 * Call this only at the point a nudge would actually be injected.
 */
export function claimTaskNudge(sessionId: string | undefined, projectDir: string): boolean {
  if (!sessionId) return false; // cannot scope it to a session -> stay quiet
  if (sessionHasTasks(projectDir, sessionId)) return false;
  try {
    mkdirSync(getSessionStorageDir(), { recursive: true });
    writeFileSync(markerPath(sessionId), new Date().toISOString(), { flag: 'wx' });
    return true;
  } catch {
    return false; // already claimed (EEXIST) or unwritable -> stay quiet
  }
}

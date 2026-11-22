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
 * The nudge is spent only when its text is delivered. A dispatcher hook first
 * asks taskNudgeAvailable (read only), and its dispatcher claims after a later
 * hook's ask or deny, or the prompt token budget, can no longer discard the
 * text. An unprompted reminder is included only if that exclusive claim wins.
 * Any filesystem problem fails CLOSED (no unprompted nudge). Only injected text
 * is gated here; side effects stay in the calling hooks.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput } from '../types.js';
import { getSessionStorageDir } from './paths.js';
import { safeIdentifier } from './safe-fs.js';
import { sessionHasTasks } from './task-usage-signal.js';

/**
 * EXPLICIT ask: the operator is talking about task/todo organisation itself.
 * It bypasses the one-per-session limit, because rate-limiting the literal
 * request is how visual-style-nudge measured 4 silenced explicit asks in one
 * session before its bypass existed. It still needs a session id and no task.
 */
const EXPLICIT_RE = /\b(?:todo list|task list|todos?\b|taskcreate|organi[sz]e (?:our|the|this) (?:session|work))/i;

export function isExplicitTaskAsk(prompt: string): boolean {
  return EXPLICIT_RE.test(prompt);
}

function markerPath(sessionId: string): string {
  // session_id is untrusted hook input: sanitize before it becomes a filename.
  return join(getSessionStorageDir(), `${safeIdentifier(sessionId, 'invalid')}-task-nudge.sent`);
}

/** The session can be named and has no task yet. Explicit asks need only this. */
export function taskNudgeEligible(sessionId: string | undefined, projectDir: string): boolean {
  return Boolean(sessionId) && !sessionHasTasks(projectDir, sessionId as string);
}

/** Read only: would a claim for this session succeed right now? */
export function taskNudgeAvailable(sessionId: string | undefined, projectDir: string): boolean {
  if (!taskNudgeEligible(sessionId, projectDir)) return false;
  try {
    return !existsSync(markerPath(sessionId as string));
  } catch {
    return false;
  }
}

/**
 * True exactly once per session, and only when the session has no tasks yet.
 * Call this only at the point the nudge text is actually delivered.
 */
export function claimTaskNudge(sessionId: string | undefined, projectDir: string): boolean {
  if (!taskNudgeEligible(sessionId, projectDir)) return false; // no id, or it has a task
  try {
    mkdirSync(getSessionStorageDir(), { recursive: true });
    writeFileSync(markerPath(sessionId as string), new Date().toISOString(), { flag: 'wx' });
    return true;
  } catch {
    return false; // already claimed (EEXIST) or unwritable -> stay quiet
  }
}

/** Dispatcher form of claimTaskNudge, resolving the project dir from the input. */
export function claimTaskNudgeForInput(input: HookInput): boolean {
  return claimTaskNudge(input.session_id, input.project_dir || process.env.CLAUDE_PROJECT_DIR || '');
}

/**
 * Prompt dispatcher: may this reminder be included? An unprompted one must win
 * the claim. An explicit ask was already checked for eligibility, so it is
 * answered either way, and its claim only quiets later unprompted reminders.
 */
export function admitPromptTaskNudge(input: HookInput): boolean {
  const claimed = claimTaskNudgeForInput(input);
  return claimed || isExplicitTaskAsk(typeof input.prompt === 'string' ? input.prompt : '');
}

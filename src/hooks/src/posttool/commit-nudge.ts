/**
 * Commit Nudge — Escalating reminders to commit work
 *
 * Tracks dirty files and time since last commit. Escalates urgency:
 * - 5 dirty files → info (stderr, user-only)
 * - 10 dirty files → warning (additionalContext, Claude sees it)
 * - 15+ dirty files → strong nudge (additionalContext, urgent)
 * - 15min without commit → gentle time-based nudge
 *
 * State: /tmp/ork-commit-nudge-{session}.json
 * Disable: ORCHESTKIT_AUTO_COMMIT_NUDGE=false
 *
 * @hook PostToolUse (Write|Edit|MultiEdit|Bash)
 * @since v7.2.0
 */

import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputWithContext, logHook, getProjectDir } from '../lib/common.js';
import { atomicWriteSync } from '../lib/atomic-write.js';
import { getLogDir } from '../lib/paths.js';
import { getDirtyFileCount } from '../lib/git.js';

const HOOK_NAME = 'commit-nudge';

// Thresholds
const INFO_THRESHOLD = 5;
const WARN_THRESHOLD = 10;
const URGENT_THRESHOLD = 15;
const TIME_NUDGE_MS = 15 * 60 * 1000; // 15 minutes
const COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes
const TRACKED_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'Bash']);

interface NudgeState {
  last_commit_ts: number;
  last_nudge_level: 'none' | 'info' | 'warn' | 'urgent' | 'time';
  last_nudge_ts: number;
}

function getStatePath(): string {
  return join(getLogDir(), 'commit-nudge-state.json');
}

function loadState(): NudgeState {
  try {
    const path = getStatePath();
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf8'));
    }
  } catch { /* start fresh */ }
  return {
    last_commit_ts: Date.now(),
    last_nudge_level: 'none',
    last_nudge_ts: 0,
  };
}

function saveState(state: NudgeState): void {
  try {
    const path = getStatePath();
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    atomicWriteSync(path, JSON.stringify(state));
  } catch {
    logHook(HOOK_NAME, 'Failed to persist state', 'warn');
  }
}

function isRecentCommit(command: string): boolean {
  const trimmed = command.trim();
  if (!/^git\s+commit\b/.test(trimmed)) return false;
  // --amend and --allow-empty don't reduce dirty files — don't reset nudge state
  if (/--amend\b/.test(trimmed)) return false;
  if (/--allow-empty\b/.test(trimmed)) return false;
  return true;
}

/**
 * Commit nudge hook — escalating reminders based on dirty files and time
 */
export function commitNudge(input: HookInput): HookResult {
  // Disabled by env var
  if (process.env.ORCHESTKIT_AUTO_COMMIT_NUDGE === 'false') {
    return outputSilentSuccess();
  }

  const projectDir = getProjectDir();
  if (!projectDir) return outputSilentSuccess();

  const state = loadState();
  const now = Date.now();

  // If this was a git commit command, reset state
  const toolName = input.tool_name || '';
  const command = input.tool_input?.command ?? '';
  if (toolName === 'Bash' && isRecentCommit(command)) {
    state.last_commit_ts = now;
    state.last_nudge_level = 'none';
    state.last_nudge_ts = 0;
    saveState(state);
    return outputSilentSuccess();
  }

  // Only check on file-modifying tools
  if (!TRACKED_TOOLS.has(toolName)) return outputSilentSuccess();

  const dirtyCount = getDirtyFileCount(projectDir);
  if (dirtyCount === 0) return outputSilentSuccess();

  // Cooldown: don't nudge more than once per 3 minutes
  if (now - state.last_nudge_ts < COOLDOWN_MS) {
    return outputSilentSuccess();
  }

  // File-count-based nudge (escalating) — evaluated first, takes priority over time-based
  const timeSinceCommit = now - state.last_commit_ts;

  if (dirtyCount >= URGENT_THRESHOLD && state.last_nudge_level !== 'urgent') {
    state.last_nudge_level = 'urgent';
    state.last_nudge_ts = now;
    saveState(state);
    logHook(HOOK_NAME, `${dirtyCount} dirty files — urgent nudge`);
    return outputWithContext(
      `[Commit Nudge] ${dirtyCount} uncommitted files — this is a lot of unsaved work. Commit NOW to prevent loss from rate limits or session interruption. Use /ork:commit to commit.`
    );
  }

  if (dirtyCount >= WARN_THRESHOLD && (state.last_nudge_level === 'none' || state.last_nudge_level === 'info')) {
    state.last_nudge_level = 'warn';
    state.last_nudge_ts = now;
    saveState(state);
    logHook(HOOK_NAME, `${dirtyCount} dirty files — warn nudge`);
    return outputWithContext(
      `[Commit Nudge] ${dirtyCount} uncommitted files. Consider committing intermediate progress to avoid losing work.`
    );
  }

  if (dirtyCount >= INFO_THRESHOLD && state.last_nudge_level === 'none') {
    state.last_nudge_level = 'info';
    state.last_nudge_ts = now;
    saveState(state);
    logHook(HOOK_NAME, `${dirtyCount} dirty files — info nudge`);
    // Info level: stderr only (user sees, Claude doesn't)
    process.stderr.write(`[commit-nudge] ${dirtyCount} uncommitted files — consider committing soon\n`);
    return outputSilentSuccess();
  }

  // Time-based nudge (15min without commit, any dirty files)
  if (timeSinceCommit >= TIME_NUDGE_MS && state.last_nudge_level !== 'urgent') {
    state.last_nudge_level = 'time';
    state.last_nudge_ts = now;
    saveState(state);
    const mins = Math.round(timeSinceCommit / 60000);
    logHook(HOOK_NAME, `${mins}min since last commit, ${dirtyCount} dirty files`);
    return outputWithContext(
      `[Commit Nudge] ${mins} minutes since last commit with ${dirtyCount} uncommitted file(s). Consider committing to preserve progress. Use /ork:commit for a quick conventional commit.`
    );
  }

  return outputSilentSuccess();
}

/**
 * Agent Teams Detection & Configuration Utility
 * Issue #362: Deprecate coordination hooks redundant with CC Agent Teams
 *
 * CC Agent Teams (CC 2.1.33+) provides native multi-instance coordination:
 * - Teammate lifecycle management
 * - 5-minute runtime heartbeat
 * - Idle notifications
 * - Cleanup on session end
 *
 * When Agent Teams is active, OrchestKit's custom coordination hooks
 * should yield to CC's native implementation to avoid duplication.
 */

import { existsSync, readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DB_PATH, openDb } from './session-registry.js';

/**
 * Check if CC Agent Teams is active.
 *
 * Detection signals:
 * - CLAUDE_CODE_TEAM_NAME: Set when running as part of an Agent Teams team
 * - CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: Feature flag for Agent Teams
 */
export function isAgentTeamsActive(): boolean {
  return !!(
    process.env.CLAUDE_CODE_TEAM_NAME ||
    process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1'
  );
}

/** Check if current session is a teammate in a team */
export function isTeammate(): boolean {
  return !!process.env.CLAUDE_CODE_TEAM_NAME;
}

/** Get current team name */
export function getTeamName(): string | null {
  return process.env.CLAUDE_CODE_TEAM_NAME || null;
}

export interface TeamMember {
  name: string;
  agentType: string;
}

/**
 * Read team config to get member list.
 * Reads from ~/.claude/teams/{team-name}/config.json
 */
export function getTeamMembers(): TeamMember[] {
  const teamName = getTeamName();
  if (!teamName) return [];

  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (!homeDir) return [];

  const configPath = join(homeDir, '.claude', 'teams', teamName, 'config.json');
  if (!existsSync(configPath)) return [];

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const members = config.members;
    if (!Array.isArray(members)) return [];

    return members.map((m: { name?: string; agentType?: string }) => ({
      name: m.name || 'unknown',
      agentType: m.agentType || 'unknown',
    }));
  } catch {
    return [];
  }
}

/** Count current team members */
export function getTeamSize(): number {
  return getTeamMembers().length;
}

/** List all team directories */
export function listAllTeams(): string[] {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (!homeDir) return [];
  const teamsDir = join(homeDir, '.claude', 'teams');
  if (!existsSync(teamsDir)) return [];
  try {
    return readdirSync(teamsDir).filter(name => {
      try { return statSync(join(teamsDir, name)).isDirectory(); } catch { return false; }
    });
  } catch { return []; }
}

/**
 * Newest mtime anywhere under `root`, in ms. Bounded depth, symlinks not followed.
 *
 * A directory's own mtime only changes when its DIRECT children are added or
 * removed. Writing a file two levels down leaves the top-level mtime untouched,
 * so `statSync(teamPath).mtimeMs` reports a busy team as hours idle.
 *
 * Throws if the root cannot be observed. Callers must treat that as
 * "cannot decide", never as "old".
 */
function newestMtimeMs(root: string, maxDepth = 3): { ms: number; path: string } {
  let newest = { ms: statSync(root).mtimeMs, path: root };
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return;
    let entries: import('node:fs').Dirent[];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      try {
        const st = statSync(p);
        if (st.mtimeMs > newest.ms) newest = { ms: st.mtimeMs, path: p };
        if (e.isDirectory() && !e.isSymbolicLink()) walk(p, depth + 1);
      } catch { /* a racing delete is not evidence of age */ }
    }
  };
  walk(root, 1);
  return newest;
}

/**
 * Is this team directory abandoned by a dead session?
 *
 * Deleting a team removes CC's own `~/.claude/teams/<name>` AND
 * `~/.claude/tasks/<name>`, so a false positive destroys a LIVE session's task
 * list. This runs at SessionStart, while other sessions are mid-flight. Every
 * branch below therefore fails CLOSED: when we cannot prove abandonment, we
 * keep the directory.
 *
 * Two bugs this replaces, both reproduced 2026-08-08:
 *  1. `!existsSync(config) -> stale` deleted a directory at ANY age, including
 *     one created milliseconds earlier by a live session that had not yet
 *     written config.json.
 *  2. The age came from the team dir's own mtime, which does not move when a
 *     nested task file is written, so active teams read as idle.
 */
/**
 * Lowercased identifying tokens of every session that is provably still alive.
 *
 * `ok: false` means we could not read the registry at all. Callers must treat
 * that as "ownership unknown" and refuse to delete — the whole point of #3385
 * is that a cleanup pass which cannot see liveness has no business deleting
 * anything. Returning an empty set on failure would silently restore the old
 * behaviour, so the failure is reported rather than flattened.
 *
 * Liveness is the pid from migration 004 (#3318). Before that fix the column
 * held the pid of the short-lived `node run-hook.mjs` child, which is always
 * dead by the time anyone reads it — a liveness check against that value would
 * have reported every session as gone.
 */
export function liveSessionTokens(): { ok: boolean; tokens: Set<string> } {
  const tokens = new Set<string>();
  try {
    // "No registry file" and "registry unreadable" are NOT the same question,
    // and collapsing them made this hook inert everywhere the file is absent
    // (CI, fresh installs) — the existing suite caught it, this machine could
    // not, because it happens to have a registry.
    //
    // Absent: ork has never registered a session here, so there is nobody to
    // vouch for. Report ok with an empty set and let the 24h window decide.
    // Unreadable (below): the answer exists and we failed to get it, which is
    // the only case that justifies refusing to delete anything.
    if (!existsSync(DB_PATH)) return { ok: true, tokens };
    const db = openDb();
    try {
      const rows = db
        .prepare('SELECT sid, pid FROM sessions WHERE ended_at IS NULL')
        .all() as Array<{ sid: string; pid: number }>;
      for (const r of rows) {
        if (!r.sid || typeof r.pid !== 'number' || r.pid <= 0) continue;
        try {
          process.kill(r.pid, 0); // signal 0 = liveness probe, sends nothing
        } catch {
          continue; // dead or not ours
        }
        const sid = r.sid.toLowerCase();
        tokens.add(sid);
        // CC names team dirs after a short prefix of the session id, so match
        // on that too. Only ever used to KEEP a directory.
        if (sid.length >= 8) tokens.add(sid.slice(0, 8));
      }
    } finally {
      try { db.close(); } catch { /* already closed */ }
    }
    return { ok: true, tokens };
  } catch {
    return { ok: false, tokens };
  }
}

export interface StalenessVerdict {
  /** True only when abandonment was positively established. */
  stale: boolean;
  /** Machine-readable reason, stable enough to grep for in logs. */
  reason:
    | 'no-home'
    | 'not-found'
    | 'unobservable'
    | 'recent-activity'
    | 'past-window'
    /** A session owning this team is still running. Never delete. */
    | 'session-live'
    /** The registry could not be read, so ownership is unknown. Never delete. */
    | 'liveness-unknown';
  /** Age of the newest mtime in the tree, in ms. Absent when undecidable. */
  ageMs?: number;
  /** Which path supplied that mtime — the forensic breadcrumb. */
  newestPath?: string;
}

/**
 * Decide, and SAY WHY.
 *
 * The boolean-only predicate this replaces made an irreversible decision
 * (rmSync of two directories) and left no record of the age it measured, the
 * path it measured, or which branch it took. When it deleted the wrong thing
 * there was nothing to read afterwards — the caller only logged a count.
 * That silence is why the misfire survived: nobody could see it happen.
 */
export function teamStaleness(
  teamName: string,
  maxAgeHours: number = 4
): StalenessVerdict {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (!homeDir) return { stale: false, reason: 'no-home' };
  const teamPath = join(homeDir, '.claude', 'teams', teamName);
  if (!existsSync(teamPath)) return { stale: false, reason: 'not-found' };

  // LIVENESS GATE, before any age reasoning (#3385).
  //
  // mtime is not liveness. A session open for hours that has not touched its
  // team directory recently is idle, not abandoned, and deleting its team makes
  // CC fail every later named-agent spawn with "team file not found". This
  // struct's own doc says stale is "True only when abandonment was positively
  // established"; an old mtime establishes nothing of the kind.
  //
  // The gate is deliberately one-directional: it can only ADD keeps. The
  // team-name -> session mapping is CC's convention, not ours, so a wrong guess
  // here must never be able to justify a delete. Unknown ownership keeps.
  const live = liveSessionTokens();
  if (!live.ok) return { stale: false, reason: 'liveness-unknown' };
  const lower = teamName.toLowerCase();
  for (const tok of live.tokens) {
    if (lower.includes(tok)) return { stale: false, reason: 'session-live' };
  }

  // Age gate, and it applies with or without a config. A team younger
  // than the window is never stale — that is the window's entire purpose.
  let newest: { ms: number; path: string };
  try {
    newest = newestMtimeMs(teamPath);
  } catch {
    return { stale: false, reason: 'unobservable' }; // could not observe != old
  }

  const ageMs = Date.now() - newest.ms;
  if (ageMs <= maxAgeHours * 3600_000) {
    return { stale: false, reason: 'recent-activity', ageMs, newestPath: newest.path };
  }

  // Past the window with nothing recent underneath it: abandoned.
  return { stale: true, reason: 'past-window', ageMs, newestPath: newest.path };
}

/** Boolean form, for callers that do not log. Prefer teamStaleness(). */
export function isStaleTeam(teamName: string, maxAgeHours: number = 4): boolean {
  return teamStaleness(teamName, maxAgeHours).stale;
}

/** Remove team + task directories */
export function cleanupTeam(teamName: string): boolean {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (!homeDir) return false;
  let ok = true;
  for (const sub of ['teams', 'tasks']) {
    const dir = join(homeDir, '.claude', sub, teamName);
    if (existsSync(dir)) {
      try { rmSync(dir, { recursive: true, force: true }); } catch { ok = false; }
    }
  }
  return ok;
}

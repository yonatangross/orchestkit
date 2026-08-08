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
function newestMtimeMs(root: string, maxDepth = 3): number {
  let newest = statSync(root).mtimeMs;
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return;
    let entries: import('node:fs').Dirent[];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      try {
        const st = statSync(p);
        if (st.mtimeMs > newest) newest = st.mtimeMs;
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
export function isStaleTeam(teamName: string, maxAgeHours: number = 4): boolean {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (!homeDir) return false;
  const teamPath = join(homeDir, '.claude', 'teams', teamName);
  if (!existsSync(teamPath)) return false;

  // Age gate FIRST, and it applies with or without a config. A team younger
  // than the window is never stale — that is the window's entire purpose.
  let newestMs: number;
  try {
    newestMs = newestMtimeMs(teamPath);
  } catch {
    return false; // could not observe != old
  }
  if (Date.now() - newestMs <= maxAgeHours * 3600_000) return false;

  // Past the window with nothing recent underneath it: abandoned.
  return true;
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

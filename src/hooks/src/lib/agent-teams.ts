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

import { existsSync, readFileSync } from 'node:fs';
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

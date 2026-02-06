/**
 * Agent Teams Detection Utility
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

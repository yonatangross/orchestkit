/**
 * Profile Injector - UserPromptSubmit Hook (Phase 6.1)
 *
 * Loads user profile on first prompt of each session and injects personalized context.
 * Part of Issue #245: Multi-User Intelligent Decision Capture System.
 *
 * This hook runs ONCE per session (configured via `once: true` in hooks.json)
 * and provides Claude with user-specific context including:
 * - User display name
 * - Top skills used (by usage count)
 * - Top agents spawned (by usage count)
 * - Recent architectural decisions
 *
 * Context is kept compact (~200 tokens) to minimize overhead while providing
 * useful personalization hints.
 *
 * @module prompt/profile-injector
 *
 * Storage: ~/.claude/orchestkit/users/{user_id}/profile.json (cross-project)
 *
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext for injection
 *
 * @example Output format:
 * ```
 * ## User Profile Context
 * Working with **John** (42 sessions)
 *
 * **Preferred skills:** api-design-framework, fastapi-advanced, database-schema-designer
 *
 * **Frequently used agents:** backend-system-architect, database-engineer
 *
 * **Recent decisions:** Use cursor pagination for large datasets; Adopt clean architecture
 * ```
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputPromptContext, logHook } from '../lib/common.js';
import {
  loadUserProfile,
  getTopSkills,
  getTopAgents,
  getRecentDecisions,
  type UserProfile,
} from '../lib/user-profile.js';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Maximum context length in characters.
 * Targets ~200 tokens (rough estimate: ~4 chars per token).
 */
const MAX_CONTEXT_CHARS = 800;

/**
 * Number of top skills to include in context.
 */
const TOP_SKILLS_LIMIT = 3;

/**
 * Number of top agents to include in context.
 */
const TOP_AGENTS_LIMIT = 3;

/**
 * Number of recent decisions to include in context.
 */
const RECENT_DECISIONS_LIMIT = 2;

/**
 * Maximum length for individual decision text before truncation.
 */
const MAX_DECISION_LENGTH = 50;

/**
 * Number of top preferences to include in context.
 */
const TOP_PREFERENCES_LIMIT = 2;

// =============================================================================
// FORMATTERS
// =============================================================================

/**
 * Formats the user's top skills into a comma-separated string.
 *
 * @param profile - User profile containing skill usage data
 * @param limit - Maximum number of skills to include
 * @returns Comma-separated skill names, or empty string if none
 *
 * @example
 * // Returns: "api-design-framework, fastapi-advanced, database-schema-designer"
 * formatTopSkills(profile, 3);
 */
function formatTopSkills(profile: UserProfile, limit: number = TOP_SKILLS_LIMIT): string {
  const topSkills = getTopSkills(profile, limit);
  if (topSkills.length === 0) return '';

  return topSkills.map((s) => s.skill).join(', ');
}

/**
 * Formats the user's top agents into a comma-separated string.
 *
 * @param profile - User profile containing agent usage data
 * @param limit - Maximum number of agents to include
 * @returns Comma-separated agent names, or empty string if none
 *
 * @example
 * // Returns: "backend-system-architect, database-engineer"
 * formatTopAgents(profile, 2);
 */
function formatTopAgents(profile: UserProfile, limit: number = TOP_AGENTS_LIMIT): string {
  const topAgents = getTopAgents(profile, limit);
  if (topAgents.length === 0) return '';

  return topAgents.map((a) => a.agent).join(', ');
}

/**
 * Formats recent decisions into a semicolon-separated string.
 * Decision text is truncated if longer than MAX_DECISION_LENGTH.
 *
 * @param profile - User profile containing decision history
 * @param limit - Maximum number of decisions to include
 * @returns Semicolon-separated decision summaries, or empty string if none
 *
 * @example
 * // Returns: "Use cursor pagination for large datasets; Adopt clean architecture"
 * formatRecentDecisions(profile, 2);
 */
function formatRecentDecisions(
  profile: UserProfile,
  limit: number = RECENT_DECISIONS_LIMIT
): string {
  const decisions = getRecentDecisions(profile, limit);
  if (decisions.length === 0) return '';

  return decisions
    .map((d) => d.what)
    .map((what) => (what.length > MAX_DECISION_LENGTH ? what.slice(0, MAX_DECISION_LENGTH - 3) + '...' : what))
    .join('; ');
}

/**
 * Formats user preferences into a compact string.
 *
 * @param profile - User profile containing preferences
 * @param limit - Maximum number of preferences to include
 * @returns Comma-separated "category: preference" pairs, or empty string if none
 *
 * @example
 * // Returns: "testing: pytest, database: PostgreSQL"
 * formatPreferences(profile, 2);
 */
function formatPreferences(profile: UserProfile, limit: number = TOP_PREFERENCES_LIMIT): string {
  if (profile.preferences.length === 0) return '';

  return profile.preferences
    .slice(0, limit)
    .map((p) => `${p.category}: ${p.preference}`)
    .join(', ');
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Checks if the user profile contains meaningful data worth injecting.
 * Returns false for completely new users with no activity.
 *
 * @param profile - User profile to validate
 * @returns true if profile has any meaningful data
 */
function hasProfileData(profile: UserProfile): boolean {
  return (
    profile.sessions_count > 0 ||
    Object.keys(profile.skill_usage).length > 0 ||
    Object.keys(profile.agent_usage).length > 0 ||
    profile.decisions.length > 0 ||
    profile.preferences.length > 0
  );
}

// =============================================================================
// CONTEXT BUILDER
// =============================================================================

/**
 * Builds a personalized context message from the user profile.
 * The output is formatted as markdown and kept under MAX_CONTEXT_CHARS.
 *
 * Format:
 * ```
 * ## User Profile Context
 * Working with **[display_name]** ([N] sessions)
 *
 * **Preferred skills:** [skill1, skill2, skill3]
 *
 * **Frequently used agents:** [agent1, agent2]
 *
 * **Recent decisions:** [decision1; decision2]
 *
 * **Preferences:** [category1: pref1, category2: pref2]
 * ```
 *
 * @param profile - User profile to build context from
 * @returns Formatted markdown context string, truncated if necessary
 */
function buildProfileContext(profile: UserProfile): string {
  const parts: string[] = [];

  // Header
  parts.push('## User Profile Context\n');

  // User identification with session count
  const name = profile.display_name || 'User';
  if (profile.sessions_count > 0) {
    parts.push(`Working with **${name}** (${profile.sessions_count} sessions)`);
  } else {
    parts.push(`Working with **${name}**`);
  }

  // Top skills
  const skills = formatTopSkills(profile);
  if (skills) {
    parts.push(`\n\n**Preferred skills:** ${skills}`);
  }

  // Top agents
  const agents = formatTopAgents(profile);
  if (agents) {
    parts.push(`\n\n**Frequently used agents:** ${agents}`);
  }

  // Recent decisions
  const decisions = formatRecentDecisions(profile);
  if (decisions) {
    parts.push(`\n\n**Recent decisions:** ${decisions}`);
  }

  // Top preferences
  const preferences = formatPreferences(profile);
  if (preferences) {
    parts.push(`\n\n**Preferences:** ${preferences}`);
  }

  let context = parts.join('');

  // Truncate if exceeding budget
  if (context.length > MAX_CONTEXT_CHARS) {
    context = context.slice(0, MAX_CONTEXT_CHARS - 3) + '...';
    logHook('profile-injector', `Context truncated to ${MAX_CONTEXT_CHARS} chars`, 'debug');
  }

  return context;
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Profile Injector Hook - Injects user profile context on first prompt.
 *
 * This hook is configured with `once: true` in hooks.json, ensuring it runs
 * only once per session (on the first UserPromptSubmit event).
 *
 * Behavior:
 * 1. Loads user profile from ~/.claude/orchestkit/users/{user_id}/profile.json
 * 2. Checks if profile has meaningful data
 * 3. Builds compact context string (~200 tokens)
 * 4. Injects via additionalContext (CC 2.1.9)
 *
 * Graceful degradation:
 * - Empty profile: Returns silent success (no injection)
 * - Load error: Logs warning and returns silent success
 * - Never crashes the hook chain
 *
 * @param _input - Hook input from Claude Code (prompt and session info)
 * @returns HookResult with additionalContext containing profile summary,
 *          or silent success if profile is empty/unavailable
 *
 * @example
 * // Hook is registered in hooks.json:
 * // {
 * //   "type": "command",
 * //   "command": "node .../run-hook.mjs prompt/profile-injector",
 * //   "once": true
 * // }
 */
export function profileInjector(_input: HookInput): HookResult {
  logHook('profile-injector', 'Loading user profile for session context');

  try {
    // Load user profile (handles migration from legacy paths automatically)
    const profile = loadUserProfile();

    // Skip injection if profile is empty (new user with no history)
    if (!hasProfileData(profile)) {
      logHook('profile-injector', 'Empty profile, skipping injection', 'debug');
      return outputSilentSuccess();
    }

    // Build personalized context message
    const context = buildProfileContext(profile);

    logHook(
      'profile-injector',
      `Injecting profile context for ${profile.display_name} (${context.length} chars)`,
      'info'
    );

    // Inject via additionalContext (CC 2.1.9 compliant)
    return outputPromptContext(context);
  } catch (error) {
    // Never crash the hook - fail gracefully and log warning
    logHook('profile-injector', `Error loading profile: ${error}`, 'warn');
    return outputSilentSuccess();
  }
}

// =============================================================================
// EXPORTS (for testing)
// =============================================================================

export {
  formatTopSkills,
  formatTopAgents,
  formatRecentDecisions,
  formatPreferences,
  hasProfileData,
  buildProfileContext,
  MAX_CONTEXT_CHARS,
  TOP_SKILLS_LIMIT,
  TOP_AGENTS_LIMIT,
  RECENT_DECISIONS_LIMIT,
};

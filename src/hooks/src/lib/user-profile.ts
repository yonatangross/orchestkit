/**
 * User Profile Management
 * Aggregates session data into user profiles for learning patterns across sessions.
 *
 * Profiles track:
 * - Skill usage patterns
 * - Agent preferences
 * - Decision history
 * - Workflow patterns
 * - Tool preferences
 *
 * Storage: ~/.claude/orchestkit/users/{user_id}/profile.json (cross-project)
 *
 * Migration: Profiles are migrated from old project-local path on first access
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { getProjectDir, logHook } from './common.js';
import { resolveUserIdentity } from './user-identity.js';
import { generateSessionSummary, type SessionSummary } from './session-tracker.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Usage statistics for a skill/agent/tool
 */
export interface UsageStats {
  /** Total times used */
  count: number;
  /** Success rate (0-1) */
  success_rate: number;
  /** Average duration in ms */
  avg_duration_ms?: number;
  /** First used timestamp */
  first_used: string;
  /** Last used timestamp */
  last_used: string;
}

/**
 * Recorded decision
 */
export interface RecordedDecision {
  /** What was decided */
  what: string;
  /** Alternatives considered */
  alternatives?: string[];
  /** Rationale provided */
  rationale?: string;
  /** Confidence score */
  confidence: number;
  /** When decided */
  timestamp: string;
  /** Project where decision was made */
  project?: string;
}

/**
 * Recorded preference
 */
export interface RecordedPreference {
  /** Category (e.g., "file_search", "testing", "language") */
  category: string;
  /** What is preferred */
  preference: string;
  /** Confidence score */
  confidence: number;
  /** When recorded */
  timestamp: string;
  /** How many times this preference was observed */
  observation_count: number;
}

/**
 * Detected workflow pattern
 */
export interface WorkflowPattern {
  /** Pattern name */
  name: string;
  /** Pattern description */
  description: string;
  /** How often this pattern is observed (0-1) */
  frequency: number;
  /** Tool sequences that indicate this pattern */
  tool_sequences: string[][];
}

/**
 * Complete user profile
 */
export interface UserProfile {
  /** User identifier */
  user_id: string;
  /** Anonymous identifier for global sharing */
  anonymous_id: string;
  /** Display name */
  display_name: string;
  /** Team/org if known */
  team_id?: string;
  /** Total sessions analyzed */
  sessions_count: number;
  /** First seen timestamp */
  first_seen: string;
  /** Last seen timestamp */
  last_seen: string;
  /** Profile version for migrations */
  version: number;

  /** Skill usage statistics */
  skill_usage: Record<string, UsageStats>;
  /** Agent usage statistics */
  agent_usage: Record<string, UsageStats>;
  /** Tool usage statistics */
  tool_usage: Record<string, UsageStats>;

  /** Tool preferences by category (Phase 4: Tool Usage Tracking)
   * Maps category → preferred tool name based on usage frequency
   * e.g., { search: 'Grep', file_read: 'Read' }
   */
  tool_preferences?: Record<string, string>;

  /** Tool usage by category (Phase 4: Tool Usage Tracking)
   * Maps category → { tool → count }
   * e.g., { search: { Grep: 10, Glob: 3 } }
   */
  tool_usage_by_category?: Record<string, Record<string, number>>;

  /** Recorded decisions */
  decisions: RecordedDecision[];
  /** Recorded preferences */
  preferences: RecordedPreference[];

  /** Detected workflow patterns */
  workflow_patterns: WorkflowPattern[];

  /** Session IDs that have been aggregated */
  aggregated_sessions: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PROFILE_VERSION = 1;
const MAX_DECISIONS = 100;
const MAX_PREFERENCES = 50;

// =============================================================================
// PATHS
// =============================================================================

/**
 * Get the home directory for cross-project storage
 */
function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '/tmp';
}

/**
 * Get the cross-project OrchestKit directory
 */
function getOrchestKitDir(): string {
  return join(getHomeDir(), '.claude', 'orchestkit');
}

/**
 * Get user profile directory (cross-project, in home directory)
 */
function getUserProfileDir(userId: string): string {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9@._-]/g, '_');
  return join(getOrchestKitDir(), 'users', sanitizedUserId);
}

/**
 * Get user profile file path
 */
function getUserProfilePath(userId: string): string {
  return join(getUserProfileDir(userId), 'profile.json');
}

/**
 * Get the OLD project-local profile path (for migration)
 */
function getLegacyProfilePath(userId: string): string {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9@._-]/g, '_');
  return join(getProjectDir(), '.claude', 'memory', 'users', sanitizedUserId, 'profile.json');
}

/**
 * Migrate profile from old project-local path to new cross-project path
 * Returns true if migration occurred
 */
function migrateProfileIfNeeded(userId: string): boolean {
  const legacyPath = getLegacyProfilePath(userId);
  const newPath = getUserProfilePath(userId);

  // If new path exists, no migration needed
  if (existsSync(newPath)) {
    return false;
  }

  // If legacy path exists, migrate it
  if (existsSync(legacyPath)) {
    try {
      const newDir = dirname(newPath);
      if (!existsSync(newDir)) {
        mkdirSync(newDir, { recursive: true });
      }

      // Read legacy profile
      const content = readFileSync(legacyPath, 'utf8');
      const profile = JSON.parse(content);

      // Write to new location
      writeFileSync(newPath, JSON.stringify(profile, null, 2));

      logHook('user-profile', `Migrated profile for ${userId} to cross-project storage`, 'info');
      return true;
    } catch (error) {
      logHook('user-profile', `Failed to migrate profile: ${error}`, 'warn');
      return false;
    }
  }

  return false;
}

// =============================================================================
// PROFILE LOADING/SAVING
// =============================================================================

/**
 * Create empty profile for a user
 */
function createEmptyProfile(userId: string): UserProfile {
  const identity = resolveUserIdentity();
  const now = new Date().toISOString();

  return {
    user_id: userId,
    anonymous_id: identity.anonymous_id,
    display_name: identity.display_name,
    team_id: identity.team_id,
    sessions_count: 0,
    first_seen: now,
    last_seen: now,
    version: PROFILE_VERSION,
    skill_usage: {},
    agent_usage: {},
    tool_usage: {},
    decisions: [],
    preferences: [],
    workflow_patterns: [],
    aggregated_sessions: [],
  };
}

/**
 * Load user profile from disk
 */
export function loadUserProfile(userId?: string): UserProfile {
  // Attempt migration from legacy project-local path
  const uid = userId || resolveUserIdentity().user_id;
  migrateProfileIfNeeded(uid);

  const profilePath = getUserProfilePath(uid);


  if (!existsSync(profilePath)) {
    return createEmptyProfile(uid);
  }

  try {
    const content = readFileSync(profilePath, 'utf8');
    const profile = JSON.parse(content) as UserProfile;

    // Handle version migrations here if needed
    if (profile.version < PROFILE_VERSION) {
      // Migrate profile
      profile.version = PROFILE_VERSION;
    }

    return profile;
  } catch (error) {
    logHook('user-profile', `Failed to load profile: ${error}`, 'warn');
    return createEmptyProfile(uid);
  }
}

/**
 * Save user profile to disk
 */
export function saveUserProfile(profile: UserProfile): boolean {
  const profileDir = getUserProfileDir(profile.user_id);
  const profilePath = getUserProfilePath(profile.user_id);

  try {
    if (!existsSync(profileDir)) {
      mkdirSync(profileDir, { recursive: true });
    }

    profile.last_seen = new Date().toISOString();
    writeFileSync(profilePath, JSON.stringify(profile, null, 2));

    logHook('user-profile', `Saved profile for ${profile.user_id}`, 'debug');
    return true;
  } catch (error) {
    logHook('user-profile', `Failed to save profile: ${error}`, 'error');
    return false;
  }
}

// =============================================================================
// PROFILE AGGREGATION
// =============================================================================

/**
 * Update usage stats with new data
 */
function updateUsageStats(
  existing: UsageStats | undefined,
  success: boolean,
  durationMs?: number
): UsageStats {
  const now = new Date().toISOString();

  if (!existing) {
    return {
      count: 1,
      success_rate: success ? 1 : 0,
      avg_duration_ms: durationMs,
      first_used: now,
      last_used: now,
    };
  }

  const newCount = existing.count + 1;
  const successCount = Math.round(existing.success_rate * existing.count) + (success ? 1 : 0);
  const newSuccessRate = successCount / newCount;

  let newAvgDuration = existing.avg_duration_ms;
  if (durationMs !== undefined) {
    if (existing.avg_duration_ms !== undefined) {
      newAvgDuration =
        (existing.avg_duration_ms * existing.count + durationMs) / newCount;
    } else {
      newAvgDuration = durationMs;
    }
  }

  return {
    count: newCount,
    success_rate: newSuccessRate,
    avg_duration_ms: newAvgDuration,
    first_used: existing.first_used,
    last_used: now,
  };
}

/**
 * Aggregate a session into the user profile
 */
export function aggregateSession(
  profile: UserProfile,
  summary: SessionSummary
): UserProfile {
  // Skip if already aggregated
  if (profile.aggregated_sessions.includes(summary.session_id)) {
    logHook('user-profile', `Session ${summary.session_id} already aggregated`, 'debug');
    return profile;
  }

  // Update session count
  profile.sessions_count++;
  profile.aggregated_sessions.push(summary.session_id);

  // Aggregate skill usage
  for (const skill of summary.skills_used) {
    profile.skill_usage[skill] = updateUsageStats(
      profile.skill_usage[skill],
      true // We don't have per-skill success in summary
    );
  }

  // Aggregate agent usage
  for (const agent of summary.agents_spawned) {
    profile.agent_usage[agent] = updateUsageStats(
      profile.agent_usage[agent],
      true
    );
  }

  // Keep only last N sessions to prevent unbounded growth
  const MAX_AGGREGATED_SESSIONS = 100;
  if (profile.aggregated_sessions.length > MAX_AGGREGATED_SESSIONS) {
    profile.aggregated_sessions = profile.aggregated_sessions.slice(
      -MAX_AGGREGATED_SESSIONS
    );
  }

  return profile;
}

/**
 * Aggregate current session and save profile
 */
export function aggregateCurrentSession(): UserProfile {
  const identity = resolveUserIdentity();
  const profile = loadUserProfile(identity.user_id);
  const summary = generateSessionSummary();

  const updatedProfile = aggregateSession(profile, summary);
  saveUserProfile(updatedProfile);

  return updatedProfile;
}

// =============================================================================
// DECISION/PREFERENCE RECORDING
// =============================================================================

/**
 * Add a decision to user profile
 */
export function addDecision(
  profile: UserProfile,
  decision: Omit<RecordedDecision, 'timestamp'>
): UserProfile {
  const newDecision: RecordedDecision = {
    ...decision,
    timestamp: new Date().toISOString(),
  };

  profile.decisions.unshift(newDecision);

  // Keep only last N decisions
  if (profile.decisions.length > MAX_DECISIONS) {
    profile.decisions = profile.decisions.slice(0, MAX_DECISIONS);
  }

  return profile;
}

/**
 * Add or update a preference
 */
export function addPreference(
  profile: UserProfile,
  category: string,
  preference: string,
  confidence: number
): UserProfile {
  // Check if preference already exists
  const existingIdx = profile.preferences.findIndex(
    p => p.category === category && p.preference === preference
  );

  if (existingIdx >= 0) {
    // Update existing
    const existing = profile.preferences[existingIdx];
    existing.observation_count++;
    existing.confidence = Math.max(existing.confidence, confidence);
    existing.timestamp = new Date().toISOString();
  } else {
    // Add new
    profile.preferences.push({
      category,
      preference,
      confidence,
      timestamp: new Date().toISOString(),
      observation_count: 1,
    });

    // Keep only top N preferences
    if (profile.preferences.length > MAX_PREFERENCES) {
      profile.preferences.sort((a, b) => b.observation_count - a.observation_count);
      profile.preferences = profile.preferences.slice(0, MAX_PREFERENCES);
    }
  }

  return profile;
}

// =============================================================================
// PROFILE QUERIES
// =============================================================================

/**
 * Get top N used skills for a user
 */
export function getTopSkills(profile: UserProfile, limit: number = 5): Array<{
  skill: string;
  stats: UsageStats;
}> {
  return Object.entries(profile.skill_usage)
    .map(([skill, stats]) => ({ skill, stats }))
    .sort((a, b) => b.stats.count - a.stats.count)
    .slice(0, limit);
}

/**
 * Get top N used agents for a user
 */
export function getTopAgents(profile: UserProfile, limit: number = 5): Array<{
  agent: string;
  stats: UsageStats;
}> {
  return Object.entries(profile.agent_usage)
    .map(([agent, stats]) => ({ agent, stats }))
    .sort((a, b) => b.stats.count - a.stats.count)
    .slice(0, limit);
}

/**
 * Get user's preferred tool for a category
 */
export function getPreferredTool(
  profile: UserProfile,
  category: string
): string | undefined {
  const pref = profile.preferences.find(p => p.category === category);
  return pref?.preference;
}

/**
 * Get recent decisions for a user
 */
export function getRecentDecisions(
  profile: UserProfile,
  limit: number = 10
): RecordedDecision[] {
  return profile.decisions.slice(0, limit);
}

/**
 * Check if user has made a specific type of decision before
 */
export function hasDecisionAbout(
  profile: UserProfile,
  keyword: string
): RecordedDecision | undefined {
  const lower = keyword.toLowerCase();
  return profile.decisions.find(
    d =>
      d.what.toLowerCase().includes(lower) ||
      d.rationale?.toLowerCase().includes(lower)
  );
}

// =============================================================================
// PROFILE EXPORT (for sharing)
// =============================================================================

/**
 * Export profile for team sharing (respects privacy settings)
 */
export function exportForTeam(profile: UserProfile): Partial<UserProfile> {
  return {
    user_id: profile.user_id,
    display_name: profile.display_name,
    team_id: profile.team_id,
    skill_usage: profile.skill_usage,
    agent_usage: profile.agent_usage,
    decisions: profile.decisions,
    preferences: profile.preferences,
  };
}

/**
 * Export profile for global sharing (anonymized)
 */
export function exportForGlobal(profile: UserProfile): {
  anonymous_id: string;
  decisions: Array<Omit<RecordedDecision, 'project'>>;
  preferences: RecordedPreference[];
} {
  // Remove project info from decisions for privacy
  const anonDecisions = profile.decisions.map(d => {
    const { project, ...rest } = d;
    return rest;
  });

  return {
    anonymous_id: profile.anonymous_id,
    decisions: anonDecisions,
    preferences: profile.preferences,
  };
}

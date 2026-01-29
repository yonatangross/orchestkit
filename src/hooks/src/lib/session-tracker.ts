/**
 * Session Event Tracker
 * Logs all session events (skills, agents, hooks, decisions) with user identity.
 *
 * Events are stored per-session in JSONL format for later aggregation.
 * This enables learning user patterns across sessions.
 *
 * Storage: .claude/memory/sessions/{session_id}/events.jsonl
 */

import { existsSync, appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { getProjectDir, getSessionId, logHook } from './common.js';
import { getIdentityContext, type IdentityContext } from './user-identity.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Event types that can be tracked
 */
export type SessionEventType =
  | 'skill_invoked'
  | 'agent_spawned'
  | 'hook_triggered'
  | 'decision_made'
  | 'preference_stated'
  | 'problem_reported'
  | 'solution_found'
  | 'tool_used'
  | 'session_start'
  | 'session_end'
  | 'communication_style_detected';

/**
 * A single session event
 */
export interface SessionEvent {
  /** Unique event ID */
  event_id: string;
  /** Event type */
  event_type: SessionEventType;
  /** Identity context (user, session, machine) */
  identity: IdentityContext;
  /** Event-specific payload */
  payload: {
    /** Name of skill/agent/hook/tool */
    name: string;
    /** Input data (optional, may be truncated for privacy) */
    input?: Record<string, unknown>;
    /** Output/result (optional, may be truncated) */
    output?: Record<string, unknown>;
    /** Duration in milliseconds */
    duration_ms?: number;
    /** Whether the event succeeded */
    success: boolean;
    /** Additional context */
    context?: string;
    /** Confidence score (for decisions) */
    confidence?: number;
  };
}

/**
 * Session summary (aggregated at session end)
 */
export interface SessionSummary {
  session_id: string;
  user_id: string;
  anonymous_id: string;
  team_id?: string;
  start_time?: string;
  end_time?: string;
  duration_ms?: number;
  event_counts: Record<SessionEventType, number>;
  skills_used: string[];
  agents_spawned: string[];
  hooks_triggered: string[];
  decisions_made: number;
  problems_reported: number;
  solutions_found: number;
}

// =============================================================================
// PATHS
// =============================================================================

/** Session ID validation regex - alphanumeric, dashes, underscores only (SEC-002) */
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Validate session ID to prevent path traversal attacks.
 * Defense-in-depth: trusted sources, but we validate at boundary anyway.
 */
function isValidSessionId(sessionId: string): boolean {
  return SESSION_ID_PATTERN.test(sessionId);
}

/**
 * Get session storage directory
 */
function getSessionDir(sessionId?: string): string {
  const sid = sessionId || getSessionId();
  // Validate session ID to prevent path traversal (SEC-002)
  if (!isValidSessionId(sid)) {
    throw new Error(`Invalid session ID format`);
  }
  return `${getProjectDir()}/.claude/memory/sessions/${sid}`;
}

/**
 * Get events file path for a session
 */
function getEventsPath(sessionId?: string): string {
  return `${getSessionDir(sessionId)}/events.jsonl`;
}

/**
 * Ensure session directory exists
 */
function ensureSessionDir(sessionId?: string): void {
  const dir = getSessionDir(sessionId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// =============================================================================
// EVENT GENERATION
// =============================================================================

let eventCounter = 0;

/**
 * Generate unique event ID
 */
function generateEventId(): string {
  eventCounter++;
  return `evt-${Date.now()}-${eventCounter}`;
}

// =============================================================================
// EVENT TRACKING
// =============================================================================

/**
 * Track a session event
 *
 * @param eventType - Type of event
 * @param name - Name of skill/agent/hook/tool
 * @param options - Additional event options
 */
export function trackEvent(
  eventType: SessionEventType,
  name: string,
  options: {
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    duration_ms?: number;
    success?: boolean;
    context?: string;
    confidence?: number;
  } = {}
): void {
  try {
    const event: SessionEvent = {
      event_id: generateEventId(),
      event_type: eventType,
      identity: getIdentityContext(),
      payload: {
        name,
        input: sanitizeForStorage(options.input),
        output: sanitizeForStorage(options.output),
        duration_ms: options.duration_ms,
        success: options.success ?? true,
        context: options.context ? truncate(options.context, 500) : undefined,
        confidence: options.confidence,
      },
    };

    ensureSessionDir();
    const eventsPath = getEventsPath();
    appendFileSync(eventsPath, JSON.stringify(event) + '\n');

    logHook('session-tracker', `Tracked ${eventType}: ${name}`, 'debug');
  } catch (error) {
    logHook('session-tracker', `Failed to track event: ${error}`, 'warn');
  }
}

/**
 * Track skill invocation
 */
export function trackSkillInvoked(
  skillName: string,
  args?: string,
  success: boolean = true,
  durationMs?: number
): void {
  trackEvent('skill_invoked', skillName, {
    input: args ? { args } : undefined,
    success,
    duration_ms: durationMs,
  });
}

/**
 * Track agent spawn
 */
export function trackAgentSpawned(
  agentType: string,
  prompt?: string,
  success: boolean = true
): void {
  trackEvent('agent_spawned', agentType, {
    input: prompt ? { prompt: truncate(prompt, 200) } : undefined,
    success,
  });
}

/**
 * Track hook triggered
 */
export function trackHookTriggered(
  hookName: string,
  success: boolean = true,
  durationMs?: number
): void {
  trackEvent('hook_triggered', hookName, {
    success,
    duration_ms: durationMs,
  });
}

/**
 * Track decision made
 */
export function trackDecisionMade(
  decision: string,
  rationale?: string,
  confidence?: number
): void {
  trackEvent('decision_made', 'decision', {
    context: decision,
    input: rationale ? { rationale } : undefined,
    confidence,
    success: true,
  });
}

/**
 * Track preference stated
 */
export function trackPreferenceStated(
  preference: string,
  confidence?: number
): void {
  trackEvent('preference_stated', 'preference', {
    context: preference,
    confidence,
    success: true,
  });
}

/**
 * Track problem reported
 */
export function trackProblemReported(problem: string): void {
  trackEvent('problem_reported', 'problem', {
    context: problem,
    success: true,
  });
}

/**
 * Track solution found
 */
export function trackSolutionFound(
  solution: string,
  problemId?: string,
  confidence?: number
): void {
  trackEvent('solution_found', 'solution', {
    context: solution,
    input: problemId ? { problem_id: problemId } : undefined,
    confidence,
    success: true,
  });
}

/**
 * Track tool usage
 *
 * @param toolName - Name of the tool (e.g., 'Grep', 'Read')
 * @param success - Whether the tool call succeeded
 * @param durationMs - Duration of the tool call in milliseconds
 * @param category - Tool category (e.g., 'search', 'file_read') for preference tracking
 */
export function trackToolUsed(
  toolName: string,
  success: boolean = true,
  durationMs?: number,
  category?: string
): void {
  trackEvent('tool_used', toolName, {
    success,
    duration_ms: durationMs,
    input: category ? { category } : undefined,
  });
}

/**
 * Session context captured at session start
 * Issue #245 Phase 5: Session Lifecycle Tracking
 */
export interface SessionContext {
  /** Project directory path */
  project_dir?: string;
  /** Current git branch */
  git_branch?: string;
  /** Time of day category */
  time_of_day?: 'morning' | 'afternoon' | 'evening' | 'night';
  /** Timestamp */
  started_at: string;
}

/**
 * Get time of day category from hour
 */
function getTimeOfDay(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Track session start with context
 * Issue #245 Phase 5: Session Lifecycle Tracking
 *
 * @param context - Optional session context (project, branch, time)
 */
export function trackSessionStart(context?: Partial<SessionContext>): void {
  const now = new Date();
  const sessionContext: SessionContext = {
    project_dir: context?.project_dir,
    git_branch: context?.git_branch,
    time_of_day: context?.time_of_day || getTimeOfDay(now.getHours()),
    started_at: now.toISOString(),
  };

  trackEvent('session_start', 'session', {
    success: true,
    input: sessionContext as unknown as Record<string, unknown>,
  });
}

/**
 * Track session end with timestamp
 * Issue #245 Phase 5: Session Lifecycle Tracking
 */
export function trackSessionEnd(): void {
  trackEvent('session_end', 'session', {
    success: true,
    input: { ended_at: new Date().toISOString() },
  });
}

/**
 * Track user communication style
 */
export function trackCommunicationStyle(
  style: {
    verbosity: 'terse' | 'moderate' | 'detailed';
    interaction_type: 'question' | 'command' | 'discussion';
    technical_level: 'beginner' | 'intermediate' | 'expert';
  }
): void {
  trackEvent('communication_style_detected', 'communication', {
    input: style as unknown as Record<string, unknown>,
    success: true,
  });
}


// =============================================================================
// SESSION SUMMARY
// =============================================================================

/**
 * Load all events for a session
 */
export function loadSessionEvents(sessionId?: string): SessionEvent[] {
  const eventsPath = getEventsPath(sessionId);

  if (!existsSync(eventsPath)) {
    return [];
  }

  try {
    const content = readFileSync(eventsPath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.map(line => JSON.parse(line));
  } catch (error) {
    logHook('session-tracker', `Failed to load session events: ${error}`, 'warn');
    return [];
  }
}

/**
 * Generate session summary from events
 */
export function generateSessionSummary(sessionId?: string): SessionSummary {
  const events = loadSessionEvents(sessionId);
  const identity = getIdentityContext();

  const eventCounts: Record<SessionEventType, number> = {
    skill_invoked: 0,
    agent_spawned: 0,
    hook_triggered: 0,
    decision_made: 0,
    preference_stated: 0,
    problem_reported: 0,
    solution_found: 0,
    tool_used: 0,
    session_start: 0,
    session_end: 0,
    communication_style_detected: 0,
  };

  const skillsUsed = new Set<string>();
  const agentsSpawned = new Set<string>();
  const hooksTriggered = new Set<string>();

  let startTime: string | undefined;
  let endTime: string | undefined;

  for (const event of events) {
    eventCounts[event.event_type]++;

    switch (event.event_type) {
      case 'skill_invoked':
        skillsUsed.add(event.payload.name);
        break;
      case 'agent_spawned':
        agentsSpawned.add(event.payload.name);
        break;
      case 'hook_triggered':
        hooksTriggered.add(event.payload.name);
        break;
      case 'session_start':
        startTime = event.identity.timestamp;
        break;
      case 'session_end':
        endTime = event.identity.timestamp;
        break;
    }
  }

  const durationMs =
    startTime && endTime
      ? new Date(endTime).getTime() - new Date(startTime).getTime()
      : undefined;

  return {
    session_id: sessionId || identity.session_id,
    user_id: identity.user_id,
    anonymous_id: identity.anonymous_id,
    team_id: identity.team_id,
    start_time: startTime,
    end_time: endTime,
    duration_ms: durationMs,
    event_counts: eventCounts,
    skills_used: [...skillsUsed],
    agents_spawned: [...agentsSpawned],
    hooks_triggered: [...hooksTriggered],
    decisions_made: eventCounts.decision_made,
    problems_reported: eventCounts.problem_reported,
    solutions_found: eventCounts.solution_found,
  };
}

// =============================================================================
// CROSS-SESSION QUERIES
// =============================================================================
// GAP-008/009 FIX: Removed listSessionIds() and getRecentUserSessions()
// These functions were exported but never called by production code.
// Cross-session queries should be handled by profile-injector if needed.
// =============================================================================

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Sanitize object for storage (remove sensitive data, truncate)
 */
function sanitizeForStorage(
  obj: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!obj) return undefined;

  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = ['password', 'secret', 'token', 'key', 'credential', 'auth'];

  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive keys
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Truncate long strings
    if (typeof value === 'string' && value.length > 500) {
      sanitized[key] = truncate(value, 500);
      continue;
    }

    // Recursively sanitize objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeForStorage(value as Record<string, unknown>);
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

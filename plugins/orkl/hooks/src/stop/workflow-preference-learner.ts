/**
 * Workflow Preference Learner Hook - Learn user's development workflow patterns
 *
 * Part of Intelligent Decision Capture System
 * Hook: Stop
 *
 * Purpose:
 * - Analyze the session's decision flow on completion
 * - Detect workflow patterns (TDD, explore-first, iterate-fast)
 * - Track patterns across sessions for learning
 * - Store workflow preferences
 *
 * Patterns Detected:
 * - test-first: TDD workflow (tests before implementation)
 * - explore-first: Read files before writing
 * - iterate-fast: Quick write → test cycles
 * - big-bang: Multiple writes then test
 * - agent-delegate: Heavy use of subagents
 *
 * CC 2.1.16 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import {
  outputSilentSuccess,
  getProjectDir,
  getSessionId,
  logHook,
} from '../lib/common.js';
import {
  analyzeDecisionFlow,
  completeDecisionFlow,
  type WorkflowPattern,
  type DecisionFlow,
} from '../lib/decision-flow-tracker.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

// =============================================================================
// CONSTANTS
// =============================================================================

const HOOK_NAME = 'workflow-preference-learner';
const MIN_ACTIONS_FOR_PATTERN = 5; // Need at least 5 actions to detect pattern

// =============================================================================
// TYPES
// =============================================================================

/**
 * Workflow preference with statistics
 */
export interface WorkflowPreference {
  /** The workflow pattern */
  pattern: WorkflowPattern;
  /** How often this pattern is used (0-1) */
  frequency: number;
  /** Number of sessions with this pattern */
  count: number;
  /** Total sessions analyzed */
  total_sessions: number;
  /** Average success rate for this pattern */
  avg_success_rate: number;
  /** Last updated timestamp */
  updated_at: string;
}

/**
 * All workflow preferences data
 */
interface WorkflowPreferencesData {
  /** Count of each pattern */
  pattern_counts: Record<WorkflowPattern, number>;
  /** Success rates for each pattern */
  pattern_success_rates: Record<WorkflowPattern, number[]>;
  /** Total sessions analyzed */
  total_sessions: number;
  /** Derived preferences */
  preferences: WorkflowPreference[];
  /** Last update timestamp */
  updated_at: string;
}

// =============================================================================
// FILE OPERATIONS
// =============================================================================

/**
 * Get path to workflow preferences file
 */
function getWorkflowPreferencesPath(): string {
  return join(getProjectDir(), '.claude', 'memory', 'workflow-preferences.json');
}

/**
 * Load workflow preferences data
 */
function loadWorkflowPreferences(): WorkflowPreferencesData {
  const filePath = getWorkflowPreferencesPath();

  if (!existsSync(filePath)) {
    return createEmptyWorkflowPreferences();
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as WorkflowPreferencesData;
  } catch {
    return createEmptyWorkflowPreferences();
  }
}

/**
 * Save workflow preferences data
 */
function saveWorkflowPreferences(data: WorkflowPreferencesData): boolean {
  const filePath = getWorkflowPreferencesPath();

  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    logHook(HOOK_NAME, `Failed to save workflow preferences: ${err}`, 'warn');
    return false;
  }
}

/**
 * Create empty workflow preferences structure
 */
function createEmptyWorkflowPreferences(): WorkflowPreferencesData {
  const patterns: WorkflowPattern[] = [
    'test-first', 'explore-first', 'iterate-fast', 'big-bang', 'agent-delegate', 'mixed',
  ];

  const pattern_counts: Record<WorkflowPattern, number> = {} as Record<WorkflowPattern, number>;
  const pattern_success_rates: Record<WorkflowPattern, number[]> = {} as Record<WorkflowPattern, number[]>;

  for (const pattern of patterns) {
    pattern_counts[pattern] = 0;
    pattern_success_rates[pattern] = [];
  }

  return {
    pattern_counts,
    pattern_success_rates,
    total_sessions: 0,
    preferences: [],
    updated_at: new Date().toISOString(),
  };
}

// =============================================================================
// PREFERENCE CALCULATION
// =============================================================================

/**
 * Calculate preferences from pattern data
 */
function calculateWorkflowPreferences(data: WorkflowPreferencesData): WorkflowPreference[] {
  const preferences: WorkflowPreference[] = [];
  const timestamp = new Date().toISOString();

  for (const [pattern, count] of Object.entries(data.pattern_counts)) {
    if (count === 0) continue;

    const successRates = data.pattern_success_rates[pattern as WorkflowPattern] || [];
    const avgSuccessRate = successRates.length > 0
      ? successRates.reduce((a, b) => a + b, 0) / successRates.length
      : 0;

    preferences.push({
      pattern: pattern as WorkflowPattern,
      frequency: data.total_sessions > 0 ? count / data.total_sessions : 0,
      count,
      total_sessions: data.total_sessions,
      avg_success_rate: avgSuccessRate,
      updated_at: timestamp,
    });
  }

  // Sort by frequency descending
  preferences.sort((a, b) => b.frequency - a.frequency);

  return preferences;
}

/**
 * Update workflow preferences with a new session's pattern
 */
function updateWorkflowPreferences(
  data: WorkflowPreferencesData,
  flow: DecisionFlow
): void {
  if (!flow.inferred_pattern) return;

  const pattern = flow.inferred_pattern;
  const successRate = flow.stats.success_rate;

  // Update counts
  data.pattern_counts[pattern] = (data.pattern_counts[pattern] || 0) + 1;
  data.total_sessions++;

  // Update success rates (keep last 20 per pattern)
  if (!data.pattern_success_rates[pattern]) {
    data.pattern_success_rates[pattern] = [];
  }
  data.pattern_success_rates[pattern].push(successRate);
  if (data.pattern_success_rates[pattern].length > 20) {
    data.pattern_success_rates[pattern] = data.pattern_success_rates[pattern].slice(-20);
  }

  // Recalculate preferences
  data.preferences = calculateWorkflowPreferences(data);
  data.updated_at = new Date().toISOString();
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Learn workflow preferences from completed session
 */
export function workflowPreferenceLearner(input: HookInput): HookResult {
  const sessionId = input.session_id || getSessionId();

  // Analyze the decision flow
  const flow = analyzeDecisionFlow(sessionId);

  if (!flow) {
    logHook(HOOK_NAME, `No decision flow found for session ${sessionId}`, 'debug');
    return outputSilentSuccess();
  }

  // Need minimum actions to detect meaningful pattern
  if (flow.actions.length < MIN_ACTIONS_FOR_PATTERN) {
    logHook(HOOK_NAME, `Too few actions (${flow.actions.length}) for pattern detection`, 'debug');
    return outputSilentSuccess();
  }

  // Complete and archive the flow
  completeDecisionFlow(sessionId);

  // Skip 'mixed' patterns as they don't provide learning value
  if (flow.inferred_pattern === 'mixed') {
    return outputSilentSuccess();
  }

  // Load and update preferences
  const data = loadWorkflowPreferences();
  updateWorkflowPreferences(data, flow);
  saveWorkflowPreferences(data);

  // Log the detected pattern
  logHook(
    HOOK_NAME,
    `Session pattern: ${flow.inferred_pattern} (${flow.actions.length} actions, ${(flow.stats.success_rate * 100).toFixed(0)}% success)`,
    'info'
  );

  // Check for strong preference emergence
  const topPref = data.preferences[0];
  if (topPref && topPref.frequency > 0.6 && topPref.count >= 5) {
    logHook(
      HOOK_NAME,
      `Strong workflow preference: ${topPref.pattern} (${(topPref.frequency * 100).toFixed(0)}% of sessions)`,
      'info'
    );
  }

  return outputSilentSuccess();
}

// =============================================================================
// EXPORTS FOR OTHER HOOKS
// =============================================================================

/**
 * Get the user's primary workflow preference
 */
export function getPrimaryWorkflowPreference(): WorkflowPreference | null {
  const data = loadWorkflowPreferences();
  return data.preferences[0] || null;
}

/**
 * Get all workflow preferences
 */
export function getAllWorkflowPreferences(): WorkflowPreference[] {
  const data = loadWorkflowPreferences();
  return data.preferences;
}

/**
 * Get workflow pattern summary for context injection
 */
export function getWorkflowSummary(): string | null {
  const data = loadWorkflowPreferences();

  if (data.total_sessions < 3) {
    return null; // Not enough data
  }

  const primary = data.preferences[0];
  if (!primary || primary.frequency < 0.4) {
    return null; // No clear preference
  }

  const patternDescriptions: Record<WorkflowPattern, string> = {
    'test-first': 'writes tests before implementation (TDD)',
    'explore-first': 'reads existing code before making changes',
    'iterate-fast': 'makes quick write → test iterations',
    'big-bang': 'writes multiple files then tests',
    'agent-delegate': 'delegates tasks to specialized agents',
    'mixed': 'varies approach by task',
  };

  return `User typically ${patternDescriptions[primary.pattern]} (${(primary.frequency * 100).toFixed(0)}% of sessions, ${(primary.avg_success_rate * 100).toFixed(0)}% success rate)`;
}

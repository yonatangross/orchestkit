/**
 * Decision Flow Tracker - Cross-tool correlation for understanding decision patterns
 *
 * Part of Intelligent Decision Capture System
 *
 * Purpose:
 * - Track sequence of tool actions within a session
 * - Infer workflow patterns (TDD, explore-first, iterate-fast)
 * - Detect when a decision flow completes
 * - Enable understanding of how decisions are made across multiple tools
 *
 * CC 2.1.16 Compliant
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { getProjectDir, logHook } from './common.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A single tool action in the decision flow
 */
export interface ToolAction {
  /** Tool name (Bash, Read, Write, etc.) */
  tool: string;
  /** File involved if applicable */
  file?: string;
  /** When the action occurred */
  timestamp: string;
  /** Brief summary of what was done */
  summary: string;
  /** Result of the action */
  result: 'success' | 'failure' | 'partial';
  /** Exit code for Bash */
  exit_code?: number;
  /** Action category */
  category: ActionCategory;
}

/**
 * Categories for tool actions
 */
export type ActionCategory =
  | 'exploration'  // Read, Glob, Grep
  | 'modification' // Write, Edit
  | 'execution'    // Bash
  | 'testing'      // Bash with test commands
  | 'building'     // Bash with build commands
  | 'git'          // Git operations
  | 'agent'        // Task (subagent spawn)
  | 'other';

/**
 * Detected workflow pattern
 */
export type WorkflowPattern =
  | 'test-first'      // Tests before implementation (TDD)
  | 'explore-first'   // Read multiple files before writing
  | 'iterate-fast'    // Write → Execute → Write cycles
  | 'big-bang'        // Multiple writes then one test
  | 'agent-delegate'  // Heavy use of Task tool
  | 'mixed';          // No clear pattern

/**
 * Complete decision flow for a session
 */
export interface DecisionFlow {
  /** Session ID */
  session_id: string;
  /** Sequence of actions */
  actions: ToolAction[];
  /** Detected workflow pattern */
  inferred_pattern?: WorkflowPattern;
  /** When the flow started */
  started_at: string;
  /** Last action timestamp */
  last_action_at: string;
  /** Summary statistics */
  stats: FlowStats;
}

/**
 * Statistics about the decision flow
 */
export interface FlowStats {
  total_actions: number;
  reads: number;
  writes: number;
  tests: number;
  builds: number;
  agent_spawns: number;
  success_rate: number;
}

// =============================================================================
// PATTERN DETECTION
// =============================================================================

/**
 * Patterns for categorizing actions
 */
const TEST_COMMAND_PATTERNS = [
  /\b(pytest|jest|vitest|npm\s+test|yarn\s+test|bun\s+test|go\s+test)\b/i,
  /\b(test|tests|spec)\b.*\b(run|execute)\b/i,
];

const BUILD_COMMAND_PATTERNS = [
  /\b(npm\s+run\s+build|yarn\s+build|make|cargo\s+build|docker\s+build|tsc)\b/i,
  /\b(build|compile)\b/i,
];

const GIT_COMMAND_PATTERNS = [
  /\bgit\s+(commit|push|pull|merge|rebase|checkout|branch|status|diff|log)\b/i,
  /\bgh\s+(pr|issue)\b/i,
];

// =============================================================================
// FILE OPERATIONS
// =============================================================================

/**
 * Get path to session flow file
 */
function getFlowFilePath(sessionId: string): string {
  return join(getProjectDir(), '.claude', 'memory', 'flows', `${sessionId}.json`);
}

/**
 * Get path to completed flows archive
 */
function getCompletedFlowsPath(): string {
  return join(getProjectDir(), '.claude', 'memory', 'completed-flows.jsonl');
}

/**
 * Load decision flow for a session
 */
export function loadDecisionFlow(sessionId: string): DecisionFlow | null {
  const filePath = getFlowFilePath(sessionId);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as DecisionFlow;
  } catch (err) {
    logHook('decision-flow-tracker', `Failed to load flow for ${sessionId}: ${err}`, 'warn');
    return null;
  }
}

/**
 * Save decision flow for a session
 */
function saveDecisionFlow(flow: DecisionFlow): boolean {
  const filePath = getFlowFilePath(flow.session_id);

  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filePath, JSON.stringify(flow, null, 2));
    return true;
  } catch (err) {
    logHook('decision-flow-tracker', `Failed to save flow: ${err}`, 'warn');
    return false;
  }
}

/**
 * Archive a completed flow
 */
function archiveFlow(flow: DecisionFlow): boolean {
  const archivePath = getCompletedFlowsPath();

  try {
    const dir = dirname(archivePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const line = JSON.stringify(flow) + '\n';
    appendFileSync(archivePath, line);
    return true;
  } catch (err) {
    logHook('decision-flow-tracker', `Failed to archive flow: ${err}`, 'warn');
    return false;
  }
}

// =============================================================================
// ACTION CATEGORIZATION
// =============================================================================

/**
 * Categorize a tool action
 */
export function categorizeAction(
  tool: string,
  command?: string,
  _file?: string
): ActionCategory {
  // Check for specific tool types
  if (tool === 'Read' || tool === 'Glob' || tool === 'Grep') {
    return 'exploration';
  }

  if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit' || tool === 'NotebookEdit') {
    return 'modification';
  }

  if (tool === 'Task') {
    return 'agent';
  }

  // For Bash, check command patterns
  if (tool === 'Bash' && command) {
    if (TEST_COMMAND_PATTERNS.some(p => p.test(command))) {
      return 'testing';
    }
    if (BUILD_COMMAND_PATTERNS.some(p => p.test(command))) {
      return 'building';
    }
    if (GIT_COMMAND_PATTERNS.some(p => p.test(command))) {
      return 'git';
    }
    return 'execution';
  }

  return 'other';
}

/**
 * Summarize a tool action
 */
export function summarizeAction(
  tool: string,
  command?: string,
  file?: string,
  result?: 'success' | 'failure' | 'partial'
): string {
  const resultStr = result === 'success' ? '✓' : result === 'failure' ? '✗' : '~';

  if (tool === 'Read') {
    return `${resultStr} Read ${file?.split('/').pop() || 'file'}`;
  }
  if (tool === 'Write') {
    return `${resultStr} Write ${file?.split('/').pop() || 'file'}`;
  }
  if (tool === 'Edit') {
    return `${resultStr} Edit ${file?.split('/').pop() || 'file'}`;
  }
  if (tool === 'Glob') {
    return `${resultStr} Search files`;
  }
  if (tool === 'Grep') {
    return `${resultStr} Search content`;
  }
  if (tool === 'Task') {
    return `${resultStr} Spawn agent`;
  }

  if (tool === 'Bash' && command) {
    // Extract meaningful part of command
    const cmd = command.split('\n')[0].slice(0, 50);
    return `${resultStr} ${cmd}${command.length > 50 ? '...' : ''}`;
  }

  return `${resultStr} ${tool}`;
}

// =============================================================================
// PATTERN INFERENCE
// =============================================================================

/**
 * Infer workflow pattern from action sequence
 */
export function inferWorkflowPattern(actions: ToolAction[]): WorkflowPattern {
  if (actions.length < 3) {
    return 'mixed';
  }

  // Count categories
  const counts = {
    exploration: 0,
    modification: 0,
    testing: 0,
    building: 0,
    agent: 0,
    execution: 0,
    git: 0,
    other: 0,
  };

  for (const action of actions) {
    counts[action.category]++;
  }

  // Check for test-first pattern
  // Pattern: test → write → test
  if (counts.testing >= 2) {
    const testIndices = actions
      .map((a, i) => (a.category === 'testing' ? i : -1))
      .filter(i => i >= 0);
    const writeIndices = actions
      .map((a, i) => (a.category === 'modification' ? i : -1))
      .filter(i => i >= 0);

    if (testIndices.length >= 2 && writeIndices.length > 0) {
      // Check if first test comes before first write
      if (testIndices[0] < writeIndices[0]) {
        return 'test-first';
      }
    }
  }

  // Check for explore-first pattern
  // Pattern: read → read → read → write
  if (counts.exploration >= 3 && counts.modification > 0) {
    const exploreRun = findConsecutiveRun(actions, 'exploration');
    if (exploreRun >= 3) {
      return 'explore-first';
    }
  }

  // Check for iterate-fast pattern
  // Pattern: write → execute → write → execute
  if (counts.modification >= 2 && (counts.execution + counts.testing) >= 2) {
    const alternating = countAlternations(actions, 'modification', ['execution', 'testing']);
    if (alternating >= 2) {
      return 'iterate-fast';
    }
  }

  // Check for agent-delegate pattern
  if (counts.agent >= 3 || counts.agent / actions.length > 0.3) {
    return 'agent-delegate';
  }

  // Check for big-bang pattern
  // Pattern: write → write → write → test
  if (counts.modification >= 3 && counts.testing === 1) {
    const lastTest = actions.map((a, i) => (a.category === 'testing' ? i : -1)).filter(i => i >= 0).pop();
    if (lastTest && lastTest > actions.length - 3) {
      return 'big-bang';
    }
  }

  return 'mixed';
}

/**
 * Find longest consecutive run of a category
 */
function findConsecutiveRun(actions: ToolAction[], category: ActionCategory): number {
  let maxRun = 0;
  let currentRun = 0;

  for (const action of actions) {
    if (action.category === category) {
      currentRun++;
      maxRun = Math.max(maxRun, currentRun);
    } else {
      currentRun = 0;
    }
  }

  return maxRun;
}

/**
 * Count alternations between category A and categories B
 */
function countAlternations(
  actions: ToolAction[],
  categoryA: ActionCategory,
  categoriesB: ActionCategory[]
): number {
  let alternations = 0;
  let lastWasA = false;

  for (const action of actions) {
    const isA = action.category === categoryA;
    const isB = categoriesB.includes(action.category);

    if (isA && !lastWasA) {
      lastWasA = true;
    } else if (isB && lastWasA) {
      alternations++;
      lastWasA = false;
    }
  }

  return alternations;
}

// =============================================================================
// FLOW MANAGEMENT
// =============================================================================

/**
 * Calculate flow statistics
 */
function calculateStats(actions: ToolAction[]): FlowStats {
  const successes = actions.filter(a => a.result === 'success').length;

  return {
    total_actions: actions.length,
    reads: actions.filter(a => a.category === 'exploration').length,
    writes: actions.filter(a => a.category === 'modification').length,
    tests: actions.filter(a => a.category === 'testing').length,
    builds: actions.filter(a => a.category === 'building').length,
    agent_spawns: actions.filter(a => a.category === 'agent').length,
    success_rate: actions.length > 0 ? successes / actions.length : 0,
  };
}

/**
 * Track a tool action in the decision flow
 */
export function trackToolAction(
  sessionId: string,
  tool: string,
  command: string | undefined,
  file: string | undefined,
  exitCode: number | undefined
): DecisionFlow {
  const timestamp = new Date().toISOString();

  // Determine result from exit code
  let result: 'success' | 'failure' | 'partial' = 'success';
  if (exitCode !== undefined) {
    result = exitCode === 0 ? 'success' : 'failure';
  }

  // Categorize and summarize the action
  const category = categorizeAction(tool, command, file);
  const summary = summarizeAction(tool, command, file, result);

  const action: ToolAction = {
    tool,
    file,
    timestamp,
    summary,
    result,
    exit_code: exitCode,
    category,
  };

  // Load or create flow
  let flow = loadDecisionFlow(sessionId);

  if (!flow) {
    flow = {
      session_id: sessionId,
      actions: [],
      started_at: timestamp,
      last_action_at: timestamp,
      stats: calculateStats([]),
    };
  }

  // Add action (limit to last 100 actions to prevent unbounded growth)
  flow.actions.push(action);
  if (flow.actions.length > 100) {
    flow.actions = flow.actions.slice(-100);
  }

  // Update metadata
  flow.last_action_at = timestamp;
  flow.inferred_pattern = inferWorkflowPattern(flow.actions);
  flow.stats = calculateStats(flow.actions);

  // Save
  saveDecisionFlow(flow);

  return flow;
}

/**
 * Analyze the decision flow for a session
 */
export function analyzeDecisionFlow(sessionId: string): DecisionFlow | null {
  const flow = loadDecisionFlow(sessionId);

  if (!flow) {
    return null;
  }

  // Ensure pattern is up to date
  flow.inferred_pattern = inferWorkflowPattern(flow.actions);
  flow.stats = calculateStats(flow.actions);

  return flow;
}

/**
 * Complete and archive a decision flow (called on session end)
 */
export function completeDecisionFlow(sessionId: string): boolean {
  const flow = loadDecisionFlow(sessionId);

  if (!flow) {
    return false;
  }

  // Update final analysis
  flow.inferred_pattern = inferWorkflowPattern(flow.actions);
  flow.stats = calculateStats(flow.actions);

  // Archive
  const archived = archiveFlow(flow);

  if (archived) {
    logHook(
      'decision-flow-tracker',
      `Completed flow for ${sessionId}: ${flow.actions.length} actions, pattern: ${flow.inferred_pattern}`,
      'info'
    );
  }

  return archived;
}

// =============================================================================
// GAP-010 FIX: Removed getRecentFlows()
// Function was exported but never called by production code.
// Cross-session flow analysis should be added to workflow-preference-learner if needed.
// =============================================================================

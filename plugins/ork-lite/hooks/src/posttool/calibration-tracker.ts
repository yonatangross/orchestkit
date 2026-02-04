/**
 * Calibration Tracker - PostToolUse Hook for Tracking Task Completions
 * Issue #197: Agent Orchestration Layer
 *
 * Tracks agent task completions for calibration:
 * - Captures dispatch-outcome pairs
 * - Records to calibration engine
 * - Triggers on TaskUpdate tool calls
 *
 * CC 2.1.9 Compliant: Silent hook that tracks in background
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';
import { recordOutcome } from '../lib/calibration-engine.js';
import { getTaskById } from '../lib/task-integration.js';
import { getLastClassification, loadConfig } from '../lib/orchestration-state.js';
import type { AgentOutcome } from '../lib/orchestration-types.js';

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Extract task ID from TaskUpdate tool input
 */
function extractTaskId(input: HookInput): string | null {
  const toolInput = input.tool_input || {};

  // TaskUpdate has taskId parameter
  if (typeof toolInput.taskId === 'string') {
    return toolInput.taskId;
  }

  return null;
}

/**
 * Check if this is a task status update
 */
function isTaskStatusUpdate(input: HookInput): boolean {
  if (input.tool_name !== 'TaskUpdate') {
    return false;
  }

  const toolInput = input.tool_input || {};
  return typeof toolInput.status === 'string';
}

/**
 * Map task status to agent outcome
 */
function statusToOutcome(status: string): AgentOutcome | null {
  switch (status) {
    case 'completed':
      return 'success';
    case 'pending':
      // Pending after in_progress might indicate failure
      return null;
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

/**
 * Calibration tracker hook
 *
 * Monitors TaskUpdate tool calls to track agent outcomes:
 * 1. Checks if this is a task status update to 'completed'
 * 2. Looks up the task to find associated agent
 * 3. Records outcome to calibration engine
 */
export function calibrationTracker(input: HookInput): HookResult {
  // Only track TaskUpdate calls
  if (!isTaskStatusUpdate(input)) {
    return outputSilentSuccess();
  }

  // Check if calibration is enabled
  const config = loadConfig();
  if (!config.enableCalibration) {
    return outputSilentSuccess();
  }

  const toolInput = input.tool_input || {};
  const taskId = extractTaskId(input);
  const status = toolInput.status as string;

  if (!taskId) {
    return outputSilentSuccess();
  }

  // Only track completions
  const outcome = statusToOutcome(status);
  if (!outcome) {
    return outputSilentSuccess();
  }

  logHook('calibration-tracker', `Tracking task ${taskId} status update to ${status}`);

  // Look up task
  const task = getTaskById(taskId);
  if (!task) {
    logHook('calibration-tracker', `Task ${taskId} not found in registry`);
    return outputSilentSuccess();
  }

  // Get agent from task
  const agent = task.agent;
  if (!agent) {
    logHook('calibration-tracker', `No agent associated with task ${taskId}`);
    return outputSilentSuccess();
  }

  // Get last classification for keywords
  const lastClassification = getLastClassification();
  const agentMatch = lastClassification?.agents.find(a => a.agent === agent);

  const matchedKeywords = agentMatch?.matchedKeywords || [];
  const confidence = task.confidence || agentMatch?.confidence || 0;

  // Calculate duration if possible
  const durationMs = task.createdAt
    ? Date.now() - new Date(task.createdAt).getTime()
    : undefined;

  // Record to calibration engine
  recordOutcome(
    '', // Prompt not available in PostTool context
    agent,
    matchedKeywords,
    confidence,
    outcome,
    durationMs
  );

  logHook(
    'calibration-tracker',
    `Recorded calibration: ${agent} -> ${outcome} (conf: ${confidence})`
  );

  return outputSilentSuccess();
}

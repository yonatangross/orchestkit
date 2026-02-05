/**
 * Retry Handler - SubagentStop Hook for Failed Agent Retry Logic
 * Issue #197: Agent Orchestration Layer
 *
 * Handles agent failures by:
 * 1. Evaluating if retry is appropriate
 * 2. Suggesting alternative agents when needed
 * 3. Tracking retry history
 *
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputWithContext, logHook } from '../lib/common.js';
import {
  makeRetryDecision,
  formatRetryDecision,
  createAttempt,
  completeAttempt,
} from '../lib/retry-manager.js';
import { loadConfig, loadState, updateAgentStatus } from '../lib/orchestration-state.js';
import { updateTaskStatus, getTaskByAgent } from '../lib/task-integration.js';
import type { AgentOutcome, ExecutionAttempt } from '../lib/orchestration-types.js';

// -----------------------------------------------------------------------------
// Execution History Storage
// -----------------------------------------------------------------------------

/** In-memory execution history (per session) */
const executionHistory: Map<string, ExecutionAttempt[]> = new Map();

/**
 * Add attempt to history
 */
function addToHistory(agent: string, attempt: ExecutionAttempt): void {
  const history = executionHistory.get(agent) || [];
  history.push(attempt);
  // Keep only last 10 attempts per agent
  if (history.length > 10) {
    history.shift();
  }
  executionHistory.set(agent, history);
}

/**
 * Get tried agents (those with failed attempts)
 */
function getTriedAgents(): string[] {
  const tried: string[] = [];
  for (const [agent, attempts] of executionHistory) {
    if (attempts.some(a => a.outcome === 'failure')) {
      tried.push(agent);
    }
  }
  return tried;
}

// -----------------------------------------------------------------------------
// Outcome Detection
// -----------------------------------------------------------------------------

/**
 * Detect outcome from hook input
 */
function detectOutcome(input: HookInput): { outcome: AgentOutcome; error?: string } {
  const error = input.error || input.tool_error;
  const exitCode = input.exit_code;
  const output = input.agent_output || input.output || '';

  // Explicit error
  if (error && error !== 'null' && error !== '') {
    return { outcome: 'failure', error };
  }

  // Non-zero exit code
  if (exitCode !== undefined && exitCode !== 0) {
    return { outcome: 'failure', error: `Exit code: ${exitCode}` };
  }

  // Check output for rejection patterns
  const rejectionPatterns = [
    /i cannot|i can't|i am unable/i,
    /outside my scope/i,
    /not appropriate/i,
    /i refuse/i,
  ];

  for (const pattern of rejectionPatterns) {
    if (pattern.test(output.slice(0, 500))) {
      return { outcome: 'rejected', error: 'Agent rejected the task' };
    }
  }

  // Check for partial success patterns
  const partialPatterns = [
    /partial(?:ly)?/i,
    /incomplete/i,
    /some.*failed/i,
    /couldn't finish/i,
  ];

  for (const pattern of partialPatterns) {
    if (pattern.test(output.slice(0, 500))) {
      return { outcome: 'partial' };
    }
  }

  return { outcome: 'success' };
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

/**
 * Retry handler hook - handles agent failures and retry decisions
 *
 * When an agent fails, this hook:
 * 1. Records the attempt in history
 * 2. Evaluates whether to retry
 * 3. Suggests alternatives if retry not recommended
 */
export function retryHandler(input: HookInput): HookResult {
  // Get agent type
  const toolInput = input.tool_input || {};
  const agentType =
    (toolInput.subagent_type as string) ||
    input.subagent_type ||
    input.agent_type ||
    '';

  if (!agentType) {
    return outputSilentSuccess();
  }

  // Detect outcome
  const { outcome, error } = detectOutcome(input);

  // Skip retry logic for successful completions
  if (outcome === 'success') {
    return outputSilentSuccess();
  }

  logHook('retry-handler', `Agent ${agentType} completed with outcome: ${outcome}`);

  // Load config and state
  const config = loadConfig();
  const state = loadState();

  // Find dispatched agent in state
  const dispatchedAgent = state.activeAgents.find(a => a.agent === agentType);
  const currentRetryCount = dispatchedAgent?.retryCount || 0;

  // Record attempt
  const attempt = createAttempt(agentType, currentRetryCount + 1, dispatchedAgent?.taskId);
  const completedAttempt = completeAttempt(
    attempt,
    outcome,
    error || undefined
  );
  addToHistory(agentType, completedAttempt);

  // Get tried agents for alternative suggestions
  const triedAgents = getTriedAgents();

  // Make retry decision
  const decision = makeRetryDecision(
    agentType,
    currentRetryCount + 1,
    error || 'Unknown failure',
    triedAgents,
    config.maxRetries
  );

  logHook(
    'retry-handler',
    `Retry decision for ${agentType}: shouldRetry=${decision.shouldRetry}, ` +
    `alternative=${decision.alternativeAgent || 'none'}`
  );

  // Update agent status based on decision
  if (decision.shouldRetry) {
    updateAgentStatus(agentType, 'retrying');
  } else {
    updateAgentStatus(agentType, 'failed');

    // Update task status if exists
    const task = getTaskByAgent(agentType);
    if (task) {
      updateTaskStatus(task.taskId, 'failed');
    }
  }

  // Format message for user
  const message = formatRetryDecision(decision, agentType);

  return outputWithContext(message);
}

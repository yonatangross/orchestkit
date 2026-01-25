/**
 * Retry Manager - Intelligent retry decisions for failed agents
 * Issue #197: Agent Orchestration Layer
 *
 * Provides:
 * - Exponential backoff retry logic
 * - Alternative agent suggestions
 * - Failure pattern detection
 * - Max retry limits
 */

import { logHook } from './common.js';
import type {
  RetryDecision,
  ExecutionAttempt,
  AgentOutcome,
  DispatchedAgent,
} from './orchestration-types.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

/** Alternative agent mappings for common failure scenarios */
const ALTERNATIVE_AGENTS: Record<string, string[]> = {
  // If backend architect fails, try these
  'backend-system-architect': ['database-engineer', 'api-designer'],
  // If frontend fails, try UI designer first
  'frontend-ui-developer': ['rapid-ui-designer', 'accessibility-specialist'],
  // If test generator fails, try debug investigator
  'test-generator': ['debug-investigator', 'code-quality-reviewer'],
  // If security auditor fails, try layer auditor
  'security-auditor': ['security-layer-auditor'],
  // If workflow architect fails, try LLM integrator
  'workflow-architect': ['llm-integrator', 'data-pipeline-engineer'],
};

/** Error patterns that indicate retry is unlikely to help */
const NON_RETRYABLE_ERRORS = [
  /permission denied/i,
  /access denied/i,
  /not found.*(?:file|module|package)/i,
  /(?:file|module|package)\s+not\s+found/i,
  /missing required/i,
  /invalid (?:api|token|key)/i,
  /authentication failed/i,
  /quota exceeded/i,
  /rate limit/i,
];

/** Error patterns that suggest trying an alternative agent */
const ALTERNATIVE_SUGGESTING_ERRORS = [
  /not my specialization/i,
  /outside my scope/i,
  /better suited for/i,
  /consider using/i,
  /specialized agent/i,
];

// -----------------------------------------------------------------------------
// Retry Logic
// -----------------------------------------------------------------------------

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(
  attemptNumber: number,
  baseDelayMs: number = DEFAULT_BASE_DELAY_MS
): number {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelayMs * Math.pow(2, attemptNumber - 1);
  const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
  return Math.min(exponentialDelay + jitter, MAX_DELAY_MS);
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: string): boolean {
  for (const pattern of NON_RETRYABLE_ERRORS) {
    if (pattern.test(error)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if error suggests alternative agent
 */
export function suggestsAlternative(error: string): boolean {
  for (const pattern of ALTERNATIVE_SUGGESTING_ERRORS) {
    if (pattern.test(error)) {
      return true;
    }
  }
  return false;
}

/**
 * Get alternative agent for a given agent
 */
export function getAlternativeAgent(agent: string, triedAgents: string[] = []): string | undefined {
  const alternatives = ALTERNATIVE_AGENTS[agent];
  if (!alternatives) return undefined;

  // Return first alternative not yet tried
  for (const alt of alternatives) {
    if (!triedAgents.includes(alt)) {
      return alt;
    }
  }

  return undefined;
}

/**
 * Make retry decision based on execution history and error
 */
export function makeRetryDecision(
  agent: string,
  attemptNumber: number,
  error: string,
  triedAgents: string[] = [],
  maxRetries: number = DEFAULT_MAX_RETRIES
): RetryDecision {
  logHook('retry-manager', `Evaluating retry for ${agent}, attempt ${attemptNumber}`);

  // Check if max retries exceeded
  if (attemptNumber >= maxRetries) {
    const alternative = getAlternativeAgent(agent, triedAgents);
    return {
      shouldRetry: false,
      retryCount: attemptNumber,
      maxRetries,
      alternativeAgent: alternative,
      reason: `Max retries (${maxRetries}) exceeded` +
        (alternative ? `. Consider trying ${alternative} instead.` : ''),
    };
  }

  // Check if error is retryable
  if (!isRetryableError(error)) {
    const alternative = getAlternativeAgent(agent, triedAgents);
    return {
      shouldRetry: false,
      retryCount: attemptNumber,
      maxRetries,
      alternativeAgent: alternative,
      reason: `Non-retryable error detected: ${error.slice(0, 100)}`,
    };
  }

  // Check if error suggests alternative agent
  if (suggestsAlternative(error)) {
    const alternative = getAlternativeAgent(agent, triedAgents);
    if (alternative) {
      return {
        shouldRetry: false,
        retryCount: attemptNumber,
        maxRetries,
        alternativeAgent: alternative,
        reason: `Error suggests using alternative agent: ${alternative}`,
      };
    }
  }

  // Retry with backoff
  const delayMs = calculateBackoffDelay(attemptNumber);
  return {
    shouldRetry: true,
    retryCount: attemptNumber,
    maxRetries,
    delayMs,
    reason: `Retrying (attempt ${attemptNumber + 1}/${maxRetries}) after ${Math.round(delayMs / 1000)}s`,
  };
}

// -----------------------------------------------------------------------------
// Execution Tracking
// -----------------------------------------------------------------------------

/**
 * Create execution attempt record
 */
export function createAttempt(
  agent: string,
  attemptNumber: number,
  taskId?: string
): ExecutionAttempt {
  return {
    agent,
    taskId,
    attemptNumber,
    startedAt: new Date().toISOString(),
  };
}

/**
 * Complete execution attempt with outcome
 */
export function completeAttempt(
  attempt: ExecutionAttempt,
  outcome: AgentOutcome,
  error?: string
): ExecutionAttempt {
  const completedAt = new Date().toISOString();
  const durationMs = new Date(completedAt).getTime() - new Date(attempt.startedAt).getTime();

  return {
    ...attempt,
    completedAt,
    outcome,
    error,
    durationMs,
  };
}

/**
 * Analyze execution history for patterns
 */
export function analyzeAttemptHistory(attempts: ExecutionAttempt[]): {
  successRate: number;
  avgDuration: number;
  commonErrors: string[];
} {
  if (attempts.length === 0) {
    return { successRate: 0, avgDuration: 0, commonErrors: [] };
  }

  const successful = attempts.filter(a => a.outcome === 'success').length;
  const successRate = successful / attempts.length;

  const durations = attempts
    .filter(a => a.durationMs !== undefined)
    .map(a => a.durationMs!);
  const avgDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  // Count error patterns
  const errorCounts = new Map<string, number>();
  for (const attempt of attempts) {
    if (attempt.error) {
      // Normalize error to first 50 chars
      const normalized = attempt.error.slice(0, 50).toLowerCase();
      errorCounts.set(normalized, (errorCounts.get(normalized) || 0) + 1);
    }
  }

  // Get most common errors
  const commonErrors = Array.from(errorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([error]) => error);

  return { successRate, avgDuration, commonErrors };
}

// -----------------------------------------------------------------------------
// Dispatched Agent Updates
// -----------------------------------------------------------------------------

/**
 * Update dispatched agent for retry
 */
export function prepareForRetry(
  agent: DispatchedAgent,
  decision: RetryDecision
): DispatchedAgent {
  return {
    ...agent,
    status: 'retrying',
    retryCount: decision.retryCount,
  };
}

/**
 * Format retry decision as user-facing message
 */
export function formatRetryDecision(decision: RetryDecision, agent: string): string {
  if (decision.shouldRetry) {
    return `## Retry Scheduled

Agent \`${agent}\` will retry after ${Math.round((decision.delayMs || 0) / 1000)} seconds.

**Attempt:** ${decision.retryCount + 1} of ${decision.maxRetries}
**Reason:** ${decision.reason}`;
  }

  let message = `## Retry Not Recommended

Agent \`${agent}\` has ${decision.retryCount >= decision.maxRetries ? 'exhausted retries' : 'encountered a non-retryable error'}.

**Reason:** ${decision.reason}`;

  if (decision.alternativeAgent) {
    message += `

### Alternative Suggestion

Consider using \`${decision.alternativeAgent}\` instead:

\`\`\`
Task tool with subagent_type: "${decision.alternativeAgent}"
\`\`\``;
  }

  return message;
}

/**
 * Integration tests for Retry Manager (Issue #197)
 * Tests retry decision logic, exponential backoff, and alternative agent suggestions
 */

import { describe, test, expect } from 'vitest';
import {
  calculateBackoffDelay,
  isRetryableError,
  suggestsAlternative,
  getAlternativeAgent,
  makeRetryDecision,
  createAttempt,
  completeAttempt,
  analyzeAttemptHistory,
  prepareForRetry,
  formatRetryDecision,
} from '../lib/retry-manager.js';
import type { ExecutionAttempt, DispatchedAgent } from '../lib/orchestration-types.js';

// =============================================================================
// Backoff Calculation Tests
// =============================================================================

describe('calculateBackoffDelay - exponential backoff', () => {
  test('calculates delay for first attempt (1000ms base)', () => {
    const delay = calculateBackoffDelay(1, 1000);

    // Should be around 1000ms ± 10% jitter
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(1100);
  });

  test('doubles delay for each attempt', () => {
    const delay1 = calculateBackoffDelay(1, 1000);
    const delay2 = calculateBackoffDelay(2, 1000);
    const delay3 = calculateBackoffDelay(3, 1000);

    // delay2 should be ~2x delay1, delay3 should be ~4x delay1
    expect(delay2).toBeGreaterThan(delay1 * 1.8); // Account for jitter
    expect(delay3).toBeGreaterThan(delay2 * 1.8);
  });

  test('caps delay at 30000ms (30 seconds)', () => {
    const delay = calculateBackoffDelay(10, 1000);

    expect(delay).toBeLessThanOrEqual(30000);
  });

  test('adds 10% random jitter', () => {
    const delays = new Set<number>();
    for (let i = 0; i < 10; i++) {
      const delay = calculateBackoffDelay(2, 1000);
      delays.add(delay);
    }

    // With jitter, should get different values
    expect(delays.size).toBeGreaterThan(1);
  });

  test('uses custom base delay', () => {
    const delay = calculateBackoffDelay(1, 500);

    expect(delay).toBeGreaterThanOrEqual(500);
    expect(delay).toBeLessThanOrEqual(550);
  });
});

// =============================================================================
// Error Classification Tests
// =============================================================================

describe('isRetryableError - error classification', () => {
  const nonRetryableErrors = [
    'permission denied',
    'access denied',
    'file not found',
    'module not found',
    'package not found',
    'missing required field',
    'invalid API key',
    'invalid token',
    'authentication failed',
    'quota exceeded',
    'rate limit exceeded',
  ];

  nonRetryableErrors.forEach(error => {
    test(`marks "${error}" as non-retryable`, () => {
      expect(isRetryableError(error)).toBe(false);
    });
  });

  const retryableErrors = [
    'network timeout',
    'connection reset',
    'temporary failure',
    'service unavailable',
    'internal server error',
  ];

  retryableErrors.forEach(error => {
    test(`marks "${error}" as retryable`, () => {
      expect(isRetryableError(error)).toBe(true);
    });
  });

  test('is case insensitive', () => {
    expect(isRetryableError('PERMISSION DENIED')).toBe(false);
    expect(isRetryableError('Permission Denied')).toBe(false);
    expect(isRetryableError('pErMiSsIoN dEnIeD')).toBe(false);
  });
});

describe('suggestsAlternative - alternative agent detection', () => {
  const alternativeSuggestingErrors = [
    'not my specialization',
    'outside my scope',
    'better suited for another agent',
    'consider using different agent',
    'specialized agent required',
  ];

  alternativeSuggestingErrors.forEach(error => {
    test(`detects alternative suggestion in "${error}"`, () => {
      expect(suggestsAlternative(error)).toBe(true);
    });
  });

  test('returns false for normal errors', () => {
    expect(suggestsAlternative('connection timeout')).toBe(false);
    expect(suggestsAlternative('internal error')).toBe(false);
  });

  test('is case insensitive', () => {
    expect(suggestsAlternative('NOT MY SPECIALIZATION')).toBe(true);
  });
});

// =============================================================================
// Alternative Agent Tests
// =============================================================================

describe('getAlternativeAgent - alternative suggestions', () => {
  test('returns first alternative for backend-system-architect', () => {
    const alt = getAlternativeAgent('backend-system-architect');

    expect(alt).toBeDefined();
    expect(['database-engineer', 'api-designer']).toContain(alt);
  });

  test('returns first alternative for frontend-ui-developer', () => {
    const alt = getAlternativeAgent('frontend-ui-developer');

    expect(alt).toBeDefined();
    expect(['rapid-ui-designer', 'accessibility-specialist']).toContain(alt);
  });

  test('returns first alternative for test-generator', () => {
    const alt = getAlternativeAgent('test-generator');

    expect(alt).toBeDefined();
    expect(['debug-investigator', 'code-quality-reviewer']).toContain(alt);
  });

  test('skips already-tried alternatives', () => {
    const alt1 = getAlternativeAgent('backend-system-architect', []);
    const alt2 = getAlternativeAgent('backend-system-architect', [alt1!]);

    expect(alt1).not.toBe(alt2);
  });

  test('returns undefined when all alternatives tried', () => {
    const triedAgents = ['database-engineer', 'api-designer'];
    const alt = getAlternativeAgent('backend-system-architect', triedAgents);

    expect(alt).toBeUndefined();
  });

  test('returns undefined for agent without alternatives', () => {
    const alt = getAlternativeAgent('unknown-agent');

    expect(alt).toBeUndefined();
  });
});

// =============================================================================
// Retry Decision Tests
// =============================================================================

describe('makeRetryDecision - retry logic', () => {
  test('allows retry on first attempt with retryable error', () => {
    const decision = makeRetryDecision(
      'backend-system-architect',
      1,
      'network timeout',
      [],
      3
    );

    expect(decision.shouldRetry).toBe(true);
    expect(decision.retryCount).toBe(1);
    expect(decision.maxRetries).toBe(3);
    expect(decision.delayMs).toBeDefined();
    expect(decision.reason).toContain('Retrying');
  });

  test('blocks retry when max retries exceeded', () => {
    const decision = makeRetryDecision(
      'backend-system-architect',
      3,
      'network timeout',
      [],
      3
    );

    expect(decision.shouldRetry).toBe(false);
    expect(decision.reason).toContain('Max retries');
  });

  test('suggests alternative when max retries exceeded', () => {
    const decision = makeRetryDecision(
      'backend-system-architect',
      3,
      'network timeout',
      [],
      3
    );

    expect(decision.alternativeAgent).toBeDefined();
    expect(['database-engineer', 'api-designer']).toContain(
      decision.alternativeAgent
    );
  });

  test('blocks retry for non-retryable error', () => {
    const decision = makeRetryDecision(
      'backend-system-architect',
      1,
      'permission denied',
      [],
      3
    );

    expect(decision.shouldRetry).toBe(false);
    expect(decision.reason).toContain('Non-retryable error');
  });

  test('suggests alternative for non-retryable error', () => {
    const decision = makeRetryDecision(
      'backend-system-architect',
      1,
      'invalid API key',
      [],
      3
    );

    expect(decision.alternativeAgent).toBeDefined();
  });

  test('suggests alternative when error indicates scope issue', () => {
    const decision = makeRetryDecision(
      'backend-system-architect',
      1,
      'not my specialization, better suited for database agent',
      [],
      3
    );

    expect(decision.shouldRetry).toBe(false);
    expect(decision.alternativeAgent).toBe('database-engineer');
    expect(decision.reason).toContain('alternative agent');
  });

  test('skips already-tried alternatives', () => {
    const decision = makeRetryDecision(
      'backend-system-architect',
      3,
      'network timeout',
      ['database-engineer'],
      3
    );

    expect(decision.alternativeAgent).not.toBe('database-engineer');
  });

  test('calculates backoff delay for retries', () => {
    const decision1 = makeRetryDecision('test-agent', 1, 'timeout', [], 3);
    const decision2 = makeRetryDecision('test-agent', 2, 'timeout', [], 3);

    if (decision1.shouldRetry && decision2.shouldRetry) {
      expect(decision2.delayMs!).toBeGreaterThan(decision1.delayMs!);
    }
  });

  test('includes attempt number in reason', () => {
    const decision = makeRetryDecision('test-agent', 2, 'timeout', [], 3);

    expect(decision.reason).toContain('attempt 3/3');
  });
});

// =============================================================================
// Execution Tracking Tests
// =============================================================================

describe('createAttempt - attempt creation', () => {
  test('creates attempt with required fields', () => {
    const attempt = createAttempt('backend-system-architect', 1);

    expect(attempt.agent).toBe('backend-system-architect');
    expect(attempt.attemptNumber).toBe(1);
    expect(attempt.startedAt).toBeDefined();
  });

  test('includes task ID when provided', () => {
    const attempt = createAttempt('test-agent', 1, 'task-123');

    expect(attempt.taskId).toBe('task-123');
  });

  test('sets startedAt timestamp', () => {
    const before = Date.now();
    const attempt = createAttempt('test-agent', 1);
    const after = Date.now();

    const startedTime = new Date(attempt.startedAt).getTime();
    expect(startedTime).toBeGreaterThanOrEqual(before);
    expect(startedTime).toBeLessThanOrEqual(after);
  });
});

describe('completeAttempt - attempt completion', () => {
  test('adds completion timestamp', () => {
    const attempt = createAttempt('test-agent', 1);
    const completed = completeAttempt(attempt, 'success');

    expect(completed.completedAt).toBeDefined();
  });

  test('calculates duration', () => {
    const attempt = createAttempt('test-agent', 1);

    // Wait a bit
    setTimeout(() => {
      const completed = completeAttempt(attempt, 'success');

      expect(completed.durationMs).toBeDefined();
      expect(completed.durationMs!).toBeGreaterThan(0);
    }, 10);
  });

  test('records outcome', () => {
    const attempt = createAttempt('test-agent', 1);
    const completed = completeAttempt(attempt, 'failure', 'network error');

    expect(completed.outcome).toBe('failure');
    expect(completed.error).toBe('network error');
  });

  test('handles all outcome types', () => {
    const outcomes: Array<'success' | 'failure' | 'partial' | 'rejected'> = [
      'success',
      'failure',
      'partial',
      'rejected',
    ];

    for (const outcome of outcomes) {
      const attempt = createAttempt('test-agent', 1);
      const completed = completeAttempt(attempt, outcome);

      expect(completed.outcome).toBe(outcome);
    }
  });
});

describe('analyzeAttemptHistory - pattern analysis', () => {
  test('calculates success rate', () => {
    const attempts: ExecutionAttempt[] = [
      { ...createAttempt('agent', 1), outcome: 'success', completedAt: '2024-01-01', durationMs: 1000 },
      { ...createAttempt('agent', 2), outcome: 'failure', completedAt: '2024-01-01', durationMs: 1000 },
      { ...createAttempt('agent', 3), outcome: 'success', completedAt: '2024-01-01', durationMs: 1000 },
      { ...createAttempt('agent', 4), outcome: 'success', completedAt: '2024-01-01', durationMs: 1000 },
    ];

    const analysis = analyzeAttemptHistory(attempts);

    expect(analysis.successRate).toBe(0.75); // 3/4
  });

  test('calculates average duration', () => {
    const attempts: ExecutionAttempt[] = [
      { ...createAttempt('agent', 1), durationMs: 1000, completedAt: '2024-01-01' },
      { ...createAttempt('agent', 2), durationMs: 2000, completedAt: '2024-01-01' },
      { ...createAttempt('agent', 3), durationMs: 3000, completedAt: '2024-01-01' },
    ];

    const analysis = analyzeAttemptHistory(attempts);

    expect(analysis.avgDuration).toBe(2000);
  });

  test('identifies common errors', () => {
    const attempts: ExecutionAttempt[] = [
      { ...createAttempt('agent', 1), error: 'network timeout', completedAt: '2024-01-01' },
      { ...createAttempt('agent', 2), error: 'network timeout', completedAt: '2024-01-01' },
      { ...createAttempt('agent', 3), error: 'permission denied', completedAt: '2024-01-01' },
      { ...createAttempt('agent', 4), error: 'network timeout', completedAt: '2024-01-01' },
    ];

    const analysis = analyzeAttemptHistory(attempts);

    expect(analysis.commonErrors).toContain('network timeout');
  });

  test('returns top 3 common errors', () => {
    const attempts: ExecutionAttempt[] = [];
    for (let i = 0; i < 10; i++) {
      attempts.push({
        ...createAttempt('agent', i),
        error: `error-${i % 4}`,
        completedAt: '2024-01-01',
      });
    }

    const analysis = analyzeAttemptHistory(attempts);

    expect(analysis.commonErrors.length).toBeLessThanOrEqual(3);
  });

  test('handles empty attempt history', () => {
    const analysis = analyzeAttemptHistory([]);

    expect(analysis.successRate).toBe(0);
    expect(analysis.avgDuration).toBe(0);
    expect(analysis.commonErrors).toEqual([]);
  });
});

// =============================================================================
// Dispatched Agent Update Tests
// =============================================================================

describe('prepareForRetry - agent status update', () => {
  test('sets status to retrying', () => {
    const agent: DispatchedAgent = {
      agent: 'test-agent',
      confidence: 85,
      dispatchedAt: '2024-01-01',
      status: 'in_progress',
      retryCount: 1,
      maxRetries: 3,
    };

    const decision = {
      shouldRetry: true,
      retryCount: 2,
      maxRetries: 3,
      delayMs: 2000,
      reason: 'Retrying',
    };

    const updated = prepareForRetry(agent, decision);

    expect(updated.status).toBe('retrying');
    expect(updated.retryCount).toBe(2);
  });

  test('preserves other agent fields', () => {
    const agent: DispatchedAgent = {
      agent: 'backend-system-architect',
      taskId: 'task-123',
      confidence: 88,
      dispatchedAt: '2024-01-01',
      status: 'in_progress',
      retryCount: 1,
      maxRetries: 3,
    };

    const decision = {
      shouldRetry: true,
      retryCount: 2,
      maxRetries: 3,
      delayMs: 2000,
      reason: 'Retrying',
    };

    const updated = prepareForRetry(agent, decision);

    expect(updated.agent).toBe('backend-system-architect');
    expect(updated.taskId).toBe('task-123');
    expect(updated.confidence).toBe(88);
  });
});

// =============================================================================
// Message Formatting Tests
// =============================================================================

describe('formatRetryDecision - user messages', () => {
  test('formats retry message with delay', () => {
    const decision = {
      shouldRetry: true,
      retryCount: 2,
      maxRetries: 3,
      delayMs: 2000,
      reason: 'Retrying after network timeout',
    };

    const message = formatRetryDecision(decision, 'backend-system-architect');

    expect(message).toContain('Retry Scheduled');
    expect(message).toContain('backend-system-architect');
    expect(message).toContain('2 seconds');
    expect(message).toContain('3 of 3');
  });

  test('formats no-retry message', () => {
    const decision = {
      shouldRetry: false,
      retryCount: 3,
      maxRetries: 3,
      reason: 'Max retries exceeded',
    };

    const message = formatRetryDecision(decision, 'test-agent');

    expect(message).toContain('Retry Not Recommended');
    expect(message).toContain('exhausted retries');
  });

  test('includes alternative agent suggestion', () => {
    const decision = {
      shouldRetry: false,
      retryCount: 3,
      maxRetries: 3,
      alternativeAgent: 'database-engineer',
      reason: 'Max retries exceeded',
    };

    const message = formatRetryDecision(decision, 'backend-system-architect');

    expect(message).toContain('Alternative Suggestion');
    expect(message).toContain('database-engineer');
    expect(message).toContain('Task tool with subagent_type');
  });

  test('rounds delay to seconds', () => {
    const decision = {
      shouldRetry: true,
      retryCount: 1,
      maxRetries: 3,
      delayMs: 1573,
      reason: 'Retrying',
    };

    const message = formatRetryDecision(decision, 'test-agent');

    expect(message).toContain('2 seconds'); // Should round 1.573 to 2
  });
});

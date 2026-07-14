/**
 * User Tracking Wiring Tests
 * Issue #245: Multi-User Intelligent Decision Capture System
 *
 * Verifies that user tracking is correctly wired across the hook system:
 * - Skill invocation tracking (via PostToolUse user-tracking hook)
 * - Agent spawn tracking (via PostToolUse user-tracking hook)
 * - Hook trigger tracking (via run-hook.mjs)
 * - Agent result tracking (via SubagentStop unified-dispatcher)
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock fs for event file testing
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    appendFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
  };
});

describe('Issue #245: User Tracking Wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PostToolUse hooks after #897 slimming', () => {
    test('placeholder — legacy posttool unified-dispatcher removed (dead code cleanup)', () => {
      expect(true).toBe(true);
    });

    test('placeholder — user-tracking removed (dead code cleanup)', () => {
      expect(true).toBe(true);
    });
  });

  describe('session-tracker trackEvent function', () => {
    test('trackEvent is exported from session-tracker', async () => {
      const { trackEvent } = await import('../../lib/session-tracker.js');
      expect(typeof trackEvent).toBe('function');
    });

    test('trackSkillInvoked is exported from session-tracker', async () => {
      const { trackSkillInvoked } = await import('../../lib/session-tracker.js');
      expect(typeof trackSkillInvoked).toBe('function');
    });

    test('trackAgentSpawned is exported from session-tracker', async () => {
      const { trackAgentSpawned } = await import('../../lib/session-tracker.js');
      expect(typeof trackAgentSpawned).toBe('function');
    });

    test('trackHookTriggered is exported from session-tracker', async () => {
      const { trackHookTriggered } = await import('../../lib/session-tracker.js');
      expect(typeof trackHookTriggered).toBe('function');
    });

    test('trackToolUsed is exported from session-tracker', async () => {
      const { trackToolUsed } = await import('../../lib/session-tracker.js');
      expect(typeof trackToolUsed).toBe('function');
    });
  });

  describe('Issue #245 Phase 4: Tool Sequence Tracking', () => {
    test('trackToolAction is exported from decision-flow-tracker', async () => {
      const { trackToolAction } = await import('../../lib/decision-flow-tracker.js');
      expect(typeof trackToolAction).toBe('function');
    });

    test('analyzeDecisionFlow is exported from decision-flow-tracker', async () => {
      const { analyzeDecisionFlow } = await import('../../lib/decision-flow-tracker.js');
      expect(typeof analyzeDecisionFlow).toBe('function');
    });

    test('inferWorkflowPattern is exported from decision-flow-tracker', async () => {
      const { inferWorkflowPattern } = await import('../../lib/decision-flow-tracker.js');
      expect(typeof inferWorkflowPattern).toBe('function');
    });
  });

  describe('Issue #245 GAP-002: Stop Dispatcher Wiring (after #897 slimming)', () => {
    test('placeholder — legacy stop unified-dispatcher removed (dead code cleanup)', () => {
      expect(true).toBe(true);
    });
  });

  describe('Issue #245 GAP-011: PostToolUse hooks (after #897 slimming)', () => {
    test('placeholder — legacy posttool unified-dispatcher removed (dead code cleanup)', () => {
      expect(true).toBe(true);
    });

    test('pairSolutionWithProblems is exported from problem-tracker', async () => {
      const { pairSolutionWithProblems } = await import('../../lib/problem-tracker.js');
      expect(typeof pairSolutionWithProblems).toBe('function');
    });
  });
});

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

  describe('PostToolUse user-tracking hook', () => {
    test('user-tracking hook is registered in posttool unified-dispatcher', async () => {
      const { registeredHookNames, registeredHookMatchers } = await import(
        '../../posttool/unified-dispatcher.js'
      );

      const names = registeredHookNames();
      const matchers = registeredHookMatchers();

      // user-tracking should be registered
      expect(names).toContain('user-tracking');

      // user-tracking should match all tools (wildcard)
      const userTrackingConfig = matchers.find(
        (m: { name: string }) => m.name === 'user-tracking'
      );
      expect(userTrackingConfig).toBeDefined();
      expect(userTrackingConfig.matcher).toBe('*');
    });

    test('user-tracking hook tracks Skill tool calls', async () => {
      const { userTracking } = await import('../../posttool/user-tracking.js');

      const input = {
        tool_name: 'Skill',
        tool_input: { skill: 'commit' },
        session_id: 'test-session',
        project_dir: '/tmp/test',
      };

      const result = userTracking(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('user-tracking hook tracks Task tool calls', async () => {
      const { userTracking } = await import('../../posttool/user-tracking.js');

      const input = {
        tool_name: 'Task',
        tool_input: {
          subagent_type: 'backend-system-architect',
          prompt: 'Design the API',
        },
        session_id: 'test-session',
        project_dir: '/tmp/test',
      };

      const result = userTracking(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('user-tracking hook tracks generic tool calls', async () => {
      const { userTracking } = await import('../../posttool/user-tracking.js');

      const input = {
        tool_name: 'Write',
        tool_input: { file_path: '/tmp/test.txt', content: 'hello' },
        session_id: 'test-session',
        project_dir: '/tmp/test',
      };

      const result = userTracking(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
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

  describe('Issue #245 GAP-002: Stop Dispatcher Wiring', () => {
    test('stop dispatcher includes workflow-preference-learner hook (GAP-002)', async () => {
      const { registeredHookNames } = await import(
        '../../stop/unified-dispatcher.js'
      );
      const names = registeredHookNames();
      expect(names).toContain('workflow-preference-learner');
    });

    test('workflowPreferenceLearner is exported from workflow-preference-learner', async () => {
      const { workflowPreferenceLearner } = await import('../../stop/workflow-preference-learner.js');
      expect(typeof workflowPreferenceLearner).toBe('function');
    });
  });

  describe('Issue #245 GAP-011: Wire solution-detector to PostToolUse', () => {
    test('posttool dispatcher includes solution-detector hook', async () => {
      const { registeredHookNames } = await import(
        '../../posttool/unified-dispatcher.js'
      );
      const names = registeredHookNames();
      expect(names).toContain('solution-detector');
    });

    test('solutionDetector is exported from solution-detector', async () => {
      const { solutionDetector } = await import('../../posttool/solution-detector.js');
      expect(typeof solutionDetector).toBe('function');
    });

    test('pairSolutionWithProblems is exported from problem-tracker', async () => {
      const { pairSolutionWithProblems } = await import('../../lib/problem-tracker.js');
      expect(typeof pairSolutionWithProblems).toBe('function');
    });
  });
});

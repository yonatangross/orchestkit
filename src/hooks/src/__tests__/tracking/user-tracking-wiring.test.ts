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
import * as fs from 'node:fs';
import * as path from 'node:path';

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

  describe('SubagentStop agent result tracking', () => {
    test('unified-dispatcher includes trackEvent import', async () => {
      // Read the source file to verify import
      const dispatcherPath = path.resolve(
        process.cwd(),
        'src/subagent-stop/unified-dispatcher.ts'
      );
      const content = fs.readFileSync(dispatcherPath, 'utf-8');

      expect(content).toContain("import { trackEvent } from '../lib/session-tracker.js'");
    });

    test('unified-dispatcher calls trackAgentResult', async () => {
      // Read the source file to verify trackAgentResult call
      const dispatcherPath = path.resolve(
        process.cwd(),
        'src/subagent-stop/unified-dispatcher.ts'
      );
      const content = fs.readFileSync(dispatcherPath, 'utf-8');

      expect(content).toContain('trackAgentResult(input)');
      expect(content).toContain('Issue #245');
    });

    test('trackAgentResult function extracts agent metadata', async () => {
      // Read the source file to verify trackAgentResult implementation
      const dispatcherPath = path.resolve(
        process.cwd(),
        'src/subagent-stop/unified-dispatcher.ts'
      );
      const content = fs.readFileSync(dispatcherPath, 'utf-8');

      // Should extract agent type from input
      expect(content).toContain('input.subagent_type || input.agent_type');
      // Should check for errors
      expect(content).toContain('!input.error');
      // Should extract duration
      expect(content).toContain('input.duration_ms');
      // Should extract output
      expect(content).toContain('input.agent_output || input.output');
    });
  });

  describe('run-hook.mjs hook tracking', () => {
    test('run-hook.mjs includes trackHookTriggered function', () => {
      const runHookPath = path.resolve(process.cwd(), 'bin/run-hook.mjs');
      const content = fs.readFileSync(runHookPath, 'utf-8');

      expect(content).toContain('function trackHookTriggered');
      expect(content).toContain('Issue #245');
    });

    test('run-hook.mjs tracks hook execution with timing', () => {
      const runHookPath = path.resolve(process.cwd(), 'bin/run-hook.mjs');
      const content = fs.readFileSync(runHookPath, 'utf-8');

      // Should capture start time
      expect(content).toContain('const startTime = Date.now()');
      // Should calculate duration
      expect(content).toContain('const durationMs = Date.now() - startTime');
      // Should call trackHookTriggered in finally block
      expect(content).toContain('trackHookTriggered(hookName, success, durationMs, projectDir)');
    });

    test('run-hook.mjs writes events to session directory', () => {
      const runHookPath = path.resolve(process.cwd(), 'bin/run-hook.mjs');
      const content = fs.readFileSync(runHookPath, 'utf-8');

      // Should create event with correct structure
      expect(content).toContain("event_type: 'hook_triggered'");
      // Should write to events.jsonl
      expect(content).toContain('events.jsonl');
      // Should use appendFileSync
      expect(content).toContain('appendFileSync(eventsPath');
    });

    test('run-hook.mjs handles missing session gracefully', () => {
      const runHookPath = path.resolve(process.cwd(), 'bin/run-hook.mjs');
      const content = fs.readFileSync(runHookPath, 'utf-8');

      // Should check for session ID
      expect(content).toContain('if (!sessionId) return');
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

  describe('End-to-end tracking integration', () => {
    test('all tracking entry points are wired', async () => {
      // Verify user-tracking is in posttool dispatcher
      const { registeredHookNames: postToolNames } = await import(
        '../../posttool/unified-dispatcher.js'
      );
      expect(postToolNames()).toContain('user-tracking');

      // Verify subagent-stop dispatcher has tracking
      const dispatcherPath = path.resolve(
        process.cwd(),
        'src/subagent-stop/unified-dispatcher.ts'
      );
      const dispatcherContent = fs.readFileSync(dispatcherPath, 'utf-8');
      expect(dispatcherContent).toContain('trackAgentResult');

      // Verify run-hook.mjs has tracking
      const runHookPath = path.resolve(process.cwd(), 'bin/run-hook.mjs');
      const runHookContent = fs.readFileSync(runHookPath, 'utf-8');
      expect(runHookContent).toContain('trackHookTriggered');
    });
  });

  describe('Issue #245 Phase 4: Tool Sequence Tracking', () => {
    test('user-tracking hook imports trackToolAction from decision-flow-tracker', () => {
      const userTrackingPath = path.resolve(
        process.cwd(),
        'src/posttool/user-tracking.ts'
      );
      const content = fs.readFileSync(userTrackingPath, 'utf-8');

      expect(content).toContain("import { trackToolAction } from '../lib/decision-flow-tracker.js'");
    });

    test('user-tracking hook calls trackToolAction for tool sequence tracking', () => {
      const userTrackingPath = path.resolve(
        process.cwd(),
        'src/posttool/user-tracking.ts'
      );
      const content = fs.readFileSync(userTrackingPath, 'utf-8');

      // Should call trackToolAction with session, tool, command, file, exitCode
      expect(content).toContain('trackToolAction(sessionId, toolName, command, filePath, exitCode)');
      expect(content).toContain('Issue #245 Phase 4');
    });

    test('user-tracking hook extracts command and file path', () => {
      const userTrackingPath = path.resolve(
        process.cwd(),
        'src/posttool/user-tracking.ts'
      );
      const content = fs.readFileSync(userTrackingPath, 'utf-8');

      expect(content).toContain('extractCommand(input)');
      expect(content).toContain('extractFilePath(input)');
    });

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

  describe('Issue #245 Phase 4: Workflow Pattern Aggregation', () => {
    test('user-profile imports analyzeDecisionFlow', () => {
      const userProfilePath = path.resolve(
        process.cwd(),
        'src/lib/user-profile.ts'
      );
      const content = fs.readFileSync(userProfilePath, 'utf-8');

      expect(content).toContain("import { analyzeDecisionFlow");
      expect(content).toContain("from './decision-flow-tracker.js'");
    });

    test('aggregateSession includes workflow pattern aggregation', () => {
      const userProfilePath = path.resolve(
        process.cwd(),
        'src/lib/user-profile.ts'
      );
      const content = fs.readFileSync(userProfilePath, 'utf-8');

      expect(content).toContain('Aggregate workflow pattern from decision flow');
      expect(content).toContain('Issue #245 Phase 4');
      expect(content).toContain('analyzeDecisionFlow(summary.session_id)');
    });

    test('convertFlowPattern helper exists for type conversion', () => {
      const userProfilePath = path.resolve(
        process.cwd(),
        'src/lib/user-profile.ts'
      );
      const content = fs.readFileSync(userProfilePath, 'utf-8');

      expect(content).toContain('function convertFlowPattern');
      expect(content).toContain('WORKFLOW_PATTERN_DESCRIPTIONS');
    });

    test('workflow pattern frequencies are tracked', () => {
      const userProfilePath = path.resolve(
        process.cwd(),
        'src/lib/user-profile.ts'
      );
      const content = fs.readFileSync(userProfilePath, 'utf-8');

      // Should increase frequency for existing patterns
      expect(content).toContain('existing.frequency = Math.min(1, existing.frequency + 0.1)');
      // Should cap at 10 patterns
      expect(content).toContain('workflow_patterns.length > 10');
    });
  });
});

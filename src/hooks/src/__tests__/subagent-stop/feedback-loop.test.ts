/**
 * Feedback Loop - SubagentStop Hook Test Suite
 *
 * Tests the feedback-loop hook which captures agent completion context,
 * routes findings to downstream agents, logs to decision-log.json,
 * and updates CC 2.1.16 Task status.
 *
 * CC 2.1.7 Compliant: All paths return continue: true (non-blocking)
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST be before imports
// =============================================================================

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ size: 500 }),
  renameSync: vi.fn(),
  readSync: vi.fn().mockReturnValue(0),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue('main\n'),
}));

vi.mock('../../lib/task-integration.js', () => ({
  getTaskByAgent: vi.fn().mockReturnValue(null),
  updateTaskStatus: vi.fn(),
  getActivePipeline: vi.fn().mockReturnValue(null),
}));

vi.mock('../../lib/multi-agent-coordinator.js', () => ({
  PIPELINES: [
    {
      type: 'full-stack-feature',
      steps: [
        { agent: 'backend-system-architect', dependsOn: [] },
        { agent: 'frontend-ui-developer', dependsOn: [0] },
        { agent: 'test-generator', dependsOn: [0, 1] },
      ],
    },
  ],
}));

vi.mock('../../lib/agent-teams.js', () => ({
  isAgentTeamsActive: vi.fn().mockReturnValue(false),
}));

// =============================================================================
// Import under test (after mocks)
// =============================================================================

import { feedbackLoop } from '../../subagent-stop/feedback-loop.js';
import { writeFileSync, mkdirSync, appendFileSync, existsSync, readFileSync } from 'node:fs';
import { getTaskByAgent, updateTaskStatus, getActivePipeline } from '../../lib/task-integration.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for SubagentStop events
 */
function createSubagentStopInput(
  agentType: string,
  agentOutput: string = '',
  overrides: Partial<HookInput> = {},
): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'test-session-fbl',
    tool_input: {
      subagent_type: agentType,
    },
    subagent_type: agentType,
    agent_output: agentOutput,
    ...overrides,
  };
}

// =============================================================================
// Feedback Loop Tests
// =============================================================================

describe('feedback-loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Arrange: Set project dir for predictable paths
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
    process.env.CLAUDE_INSTANCE_ID = 'test-instance-001';
    // Ensure Agent Teams is not active so feedbackLoop runs its logic
    delete process.env.CLAUDE_CODE_TEAM_NAME;
    delete process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance: Non-blocking hook
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('always returns continue: true for valid agent', () => {
      // Arrange
      const input = createSubagentStopInput('backend-system-architect', 'API designed');

      // Act
      const result = feedbackLoop(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true when routing to downstream', () => {
      // Arrange
      const input = createSubagentStopInput('backend-system-architect', 'Design complete');

      // Act
      const result = feedbackLoop(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Feedback loop');
    });

    test('returns continue: true for terminal agents', () => {
      // Arrange
      const input = createSubagentStopInput('security-auditor', 'Audit complete');

      // Act
      const result = feedbackLoop(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns continue: true even with agent errors', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', '', {
        error: 'Agent crashed unexpectedly',
      });

      // Act
      const result = feedbackLoop(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true for unknown agent type', () => {
      // Arrange
      const input = createSubagentStopInput('unknown', 'Output');

      // Act
      const result = feedbackLoop(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Downstream agent routing (static mapping)
  // ---------------------------------------------------------------------------

  describe('downstream routing (static mapping)', () => {
    test.each([
      ['market-intelligence', 'product-strategist'],
      ['product-strategist', 'prioritization-analyst'],
      ['prioritization-analyst', 'business-case-builder'],
      ['business-case-builder', 'requirements-translator'],
      ['requirements-translator', 'metrics-architect'],
      ['metrics-architect', 'backend-system-architect'],
      ['backend-system-architect', 'frontend-ui-developer'],
      ['frontend-ui-developer', 'test-generator'],
      ['test-generator', 'security-auditor'],
      ['workflow-architect', 'llm-integrator'],
      ['llm-integrator', 'data-pipeline-engineer'],
      ['data-pipeline-engineer', 'test-generator'],
      ['rapid-ui-designer', 'frontend-ui-developer'],
      ['ux-researcher', 'rapid-ui-designer'],
    ])('routes %s to %s', (fromAgent, toAgent) => {
      // Arrange
      const input = createSubagentStopInput(fromAgent, 'Work complete');

      // Act
      const result = feedbackLoop(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain(toAgent);
    });
  });

  // ---------------------------------------------------------------------------
  // Feedback categories
  // ---------------------------------------------------------------------------

  describe('feedback categories', () => {
    test.each([
      ['market-intelligence', 'product-thinking'],
      ['product-strategist', 'product-thinking'],
      ['prioritization-analyst', 'product-thinking'],
      ['business-case-builder', 'product-thinking'],
      ['requirements-translator', 'specification'],
      ['metrics-architect', 'specification'],
      ['backend-system-architect', 'architecture'],
      ['database-engineer', 'architecture'],
      ['data-pipeline-engineer', 'architecture'],
      ['frontend-ui-developer', 'frontend'],
      ['rapid-ui-designer', 'frontend'],
      ['ux-researcher', 'frontend'],
      ['test-generator', 'quality'],
      ['code-quality-reviewer', 'quality'],
      ['security-auditor', 'security'],
      ['security-layer-auditor', 'security'],
      ['workflow-architect', 'ai-integration'],
      ['llm-integrator', 'ai-integration'],
      ['debug-investigator', 'debugging'],
    ])('categorizes %s as %s', (agent, category) => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput(agent, 'Output');

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const decisionLogCall = calls.find(([path]) =>
        (path as string).includes('decision-log.json')
      );
      expect(decisionLogCall).toBeDefined();

      const logContent = JSON.parse(decisionLogCall![1] as string);
      const decision = logContent.decisions[0];
      expect(decision.category).toBe(category);
    });

    test('uses general category for unknown agents', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput('custom-agent', 'Output');

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const decisionLogCall = calls.find(([path]) =>
        (path as string).includes('decision-log.json')
      );
      const logContent = JSON.parse(decisionLogCall![1] as string);
      expect(logContent.decisions[0].category).toBe('general');
    });
  });

  // ---------------------------------------------------------------------------
  // Decision log writing
  // ---------------------------------------------------------------------------

  describe('decision log', () => {
    test('creates decision log with correct structure', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput('backend-system-architect', 'API designed');

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('decision-log.json')
      );
      expect(logCall).toBeDefined();

      const logContent = JSON.parse(logCall![1] as string);
      expect(logContent.schema_version).toBe('2.0.0');
      expect(logContent.decisions).toHaveLength(1);

      const decision = logContent.decisions[0];
      expect(decision.decision_id).toMatch(/^DEC-\d+-\d+$/);
      expect(decision.made_by.agent_type).toBe('backend-system-architect');
      expect(decision.made_by.instance_id).toBeDefined();
      expect(decision.status).toBe('completed');
    });

    test('appends to existing decision log', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        schema_version: '2.0.0',
        log_created_at: '2024-01-01T00:00:00Z',
        decisions: [{ decision_id: 'DEC-EXISTING' }],
      }));
      const input = createSubagentStopInput('test-generator', 'Tests done');

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('decision-log.json')
      );
      const logContent = JSON.parse(logCall![1] as string);
      expect(logContent.decisions.length).toBe(2);
    });

    test('logs failed status when error present', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput('backend-system-architect', '', {
        error: 'Agent timeout',
      });

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('decision-log.json')
      );
      const logContent = JSON.parse(logCall![1] as string);
      expect(logContent.decisions[0].status).toBe('failed');
      expect(logContent.decisions[0].description).toContain('Agent failed');
    });

    test('includes downstream agents in impact field', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput('backend-system-architect', 'Done');

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('decision-log.json')
      );
      const logContent = JSON.parse(logCall![1] as string);
      expect(logContent.decisions[0].impact.downstream_agents).toContain('frontend-ui-developer');
    });
  });

  // ---------------------------------------------------------------------------
  // Handoff context creation
  // ---------------------------------------------------------------------------

  describe('handoff context', () => {
    test('creates handoff file for downstream agent', () => {
      // Arrange
      const input = createSubagentStopInput('backend-system-architect', 'API complete');

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('backend-system-architect_to_frontend-ui-developer')
      );
      expect(handoffCall).toBeDefined();
    });

    test('handoff file has correct structure', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Tests complete');

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('_to_')
      );
      const handoff = JSON.parse(handoffCall![1] as string);

      expect(handoff.from_agent).toBe('test-generator');
      expect(handoff.to_agent).toBe('security-auditor');
      expect(handoff.status).toBe('pending');
      expect(handoff.feedback_loop).toBe(true);
      expect(handoff.session_id).toBe('test-session-fbl');
    });

    test('does not create handoff for terminal agents', () => {
      // Arrange
      const input = createSubagentStopInput('security-auditor', 'Audit done');

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('security-auditor_to_')
      );
      expect(handoffCall).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.16 Task Integration
  // ---------------------------------------------------------------------------

  describe('CC 2.1.16 task integration', () => {
    test('updates task status to completed on success', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue({
        taskId: 'task-123',
        agent: 'backend-system-architect',
        confidence: 95,
        createdAt: '2024-01-01T00:00:00Z',
        status: 'in_progress',
      });
      const input = createSubagentStopInput('backend-system-architect', 'Done');

      // Act
      feedbackLoop(input);

      // Assert
      expect(updateTaskStatus).toHaveBeenCalledWith('task-123', 'completed');
    });

    test('updates task status to failed on error', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue({
        taskId: 'task-456',
        agent: 'test-generator',
        confidence: 90,
        createdAt: '2024-01-01T00:00:00Z',
        status: 'in_progress',
      });
      const input = createSubagentStopInput('test-generator', '', {
        error: 'Tests failed',
      });

      // Act
      feedbackLoop(input);

      // Assert
      expect(updateTaskStatus).toHaveBeenCalledWith('task-456', 'failed');
    });

    test('includes task_id in decision log when present', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue({
        taskId: 'task-789',
        agent: 'frontend-ui-developer',
        confidence: 92,
        createdAt: '2024-01-01T00:00:00Z',
        status: 'in_progress',
      });
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput('frontend-ui-developer', 'UI done');

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('decision-log.json')
      );
      const logContent = JSON.parse(logCall![1] as string);
      expect(logContent.decisions[0].task_id).toBe('task-789');
    });

    test('includes task_id in handoff context when present', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue({
        taskId: 'task-abc',
        agent: 'backend-system-architect',
        confidence: 95,
        createdAt: '2024-01-01T00:00:00Z',
        status: 'in_progress',
      });
      const input = createSubagentStopInput('backend-system-architect', 'Done');

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('_to_')
      );
      const handoff = JSON.parse(handoffCall![1] as string);
      expect(handoff.task_id).toBe('task-abc');
    });

    test('handles missing task gracefully', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue(undefined);
      const input = createSubagentStopInput('database-engineer', 'Schema done');

      // Act
      const result = feedbackLoop(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(updateTaskStatus).not.toHaveBeenCalled();
    });

    test('includes task_id in system message when routing', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue({
        taskId: 'task-xyz',
        agent: 'backend-system-architect',
        confidence: 95,
        createdAt: '2024-01-01T00:00:00Z',
        status: 'in_progress',
      });
      const input = createSubagentStopInput('backend-system-architect', 'API done');

      // Act
      const result = feedbackLoop(input);

      // Assert
      expect(result.systemMessage).toContain('task-xyz');
    });
  });

  // ---------------------------------------------------------------------------
  // Pipeline-aware routing
  // ---------------------------------------------------------------------------

  describe('pipeline-aware routing', () => {
    test('uses pipeline routing when active pipeline exists', () => {
      // Arrange
      vi.mocked(getActivePipeline).mockReturnValue({
        pipelineId: 'pipeline-001',
        type: 'full-stack-feature',
        startedAt: '2024-01-01T00:00:00Z',
        taskIds: { 0: 'task-1', 1: 'task-2', 2: 'task-3' },
        currentStep: 0,
        completedSteps: [],
        status: 'running',
      });
      const input = createSubagentStopInput('backend-system-architect', 'Done');

      // Act
      const result = feedbackLoop(input);

      // Assert
      expect(result.continue).toBe(true);
      // Pipeline step 0 (backend-system-architect) should route to step 1 (frontend-ui-developer)
      expect(result.systemMessage).toContain('frontend-ui-developer');
    });

    test('falls back to static mapping when no pipeline', () => {
      // Arrange
      vi.mocked(getActivePipeline).mockReturnValue(null);
      const input = createSubagentStopInput('workflow-architect', 'Workflow done');

      // Act
      const result = feedbackLoop(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('llm-integrator');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty agent type', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
        subagent_type: '',
        agent_output: 'Some output',
      };

      // Act
      const result = feedbackLoop(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles undefined tool_input gracefully', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: undefined as any,
        subagent_type: 'backend-system-architect',
        agent_output: 'Output here',
      };

      // Act & Assert
      expect(() => feedbackLoop(input)).not.toThrow();
    });

    test('truncates long output in summary', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const longOutput = 'A'.repeat(600);
      const input = createSubagentStopInput('backend-system-architect', longOutput);

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('decision-log.json')
      );
      const logContent = JSON.parse(logCall![1] as string);
      expect(logContent.decisions[0].description.length).toBeLessThan(600);
      expect(logContent.decisions[0].description).toContain('...');
    });

    test('error string "null" is treated as error', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createSubagentStopInput('test-generator', 'Done', {
        error: 'null',
      });

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('decision-log.json')
      );
      const logContent = JSON.parse(logCall![1] as string);
      // error === 'null' is handled as NOT an error
      expect(logContent.decisions[0].status).toBe('completed');
    });

    test('handles malformed existing decision log', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('not valid json');
      const input = createSubagentStopInput('test-generator', 'Done');

      // Act & Assert
      expect(() => feedbackLoop(input)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Alternative field names
  // ---------------------------------------------------------------------------

  describe('alternative field names', () => {
    test('reads subagent_type from tool_input', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {
          subagent_type: 'backend-system-architect',
        },
        agent_output: 'API done',
      };

      // Act
      const result = feedbackLoop(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('frontend-ui-developer');
    });

    test('reads agent_type as fallback', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
        agent_type: 'test-generator',
        agent_output: 'Tests done',
      };

      // Act
      const result = feedbackLoop(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('security-auditor');
    });

    test('reads output field as fallback for agent_output', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: { subagent_type: 'backend-system-architect' },
        output: 'API designed successfully',
      };

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('decision-log.json')
      );
      const logContent = JSON.parse(logCall![1] as string);
      expect(logContent.decisions[0].description).toContain('API designed');
    });
  });

  // ---------------------------------------------------------------------------
  // Directory creation
  // ---------------------------------------------------------------------------

  describe('directory creation', () => {
    test('creates coordination directory if needed', () => {
      // Arrange
      const input = createSubagentStopInput('backend-system-architect', 'Output');

      // Act
      feedbackLoop(input);

      // Assert
      expect(mkdirSync).toHaveBeenCalled();
    });

    test('creates handoff directory if needed', () => {
      // Arrange
      const input = createSubagentStopInput('backend-system-architect', 'Output');

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(mkdirSync).mock.calls;
      const handoffDirCall = calls.find(([path]) =>
        (path as string).includes('handoffs')
      );
      expect(handoffDirCall).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  describe('logging', () => {
    test('logs feedback action to file', () => {
      // Arrange
      const input = createSubagentStopInput('backend-system-architect', 'API done');

      // Act
      feedbackLoop(input);

      // Assert
      expect(appendFileSync).toHaveBeenCalled();
      const calls = vi.mocked(appendFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('agent-feedback.log')
      );
      expect(logCall).toBeDefined();
    });

    test('logs when no downstream agents', () => {
      // Arrange
      const input = createSubagentStopInput('security-auditor', 'Audit done');

      // Act
      feedbackLoop(input);

      // Assert
      expect(appendFileSync).toHaveBeenCalled();
      const calls = vi.mocked(appendFileSync).mock.calls;
      const logEntry = calls.find(
        ([_, content]) => (content as string).includes('terminal agent')
      );
      expect(logEntry).toBeDefined();
    });

    test('logs task status update', () => {
      // Arrange
      vi.mocked(getTaskByAgent).mockReturnValue({
        taskId: 'task-log-test',
        agent: 'test-generator',
        confidence: 90,
        createdAt: '2024-01-01T00:00:00Z',
        status: 'in_progress',
      });
      const input = createSubagentStopInput('test-generator', 'Done');

      // Act
      feedbackLoop(input);

      // Assert
      const calls = vi.mocked(appendFileSync).mock.calls;
      const logEntry = calls.find(
        ([_, content]) => (content as string).includes('Updated task task-log-test')
      );
      expect(logEntry).toBeDefined();
    });
  });
});

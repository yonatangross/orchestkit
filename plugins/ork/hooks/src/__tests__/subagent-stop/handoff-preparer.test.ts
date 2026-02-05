/**
 * Handoff Preparer - SubagentStop Hook Test Suite
 *
 * Tests the handoff-preparer hook which prepares context for handoff
 * to the next agent in a pipeline. Creates handoff files and logs
 * with summaries and suggestions for downstream agents.
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

// =============================================================================
// Import under test (after mocks)
// =============================================================================

import { handoffPreparer } from '../../subagent-stop/handoff-preparer.js';
import { writeFileSync, mkdirSync } from 'node:fs';

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
    session_id: 'test-session-hp',
    tool_input: {
      subagent_type: agentType,
    },
    subagent_type: agentType,
    agent_output: agentOutput,
    ...overrides,
  };
}

// =============================================================================
// Handoff Preparer Tests
// =============================================================================

describe('handoff-preparer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Arrange: Set project dir for predictable paths
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance: Non-blocking hook
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('always returns continue: true for valid agent', () => {
      // Arrange
      const input = createSubagentStopInput('backend-system-architect', 'API designed');

      // Act
      const result = handoffPreparer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true with suppressOutput for valid agents', () => {
      // Arrange
      const input = createSubagentStopInput('frontend-ui-developer', 'UI complete');

      // Act
      const result = handoffPreparer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns continue: true for non-pipeline agents', () => {
      // Arrange
      const input = createSubagentStopInput('custom-agent', 'Output');

      // Act
      const result = handoffPreparer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns continue: true for terminal agents', () => {
      // Arrange
      const input = createSubagentStopInput('security-auditor', 'Audit complete');

      // Act
      const result = handoffPreparer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns continue: true even with empty output', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', '');

      // Act
      const result = handoffPreparer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Valid pipeline agents
  // ---------------------------------------------------------------------------

  describe('valid pipeline agents', () => {
    test.each([
      'market-intelligence',
      'product-strategist',
      'prioritization-analyst',
      'business-case-builder',
      'requirements-translator',
      'metrics-architect',
      'backend-system-architect',
      'code-quality-reviewer',
      'data-pipeline-engineer',
      'database-engineer',
      'debug-investigator',
      'frontend-ui-developer',
      'llm-integrator',
      'rapid-ui-designer',
      'security-auditor',
      'security-layer-auditor',
      'system-design-reviewer',
      'test-generator',
      'ux-researcher',
      'workflow-architect',
    ])('recognizes %s as valid pipeline agent', (agent) => {
      // Arrange
      const input = createSubagentStopInput(agent, 'Work complete');

      // Act
      const result = handoffPreparer(input);

      // Assert
      expect(result.continue).toBe(true);
      // For valid agents, handoff files should be written
      expect(writeFileSync).toHaveBeenCalled();
    });

    test('does not create handoff for unknown agent', () => {
      // Arrange
      const input = createSubagentStopInput('unknown-agent', 'Output');

      // Act
      const result = handoffPreparer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(writeFileSync).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Next agent mapping
  // ---------------------------------------------------------------------------

  describe('next agent mapping', () => {
    test.each([
      // Product thinking pipeline
      ['market-intelligence', 'product-strategist'],
      ['product-strategist', 'prioritization-analyst'],
      ['prioritization-analyst', 'business-case-builder'],
      ['business-case-builder', 'requirements-translator'],
      ['requirements-translator', 'metrics-architect'],
      ['metrics-architect', 'backend-system-architect'],
      // Full-stack pipeline
      ['backend-system-architect', 'frontend-ui-developer'],
      ['frontend-ui-developer', 'test-generator'],
      ['test-generator', 'code-quality-reviewer'],
      ['code-quality-reviewer', 'security-auditor'],
      // AI integration pipeline
      ['workflow-architect', 'llm-integrator'],
      ['llm-integrator', 'data-pipeline-engineer'],
      ['data-pipeline-engineer', 'code-quality-reviewer'],
      // Database pipeline
      ['database-engineer', 'backend-system-architect'],
      // UI pipeline
      ['rapid-ui-designer', 'frontend-ui-developer'],
      ['ux-researcher', 'rapid-ui-designer'],
    ])('maps %s to %s', (fromAgent, toAgent) => {
      // Arrange
      const input = createSubagentStopInput(fromAgent, 'Work complete');

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes(`${fromAgent}_to_${toAgent}`)
      );
      expect(handoffCall).toBeDefined();
    });

    test.each([
      'security-auditor',
      'security-layer-auditor',
      'debug-investigator',
      'system-design-reviewer',
    ])('maps %s to none (terminal agent)', (agent) => {
      // Arrange
      const input = createSubagentStopInput(agent, 'Work complete');

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes(`${agent}_to_none`)
      );
      expect(handoffCall).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Handoff suggestions
  // ---------------------------------------------------------------------------

  describe('handoff suggestions', () => {
    test.each([
      ['market-intelligence', 'product-strategist should define product vision'],
      ['product-strategist', 'prioritization-analyst should rank features'],
      ['prioritization-analyst', 'business-case-builder should create ROI'],
      ['business-case-builder', 'requirements-translator should convert to technical specs'],
      ['requirements-translator', 'metrics-architect should define success criteria'],
      ['metrics-architect', 'backend-system-architect should design API'],
      ['backend-system-architect', 'frontend-ui-developer should build UI'],
      ['frontend-ui-developer', 'test-generator should create test coverage'],
      ['test-generator', 'code-quality-reviewer should validate implementation'],
      ['code-quality-reviewer', 'security-auditor should perform security scan'],
      ['workflow-architect', 'llm-integrator should configure LLM providers'],
      ['llm-integrator', 'data-pipeline-engineer should set up embeddings'],
      ['data-pipeline-engineer', 'code-quality-reviewer should validate data pipeline'],
      ['database-engineer', 'backend-system-architect should integrate schema'],
      ['rapid-ui-designer', 'frontend-ui-developer should implement designs'],
      ['ux-researcher', 'rapid-ui-designer should create mockups'],
    ])('includes suggestion for %s handoff', (agent, suggestionPart) => {
      // Arrange
      const input = createSubagentStopInput(agent, 'Work complete');

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes(`${agent}_to_`)
      );
      const handoff = JSON.parse(handoffCall![1] as string);
      expect(handoff.suggestions).toContain(suggestionPart);
    });

    test('uses "Pipeline complete" for terminal agents', () => {
      // Arrange
      const input = createSubagentStopInput('security-auditor', 'Audit done');

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('security-auditor_to_')
      );
      const handoff = JSON.parse(handoffCall![1] as string);
      expect(handoff.suggestions).toBe('Pipeline complete');
    });
  });

  // ---------------------------------------------------------------------------
  // Handoff file structure
  // ---------------------------------------------------------------------------

  describe('handoff file structure', () => {
    test('creates handoff file with correct structure', () => {
      // Arrange
      const input = createSubagentStopInput('backend-system-architect', 'API designed');

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('handoffs')
      );
      expect(handoffCall).toBeDefined();

      const handoff = JSON.parse(handoffCall![1] as string);
      expect(handoff.from_agent).toBe('backend-system-architect');
      expect(handoff.to_agent).toBe('frontend-ui-developer');
      expect(handoff.timestamp).toBeDefined();
      expect(handoff.summary).toBeDefined();
      expect(handoff.suggestions).toBeDefined();
      expect(handoff.status).toBe('ready_for_handoff');
    });

    test('handoff file path includes timestamp', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Tests done');

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('test-generator_to_')
      );
      // Path should include date like _20260202T082647 (YYYYMMDDTHHmmss)
      expect(handoffCall![0]).toMatch(/_\d{8}T\d{6}\.json$/);
    });
  });

  // ---------------------------------------------------------------------------
  // Log file structure
  // ---------------------------------------------------------------------------

  describe('log file structure', () => {
    test('creates log file with correct content', () => {
      // Arrange
      const input = createSubagentStopInput('frontend-ui-developer', 'Components built');

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('agent-handoffs')
      );
      expect(logCall).toBeDefined();

      const logContent = logCall![1] as string;
      expect(logContent).toContain('HANDOFF PREPARATION');
      expect(logContent).toContain('From: frontend-ui-developer');
      expect(logContent).toContain('To: test-generator');
      expect(logContent).toContain('Summary:');
      expect(logContent).toContain('Next Steps:');
    });

    test('log file includes handoff file reference', () => {
      // Arrange
      const input = createSubagentStopInput('backend-system-architect', 'API done');

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const logCall = calls.find(([path]) =>
        (path as string).includes('agent-handoffs')
      );
      const logContent = logCall![1] as string;
      expect(logContent).toContain('Handoff file:');
      expect(logContent).toContain('.json');
    });
  });

  // ---------------------------------------------------------------------------
  // Summary generation
  // ---------------------------------------------------------------------------

  describe('summary generation', () => {
    test('truncates long output in summary', () => {
      // Arrange
      const longOutput = 'A'.repeat(400);
      const input = createSubagentStopInput('backend-system-architect', longOutput);

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('handoffs')
      );
      const handoff = JSON.parse(handoffCall![1] as string);
      expect(handoff.summary.length).toBeLessThanOrEqual(303); // 300 + '...'
      expect(handoff.summary).toContain('...');
    });

    test('uses full output when under 300 chars', () => {
      // Arrange
      const shortOutput = 'Short output here';
      const input = createSubagentStopInput('test-generator', shortOutput);

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('handoffs')
      );
      const handoff = JSON.parse(handoffCall![1] as string);
      expect(handoff.summary).toBe(shortOutput);
    });

    test('generates default summary for empty output', () => {
      // Arrange
      const input = createSubagentStopInput('frontend-ui-developer', '');

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('handoffs')
      );
      const handoff = JSON.parse(handoffCall![1] as string);
      expect(handoff.summary).toBe('Agent frontend-ui-developer completed');
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
      const result = handoffPreparer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // Empty agent type is not in VALID_AGENTS, so no files
      expect(writeFileSync).not.toHaveBeenCalled();
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
      expect(() => handoffPreparer(input)).not.toThrow();
    });

    test('handles output field as fallback', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: { subagent_type: 'backend-system-architect' },
        output: 'API designed via output field',
      };

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('handoffs')
      );
      const handoff = JSON.parse(handoffCall![1] as string);
      expect(handoff.summary).toContain('API designed');
    });

    test('reads subagent_type from tool_input', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {
          subagent_type: 'test-generator',
        },
        agent_output: 'Tests done',
      };

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('test-generator_to_')
      );
      expect(handoffCall).toBeDefined();
    });

    test('reads agent_type as fallback', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
        agent_type: 'frontend-ui-developer',
        agent_output: 'UI done',
      };

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('frontend-ui-developer_to_')
      );
      expect(handoffCall).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Directory creation
  // ---------------------------------------------------------------------------

  describe('directory creation', () => {
    test('creates handoffs directory if needed', () => {
      // Arrange
      const input = createSubagentStopInput('backend-system-architect', 'Output');

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(mkdirSync).mock.calls;
      const handoffDirCall = calls.find(([path]) =>
        (path as string).includes('handoffs')
      );
      expect(handoffDirCall).toBeDefined();
      expect(handoffDirCall![1]).toEqual({ recursive: true });
    });

    test('creates logs directory if needed', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Output');

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(mkdirSync).mock.calls;
      const logDirCall = calls.find(([path]) =>
        (path as string).includes('agent-handoffs')
      );
      expect(logDirCall).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Non-pipeline agent handling
  // ---------------------------------------------------------------------------

  describe('non-pipeline agent handling', () => {
    test.each([
      'Explore',
      'general-purpose',
      'custom-task',
      'unknown-type',
    ])('silently skips non-pipeline agent: %s', (agent) => {
      // Arrange
      const input = createSubagentStopInput(agent, 'Output');

      // Act
      const result = handoffPreparer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(writeFileSync).not.toHaveBeenCalled();
      expect(mkdirSync).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Timestamp format
  // ---------------------------------------------------------------------------

  describe('timestamp format', () => {
    test('uses ISO format for timestamp in handoff', () => {
      // Arrange
      const input = createSubagentStopInput('backend-system-architect', 'Done');

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('handoffs')
      );
      const handoff = JSON.parse(handoffCall![1] as string);
      // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(handoff.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('file path uses compact timestamp', () => {
      // Arrange
      const input = createSubagentStopInput('test-generator', 'Done');

      // Act
      handoffPreparer(input);

      // Assert
      const calls = vi.mocked(writeFileSync).mock.calls;
      const handoffCall = calls.find(([path]) =>
        (path as string).includes('handoffs')
      );
      // Format: YYYYMMDDTHHmmss (15 chars including T)
      expect(handoffCall![0]).toMatch(/_\d{8}T\d{6}\.json$/);
    });
  });
});

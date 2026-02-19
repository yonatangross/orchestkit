/**
 * Unit tests for pipeline-detector hook
 * Tests UserPromptSubmit hook that detects multi-agent pipeline triggers
 *
 * Features tested:
 * - Pipeline trigger detection (product-thinking, full-stack, ai-integration, security-audit)
 * - Question vs request differentiation
 * - Active pipeline detection
 * - Pipeline execution plan generation
 * - CC 2.1.9 compliance
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST be before imports
// =============================================================================

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputPromptContext: vi.fn((ctx: string) => ({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: ctx,
    },
  })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-123'),
}));

vi.mock('../../lib/orchestration-state.js', () => ({
  loadConfig: vi.fn(() => ({
    enableAutoDispatch: true,
    enableSkillInjection: true,
    maxSkillInjectionTokens: 1200,
    enableCalibration: true,
    enablePipelines: true,
    maxRetries: 3,
    retryDelayBaseMs: 1000,
  })),
}));

vi.mock('../../lib/multi-agent-coordinator.js', () => ({
  detectPipeline: vi.fn(() => null),
  createPipelineExecution: vi.fn(() => ({
    execution: {
      pipelineId: 'pipeline-123',
      type: 'product-thinking',
      startedAt: new Date().toISOString(),
      taskIds: { 0: 'task-1', 1: 'task-2' },
      currentStep: 0,
      completedSteps: [],
      status: 'running',
    },
    tasks: [
      {
        subject: 'Step 1',
        description: 'First step',
        activeForm: 'Running step 1',
        metadata: { source: 'pipeline', dispatchedAgent: 'agent-1' },
      },
    ],
  })),
  registerPipelineExecution: vi.fn(),
  formatPipelinePlan: vi.fn(() => '## Pipeline Plan\n\nMocked plan content'),
}));

vi.mock('../../lib/task-integration.js', () => ({
  getActivePipeline: vi.fn(() => undefined),
}));

import { pipelineDetector } from '../../prompt/pipeline-detector.js';
import { outputSilentSuccess, outputPromptContext } from '../../lib/common.js';
import { loadConfig } from '../../lib/orchestration-state.js';
import { detectPipeline, createPipelineExecution, registerPipelineExecution, formatPipelinePlan } from '../../lib/multi-agent-coordinator.js';
import { getActivePipeline } from '../../lib/task-integration.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create UserPromptSubmit input for testing
 */
function createPromptInput(prompt: string, overrides: Partial<HookInput> = {}): HookInput {
  return {
    hook_event: 'UserPromptSubmit',
    tool_name: 'UserPromptSubmit',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {},
    prompt,
    ...overrides,
  };
}

/**
 * Create mock pipeline definition
 */
function createPipelineDefinition(type: string, triggers: string[]) {
  return {
    type,
    name: `${type} Pipeline`,
    description: `Description for ${type}`,
    triggers,
    steps: [
      {
        agent: 'test-agent-1',
        description: 'Step 1',
        dependsOn: [],
        skills: ['skill-1'],
        estimatedTokens: 1000,
      },
      {
        agent: 'test-agent-2',
        description: 'Step 2',
        dependsOn: [0],
        skills: ['skill-2'],
        estimatedTokens: 1000,
      },
    ],
    estimatedTotalTokens: 2000,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('prompt/pipeline-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CLAUDE_PROJECT_DIR;
  });

  // ---------------------------------------------------------------------------
  // Short prompt filtering
  // ---------------------------------------------------------------------------

  describe('short prompt filtering', () => {
    test('returns silent success for prompt under 15 chars', () => {
      // Arrange
      const input = createPromptInput('build it'); // 8 chars

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(detectPipeline).not.toHaveBeenCalled();
    });

    test('returns silent success for empty prompt', () => {
      // Arrange
      const input = createPromptInput('');

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('processes prompt with exactly 15 chars', () => {
      // Arrange
      const input = createPromptInput('build a feature'); // 15 chars

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      // Should proceed to check for pipeline
    });
  });

  // ---------------------------------------------------------------------------
  // Question vs request filtering
  // ---------------------------------------------------------------------------

  describe('question vs request filtering', () => {
    test.each([
      ['what is a pipeline workflow?', 'what is'],
      ['explain how pipelines work', 'explain'],
      ['how does multi-agent work?', 'how does'],
      ['tell me about security audits', 'tell me about'],
      ['describe the full-stack feature', 'describe'],
      ['list the available agents', 'list'],
      ['show me the pipeline steps', 'show me'],
    ])('filters out question: %s (starts with "%s")', (prompt) => {
      // Arrange
      const input = createPromptInput(prompt);

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(detectPipeline).not.toHaveBeenCalled();
    });

    test('filters out short questions ending with ?', () => {
      // Arrange
      const input = createPromptInput('should we build a new feature?'); // < 100 chars with ?

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('does not filter long prompts ending with ?', () => {
      // Arrange - > 100 chars with ?
      const longPrompt = `${'a'.repeat(90)} should we build a new feature for user management?`;
      const input = createPromptInput(longPrompt);

      // Act
      const result = pipelineDetector(input);

      // Assert
      // Should proceed to check for pipeline (not filtered by question mark)
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Pipelines disabled
  // ---------------------------------------------------------------------------

  describe('pipelines disabled', () => {
    test('returns silent success when enablePipelines is false', () => {
      // Arrange
      vi.mocked(loadConfig).mockReturnValueOnce({
        enableAutoDispatch: true,
        enableSkillInjection: true,
        maxSkillInjectionTokens: 1200,
        enableCalibration: true,
        enablePipelines: false,
        maxRetries: 3,
        retryDelayBaseMs: 1000,
      });
      const input = createPromptInput('should we build a full-stack feature for user management');

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(detectPipeline).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Already in active pipeline
  // ---------------------------------------------------------------------------

  describe('already in active pipeline', () => {
    test('returns silent success when already in active pipeline', () => {
      // Arrange
      vi.mocked(getActivePipeline).mockReturnValueOnce({
        pipelineId: 'active-pipeline',
        type: 'product-thinking',
        startedAt: new Date().toISOString(),
        taskIds: {},
        currentStep: 1,
        completedSteps: [0],
        status: 'running',
      });
      const input = createPromptInput('should we build another feature for the application');

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(detectPipeline).not.toHaveBeenCalled();
    });

    test('proceeds when pipeline is not running', () => {
      // Arrange
      vi.mocked(getActivePipeline).mockReturnValueOnce({
        pipelineId: 'completed-pipeline',
        type: 'product-thinking',
        startedAt: new Date().toISOString(),
        taskIds: {},
        currentStep: 2,
        completedSteps: [0, 1, 2],
        status: 'completed',
      });
      vi.mocked(detectPipeline).mockReturnValueOnce(null);
      const input = createPromptInput('should we build a new feature for user management');

      // Act
      const _result = pipelineDetector(input);

      // Assert
      expect(detectPipeline).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Pipeline trigger detection
  // ---------------------------------------------------------------------------

  describe('pipeline trigger detection', () => {
    test('detects product-thinking pipeline trigger', () => {
      // Arrange
      const pipeline = createPipelineDefinition('product-thinking', ['should we build']);
      vi.mocked(detectPipeline).mockReturnValueOnce(pipeline);
      const input = createPromptInput('should we build a new user dashboard feature');

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputPromptContext).toHaveBeenCalled();
      expect(createPipelineExecution).toHaveBeenCalledWith(pipeline);
      expect(registerPipelineExecution).toHaveBeenCalled();
    });

    test('detects full-stack-feature pipeline trigger', () => {
      // Arrange
      const pipeline = createPipelineDefinition('full-stack-feature', ['build a full-stack feature']);
      vi.mocked(detectPipeline).mockReturnValueOnce(pipeline);
      const input = createPromptInput('build a full-stack feature for user authentication');

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputPromptContext).toHaveBeenCalled();
      expect(createPipelineExecution).toHaveBeenCalled();
    });

    test('detects ai-integration pipeline trigger', () => {
      // Arrange
      const pipeline = createPipelineDefinition('ai-integration', ['add rag', 'implement rag']);
      vi.mocked(detectPipeline).mockReturnValueOnce(pipeline);
      const input = createPromptInput('implement rag for document search in the application');

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputPromptContext).toHaveBeenCalled();
    });

    test('detects security-audit pipeline trigger', () => {
      // Arrange
      const pipeline = createPipelineDefinition('security-audit', ['security audit', 'security review']);
      vi.mocked(detectPipeline).mockReturnValueOnce(pipeline);
      const input = createPromptInput('run a security audit on the application codebase');

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputPromptContext).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // No pipeline detected
  // ---------------------------------------------------------------------------

  describe('no pipeline detected', () => {
    test('returns silent success when no pipeline matches', () => {
      // Arrange
      vi.mocked(detectPipeline).mockReturnValueOnce(null);
      const input = createPromptInput('refactor the user service class for better maintainability');

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(createPipelineExecution).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Pipeline plan formatting
  // ---------------------------------------------------------------------------

  describe('pipeline plan formatting', () => {
    test('formats pipeline plan for output', () => {
      // Arrange
      const pipeline = createPipelineDefinition('product-thinking', ['should we build']);
      vi.mocked(detectPipeline).mockReturnValueOnce(pipeline);
      vi.mocked(formatPipelinePlan).mockReturnValueOnce('## Formatted Pipeline Plan');
      const input = createPromptInput('should we build a new analytics dashboard');

      // Act
      pipelineDetector(input);

      // Assert
      expect(formatPipelinePlan).toHaveBeenCalled();
      expect(outputPromptContext).toHaveBeenCalledWith('## Formatted Pipeline Plan');
    });

    test('includes pipeline ID in output', () => {
      // Arrange
      const pipeline = createPipelineDefinition('full-stack-feature', ['full-stack feature']);
      vi.mocked(detectPipeline).mockReturnValueOnce(pipeline);
      vi.mocked(formatPipelinePlan).mockReturnValueOnce('**Pipeline ID:** `pipeline-123`');
      const input = createPromptInput('build a full-stack feature for notifications');

      // Act
      pipelineDetector(input);

      // Assert
      const outputArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(outputArg).toContain('pipeline-123');
    });
  });

  // ---------------------------------------------------------------------------
  // Pipeline registration
  // ---------------------------------------------------------------------------

  describe('pipeline registration', () => {
    test('registers pipeline execution and tasks', () => {
      // Arrange
      const pipeline = createPipelineDefinition('security-audit', ['security audit']);
      const execution = {
        pipelineId: 'pipeline-456',
        type: 'security-audit',
        startedAt: new Date().toISOString(),
        taskIds: { 0: 'task-1' },
        currentStep: 0,
        completedSteps: [],
        status: 'running' as const,
      };
      const tasks = [
        {
          subject: 'Security scan',
          description: 'Run security scan',
          activeForm: 'Scanning',
          metadata: { source: 'pipeline' as const, dispatchedAgent: 'security-auditor' },
        },
      ];
      vi.mocked(detectPipeline).mockReturnValueOnce(pipeline);
      vi.mocked(createPipelineExecution).mockReturnValueOnce({ execution, tasks });
      const input = createPromptInput('run a security audit on the application');

      // Act
      pipelineDetector(input);

      // Assert
      expect(registerPipelineExecution).toHaveBeenCalledWith(execution, tasks);
    });
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance - continue: true
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test.each([
      ['empty prompt', ''],
      ['short prompt', 'help'],
      ['question prompt', 'what is a pipeline?'],
      ['no match prompt', 'refactor the user service class'],
      ['pipeline match prompt', 'should we build a new feature'],
    ])('always returns continue: true for %s', (_, prompt) => {
      // Arrange
      const input = createPromptInput(prompt);

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('uses hookEventName: UserPromptSubmit when providing context', () => {
      // Arrange
      const pipeline = createPipelineDefinition('product-thinking', ['should we build']);
      vi.mocked(detectPipeline).mockReturnValueOnce(pipeline);
      const input = createPromptInput('should we build a user dashboard');

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.hookSpecificOutput?.hookEventName).toBe('UserPromptSubmit');
    });

    test('includes suppressOutput: true for all responses', () => {
      // Arrange
      const pipeline = createPipelineDefinition('product-thinking', ['should we build']);
      vi.mocked(detectPipeline).mockReturnValueOnce(pipeline);
      const input = createPromptInput('should we build a user dashboard');

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles prompt with special characters', () => {
      // Arrange
      const input = createPromptInput('should we build $pecial ch@rs feature <test>');

      // Act & Assert
      expect(() => pipelineDetector(input)).not.toThrow();
    });

    test('handles prompt with newlines', () => {
      // Arrange
      const input = createPromptInput('should we build\na new\nfeature');

      // Act & Assert
      expect(() => pipelineDetector(input)).not.toThrow();
    });

    test('handles very long prompts', () => {
      // Arrange
      const longPrompt = `should we build ${'a'.repeat(5000)}`;
      const input = createPromptInput(longPrompt);

      // Act & Assert
      expect(() => pipelineDetector(input)).not.toThrow();
    });

    test('handles undefined prompt gracefully', () => {
      // Arrange
      const input = createPromptInput('');
      input.prompt = undefined;

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('case insensitive trigger matching', () => {
      // Arrange
      const pipeline = createPipelineDefinition('product-thinking', ['should we build']);
      vi.mocked(detectPipeline).mockReturnValueOnce(pipeline);
      const input = createPromptInput('SHOULD WE BUILD a new feature for the app');

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // All exclusion words coverage
  // ---------------------------------------------------------------------------

  describe('all exclusion words coverage', () => {
    const EXCLUSION_WORDS = [
      'what is',
      'explain',
      'how does',
      'tell me about',
      'describe',
      'list',
      'show me',
    ];

    test.each(EXCLUSION_WORDS)('filters prompts starting with "%s"', (word) => {
      // Arrange
      const input = createPromptInput(`${word} the full-stack feature pipeline`);

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(detectPipeline).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Pipeline type coverage
  // ---------------------------------------------------------------------------

  describe('pipeline type coverage', () => {
    test.each([
      ['product-thinking', ['should we build', 'product decision']],
      ['full-stack-feature', ['full-stack feature', 'build a feature']],
      ['ai-integration', ['add rag', 'add llm', 'ai integration']],
      ['security-audit', ['security audit', 'security review']],
      ['frontend-compliance', ['frontend compliance', 'modernize frontend']],
    ])('detects %s pipeline type', (type, triggers) => {
      // Arrange
      const pipeline = createPipelineDefinition(type, triggers);
      vi.mocked(detectPipeline).mockReturnValueOnce(pipeline);
      const input = createPromptInput(`${triggers[0]} for the application system`);

      // Act
      const result = pipelineDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(createPipelineExecution).toHaveBeenCalledWith(pipeline);
    });
  });
});

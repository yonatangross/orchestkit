/**
 * Unit tests for agent-orchestrator hook
 * Tests the main UserPromptSubmit hook for agent auto-dispatch
 *
 * Features tested:
 * - Auto-dispatch at confidence >= 85%
 * - Strong recommendation at 70-84%
 * - Suggestion at 50-69%
 * - CC 2.1.9/2.1.16 compliance
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
  getPluginRoot: vi.fn(() => '/test/plugin'),
}));

vi.mock('../../lib/intent-classifier.js', () => ({
  classifyIntent: vi.fn(() => ({
    agents: [],
    skills: [],
    intent: 'general',
    confidence: 0,
    signals: [],
    shouldAutoDispatch: false,
    shouldInjectSkills: false,
  })),
  shouldClassify: vi.fn(() => true),
}));

vi.mock('../../lib/orchestration-state.js', () => ({
  loadConfig: vi.fn(() => ({
    enableAutoDispatch: true,
    enableSkillInjection: true,
    maxSkillInjectionTokens: 800,
    enableCalibration: true,
    enablePipelines: true,
    maxRetries: 3,
    retryDelayBaseMs: 1000,
  })),
  addToPromptHistory: vi.fn(),
  cacheClassification: vi.fn(),
  isAgentDispatched: vi.fn(() => false),
  trackDispatchedAgent: vi.fn(),
  getPromptHistory: vi.fn(() => []),
}));

import { agentOrchestrator } from '../../prompt/agent-orchestrator.js';
import { outputSilentSuccess, outputPromptContext } from '../../lib/common.js';
import { classifyIntent, shouldClassify } from '../../lib/intent-classifier.js';
import { loadConfig, isAgentDispatched, trackDispatchedAgent } from '../../lib/orchestration-state.js';

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
 * Create mock agent match for testing
 */
function createAgentMatch(agent: string, confidence: number, keywords: string[] = []) {
  return {
    agent,
    confidence,
    description: `${agent} agent description`,
    matchedKeywords: keywords,
    signals: [{ type: 'keyword', source: 'test', weight: confidence, matched: keywords[0] || 'test' }],
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('prompt/agent-orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CLAUDE_PROJECT_DIR;
  });

  // ---------------------------------------------------------------------------
  // Quick filter behavior
  // ---------------------------------------------------------------------------

  describe('quick filter behavior', () => {
    test('returns silent success when shouldClassify returns false', () => {
      // Arrange
      vi.mocked(shouldClassify).mockReturnValueOnce(false);
      const input = createPromptInput('short');

      // Act
      const result = agentOrchestrator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
      expect(classifyIntent).not.toHaveBeenCalled();
    });

    test('returns silent success for empty prompt', () => {
      // Arrange
      vi.mocked(shouldClassify).mockReturnValueOnce(false);
      const input = createPromptInput('');

      // Act
      const result = agentOrchestrator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });

    test('returns silent success for undefined prompt', () => {
      // Arrange
      vi.mocked(shouldClassify).mockReturnValueOnce(false);
      const input = createPromptInput('');
      input.prompt = undefined;

      // Act
      const result = agentOrchestrator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-dispatch at high confidence (85%+)
  // ---------------------------------------------------------------------------

  describe('auto-dispatch at high confidence', () => {
    test('auto-dispatches agent at 85% confidence', () => {
      // Arrange
      const match = createAgentMatch('backend-system-architect', 85, ['api', 'design']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'api-design',
        confidence: 85,
        signals: match.signals,
        shouldAutoDispatch: true,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Design an API for user management');

      // Act
      const result = agentOrchestrator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputPromptContext).toHaveBeenCalledTimes(1);
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('AUTO-DISPATCH');
      expect(contextArg).toContain('backend-system-architect');
    });

    test('auto-dispatches agent at 90% confidence', () => {
      // Arrange
      const match = createAgentMatch('database-engineer', 90, ['database', 'schema']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'database',
        confidence: 90,
        signals: match.signals,
        shouldAutoDispatch: true,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Design a database schema');

      // Act
      const result = agentOrchestrator(input);

      // Assert
      expect(outputPromptContext).toHaveBeenCalledTimes(1);
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('AUTO-DISPATCH');
      expect(contextArg).toContain('database-engineer');
    });

    test('tracks dispatched agent after auto-dispatch', () => {
      // Arrange
      const match = createAgentMatch('test-generator', 88, ['test', 'pytest']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'testing',
        confidence: 88,
        signals: match.signals,
        shouldAutoDispatch: true,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Write pytest tests for the service');

      // Act
      agentOrchestrator(input);

      // Assert
      expect(trackDispatchedAgent).toHaveBeenCalledWith('test-generator', 88);
    });

    test('includes TaskCreate instruction in auto-dispatch message', () => {
      // Arrange
      const match = createAgentMatch('security-auditor', 92, ['security', 'audit']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'security',
        confidence: 92,
        signals: match.signals,
        shouldAutoDispatch: true,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Run a security audit on the codebase');

      // Act
      agentOrchestrator(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('TaskCreate');
      expect(contextArg).toContain('security-auditor');
    });
  });

  // ---------------------------------------------------------------------------
  // Strong recommendation (70-84%)
  // ---------------------------------------------------------------------------

  describe('strong recommendation at medium-high confidence', () => {
    test('recommends agent at 75% confidence', () => {
      // Arrange
      const match = createAgentMatch('frontend-ui-developer', 75, ['react', 'component']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'frontend',
        confidence: 75,
        signals: match.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Build a React component');

      // Act
      const result = agentOrchestrator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputPromptContext).toHaveBeenCalledTimes(1);
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('RECOMMENDED');
      expect(contextArg).toContain('frontend-ui-developer');
      expect(contextArg).not.toContain('AUTO-DISPATCH');
    });

    test('recommends agent at 70% confidence (threshold)', () => {
      // Arrange
      const match = createAgentMatch('workflow-architect', 70, ['langgraph', 'workflow']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'ai-integration',
        confidence: 70,
        signals: match.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Design a LangGraph workflow');

      // Act
      agentOrchestrator(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('RECOMMENDED');
      expect(contextArg).toContain('workflow-architect');
    });

    test('recommends agent at 84% confidence (just below auto-dispatch)', () => {
      // Arrange
      const match = createAgentMatch('llm-integrator', 84, ['llm', 'api']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'ai-integration',
        confidence: 84,
        signals: match.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Integrate LLM API');

      // Act
      agentOrchestrator(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('RECOMMENDED');
      expect(contextArg).not.toContain('AUTO-DISPATCH');
    });
  });

  // ---------------------------------------------------------------------------
  // Suggestion (50-69%)
  // ---------------------------------------------------------------------------

  describe('suggestion at medium confidence', () => {
    test('suggests agent at 55% confidence', () => {
      // Arrange
      const match = createAgentMatch('performance-engineer', 55, ['performance', 'optimize']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'general',
        confidence: 55,
        signals: match.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Optimize application performance');

      // Act
      agentOrchestrator(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Consider');
      expect(contextArg).toContain('performance-engineer');
      expect(contextArg).not.toContain('RECOMMENDED');
      expect(contextArg).not.toContain('AUTO-DISPATCH');
    });

    test('suggests agent at 50% confidence (threshold)', () => {
      // Arrange
      const match = createAgentMatch('debug-investigator', 50, ['debug', 'error']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'general',
        confidence: 50,
        signals: match.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Debug an error');

      // Act
      agentOrchestrator(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Consider');
      expect(contextArg).toContain('debug-investigator');
    });

    test('suggests agent at 69% confidence', () => {
      // Arrange
      const match = createAgentMatch('accessibility-specialist', 69, ['a11y', 'accessibility']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'frontend',
        confidence: 69,
        signals: match.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Check accessibility');

      // Act
      agentOrchestrator(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Consider');
    });
  });

  // ---------------------------------------------------------------------------
  // No match or below threshold
  // ---------------------------------------------------------------------------

  describe('no match or below threshold', () => {
    test('returns silent success when no agents match', () => {
      // Arrange
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [],
        intent: 'general',
        confidence: 0,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('What is the weather today?');

      // Act
      const result = agentOrchestrator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(outputPromptContext).not.toHaveBeenCalled();
    });

    test('returns silent success when confidence below 50%', () => {
      // Arrange
      const match = createAgentMatch('code-quality-reviewer', 45, ['review']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'general',
        confidence: 45,
        signals: match.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Review something');

      // Act
      const result = agentOrchestrator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Already dispatched agent handling
  // ---------------------------------------------------------------------------

  describe('already dispatched agent handling', () => {
    test('skips agent already dispatched', () => {
      // Arrange
      vi.mocked(isAgentDispatched).mockReturnValueOnce(true);
      const match = createAgentMatch('backend-system-architect', 90, ['api']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'api-design',
        confidence: 90,
        signals: match.signals,
        shouldAutoDispatch: true,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Design an API');

      // Act
      const result = agentOrchestrator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(trackDispatchedAgent).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Alternative agent handling
  // ---------------------------------------------------------------------------

  describe('alternative agent handling', () => {
    test('includes alternative agent when second match above threshold', () => {
      // Arrange
      const match1 = createAgentMatch('backend-system-architect', 85, ['api', 'design']);
      const match2 = createAgentMatch('database-engineer', 60, ['database']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match1, match2],
        skills: [],
        intent: 'api-design',
        confidence: 85,
        signals: [...match1.signals, ...match2.signals],
        shouldAutoDispatch: true,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Design API with database schema');

      // Act
      agentOrchestrator(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Alternative');
      expect(contextArg).toContain('database-engineer');
    });

    test('excludes alternative agent when second match below threshold', () => {
      // Arrange
      const match1 = createAgentMatch('backend-system-architect', 85, ['api']);
      const match2 = createAgentMatch('code-quality-reviewer', 40, ['review']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match1, match2],
        skills: [],
        intent: 'api-design',
        confidence: 85,
        signals: match1.signals,
        shouldAutoDispatch: true,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Design an API');

      // Act
      agentOrchestrator(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).not.toContain('code-quality-reviewer');
    });
  });

  // ---------------------------------------------------------------------------
  // Config: auto-dispatch disabled
  // ---------------------------------------------------------------------------

  describe('config: auto-dispatch disabled', () => {
    test('recommends instead of auto-dispatching when disabled', () => {
      // Arrange
      vi.mocked(loadConfig).mockReturnValueOnce({
        enableAutoDispatch: false,
        enableSkillInjection: true,
        maxSkillInjectionTokens: 800,
        enableCalibration: true,
        enablePipelines: true,
        maxRetries: 3,
        retryDelayBaseMs: 1000,
      });
      const match = createAgentMatch('backend-system-architect', 90, ['api']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'api-design',
        confidence: 90,
        signals: match.signals,
        shouldAutoDispatch: true,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Design an API');

      // Act
      agentOrchestrator(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('RECOMMENDED');
      expect(contextArg).not.toContain('AUTO-DISPATCH');
      expect(trackDispatchedAgent).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance - continue: true
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test.each([
      ['empty prompt', ''],
      ['short prompt', 'help'],
      ['no match prompt', 'What is the weather?'],
      ['low confidence prompt', 'Review something'],
      ['high confidence prompt', 'Design an API for user management'],
    ])('always returns continue: true for %s', (_, prompt) => {
      // Arrange
      const input = createPromptInput(prompt);

      // Act
      const result = agentOrchestrator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('uses hookEventName: UserPromptSubmit when providing context', () => {
      // Arrange
      const match = createAgentMatch('backend-system-architect', 85, ['api']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'api-design',
        confidence: 85,
        signals: match.signals,
        shouldAutoDispatch: true,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Design an API');

      // Act
      const result = agentOrchestrator(input);

      // Assert
      expect(result.hookSpecificOutput?.hookEventName).toBe('UserPromptSubmit');
    });

    test('includes suppressOutput: true for all responses', () => {
      // Arrange
      const match = createAgentMatch('backend-system-architect', 85, ['api']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'api-design',
        confidence: 85,
        signals: match.signals,
        shouldAutoDispatch: true,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Design an API');

      // Act
      const result = agentOrchestrator(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles prompts with special characters', () => {
      // Arrange
      const input = createPromptInput('Design API for $pecial ch@rs! <test>');

      // Act & Assert
      expect(() => agentOrchestrator(input)).not.toThrow();
    });

    test('handles prompts with newlines', () => {
      // Arrange
      const input = createPromptInput('Design an API\nwith multiple\nlines');

      // Act & Assert
      expect(() => agentOrchestrator(input)).not.toThrow();
    });

    test('handles very long prompts', () => {
      // Arrange
      const longPrompt = 'Design an API ' + 'a'.repeat(5000);
      const input = createPromptInput(longPrompt);

      // Act & Assert
      expect(() => agentOrchestrator(input)).not.toThrow();
    });

    test('handles prompts with unicode characters', () => {
      // Arrange
      const input = createPromptInput('Design API for users in Japanese');

      // Act & Assert
      expect(() => agentOrchestrator(input)).not.toThrow();
    });

    test('does not throw on classification error', () => {
      // Arrange
      vi.mocked(classifyIntent).mockImplementationOnce(() => {
        throw new Error('Classification failed');
      });
      const input = createPromptInput('Design an API');

      // Act & Assert
      expect(() => agentOrchestrator(input)).toThrow('Classification failed');
    });
  });

  // ---------------------------------------------------------------------------
  // Confidence threshold boundaries
  // ---------------------------------------------------------------------------

  describe('confidence threshold boundaries', () => {
    test.each([
      [49, 'silent'],
      [50, 'suggest'],
      [69, 'suggest'],
      [70, 'recommend'],
      [84, 'recommend'],
      [85, 'auto-dispatch'],
      [100, 'auto-dispatch'],
    ])('at %d%% confidence, behavior is %s', (confidence, expectedBehavior) => {
      // Arrange
      const match = createAgentMatch('test-agent', confidence, ['keyword']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'general',
        confidence,
        signals: match.signals,
        shouldAutoDispatch: confidence >= 85,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Test prompt');

      // Act
      const result = agentOrchestrator(input);

      // Assert
      expect(result.continue).toBe(true);

      if (expectedBehavior === 'silent') {
        expect(outputSilentSuccess).toHaveBeenCalled();
      } else if (expectedBehavior === 'suggest') {
        const ctx = vi.mocked(outputPromptContext).mock.calls[0]?.[0] || '';
        expect(ctx).toContain('Consider');
      } else if (expectedBehavior === 'recommend') {
        const ctx = vi.mocked(outputPromptContext).mock.calls[0]?.[0] || '';
        expect(ctx).toContain('RECOMMENDED');
      } else if (expectedBehavior === 'auto-dispatch') {
        const ctx = vi.mocked(outputPromptContext).mock.calls[0]?.[0] || '';
        expect(ctx).toContain('AUTO-DISPATCH');
      }
    });
  });
});

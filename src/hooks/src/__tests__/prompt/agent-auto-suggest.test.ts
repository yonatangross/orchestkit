/**
 * Unit tests for agent-auto-suggest hook (dedicated test file)
 * Tests the LEGACY UserPromptSubmit hook for backward-compatible agent suggestions
 *
 * This is the legacy hook maintained for backward compatibility.
 * The new agent-orchestrator.ts provides full orchestration with task integration.
 *
 * Features tested:
 * - Defers to agent-orchestrator when auto-dispatch enabled
 * - Agent suggestion at different confidence levels
 * - Intent classifier integration
 * - Calibration adjustments
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

vi.mock('../../lib/calibration-engine.js', () => ({
  getAdjustments: vi.fn(() => []),
}));

vi.mock('../../lib/orchestration-state.js', () => ({
  loadConfig: vi.fn(() => ({
    enableAutoDispatch: false, // Default: auto-dispatch disabled so this hook runs
    enableSkillInjection: true,
    maxSkillInjectionTokens: 800,
    enableCalibration: true,
    enablePipelines: true,
    maxRetries: 3,
    retryDelayBaseMs: 1000,
  })),
  getPromptHistory: vi.fn(() => []),
}));

import { agentAutoSuggest } from '../../prompt/agent-auto-suggest.js';
import { outputSilentSuccess, outputPromptContext, logHook } from '../../lib/common.js';
import { classifyIntent, shouldClassify } from '../../lib/intent-classifier.js';
import { loadConfig, getPromptHistory } from '../../lib/orchestration-state.js';
import { getAdjustments } from '../../lib/calibration-engine.js';

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
    signals: [{ type: 'keyword', source: 'keyword-match', weight: confidence, matched: keywords[0] || 'test' }],
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('prompt/agent-auto-suggest', () => {
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
      const result = agentAutoSuggest(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(classifyIntent).not.toHaveBeenCalled();
    });

    test('returns silent success for empty prompt', () => {
      // Arrange
      vi.mocked(shouldClassify).mockReturnValueOnce(false);
      const input = createPromptInput('');

      // Act
      const result = agentAutoSuggest(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Defers to agent-orchestrator
  // ---------------------------------------------------------------------------

  describe('defers to agent-orchestrator', () => {
    test('returns silent success when enableAutoDispatch is true', () => {
      // Arrange
      vi.mocked(loadConfig).mockReturnValueOnce({
        enableAutoDispatch: true, // Auto-dispatch enabled
        enableSkillInjection: true,
        maxSkillInjectionTokens: 800,
        enableCalibration: true,
        enablePipelines: true,
        maxRetries: 3,
        retryDelayBaseMs: 1000,
      });
      const input = createPromptInput('Design an API');

      // Act
      const result = agentAutoSuggest(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
      expect(logHook).toHaveBeenCalledWith(
        'agent-auto-suggest',
        'Deferring to agent-orchestrator (auto-dispatch enabled)'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // High confidence (85%+) - Strong directive
  // ---------------------------------------------------------------------------

  describe('high confidence suggestions (85%+)', () => {
    test('outputs Detected header at 85% confidence', () => {
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
      const result = agentAutoSuggest(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputPromptContext).toHaveBeenCalled();
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Detected:');
      expect(contextArg).toContain('backend-system-architect');
    });

    test('outputs Detected header at 90% confidence', () => {
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
      agentAutoSuggest(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Detected:');
    });

    test('includes Using agent and skill suggestions in high confidence message', () => {
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
      const input = createPromptInput('Write tests');

      // Act
      agentAutoSuggest(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Using `test-generator`');
      expect(contextArg).toContain('Or use a skill:');
    });
  });

  // ---------------------------------------------------------------------------
  // Medium-high confidence (70-84%) - Recommendation
  // ---------------------------------------------------------------------------

  describe('medium-high confidence suggestions (70-84%)', () => {
    test('outputs Suggested at 75% confidence', () => {
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
      agentAutoSuggest(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Suggested:');
      expect(contextArg).toContain('frontend-ui-developer');
      expect(contextArg).not.toContain('Detected:');
    });

    test('outputs Suggested at 70% confidence (threshold)', () => {
      // Arrange
      const match = createAgentMatch('workflow-architect', 70, ['langgraph']);
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
      agentAutoSuggest(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Suggested:');
    });

    test('outputs Suggested at 84% confidence', () => {
      // Arrange
      const match = createAgentMatch('llm-integrator', 84, ['llm']);
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
      agentAutoSuggest(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Suggested:');
      expect(contextArg).not.toContain('Detected:');
    });

    test('includes agent name and skill suggestions in recommendation', () => {
      // Arrange
      const match = createAgentMatch('security-auditor', 78, ['security']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'security',
        confidence: 78,
        signals: match.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Review security');

      // Act
      agentAutoSuggest(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('security-auditor');
      expect(contextArg).toContain('Or try a skill:');
    });
  });

  // ---------------------------------------------------------------------------
  // Medium confidence (50-69%) - Suggestion
  // ---------------------------------------------------------------------------

  describe('medium confidence suggestions (50-69%)', () => {
    test('outputs Possible match at 55% confidence', () => {
      // Arrange
      const match = createAgentMatch('performance-engineer', 55, ['performance']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'general',
        confidence: 55,
        signals: match.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Optimize performance');

      // Act
      agentAutoSuggest(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Possible match');
      expect(contextArg).toContain('performance-engineer');
      expect(contextArg).not.toContain('Suggested:');
    });

    test('outputs Possible match at 50% confidence (threshold)', () => {
      // Arrange
      const match = createAgentMatch('debug-investigator', 50, ['debug']);
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
      agentAutoSuggest(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Possible match');
    });

    test('outputs Possible match at 69% confidence', () => {
      // Arrange
      const match = createAgentMatch('accessibility-specialist', 69, ['a11y']);
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
      agentAutoSuggest(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Possible match');
      expect(contextArg).not.toContain('Suggested:');
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
      const input = createPromptInput('What is the weather?');

      // Act
      const result = agentAutoSuggest(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
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
      const result = agentAutoSuggest(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Alternative agent handling
  // ---------------------------------------------------------------------------

  describe('alternative agent handling', () => {
    test('includes alternative agent when second match above threshold', () => {
      // Arrange
      const match1 = createAgentMatch('backend-system-architect', 85, ['api']);
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
      const input = createPromptInput('Design API with database');

      // Act
      agentAutoSuggest(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Also consider:');
      expect(contextArg).toContain('database-engineer');
    });

    test('limits suggestions to MAX_SUGGESTIONS (2)', () => {
      // Arrange
      const match1 = createAgentMatch('agent-1', 90, ['k1']);
      const match2 = createAgentMatch('agent-2', 80, ['k2']);
      const match3 = createAgentMatch('agent-3', 70, ['k3']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match1, match2, match3],
        skills: [],
        intent: 'general',
        confidence: 90,
        signals: [],
        shouldAutoDispatch: true,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Multi-agent prompt');

      // Act
      agentAutoSuggest(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('agent-1');
      expect(contextArg).toContain('agent-2');
      expect(contextArg).not.toContain('agent-3');
    });
  });

  // ---------------------------------------------------------------------------
  // Calibration adjustments integration
  // ---------------------------------------------------------------------------

  describe('calibration adjustments integration', () => {
    test('passes calibration adjustments to classifyIntent', () => {
      // Arrange
      const adjustments = [{ keyword: 'api', agent: 'backend-system-architect', adjustment: 5, sampleCount: 3, lastUpdated: new Date().toISOString() }];
      vi.mocked(getAdjustments).mockReturnValueOnce(adjustments);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [],
        intent: 'general',
        confidence: 0,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Design an API');

      // Act
      agentAutoSuggest(input);

      // Assert
      expect(classifyIntent).toHaveBeenCalledWith(
        'Design an API',
        expect.any(Array),
        adjustments
      );
    });

    test('passes prompt history to classifyIntent', () => {
      // Arrange
      const history = ['Previous prompt 1', 'Previous prompt 2'];
      vi.mocked(getPromptHistory).mockReturnValueOnce(history);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [],
        intent: 'general',
        confidence: 0,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Current prompt');

      // Act
      agentAutoSuggest(input);

      // Assert
      expect(classifyIntent).toHaveBeenCalledWith(
        'Current prompt',
        history,
        expect.any(Array)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance - continue: true
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test.each([
      ['empty prompt', ''],
      ['short prompt', 'help'],
      ['no match', 'What is the weather?'],
      ['low confidence', 'Review something'],
      ['high confidence', 'Design an API'],
    ])('always returns continue: true for %s', (_, prompt) => {
      // Arrange
      const input = createPromptInput(prompt);

      // Act
      const result = agentAutoSuggest(input);

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
      const result = agentAutoSuggest(input);

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
      const result = agentAutoSuggest(input);

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
      const input = createPromptInput('Design API for $pecial ch@rs <test>');

      // Act & Assert
      expect(() => agentAutoSuggest(input)).not.toThrow();
    });

    test('handles prompt with newlines', () => {
      // Arrange
      const input = createPromptInput('Design\nan\nAPI');

      // Act & Assert
      expect(() => agentAutoSuggest(input)).not.toThrow();
    });

    test('handles very long prompts', () => {
      // Arrange
      const longPrompt = 'Design an API ' + 'a'.repeat(5000);
      const input = createPromptInput(longPrompt);

      // Act & Assert
      expect(() => agentAutoSuggest(input)).not.toThrow();
    });

    test('handles undefined prompt gracefully', () => {
      // Arrange
      vi.mocked(shouldClassify).mockReturnValueOnce(false);
      const input = createPromptInput('');
      input.prompt = undefined;

      // Act
      const result = agentAutoSuggest(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Confidence threshold boundary tests
  // ---------------------------------------------------------------------------

  describe('confidence threshold boundary tests', () => {
    test.each([
      [49, 'silent'],
      [50, 'suggest'],
      [69, 'suggest'],
      [70, 'recommend'],
      [84, 'recommend'],
      [85, 'dispatch'],
      [100, 'dispatch'],
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
      const result = agentAutoSuggest(input);

      // Assert
      expect(result.continue).toBe(true);

      if (expectedBehavior === 'silent') {
        expect(outputSilentSuccess).toHaveBeenCalled();
      } else if (expectedBehavior === 'suggest') {
        const ctx = vi.mocked(outputPromptContext).mock.calls[0]?.[0] || '';
        expect(ctx).toContain('Possible match');
      } else if (expectedBehavior === 'recommend') {
        const ctx = vi.mocked(outputPromptContext).mock.calls[0]?.[0] || '';
        expect(ctx).toContain('Suggested:');
      } else if (expectedBehavior === 'dispatch') {
        const ctx = vi.mocked(outputPromptContext).mock.calls[0]?.[0] || '';
        expect(ctx).toContain('Detected:');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Logging behavior
  // ---------------------------------------------------------------------------

  describe('logging behavior', () => {
    test('logs analyzing message when classification runs', () => {
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
      const input = createPromptInput('Design an API');

      // Act
      agentAutoSuggest(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'agent-auto-suggest',
        'Analyzing prompt with intent classifier...'
      );
    });

    test('logs no matches message when no agents found', () => {
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
      const input = createPromptInput('What is the weather?');

      // Act
      agentAutoSuggest(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith('agent-auto-suggest', 'No agent matches found');
    });

    test('logs found matches when agents are found', () => {
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
      agentAutoSuggest(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'agent-auto-suggest',
        expect.stringContaining('Found matches')
      );
    });

    test('logs suggestion message when outputting context', () => {
      // Arrange
      const match = createAgentMatch('test-generator', 85, ['test']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [match],
        skills: [],
        intent: 'testing',
        confidence: 85,
        signals: match.signals,
        shouldAutoDispatch: true,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Write tests');

      // Act
      agentAutoSuggest(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'agent-auto-suggest',
        'Suggesting test-generator at 85%'
      );
    });
  });
});

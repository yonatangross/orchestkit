/**
 * Unit tests for skill-injector hook
 * Tests UserPromptSubmit hook that auto-injects skill content at confidence >= 80%
 *
 * Features tested:
 * - Skill content loading and truncation
 * - Confidence threshold (80%)
 * - Token budget management
 * - Already injected skill tracking
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
  isSkillInjected: vi.fn(() => false),
  trackInjectedSkill: vi.fn(),
  getLastClassification: vi.fn(() => undefined),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => `---
name: test-skill
description: Test skill description
---

# Test Skill

This is test skill content.

## Overview

Detailed content here.
`),
}));

import { skillInjector } from '../../prompt/skill-injector.js';
import { outputSilentSuccess, outputPromptContext } from '../../lib/common.js';
import { classifyIntent, shouldClassify } from '../../lib/intent-classifier.js';
import { loadConfig, isSkillInjected, trackInjectedSkill, getLastClassification } from '../../lib/orchestration-state.js';
import { existsSync, readFileSync } from 'node:fs';

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
 * Create mock skill match
 */
function createSkillMatch(skill: string, confidence: number, keywords: string[] = []) {
  return {
    skill,
    confidence,
    description: `${skill} skill description`,
    matchedKeywords: keywords,
    signals: [{ type: 'keyword', source: 'skill-keyword', weight: confidence, matched: keywords[0] || 'test' }],
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('prompt/skill-injector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLAUDE_PROJECT_DIR = '/test/project';

    // Reset ALL mocks to default working state after clearAllMocks
    // (clearAllMocks clears mock return values too)

    // Common lib mocks
    vi.mocked(outputSilentSuccess).mockReturnValue({ continue: true, suppressOutput: true });
    vi.mocked(outputPromptContext).mockImplementation((ctx: string) => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: ctx,
      },
    }));

    // Intent classifier mocks
    vi.mocked(shouldClassify).mockReturnValue(true);
    vi.mocked(classifyIntent).mockReturnValue({
      agents: [],
      skills: [],
      intent: 'general',
      confidence: 0,
      signals: [],
      shouldAutoDispatch: false,
      shouldInjectSkills: false,
    });

    // Orchestration state mocks
    vi.mocked(loadConfig).mockReturnValue({
      enableAutoDispatch: true,
      enableSkillInjection: true,
      maxSkillInjectionTokens: 800,
      enableCalibration: true,
      enablePipelines: true,
      maxRetries: 3,
      retryDelayBaseMs: 1000,
    });
    vi.mocked(isSkillInjected).mockReturnValue(false);
    vi.mocked(trackInjectedSkill).mockReturnValue(undefined);
    vi.mocked(getLastClassification).mockReturnValue(undefined);

    // FS mocks
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(`---
name: test-skill
description: Test skill description
---

# Test Skill

This is test skill content.

## Overview

Detailed content here.
`);
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
      const result = skillInjector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success for empty prompt', () => {
      // Arrange
      vi.mocked(shouldClassify).mockReturnValueOnce(false);
      const input = createPromptInput('');

      // Act
      const result = skillInjector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Skill injection disabled
  // ---------------------------------------------------------------------------

  describe('skill injection disabled', () => {
    test('returns silent success when enableSkillInjection is false', () => {
      // Arrange
      vi.mocked(loadConfig).mockReturnValueOnce({
        enableAutoDispatch: true,
        enableSkillInjection: false,
        maxSkillInjectionTokens: 800,
        enableCalibration: true,
        enablePipelines: true,
        maxRetries: 3,
        retryDelayBaseMs: 1000,
      });
      const input = createPromptInput('Design an API');

      // Act
      const result = skillInjector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Confidence threshold (80%)
  // ---------------------------------------------------------------------------

  describe('confidence threshold', () => {
    test('injects skill at exactly 80% confidence', () => {
      // Arrange
      const skillMatch = createSkillMatch('api-design-framework', 80, ['api', 'design']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [skillMatch],
        intent: 'api-design',
        confidence: 80,
        signals: skillMatch.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      const input = createPromptInput('Design an API for user management');

      // Act
      const result = skillInjector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputPromptContext).toHaveBeenCalled();
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Loaded: `api-design-framework`');
    });

    test('injects skill at 90% confidence', () => {
      // Arrange
      const skillMatch = createSkillMatch('database-schema-designer', 90, ['database', 'schema']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [skillMatch],
        intent: 'database',
        confidence: 90,
        signals: skillMatch.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      const input = createPromptInput('Design a database schema');

      // Act
      const result = skillInjector(input);

      // Assert
      expect(outputPromptContext).toHaveBeenCalled();
    });

    test('does not inject skill at 79% confidence', () => {
      // Arrange
      const skillMatch = createSkillMatch('integration-testing', 79, ['test']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [skillMatch],
        intent: 'testing',
        confidence: 79,
        signals: skillMatch.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Write some tests');

      // Act
      const result = skillInjector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Already injected skill tracking
  // ---------------------------------------------------------------------------

  describe('already injected skill tracking', () => {
    test('skips skill already injected in session', () => {
      // Arrange
      vi.mocked(isSkillInjected).mockReturnValueOnce(true);
      const skillMatch = createSkillMatch('api-design-framework', 85, ['api']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [skillMatch],
        intent: 'api-design',
        confidence: 85,
        signals: skillMatch.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      const input = createPromptInput('Design another API');

      // Act
      const result = skillInjector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('tracks injected skill after injection', () => {
      // Arrange
      const skillMatch = createSkillMatch('fastapi-advanced', 85, ['fastapi']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [skillMatch],
        intent: 'api-design',
        confidence: 85,
        signals: skillMatch.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      const input = createPromptInput('Create a FastAPI application');

      // Act
      skillInjector(input);

      // Assert
      expect(trackInjectedSkill).toHaveBeenCalledWith('fastapi-advanced');
    });
  });

  // ---------------------------------------------------------------------------
  // Cached classification usage
  // ---------------------------------------------------------------------------

  describe('cached classification usage', () => {
    test('uses cached classification when available', () => {
      // Arrange
      const skillMatch = createSkillMatch('react-server-components-framework', 85, ['react']);
      vi.mocked(getLastClassification).mockReturnValueOnce({
        agents: [],
        skills: [skillMatch],
        intent: 'frontend',
        confidence: 85,
        signals: skillMatch.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      const input = createPromptInput('Build a React component');

      // Act
      skillInjector(input);

      // Assert
      expect(classifyIntent).not.toHaveBeenCalled();
    });

    test('runs classification when no cached result', () => {
      // Arrange
      vi.mocked(getLastClassification).mockReturnValueOnce(undefined);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [],
        intent: 'general',
        confidence: 0,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Build a React component');

      // Act
      skillInjector(input);

      // Assert
      expect(classifyIntent).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Skill file loading
  // ---------------------------------------------------------------------------

  describe('skill file loading', () => {
    test('removes frontmatter from skill content', () => {
      // Arrange
      const skillMatch = createSkillMatch('test-skill', 85, ['test']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [skillMatch],
        intent: 'testing',
        confidence: 85,
        signals: skillMatch.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(readFileSync).mockReturnValueOnce(`---
name: test-skill
description: Test description
---

# Test Skill Content

This is the actual content.
`);
      const input = createPromptInput('Write tests');

      // Act
      skillInjector(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).not.toContain('description: Test description');
      expect(contextArg).toContain('Test Skill Content');
    });

    test('handles skill file not found gracefully', () => {
      // Arrange
      const skillMatch = createSkillMatch('nonexistent-skill', 85, ['nonexistent']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [skillMatch],
        intent: 'general',
        confidence: 85,
        signals: skillMatch.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(existsSync).mockReturnValueOnce(false);
      const input = createPromptInput('Do something');

      // Act
      const result = skillInjector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('handles file read error gracefully', () => {
      // Arrange
      const skillMatch = createSkillMatch('error-skill', 85, ['error']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [skillMatch],
        intent: 'general',
        confidence: 85,
        signals: skillMatch.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(readFileSync).mockImplementationOnce(() => {
        throw new Error('Read error');
      });
      const input = createPromptInput('Do something');

      // Act
      const result = skillInjector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Token budget management
  // ---------------------------------------------------------------------------

  describe('token budget management', () => {
    test('truncates long skill content to token budget', () => {
      // Arrange
      const longContent = '# Skill\n\n' + 'a'.repeat(5000) + '\n\n## Section\n\nMore content';
      vi.mocked(readFileSync).mockReturnValueOnce(`---
name: long-skill
---

${longContent}
`);
      const skillMatch = createSkillMatch('long-skill', 85, ['long']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [skillMatch],
        intent: 'general',
        confidence: 85,
        signals: skillMatch.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      const input = createPromptInput('Need this skill');

      // Act
      skillInjector(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('truncated for context budget');
    });

    test('respects maxSkillInjectionTokens config', () => {
      // Arrange
      vi.mocked(loadConfig).mockReturnValueOnce({
        enableAutoDispatch: true,
        enableSkillInjection: true,
        maxSkillInjectionTokens: 200, // Lower budget
        enableCalibration: true,
        enablePipelines: true,
        maxRetries: 3,
        retryDelayBaseMs: 1000,
      });
      vi.mocked(readFileSync).mockReturnValueOnce(`---
name: test-skill
---

# Skill

${'a'.repeat(1000)}
`);
      const skillMatch = createSkillMatch('test-skill', 85, ['test']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [skillMatch],
        intent: 'general',
        confidence: 85,
        signals: skillMatch.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      const input = createPromptInput('Test');

      // Act
      skillInjector(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('truncated');
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple skills injection
  // ---------------------------------------------------------------------------

  describe('multiple skills injection', () => {
    test('limits to MAX_SKILLS_PER_PROMPT (2)', () => {
      // Arrange
      const skills = [
        createSkillMatch('skill-1', 90, ['keyword1']),
        createSkillMatch('skill-2', 85, ['keyword2']),
        createSkillMatch('skill-3', 82, ['keyword3']),
      ];
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills,
        intent: 'general',
        confidence: 90,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(readFileSync).mockReturnValue(`---
name: test
---

# Content
`);
      const input = createPromptInput('Multi-skill prompt');

      // Act
      skillInjector(input);

      // Assert
      expect(trackInjectedSkill).toHaveBeenCalledTimes(2);
    });

    test('divides token budget among multiple skills', () => {
      // Arrange
      const skills = [
        createSkillMatch('skill-1', 90, ['keyword1']),
        createSkillMatch('skill-2', 85, ['keyword2']),
      ];
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills,
        intent: 'general',
        confidence: 90,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(readFileSync).mockReturnValue(`---
name: test
---

# Content

Short content.
`);
      const input = createPromptInput('Multi-skill prompt');

      // Act
      skillInjector(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('skill-1');
      expect(contextArg).toContain('skill-2');
    });
  });

  // ---------------------------------------------------------------------------
  // No eligible skills
  // ---------------------------------------------------------------------------

  describe('no eligible skills', () => {
    test('returns silent success when no skills above threshold', () => {
      // Arrange
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [createSkillMatch('low-conf-skill', 50, ['test'])],
        intent: 'general',
        confidence: 50,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      const input = createPromptInput('Some prompt');

      // Act
      const result = skillInjector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success when all skills already injected', () => {
      // Arrange
      vi.mocked(isSkillInjected).mockReturnValue(true);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [createSkillMatch('already-injected', 85, ['test'])],
        intent: 'general',
        confidence: 85,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      const input = createPromptInput('Some prompt');

      // Act
      const result = skillInjector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance - continue: true
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test.each([
      ['empty prompt', ''],
      ['short prompt', 'help'],
      ['no skill match', 'Random unrelated text'],
      ['low confidence', 'Some testing'],
      ['high confidence', 'Design a REST API'],
    ])('always returns continue: true for %s', (_, prompt) => {
      // Arrange
      const input = createPromptInput(prompt);

      // Act
      const result = skillInjector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('uses hookEventName: UserPromptSubmit when providing context', () => {
      // Arrange
      const skillMatch = createSkillMatch('test-skill', 85, ['test']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [skillMatch],
        intent: 'testing',
        confidence: 85,
        signals: skillMatch.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      const input = createPromptInput('Write tests');

      // Act
      const result = skillInjector(input);

      // Assert
      expect(result.hookSpecificOutput?.hookEventName).toBe('UserPromptSubmit');
    });

    test('includes suppressOutput: true for all responses', () => {
      // Arrange
      const skillMatch = createSkillMatch('test-skill', 85, ['test']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [skillMatch],
        intent: 'testing',
        confidence: 85,
        signals: skillMatch.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      const input = createPromptInput('Write tests');

      // Act
      const result = skillInjector(input);

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
      const input = createPromptInput('Design API with $pecial ch@rs <test>');

      // Act & Assert
      expect(() => skillInjector(input)).not.toThrow();
    });

    test('handles prompt with newlines', () => {
      // Arrange
      const input = createPromptInput('Design\nan\nAPI');

      // Act & Assert
      expect(() => skillInjector(input)).not.toThrow();
    });

    test('handles very long prompts', () => {
      // Arrange
      const longPrompt = 'Design an API ' + 'a'.repeat(5000);
      const input = createPromptInput(longPrompt);

      // Act & Assert
      expect(() => skillInjector(input)).not.toThrow();
    });

    test('handles undefined prompt gracefully', () => {
      // Arrange
      vi.mocked(shouldClassify).mockReturnValueOnce(false);
      const input = createPromptInput('');
      input.prompt = undefined;

      // Act
      const result = skillInjector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles skill content without frontmatter', () => {
      // Arrange
      vi.mocked(readFileSync).mockReturnValue('# Skill Content\n\nNo frontmatter here.');
      const skillMatch = createSkillMatch('no-frontmatter', 85, ['test']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [skillMatch],
        intent: 'general',
        confidence: 85,
        signals: skillMatch.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      const input = createPromptInput('Test prompt');

      // Act
      skillInjector(input);

      // Assert
      expect(outputPromptContext).toHaveBeenCalled();
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('Skill Content');
    });
  });

  // ---------------------------------------------------------------------------
  // Confidence threshold boundary tests
  // ---------------------------------------------------------------------------

  describe('confidence threshold boundary tests', () => {
    test.each([
      [79, false],
      [80, true],
      [81, true],
      [100, true],
    ])('at %d%% confidence, injects=%s', (confidence, shouldInject) => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(`---
name: test-skill
---

# Test Skill Content
`);
      const skillMatch = createSkillMatch('test-skill', confidence, ['keyword']);
      vi.mocked(classifyIntent).mockReturnValueOnce({
        agents: [],
        skills: [skillMatch],
        intent: 'general',
        confidence,
        signals: skillMatch.signals,
        shouldAutoDispatch: false,
        shouldInjectSkills: confidence >= 80,
      });
      const input = createPromptInput('Test prompt');

      // Act
      skillInjector(input);

      // Assert
      if (shouldInject) {
        expect(outputPromptContext).toHaveBeenCalled();
      } else {
        expect(outputSilentSuccess).toHaveBeenCalled();
      }
    });
  });
});

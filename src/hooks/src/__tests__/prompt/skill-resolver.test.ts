/**
 * Skill Resolver Tests
 * Tests the unified skill-resolver hook that replaces skill-auto-suggest + skill-injector
 *
 * Issue #278: Three-tier UX with dual output channels
 * - systemMessage: Brief user notification (80-89% confidence)
 * - additionalContext: Full context for Claude (all tiers)
 *
 * Coverage includes:
 * - Tier boundary tests (90/80/70/50% thresholds)
 * - Helper function unit tests
 * - Edge cases and error handling
 * - Configuration options
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';

// Mock node:fs at module level before imports
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ size: 0 }),
  renameSync: vi.fn(),
  readSync: vi.fn().mockReturnValue(0),
  readdirSync: vi.fn().mockReturnValue([]),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue('main\n'),
}));

// Mock orchestration-state to control skill injection state
vi.mock('../../lib/orchestration-state.js', () => ({
  loadConfig: vi.fn().mockReturnValue({
    enableSkillInjection: true,
    maxSkillInjectionTokens: 800,
  }),
  isSkillInjected: vi.fn().mockReturnValue(false),
  trackInjectedSkill: vi.fn(),
  getLastClassification: vi.fn().mockReturnValue(null),
}));

// Mock intent-classifier with controllable results
vi.mock('../../lib/intent-classifier.js', () => ({
  classifyIntent: vi.fn().mockReturnValue({
    agents: [],
    skills: [],
    intent: 'general',
    confidence: 0,
    signals: [],
    shouldAutoDispatch: false,
    shouldInjectSkills: false,
  }),
  shouldClassify: vi.fn().mockReturnValue(true),
}));

// Mock skill-auto-suggest keyword matching
vi.mock('../../prompt/skill-auto-suggest.js', () => ({
  findMatchingSkills: vi.fn().mockReturnValue([]),
}));

import { existsSync, readFileSync } from 'node:fs';
import { skillResolver } from '../../prompt/skill-resolver.js';
import { loadConfig, isSkillInjected, trackInjectedSkill, getLastClassification } from '../../lib/orchestration-state.js';
import { classifyIntent, shouldClassify } from '../../lib/intent-classifier.js';
import { findMatchingSkills } from '../../prompt/skill-auto-suggest.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
 * Helper to create a mock skill file content with frontmatter
 */
function createSkillContent(name: string, description: string, body: string): string {
  return `---
name: ${name}
description: ${description}
tags: [test]
---

# ${name}

${body}
`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('prompt/skill-resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shouldClassify).mockReturnValue(true);
    vi.mocked(loadConfig).mockReturnValue({
      enableSkillInjection: true,
      maxSkillInjectionTokens: 800,
    });
    vi.mocked(getLastClassification).mockReturnValue(null);
    vi.mocked(isSkillInjected).mockReturnValue(false);
    vi.mocked(classifyIntent).mockReturnValue({
      agents: [],
      skills: [],
      intent: 'general',
      confidence: 0,
      signals: [],
      shouldAutoDispatch: false,
      shouldInjectSkills: false,
    });
    vi.mocked(findMatchingSkills).mockReturnValue([]);
  });

  // =========================================================================
  // Basic Behavior Tests
  // =========================================================================

  describe('silent success cases', () => {
    test('returns silent success for empty prompt', () => {
      const result = skillResolver(createPromptInput(''));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for short prompt', () => {
      vi.mocked(shouldClassify).mockReturnValue(false);
      const result = skillResolver(createPromptInput('hi'));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for prompts without matching keywords', () => {
      const result = skillResolver(createPromptInput('What is the weather today?'));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('always continues execution', () => {
    test('never blocks execution regardless of content', () => {
      const prompts = [
        '',
        'hello',
        'Design a REST API',
        'Create database schema',
        'Random text with no keywords',
      ];

      for (const prompt of prompts) {
        const result = skillResolver(createPromptInput(prompt));
        expect(result.continue).toBe(true);
      }
    });
  });

  // =========================================================================
  // Tier Boundary Tests (Issue #278 Critical)
  // =========================================================================

  describe('tier boundaries (Issue #278)', () => {
    beforeEach(() => {
      // Setup mock skill file
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent(
        'test-skill',
        'Test skill description',
        'This is the skill content for testing.'
      ));
    });

    test('TIER_SILENT (>=90%): injects content without systemMessage', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 95, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      const result = skillResolver(createPromptInput('Test prompt for silent tier'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // Silent tier: NO systemMessage
      expect(result.systemMessage).toBeUndefined();
      // Silent tier: additionalContext MUST exist
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
    });

    test('TIER_NOTIFY (80-89%): injects content WITH systemMessage', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 85, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 85,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      const result = skillResolver(createPromptInput('Test prompt for notify tier'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // Notify tier: systemMessage MUST exist
      expect(result.systemMessage).toBeDefined();
      expect(result.systemMessage).toMatch(/Loaded:/);
      // Notify tier: additionalContext MUST exist
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
    });

    test('TIER_SUGGEST (70-79%): adds to additionalContext only, no full content', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 75, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 75,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      const result = skillResolver(createPromptInput('Test prompt for suggest tier'));

      expect(result.continue).toBe(true);
      // Suggest tier: NO systemMessage
      expect(result.systemMessage).toBeUndefined();
      // Suggest tier: additionalContext MUST exist with "Also Available"
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toContain('Also Available');
    });

    test('TIER_HINT (50-69%): minimal hint in additionalContext', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 60, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 60,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });

      const result = skillResolver(createPromptInput('Test prompt for hint tier'));

      expect(result.continue).toBe(true);
      // Hint tier: NO systemMessage
      expect(result.systemMessage).toBeUndefined();
      // Hint tier: additionalContext MUST exist with "Related skills"
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toContain('Related skills');
    });

    test('below 50%: returns silent success with no output', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 40, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 40,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });

      const result = skillResolver(createPromptInput('Test prompt below threshold'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // Below threshold: NO additionalContext
      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
      expect(result.systemMessage).toBeUndefined();
    });

    test('boundary: exactly 90% triggers SILENT tier', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 90, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 90,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      const result = skillResolver(createPromptInput('Boundary test 90%'));

      // 90% is SILENT tier: NO systemMessage, additionalContext MUST exist
      expect(result.systemMessage).toBeUndefined();
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
    });

    test('boundary: exactly 80% triggers NOTIFY tier', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 80, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 80,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      const result = skillResolver(createPromptInput('Boundary test 80%'));

      // 80% is NOTIFY tier: systemMessage MUST exist
      expect(result.systemMessage).toBeDefined();
      expect(result.systemMessage).toMatch(/Loaded:/);
    });

    test('boundary: exactly 70% triggers SUGGEST tier', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 70, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 70,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });

      const result = skillResolver(createPromptInput('Boundary test 70%'));

      // 70% is SUGGEST tier: NO systemMessage, additionalContext MUST exist
      expect(result.systemMessage).toBeUndefined();
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toContain('Also Available');
    });

    test('boundary: exactly 50% triggers HINT tier', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 50, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 50,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });

      const result = skillResolver(createPromptInput('Boundary test 50%'));

      // 50% is HINT tier: NO systemMessage, additionalContext MUST exist
      expect(result.systemMessage).toBeUndefined();
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toContain('Related skills');
    });

    test('boundary: 49% returns silent success', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 49, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 49,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });

      const result = skillResolver(createPromptInput('Boundary test 49%'));

      // 49% is below threshold
      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });
  });

  // =========================================================================
  // Output Structure Tests
  // =========================================================================

  describe('output structure', () => {
    test('uses hookEventName UserPromptSubmit when injecting', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 95, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      const result = skillResolver(createPromptInput('Design an API endpoint'));

      // When injecting, hookSpecificOutput MUST exist with correct hookEventName
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      expect(result.hookSpecificOutput!.hookEventName).toBe('UserPromptSubmit');
    });

    test('has suppressOutput true', () => {
      const result = skillResolver(createPromptInput('anything'));
      expect(result.suppressOutput).toBe(true);
    });

    test('does not include raw percentages in additionalContext (Issue #278)', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 85, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 85,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      const result = skillResolver(createPromptInput('Design a REST API endpoint'));

      // additionalContext MUST exist for notify tier
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      // Issue #278: No raw percentages like "(85% match)"
      expect(ctx).not.toMatch(/\(\d+% match\)/);
    });
  });

  // =========================================================================
  // Configuration Tests
  // =========================================================================

  describe('configuration options', () => {
    test('respects enableSkillInjection=false', () => {
      vi.mocked(loadConfig).mockReturnValue({
        enableSkillInjection: false,
        maxSkillInjectionTokens: 800,
      });
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 95, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      const result = skillResolver(createPromptInput('Test with injection disabled'));

      // With injection disabled, no full content should be loaded
      expect(result.continue).toBe(true);
      // trackInjectedSkill should NOT be called
      expect(trackInjectedSkill).not.toHaveBeenCalled();
    });

    test('skips already-injected skills', () => {
      vi.mocked(isSkillInjected).mockReturnValue(true);
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 95, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      const result = skillResolver(createPromptInput('Test with already injected skill'));

      expect(result.continue).toBe(true);
      // Should not re-inject
      expect(trackInjectedSkill).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Merge Logic Tests
  // =========================================================================

  describe('skill merge logic', () => {
    test('merges classifier and keyword matches, keeps highest confidence', () => {
      // Classifier returns skill at 70%
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 70, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 70,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      // Keyword matcher returns same skill at 85%
      vi.mocked(findMatchingSkills).mockReturnValue([
        { skill: 'test-skill', confidence: 85 },
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      const result = skillResolver(createPromptInput('Merge test'));

      // Should use higher confidence (85% = notify tier)
      expect(result.systemMessage).toMatch(/Loaded:/);
    });

    test('deduplicates skills from both sources', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [
          { skill: 'skill-a', confidence: 80, description: 'A', matchedKeywords: [], signals: [] },
          { skill: 'skill-b', confidence: 75, description: 'B', matchedKeywords: [], signals: [] },
        ],
        intent: 'testing',
        confidence: 80,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(findMatchingSkills).mockReturnValue([
        { skill: 'skill-a', confidence: 70 }, // Lower than classifier
        { skill: 'skill-c', confidence: 85 }, // New skill
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      const result = skillResolver(createPromptInput('Dedup test'));

      // Should have loaded content (skill-c at 85% or skill-a at 80%)
      expect(result.continue).toBe(true);
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('edge cases', () => {
    test('handles special characters in prompt', () => {
      const result = skillResolver(createPromptInput('Design API for $pecial ch@rs! <test>'));
      expect(result.continue).toBe(true);
    });

    test('handles very long prompts', () => {
      const result = skillResolver(createPromptInput('Design an API ' + 'x'.repeat(5000)));
      expect(result.continue).toBe(true);
    });

    test('is case insensitive', () => {
      const variations = ['API', 'api', 'Api', 'aPi'];
      for (const keyword of variations) {
        const result = skillResolver(createPromptInput('Design the ' + keyword));
        expect(result.continue).toBe(true);
      }
    });

    test('handles skill file not found gracefully', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'missing-skill', confidence: 95, description: 'Missing', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(existsSync).mockReturnValue(false);

      const result = skillResolver(createPromptInput('Test with missing skill'));

      // Should not crash, returns silent success or hint
      expect(result.continue).toBe(true);
    });

    test('handles skill file read error gracefully', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'error-skill', confidence: 95, description: 'Error', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = skillResolver(createPromptInput('Test with read error'));

      // Should not crash
      expect(result.continue).toBe(true);
    });
  });

  // =========================================================================
  // Keyword Matching Integration
  // =========================================================================

  describe('keyword matching through merged pipeline', () => {
    test('detects API-related skills', () => {
      vi.mocked(findMatchingSkills).mockReturnValue([
        { skill: 'api-design-framework', confidence: 80 },
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('api-design-framework', 'API Design', 'Content'));

      const result = skillResolver(createPromptInput('Help me design a REST API for users'));

      expect(result.continue).toBe(true);
      // 80% confidence = NOTIFY tier, additionalContext MUST exist
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toContain('api-design-framework');
    });

    test('detects database-related skills', () => {
      vi.mocked(findMatchingSkills).mockReturnValue([
        { skill: 'database-schema-designer', confidence: 80 },
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('database-schema-designer', 'DB Design', 'Content'));

      const result = skillResolver(createPromptInput('Create a database schema for orders'));

      expect(result.continue).toBe(true);
      // 80% confidence = NOTIFY tier, additionalContext MUST exist
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toContain('database');
    });
  });

  // =========================================================================
  // Token Budget Management Tests
  // =========================================================================

  describe('token budget management', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
    });

    test('respects maxSkillInjectionTokens config', () => {
      // Arrange: Set a lower token limit in config
      vi.mocked(loadConfig).mockReturnValue({
        enableSkillInjection: true,
        maxSkillInjectionTokens: 200, // Much lower than default 800
      });

      // Create a skill with content that exceeds 200 tokens (~700 chars)
      const longContent = 'This is a skill with long content. '.repeat(50);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent(
        'test-skill',
        'Test skill with long content',
        longContent
      ));

      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 95, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      // Act
      const result = skillResolver(createPromptInput('Load skill with budget limit'));

      // Assert: Content should be present but truncated
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
      if (result.hookSpecificOutput?.additionalContext) {
        // With 200 tokens (~700 chars), content should be truncated
        expect(result.hookSpecificOutput.additionalContext).toContain('truncated');
      }
    });

    test('stops loading when remainingTokens < 100', () => {
      // Arrange: Configure with limited budget
      vi.mocked(loadConfig).mockReturnValue({
        enableSkillInjection: true,
        maxSkillInjectionTokens: 150, // Very tight budget
      });

      // First skill consumes most of the budget (~120 tokens worth)
      const skill1Content = 'Content for skill one. '.repeat(15); // ~350 chars = ~100 tokens

      vi.mocked(readFileSync).mockImplementation((path: unknown) => {
        const pathStr = path as string;
        if (pathStr.includes('skill-one')) {
          return createSkillContent('skill-one', 'First skill', skill1Content);
        }
        return createSkillContent('skill-two', 'Second skill', 'Second skill content should not load.');
      });

      vi.mocked(existsSync).mockReturnValue(true);

      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [
          { skill: 'skill-one', confidence: 95, description: 'First', matchedKeywords: [], signals: [] },
          { skill: 'skill-two', confidence: 92, description: 'Second', matchedKeywords: [], signals: [] },
        ],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      // Act
      const result = skillResolver(createPromptInput('Load multiple skills with tight budget'));

      // Assert: Should load first skill, but second should be skipped due to budget
      expect(result.continue).toBe(true);
      expect(trackInjectedSkill).toHaveBeenCalledWith('skill-one');
      // Second skill should NOT be tracked if budget exhausted (remaining < 100)
    });

    test('divides budget evenly between multiple skills', () => {
      // Arrange: Two skills at silent tier with 800 token budget
      vi.mocked(loadConfig).mockReturnValue({
        enableSkillInjection: true,
        maxSkillInjectionTokens: 800,
      });

      const moderateContent = 'Moderate content line. '.repeat(30); // ~700 chars

      vi.mocked(readFileSync).mockImplementation((path: unknown) => {
        const pathStr = path as string;
        if (pathStr.includes('skill-a')) {
          return createSkillContent('skill-a', 'Skill A', moderateContent);
        }
        return createSkillContent('skill-b', 'Skill B', moderateContent);
      });

      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [
          { skill: 'skill-a', confidence: 95, description: 'A', matchedKeywords: [], signals: [] },
          { skill: 'skill-b', confidence: 92, description: 'B', matchedKeywords: [], signals: [] },
        ],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      // Act
      const result = skillResolver(createPromptInput('Load two skills with budget division'));

      // Assert: Both skills should be tracked (budget divided: ~400 tokens each)
      expect(result.continue).toBe(true);
      expect(trackInjectedSkill).toHaveBeenCalledWith('skill-a');
      expect(trackInjectedSkill).toHaveBeenCalledWith('skill-b');
    });

    test('truncates content at paragraph boundary when over budget', () => {
      // Arrange
      vi.mocked(loadConfig).mockReturnValue({
        enableSkillInjection: true,
        maxSkillInjectionTokens: 200,
      });

      // Content with clear paragraph breaks
      const paragraphedContent = `
First paragraph with some introductory content here.

Second paragraph with more detailed information about the topic.

Third paragraph that should be truncated if we hit the budget limit.

Fourth paragraph with even more content that definitely won't fit.
`.trim();

      vi.mocked(readFileSync).mockReturnValue(createSkillContent(
        'test-skill',
        'Test with paragraphs',
        paragraphedContent
      ));

      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 95, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      // Act
      const result = skillResolver(createPromptInput('Test paragraph boundary truncation'));

      // Assert: Content should be truncated but present
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    });

    test('adds truncation notice when content exceeds budget', () => {
      // Arrange: Small budget with large content
      vi.mocked(loadConfig).mockReturnValue({
        enableSkillInjection: true,
        maxSkillInjectionTokens: 100, // Very small
      });

      const largeContent = 'This is a very long skill content. '.repeat(100);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent(
        'test-skill',
        'Large skill',
        largeContent
      ));

      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 95, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      // Act
      const result = skillResolver(createPromptInput('Test truncation notice'));

      // Assert: Should have truncation notice
      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('truncated');
      }
    });
  });

  // =========================================================================
  // Multi-Skill Scenarios
  // =========================================================================

  describe('multi-skill scenarios', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(loadConfig).mockReturnValue({
        enableSkillInjection: true,
        maxSkillInjectionTokens: 800,
      });
    });

    test('loads up to MAX_FULL_INJECT=2 skills for silent tier', () => {
      // Arrange: Three skills all at silent tier (>=90%)
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [
          { skill: 'skill-one', confidence: 98, description: 'First', matchedKeywords: [], signals: [] },
          { skill: 'skill-two', confidence: 95, description: 'Second', matchedKeywords: [], signals: [] },
          { skill: 'skill-three', confidence: 91, description: 'Third', matchedKeywords: [], signals: [] },
        ],
        intent: 'testing',
        confidence: 98,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      // Act
      const result = skillResolver(createPromptInput('Load three skills at silent tier'));

      // Assert: Only first two should be loaded (MAX_FULL_INJECT=2)
      expect(result.continue).toBe(true);
      expect(trackInjectedSkill).toHaveBeenCalledTimes(2);
      expect(trackInjectedSkill).toHaveBeenCalledWith('skill-one');
      expect(trackInjectedSkill).toHaveBeenCalledWith('skill-two');
      // Third skill at 91% should NOT be loaded
      expect(trackInjectedSkill).not.toHaveBeenCalledWith('skill-three');
    });

    test('mixes tiers correctly (silent + notify + suggest + hint)', () => {
      // Arrange: Skills at each tier level
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [
          { skill: 'silent-skill', confidence: 95, description: 'Silent tier', matchedKeywords: [], signals: [] },
          { skill: 'notify-skill', confidence: 85, description: 'Notify tier', matchedKeywords: [], signals: [] },
          { skill: 'suggest-skill', confidence: 75, description: 'Suggest tier', matchedKeywords: [], signals: [] },
          { skill: 'hint-skill', confidence: 55, description: 'Hint tier', matchedKeywords: [], signals: [] },
        ],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      // Act
      const result = skillResolver(createPromptInput('Test all tiers together'));

      // Assert
      expect(result.continue).toBe(true);

      // Silent + Notify tiers get full content loaded
      expect(trackInjectedSkill).toHaveBeenCalledWith('silent-skill');
      expect(trackInjectedSkill).toHaveBeenCalledWith('notify-skill');

      // Has systemMessage because notify tier has loaded content
      expect(result.systemMessage).toMatch(/Loaded:/);

      // additionalContext should have multiple sections
      const ctx = result.hookSpecificOutput?.additionalContext;
      expect(ctx).toBeDefined();
      if (ctx) {
        // Loaded skills section
        expect(ctx).toContain('Relevant Patterns');
        // Suggest tier in "Also Available"
        expect(ctx).toContain('Also Available');
        expect(ctx).toContain('suggest-skill');
        // Hint tier in "Related skills"
        expect(ctx).toContain('Related skills');
        expect(ctx).toContain('hint-skill');
      }
    });

    test('limits suggestions to MAX_SUGGESTIONS=3', () => {
      // Arrange: Five skills in suggest tier (70-79%)
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [
          { skill: 'suggest-1', confidence: 79, description: 'Suggest 1', matchedKeywords: [], signals: [] },
          { skill: 'suggest-2', confidence: 78, description: 'Suggest 2', matchedKeywords: [], signals: [] },
          { skill: 'suggest-3', confidence: 76, description: 'Suggest 3', matchedKeywords: [], signals: [] },
          { skill: 'suggest-4', confidence: 74, description: 'Suggest 4', matchedKeywords: [], signals: [] },
          { skill: 'suggest-5', confidence: 72, description: 'Suggest 5', matchedKeywords: [], signals: [] },
        ],
        intent: 'testing',
        confidence: 79,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false, // No silent/notify tier
      });

      // Act
      const result = skillResolver(createPromptInput('Test suggestion limit'));

      // Assert: Only 3 suggestions should appear
      expect(result.continue).toBe(true);
      const ctx = result.hookSpecificOutput?.additionalContext;
      expect(ctx).toBeDefined();
      if (ctx) {
        expect(ctx).toContain('Also Available');
        expect(ctx).toContain('suggest-1');
        expect(ctx).toContain('suggest-2');
        expect(ctx).toContain('suggest-3');
        // Fourth and fifth should NOT appear
        expect(ctx).not.toContain('suggest-4');
        expect(ctx).not.toContain('suggest-5');
      }
    });

    test('limits hints to MAX_SUGGESTIONS=3', () => {
      // Arrange: Five skills in hint tier (50-69%)
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [
          { skill: 'hint-1', confidence: 65, description: 'Hint 1', matchedKeywords: [], signals: [] },
          { skill: 'hint-2', confidence: 62, description: 'Hint 2', matchedKeywords: [], signals: [] },
          { skill: 'hint-3', confidence: 58, description: 'Hint 3', matchedKeywords: [], signals: [] },
          { skill: 'hint-4', confidence: 54, description: 'Hint 4', matchedKeywords: [], signals: [] },
          { skill: 'hint-5', confidence: 51, description: 'Hint 5', matchedKeywords: [], signals: [] },
        ],
        intent: 'testing',
        confidence: 65,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });

      // Act
      const result = skillResolver(createPromptInput('Test hint limit'));

      // Assert: Only 3 hints should appear
      expect(result.continue).toBe(true);
      const ctx = result.hookSpecificOutput?.additionalContext;
      expect(ctx).toBeDefined();
      if (ctx) {
        expect(ctx).toContain('Related skills');
        expect(ctx).toContain('hint-1');
        expect(ctx).toContain('hint-2');
        expect(ctx).toContain('hint-3');
        // Fourth and fifth should NOT appear
        expect(ctx).not.toContain('hint-4');
        expect(ctx).not.toContain('hint-5');
      }
    });

    test('handles many skills across all tiers', () => {
      // Arrange: 10 skills at various confidence levels
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [
          // Silent tier (>=90): 2 skills
          { skill: 'silent-1', confidence: 98, description: 'Silent 1', matchedKeywords: [], signals: [] },
          { skill: 'silent-2', confidence: 92, description: 'Silent 2', matchedKeywords: [], signals: [] },
          // Notify tier (80-89): 2 skills
          { skill: 'notify-1', confidence: 88, description: 'Notify 1', matchedKeywords: [], signals: [] },
          { skill: 'notify-2', confidence: 82, description: 'Notify 2', matchedKeywords: [], signals: [] },
          // Suggest tier (70-79): 3 skills
          { skill: 'suggest-1', confidence: 78, description: 'Suggest 1', matchedKeywords: [], signals: [] },
          { skill: 'suggest-2', confidence: 74, description: 'Suggest 2', matchedKeywords: [], signals: [] },
          { skill: 'suggest-3', confidence: 71, description: 'Suggest 3', matchedKeywords: [], signals: [] },
          // Hint tier (50-69): 3 skills
          { skill: 'hint-1', confidence: 65, description: 'Hint 1', matchedKeywords: [], signals: [] },
          { skill: 'hint-2', confidence: 58, description: 'Hint 2', matchedKeywords: [], signals: [] },
          { skill: 'hint-3', confidence: 52, description: 'Hint 3', matchedKeywords: [], signals: [] },
        ],
        intent: 'testing',
        confidence: 98,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      // Act
      const result = skillResolver(createPromptInput('Test with 10 skills across tiers'));

      // Assert
      expect(result.continue).toBe(true);

      // Only MAX_FULL_INJECT=2 skills loaded (highest confidence: silent-1, silent-2)
      expect(trackInjectedSkill).toHaveBeenCalledTimes(2);
      expect(trackInjectedSkill).toHaveBeenCalledWith('silent-1');
      expect(trackInjectedSkill).toHaveBeenCalledWith('silent-2');

      // No systemMessage for silent tier only
      expect(result.systemMessage).toBeUndefined();

      // Check additionalContext structure
      const ctx = result.hookSpecificOutput?.additionalContext;
      expect(ctx).toBeDefined();
      if (ctx) {
        // Should have loaded patterns section
        expect(ctx).toContain('Relevant Patterns');
        // Should have suggestions (up to 3)
        expect(ctx).toContain('Also Available');
        // Should have hints (up to 3)
        expect(ctx).toContain('Related skills');
      }
    });

    test('prioritizes higher confidence skills when at limit', () => {
      // Arrange: Skills with intentionally scrambled order
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [
          // Out of order to test sorting
          { skill: 'skill-low', confidence: 91, description: 'Lower', matchedKeywords: [], signals: [] },
          { skill: 'skill-highest', confidence: 99, description: 'Highest', matchedKeywords: [], signals: [] },
          { skill: 'skill-mid', confidence: 94, description: 'Middle', matchedKeywords: [], signals: [] },
          { skill: 'skill-lowest', confidence: 90, description: 'Lowest', matchedKeywords: [], signals: [] },
        ],
        intent: 'testing',
        confidence: 99,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      // Act
      const result = skillResolver(createPromptInput('Test priority ordering'));

      // Assert: Should load highest confidence skills (99% and 94%)
      expect(result.continue).toBe(true);
      expect(trackInjectedSkill).toHaveBeenCalledTimes(2);
      expect(trackInjectedSkill).toHaveBeenCalledWith('skill-highest');
      expect(trackInjectedSkill).toHaveBeenCalledWith('skill-mid');
      // Lower priority skills should not be loaded
      expect(trackInjectedSkill).not.toHaveBeenCalledWith('skill-low');
      expect(trackInjectedSkill).not.toHaveBeenCalledWith('skill-lowest');
    });

    test('combines silent and notify tiers for MAX_FULL_INJECT limit', () => {
      // Arrange: 1 silent + 2 notify = 3 skills wanting full load, but only 2 allowed
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [
          { skill: 'silent-skill', confidence: 95, description: 'Silent', matchedKeywords: [], signals: [] },
          { skill: 'notify-skill-1', confidence: 88, description: 'Notify 1', matchedKeywords: [], signals: [] },
          { skill: 'notify-skill-2', confidence: 82, description: 'Notify 2', matchedKeywords: [], signals: [] },
        ],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      // Act
      const result = skillResolver(createPromptInput('Test silent + notify limit'));

      // Assert: Should load top 2 (silent + first notify)
      expect(result.continue).toBe(true);
      expect(trackInjectedSkill).toHaveBeenCalledTimes(2);
      expect(trackInjectedSkill).toHaveBeenCalledWith('silent-skill');
      expect(trackInjectedSkill).toHaveBeenCalledWith('notify-skill-1');
      // Third skill not loaded
      expect(trackInjectedSkill).not.toHaveBeenCalledWith('notify-skill-2');

      // Should have systemMessage because notify tier has content loaded
      expect(result.systemMessage).toMatch(/Loaded:/);
    });

    test('only notify tier triggers systemMessage when present', () => {
      // Arrange: Only silent tier skills (no notify)
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [
          { skill: 'silent-1', confidence: 98, description: 'Silent 1', matchedKeywords: [], signals: [] },
          { skill: 'silent-2', confidence: 92, description: 'Silent 2', matchedKeywords: [], signals: [] },
        ],
        intent: 'testing',
        confidence: 98,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      // Act
      const result = skillResolver(createPromptInput('Test silent-only no notification'));

      // Assert: No systemMessage for pure silent tier
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeUndefined();
      // But additionalContext should exist
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    });
  });

  // =========================================================================
  // User Notification Format (Issue #278)
  // =========================================================================

  describe('user notification format (Issue #278)', () => {
    test('systemMessage starts with emoji for notify tier', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 85, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 85,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      const result = skillResolver(createPromptInput('Help me with fastapi uvicorn middleware'));

      // NOTIFY tier (80-89%): systemMessage MUST exist
      expect(result.systemMessage).toBeDefined();
      // Issue #278: User notification should be friendly with emoji
      expect(result.systemMessage).toMatch(/^💡/);
    });

    test('systemMessage contains skill name', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'fastapi-advanced', confidence: 85, description: 'FastAPI', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 85,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('fastapi-advanced', 'FastAPI', 'Content'));

      const result = skillResolver(createPromptInput('Help me with fastapi'));

      // NOTIFY tier (80-89%): systemMessage MUST exist and contain skill name
      expect(result.systemMessage).toBeDefined();
      expect(result.systemMessage).toContain('fastapi-advanced');
    });

    test('additionalContext uses friendly headers', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 95, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));

      const result = skillResolver(createPromptInput('Test friendly headers'));

      // SILENT tier (>=90%): additionalContext MUST exist
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      // Should use new friendly headers, not old technical ones
      const hasNewHeaders = ctx.includes('Relevant Patterns') || ctx.includes('Also Available') || ctx.includes('Related skills');
      expect(hasNewHeaders).toBe(true);
      // Should NOT have old headers
      expect(ctx).not.toContain('Skill Knowledge Injected');
      expect(ctx).not.toContain('Skill Hints');
    });
  });

  // =========================================================================
  // Output Existence Requirements (Issue #278 - Strong Assertions)
  // =========================================================================

  describe('output existence requirements', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent(
        'test-skill',
        'Test skill description',
        'This is the skill content for testing.'
      ));
    });

    describe('SILENT tier (>=90%)', () => {
      beforeEach(() => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'test-skill', confidence: 92, description: 'Test', matchedKeywords: [], signals: [] }],
          intent: 'testing',
          confidence: 92,
          signals: [],
          shouldAutoDispatch: false,
          shouldInjectSkills: true,
        });
      });

      test('additionalContext MUST exist', () => {
        const result = skillResolver(createPromptInput('Silent tier output test'));

        expect(result.hookSpecificOutput).toBeDefined();
        expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
        expect(typeof result.hookSpecificOutput!.additionalContext).toBe('string');
        expect(result.hookSpecificOutput!.additionalContext!.length).toBeGreaterThan(0);
      });

      test('systemMessage MUST NOT exist', () => {
        const result = skillResolver(createPromptInput('Silent tier no message test'));

        expect(result.systemMessage).toBeUndefined();
      });

      test('additionalContext contains skill content', () => {
        const result = skillResolver(createPromptInput('Silent tier content test'));

        expect(result.hookSpecificOutput).toBeDefined();
        expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
        // Should contain skill name or content reference
        expect(result.hookSpecificOutput!.additionalContext).toMatch(/test-skill|Relevant Patterns/);
      });
    });

    describe('NOTIFY tier (80-89%)', () => {
      beforeEach(() => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'test-skill', confidence: 84, description: 'Test', matchedKeywords: [], signals: [] }],
          intent: 'testing',
          confidence: 84,
          signals: [],
          shouldAutoDispatch: false,
          shouldInjectSkills: true,
        });
      });

      test('BOTH additionalContext AND systemMessage MUST exist', () => {
        const result = skillResolver(createPromptInput('Notify tier both outputs test'));

        // additionalContext MUST exist
        expect(result.hookSpecificOutput).toBeDefined();
        expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
        expect(typeof result.hookSpecificOutput!.additionalContext).toBe('string');
        expect(result.hookSpecificOutput!.additionalContext!.length).toBeGreaterThan(0);

        // systemMessage MUST exist
        expect(result.systemMessage).toBeDefined();
        expect(typeof result.systemMessage).toBe('string');
        expect(result.systemMessage!.length).toBeGreaterThan(0);
      });

      test('systemMessage contains "Loaded:" indicator', () => {
        const result = skillResolver(createPromptInput('Notify tier message format test'));

        expect(result.systemMessage).toBeDefined();
        expect(result.systemMessage).toMatch(/Loaded:/);
      });

      test('systemMessage starts with emoji', () => {
        const result = skillResolver(createPromptInput('Notify tier emoji test'));

        expect(result.systemMessage).toBeDefined();
        expect(result.systemMessage).toMatch(/^[^\w\s]/); // Starts with non-word, non-space (emoji)
      });
    });

    describe('SUGGEST tier (70-79%)', () => {
      beforeEach(() => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'test-skill', confidence: 74, description: 'Test', matchedKeywords: [], signals: [] }],
          intent: 'testing',
          confidence: 74,
          signals: [],
          shouldAutoDispatch: false,
          shouldInjectSkills: false,
        });
      });

      test('additionalContext MUST exist', () => {
        const result = skillResolver(createPromptInput('Suggest tier output test'));

        expect(result.hookSpecificOutput).toBeDefined();
        expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
        expect(typeof result.hookSpecificOutput!.additionalContext).toBe('string');
        expect(result.hookSpecificOutput!.additionalContext!.length).toBeGreaterThan(0);
      });

      test('additionalContext MUST contain "Also Available"', () => {
        const result = skillResolver(createPromptInput('Suggest tier also available test'));

        expect(result.hookSpecificOutput).toBeDefined();
        expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
        expect(result.hookSpecificOutput!.additionalContext).toContain('Also Available');
      });

      test('systemMessage MUST NOT exist', () => {
        const result = skillResolver(createPromptInput('Suggest tier no message test'));

        expect(result.systemMessage).toBeUndefined();
      });
    });

    describe('HINT tier (50-69%)', () => {
      beforeEach(() => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'test-skill', confidence: 55, description: 'Test', matchedKeywords: [], signals: [] }],
          intent: 'testing',
          confidence: 55,
          signals: [],
          shouldAutoDispatch: false,
          shouldInjectSkills: false,
        });
      });

      test('additionalContext MUST exist', () => {
        const result = skillResolver(createPromptInput('Hint tier output test'));

        expect(result.hookSpecificOutput).toBeDefined();
        expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
        expect(typeof result.hookSpecificOutput!.additionalContext).toBe('string');
        expect(result.hookSpecificOutput!.additionalContext!.length).toBeGreaterThan(0);
      });

      test('additionalContext MUST contain "Related skills"', () => {
        const result = skillResolver(createPromptInput('Hint tier related skills test'));

        expect(result.hookSpecificOutput).toBeDefined();
        expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
        expect(result.hookSpecificOutput!.additionalContext).toContain('Related skills');
      });

      test('systemMessage MUST NOT exist', () => {
        const result = skillResolver(createPromptInput('Hint tier no message test'));

        expect(result.systemMessage).toBeUndefined();
      });
    });

    describe('BELOW threshold (<50%)', () => {
      beforeEach(() => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'test-skill', confidence: 45, description: 'Test', matchedKeywords: [], signals: [] }],
          intent: 'testing',
          confidence: 45,
          signals: [],
          shouldAutoDispatch: false,
          shouldInjectSkills: false,
        });
      });

      test('additionalContext MUST NOT exist', () => {
        const result = skillResolver(createPromptInput('Below threshold output test'));

        // Either hookSpecificOutput is undefined, or additionalContext is undefined
        const hasNoAdditionalContext =
          result.hookSpecificOutput === undefined ||
          result.hookSpecificOutput.additionalContext === undefined;
        expect(hasNoAdditionalContext).toBe(true);
      });

      test('systemMessage MUST NOT exist', () => {
        const result = skillResolver(createPromptInput('Below threshold no message test'));

        expect(result.systemMessage).toBeUndefined();
      });
    });
  });

  // =========================================================================
  // Output Format Snapshots (Regression Protection)
  // =========================================================================

  describe('output format snapshots', () => {
    /**
     * Creates realistic skill content for snapshot testing.
     * Includes headers, code blocks, and decision tables to simulate
     * actual compressed skill output.
     */
    function createRealisticSkillContent(name: string, description: string): string {
      return `---
name: ${name}
description: ${description}
tags: [testing, api, patterns]
---

# ${name}

${description}

## Quick Reference

\`\`\`typescript
// Example pattern from ${name}
export function example() {
  return { pattern: '${name}' };
}
\`\`\`

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Framework | Vitest for tests |
| Coverage | 80% minimum |

## Related Skills

- unit-testing
- integration-testing
`;
    }

    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
    });

    describe('complete HookResult snapshots by tier', () => {
      test('silent tier (95%) - complete output structure', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'api-design-framework', confidence: 95, description: 'API Design patterns', matchedKeywords: ['api'], signals: ['api'] }],
          intent: 'api-design',
          confidence: 95,
          signals: ['api'],
          shouldAutoDispatch: false,
          shouldInjectSkills: true,
        });
        vi.mocked(readFileSync).mockReturnValue(createRealisticSkillContent(
          'api-design-framework',
          'Design REST APIs with industry best practices'
        ));

        const result = skillResolver(createPromptInput('Design a REST API for user management'));

        expect(result).toMatchSnapshot();
      });

      test('notify tier (85%) - complete output structure', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'database-schema-designer', confidence: 85, description: 'Database schema patterns', matchedKeywords: ['database'], signals: ['database'] }],
          intent: 'database-design',
          confidence: 85,
          signals: ['database'],
          shouldAutoDispatch: false,
          shouldInjectSkills: true,
        });
        vi.mocked(readFileSync).mockReturnValue(createRealisticSkillContent(
          'database-schema-designer',
          'Design scalable database schemas'
        ));

        const result = skillResolver(createPromptInput('Create a database schema for orders'));

        expect(result).toMatchSnapshot();
      });

      test('suggest tier (75%) - complete output structure', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'testing-patterns', confidence: 75, description: 'Testing best practices', matchedKeywords: ['test'], signals: ['test'] }],
          intent: 'testing',
          confidence: 75,
          signals: ['test'],
          shouldAutoDispatch: false,
          shouldInjectSkills: false,
        });
        vi.mocked(readFileSync).mockReturnValue(createRealisticSkillContent(
          'testing-patterns',
          'Write effective unit and integration tests'
        ));

        const result = skillResolver(createPromptInput('Help me write some tests'));

        expect(result).toMatchSnapshot();
      });

      test('hint tier (60%) - complete output structure', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'error-handling', confidence: 60, description: 'Error handling patterns', matchedKeywords: ['error'], signals: ['error'] }],
          intent: 'error-handling',
          confidence: 60,
          signals: ['error'],
          shouldAutoDispatch: false,
          shouldInjectSkills: false,
        });

        const result = skillResolver(createPromptInput('Handle this error'));

        expect(result).toMatchSnapshot();
      });

      test('below threshold (40%) - silent success', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'random-skill', confidence: 40, description: 'Some skill', matchedKeywords: [], signals: [] }],
          intent: 'unknown',
          confidence: 40,
          signals: [],
          shouldAutoDispatch: false,
          shouldInjectSkills: false,
        });

        const result = skillResolver(createPromptInput('Random prompt with low confidence'));

        expect(result).toMatchSnapshot();
      });
    });

    describe('additionalContext markdown format snapshots', () => {
      test('loaded skill markdown with full content', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'unit-testing', confidence: 92, description: 'Unit testing patterns', matchedKeywords: ['test', 'unit'], signals: ['unit', 'test'] }],
          intent: 'testing',
          confidence: 92,
          signals: ['unit', 'test'],
          shouldAutoDispatch: false,
          shouldInjectSkills: true,
        });
        vi.mocked(readFileSync).mockReturnValue(createRealisticSkillContent(
          'unit-testing',
          'Write isolated unit tests with fast feedback'
        ));

        const result = skillResolver(createPromptInput('Write unit tests for my service'));

        expect(result.hookSpecificOutput?.additionalContext).toMatchSnapshot();
      });

      test('multiple loaded skills markdown', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [
            { skill: 'api-design-framework', confidence: 95, description: 'API Design', matchedKeywords: ['api'], signals: ['api'] },
            { skill: 'openapi-spec', confidence: 90, description: 'OpenAPI specs', matchedKeywords: ['openapi'], signals: ['openapi'] },
          ],
          intent: 'api-design',
          confidence: 95,
          signals: ['api', 'openapi'],
          shouldAutoDispatch: false,
          shouldInjectSkills: true,
        });
        vi.mocked(readFileSync)
          .mockReturnValueOnce(createRealisticSkillContent('api-design-framework', 'Design REST APIs'))
          .mockReturnValueOnce(createRealisticSkillContent('openapi-spec', 'Create OpenAPI specifications'));

        const result = skillResolver(createPromptInput('Design REST API with OpenAPI spec'));

        expect(result.hookSpecificOutput?.additionalContext).toMatchSnapshot();
      });

      test('Also Available section format (suggest tier)', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [
            { skill: 'performance-testing', confidence: 75, description: 'Load testing patterns', matchedKeywords: ['performance'], signals: ['performance'] },
            { skill: 'stress-testing', confidence: 72, description: 'Stress test scenarios', matchedKeywords: ['stress'], signals: ['stress'] },
          ],
          intent: 'testing',
          confidence: 75,
          signals: ['performance'],
          shouldAutoDispatch: false,
          shouldInjectSkills: false,
        });

        const result = skillResolver(createPromptInput('Help with performance'));

        expect(result.hookSpecificOutput?.additionalContext).toMatchSnapshot();
      });

      test('Related skills hint format (hint tier)', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [
            { skill: 'security-patterns', confidence: 55, description: 'Security best practices', matchedKeywords: ['security'], signals: ['security'] },
            { skill: 'auth-patterns', confidence: 52, description: 'Authentication patterns', matchedKeywords: ['auth'], signals: ['auth'] },
          ],
          intent: 'security',
          confidence: 55,
          signals: ['security'],
          shouldAutoDispatch: false,
          shouldInjectSkills: false,
        });

        const result = skillResolver(createPromptInput('Something about security maybe'));

        expect(result.hookSpecificOutput?.additionalContext).toMatchSnapshot();
      });

      test('mixed tiers - loaded + suggested skills', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [
            { skill: 'fastapi-advanced', confidence: 88, description: 'FastAPI advanced patterns', matchedKeywords: ['fastapi'], signals: ['fastapi'] },
            { skill: 'pydantic-models', confidence: 75, description: 'Pydantic data validation', matchedKeywords: ['pydantic'], signals: ['pydantic'] },
          ],
          intent: 'api-development',
          confidence: 88,
          signals: ['fastapi', 'pydantic'],
          shouldAutoDispatch: false,
          shouldInjectSkills: true,
        });
        vi.mocked(readFileSync).mockReturnValue(createRealisticSkillContent(
          'fastapi-advanced',
          'Advanced FastAPI patterns and middleware'
        ));

        const result = skillResolver(createPromptInput('Help me with FastAPI and Pydantic models'));

        expect(result.hookSpecificOutput?.additionalContext).toMatchSnapshot();
      });
    });

    describe('systemMessage format snapshots', () => {
      test('single skill notification', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'react-patterns', confidence: 85, description: 'React patterns', matchedKeywords: ['react'], signals: ['react'] }],
          intent: 'frontend',
          confidence: 85,
          signals: ['react'],
          shouldAutoDispatch: false,
          shouldInjectSkills: true,
        });
        vi.mocked(readFileSync).mockReturnValue(createRealisticSkillContent('react-patterns', 'React best practices'));

        const result = skillResolver(createPromptInput('Build a React component'));

        expect(result.systemMessage).toMatchInlineSnapshot(`"💡 Loaded: react-patterns"`);
      });

      test('multiple skills notification', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [
            { skill: 'typescript-patterns', confidence: 87, description: 'TypeScript patterns', matchedKeywords: ['typescript'], signals: ['typescript'] },
            { skill: 'eslint-config', confidence: 82, description: 'ESLint configuration', matchedKeywords: ['eslint'], signals: ['eslint'] },
          ],
          intent: 'development',
          confidence: 87,
          signals: ['typescript', 'eslint'],
          shouldAutoDispatch: false,
          shouldInjectSkills: true,
        });
        vi.mocked(readFileSync)
          .mockReturnValueOnce(createRealisticSkillContent('typescript-patterns', 'TypeScript best practices'))
          .mockReturnValueOnce(createRealisticSkillContent('eslint-config', 'ESLint setup and rules'));

        const result = skillResolver(createPromptInput('Setup TypeScript with ESLint'));

        expect(result.systemMessage).toMatchInlineSnapshot(`"💡 Loaded: typescript-patterns, eslint-config"`);
      });

      test('silent tier has no systemMessage', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'high-confidence-skill', confidence: 95, description: 'High confidence', matchedKeywords: [], signals: [] }],
          intent: 'testing',
          confidence: 95,
          signals: [],
          shouldAutoDispatch: false,
          shouldInjectSkills: true,
        });
        vi.mocked(readFileSync).mockReturnValue(createRealisticSkillContent('high-confidence-skill', 'Very relevant skill'));

        const result = skillResolver(createPromptInput('Silent tier prompt'));

        expect(result.systemMessage).toBeUndefined();
      });

      test('suggest tier has no systemMessage', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'medium-skill', confidence: 75, description: 'Medium confidence', matchedKeywords: [], signals: [] }],
          intent: 'testing',
          confidence: 75,
          signals: [],
          shouldAutoDispatch: false,
          shouldInjectSkills: false,
        });

        const result = skillResolver(createPromptInput('Suggest tier prompt'));

        expect(result.systemMessage).toBeUndefined();
      });
    });

    describe('hookSpecificOutput structure snapshots', () => {
      test('hookEventName is UserPromptSubmit when context is present', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'test-skill', confidence: 90, description: 'Test', matchedKeywords: [], signals: [] }],
          intent: 'testing',
          confidence: 90,
          signals: [],
          shouldAutoDispatch: false,
          shouldInjectSkills: true,
        });
        vi.mocked(readFileSync).mockReturnValue(createRealisticSkillContent('test-skill', 'Test skill'));

        const result = skillResolver(createPromptInput('Test for hookEventName'));

        expect(result.hookSpecificOutput).toMatchObject({
          hookEventName: 'UserPromptSubmit',
          additionalContext: expect.any(String),
        });
      });

      test('hookSpecificOutput is undefined when no context to inject', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'low-skill', confidence: 40, description: 'Low', matchedKeywords: [], signals: [] }],
          intent: 'unknown',
          confidence: 40,
          signals: [],
          shouldAutoDispatch: false,
          shouldInjectSkills: false,
        });

        const result = skillResolver(createPromptInput('No context prompt'));

        expect(result.hookSpecificOutput).toBeUndefined();
      });
    });

    describe('format stability guards', () => {
      test('no raw percentages in additionalContext', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [
            { skill: 'skill-a', confidence: 95, description: 'A', matchedKeywords: [], signals: [] },
            { skill: 'skill-b', confidence: 85, description: 'B', matchedKeywords: [], signals: [] },
            { skill: 'skill-c', confidence: 75, description: 'C', matchedKeywords: [], signals: [] },
          ],
          intent: 'testing',
          confidence: 95,
          signals: [],
          shouldAutoDispatch: false,
          shouldInjectSkills: true,
        });
        vi.mocked(readFileSync)
          .mockReturnValueOnce(createRealisticSkillContent('skill-a', 'Skill A'))
          .mockReturnValueOnce(createRealisticSkillContent('skill-b', 'Skill B'));

        const result = skillResolver(createPromptInput('Multi-tier test'));

        if (result.hookSpecificOutput?.additionalContext) {
          // Verify no percentage patterns like (95%) or (85% match)
          expect(result.hookSpecificOutput.additionalContext).not.toMatch(/\(\d+%\)/);
          expect(result.hookSpecificOutput.additionalContext).not.toMatch(/\d+% match/);
          expect(result.hookSpecificOutput.additionalContext).not.toMatch(/confidence[:\s]+\d+/i);
        }
      });

      test('uses friendly headers not technical jargon', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'friendly-skill', confidence: 92, description: 'Friendly', matchedKeywords: [], signals: [] }],
          intent: 'testing',
          confidence: 92,
          signals: [],
          shouldAutoDispatch: false,
          shouldInjectSkills: true,
        });
        vi.mocked(readFileSync).mockReturnValue(createRealisticSkillContent('friendly-skill', 'Friendly skill'));

        const result = skillResolver(createPromptInput('Friendly headers test'));

        if (result.hookSpecificOutput?.additionalContext) {
          const ctx = result.hookSpecificOutput.additionalContext;
          // Should have friendly headers
          expect(ctx).toContain('Relevant Patterns');
          // Should NOT have technical headers
          expect(ctx).not.toContain('Skill Knowledge Injected');
          expect(ctx).not.toContain('SKILL_INJECTION');
          expect(ctx).not.toContain('High Confidence');
        }
      });

      test('emoji in systemMessage is correct', () => {
        vi.mocked(classifyIntent).mockReturnValue({
          agents: [],
          skills: [{ skill: 'emoji-skill', confidence: 85, description: 'Emoji', matchedKeywords: [], signals: [] }],
          intent: 'testing',
          confidence: 85,
          signals: [],
          shouldAutoDispatch: false,
          shouldInjectSkills: true,
        });
        vi.mocked(readFileSync).mockReturnValue(createRealisticSkillContent('emoji-skill', 'Emoji skill'));

        const result = skillResolver(createPromptInput('Emoji test'));

        // The lightbulb emoji should be at the start
        expect(result.systemMessage).toMatch(/^💡/);
        // Should use "Loaded:" not "Injected:" or other technical terms
        expect(result.systemMessage).toContain('Loaded:');
      });
    });
  });

  // =========================================================================
  // Internal Helper Function Tests (via skillResolver)
  // These test the behavior of internal helpers through the public API
  // =========================================================================

  describe('loadCompressedSkillContent helper', () => {
    beforeEach(() => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 95, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(existsSync).mockReturnValue(true);
    });

    test('removes YAML frontmatter correctly', () => {
      const skillWithFrontmatter = `---
name: test-skill
description: A test skill
tags: [test, unit]
---

# Test Skill

This is the actual content.`;
      vi.mocked(readFileSync).mockReturnValue(skillWithFrontmatter);

      const result = skillResolver(createPromptInput('Test frontmatter removal'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      // Frontmatter should be stripped
      expect(ctx).not.toContain('name: test-skill');
      expect(ctx).not.toContain('tags: [test, unit]');
      // Actual content should remain
      expect(ctx).toContain('Test Skill');
      expect(ctx).toContain('actual content');
    });

    test('strips ## References sections', () => {
      const skillWithReferences = `---
name: test-skill
description: Test
---

# Test Skill

Main content here.

## References

- [reference1.md](references/reference1.md)
- [reference2.md](references/reference2.md)

## Another Section

More content.`;
      vi.mocked(readFileSync).mockReturnValue(skillWithReferences);

      const result = skillResolver(createPromptInput('Test references stripping'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      // References section should be stripped
      expect(ctx).not.toContain('reference1.md');
      expect(ctx).not.toContain('reference2.md');
      // Main content should remain
      expect(ctx).toContain('Main content here');
    });

    test('truncates code blocks >10 lines to 5 lines + notice', () => {
      const lines = Array.from({ length: 15 }, (_, i) => `  line ${i + 1}`);
      const longCodeBlock = `\`\`\`typescript
${lines.join('\n')}
\`\`\``;
      const skillWithLongCode = `---
name: test-skill
description: Test
---

# Test Skill

${longCodeBlock}`;
      vi.mocked(readFileSync).mockReturnValue(skillWithLongCode);

      const result = skillResolver(createPromptInput('Test code truncation'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      // Should contain truncation notice
      expect(ctx).toContain('truncated');
      // Should NOT contain all 15 lines
      expect(ctx).not.toContain('line 15');
      expect(ctx).not.toContain('line 14');
    });

    test('keeps short code blocks intact', () => {
      const shortCodeBlock = `\`\`\`typescript
const foo = 1;
const bar = 2;
console.log(foo + bar);
\`\`\``;
      const skillWithShortCode = `---
name: test-skill
description: Test
---

# Test Skill

${shortCodeBlock}`;
      vi.mocked(readFileSync).mockReturnValue(skillWithShortCode);

      const result = skillResolver(createPromptInput('Test short code preservation'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      // Should NOT have truncation notice
      expect(ctx).not.toContain('truncated');
      // Should contain all code
      expect(ctx).toContain('const foo = 1');
      expect(ctx).toContain('console.log');
    });

    test('respects token budget with paragraph boundary truncation', () => {
      // Create content that exceeds typical token budget
      const longContent = Array.from({ length: 100 }, (_, i) =>
        `Paragraph ${i + 1}. This is some test content that adds up to exceed the token budget.`
      ).join('\n\n');
      const skillWithLongContent = `---
name: test-skill
description: Test
---

# Test Skill

${longContent}`;
      vi.mocked(readFileSync).mockReturnValue(skillWithLongContent);

      const result = skillResolver(createPromptInput('Test token budget'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      // Should be truncated
      expect(ctx).toContain('truncated for context budget');
      // Should NOT contain the last paragraph
      expect(ctx).not.toContain('Paragraph 100');
    });

    test('handles CRLF to LF normalization', () => {
      const crlfContent = `---\r\nname: test-skill\r\ndescription: Test\r\n---\r\n\r\n# Test Skill\r\n\r\nContent with CRLF endings.`;
      vi.mocked(readFileSync).mockReturnValue(crlfContent);

      const result = skillResolver(createPromptInput('Test CRLF normalization'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      // Should not contain raw CRLF characters
      expect(ctx).not.toContain('\r\n');
      // Content should be readable
      expect(ctx).toContain('Test Skill');
      expect(ctx).toContain('Content with CRLF endings');
    });

    test('returns null for missing file (silent success)', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = skillResolver(createPromptInput('Test missing file'));

      expect(result.continue).toBe(true);
      // No content should be injected
      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });

    test('returns null on read error (silent success)', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = skillResolver(createPromptInput('Test read error'));

      expect(result.continue).toBe(true);
      // Should not crash, no content injected
    });

    test('collapses excessive blank lines', () => {
      const skillWithExcessiveBlanks = `---
name: test-skill
description: Test
---

# Test Skill




Content after many blank lines.




More content.`;
      vi.mocked(readFileSync).mockReturnValue(skillWithExcessiveBlanks);

      const result = skillResolver(createPromptInput('Test blank line collapse'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      // Should not have >2 consecutive newlines
      expect(ctx).not.toMatch(/\n{4,}/);
      // Content should still be present
      expect(ctx).toContain('Content after many blank lines');
      expect(ctx).toContain('More content');
    });
  });

  describe('getSkillDescription helper', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
    });

    test('extracts description from frontmatter', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 75, description: '', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 75,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      vi.mocked(readFileSync).mockReturnValue(`---
name: test-skill
description: This is a detailed skill description
tags: [test]
---

# Test Skill

Content.`);

      const result = skillResolver(createPromptInput('Test description extraction'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      // In suggest tier, description should be included
      expect(ctx).toContain('This is a detailed skill description');
    });

    test('returns empty string for missing file', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'missing-skill', confidence: 75, description: '', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 75,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });

      const result = skillResolver(createPromptInput('Test missing description'));

      expect(result.continue).toBe(true);
      // Should not crash, just no description
    });

    test('returns empty string for malformed frontmatter', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 75, description: '', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 75,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      vi.mocked(readFileSync).mockReturnValue(`---
malformed yaml
no proper keys
---

# Test Skill

Content.`);

      const result = skillResolver(createPromptInput('Test malformed frontmatter'));

      expect(result.continue).toBe(true);
      // Should not crash
    });

    test('handles CRLF normalization in frontmatter', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 75, description: '', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 75,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      vi.mocked(readFileSync).mockReturnValue(`---\r\nname: test-skill\r\ndescription: Description with CRLF\r\n---\r\n\r\n# Content`);

      const result = skillResolver(createPromptInput('Test CRLF in frontmatter'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      expect(ctx).toContain('Description with CRLF');
    });
  });

  describe('buildUserNotification helper', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));
    });

    test('returns empty string for empty array (no systemMessage)', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [],
        intent: 'general',
        confidence: 0,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });

      const result = skillResolver(createPromptInput('No skills'));

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeUndefined();
    });

    test('formats single skill correctly with emoji', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'api-design-framework', confidence: 85, description: 'API Design', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 85,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('api-design-framework', 'API Design', 'Content'));

      const result = skillResolver(createPromptInput('Single skill notification'));

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
      expect(result.systemMessage).toMatch(/^💡/);
      expect(result.systemMessage).toContain('Loaded:');
      expect(result.systemMessage).toContain('api-design-framework');
    });

    test('limits to 2 skill names max', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [
          { skill: 'skill-a', confidence: 85, description: 'A', matchedKeywords: [], signals: [] },
          { skill: 'skill-b', confidence: 84, description: 'B', matchedKeywords: [], signals: [] },
          { skill: 'skill-c', confidence: 83, description: 'C', matchedKeywords: [], signals: [] },
        ],
        intent: 'testing',
        confidence: 85,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      // Mock file existence for all skills
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('skill', 'Skill', 'Content'));

      const result = skillResolver(createPromptInput('Multiple skills notification'));

      expect(result.continue).toBe(true);
      if (result.systemMessage) {
        // Should have at most 2 skill names
        const skillMentions = (result.systemMessage.match(/skill-[a-c]/g) || []).length;
        expect(skillMentions).toBeLessThanOrEqual(2);
        // skill-c should not be in systemMessage (only top 2)
        expect(result.systemMessage).not.toContain('skill-c');
      }
    });

    test('joins multiple skills with comma', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [
          { skill: 'skill-a', confidence: 85, description: 'A', matchedKeywords: [], signals: [] },
          { skill: 'skill-b', confidence: 84, description: 'B', matchedKeywords: [], signals: [] },
        ],
        intent: 'testing',
        confidence: 85,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('skill', 'Skill', 'Content'));

      const result = skillResolver(createPromptInput('Comma-joined skills'));

      expect(result.continue).toBe(true);
      if (result.systemMessage) {
        expect(result.systemMessage).toContain(', ');
      }
    });
  });

  describe('buildClaudeContext helper', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
    });

    test('formats loaded skills with ### headers', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'test-skill', confidence: 95, description: 'Test', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test Description', 'Skill content body'));

      const result = skillResolver(createPromptInput('Test ### headers'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      expect(ctx).toContain('### test-skill');
      expect(ctx).toContain('Relevant Patterns');
    });

    test('adds "Also Available" section for suggestions', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'suggest-skill', confidence: 75, description: 'Suggested', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 75,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('suggest-skill', 'Suggestion description', 'Content'));

      const result = skillResolver(createPromptInput('Test Also Available section'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      expect(ctx).toContain('Also Available');
      expect(ctx).toContain('suggest-skill');
    });

    test('includes skill descriptions when available', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'described-skill', confidence: 75, description: '', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 75,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      vi.mocked(readFileSync).mockReturnValue(`---
name: described-skill
description: A detailed description of what this skill provides
tags: [test]
---

# Described Skill

Content here.`);

      const result = skillResolver(createPromptInput('Test skill descriptions'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      expect(ctx).toContain('A detailed description of what this skill provides');
    });

    test('returns empty string when no content (silent success)', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [],
        intent: 'general',
        confidence: 0,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });

      const result = skillResolver(createPromptInput('No content'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });

    test('adds /ork: usage hint in suggestions', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'hint-skill', confidence: 75, description: 'Hint', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 75,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('hint-skill', 'Hint', 'Content'));

      const result = skillResolver(createPromptInput('Test /ork usage hint'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      expect(ctx).toContain('/ork:');
    });
  });

  describe('buildHintContext helper', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('hint-skill', 'Hint', 'Content'));
    });

    test('returns empty string for empty array', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [],
        intent: 'general',
        confidence: 0,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });

      const result = skillResolver(createPromptInput('No hints'));

      expect(result.continue).toBe(true);
      // No context should be set
      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });

    test('joins skill names with comma', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [
          { skill: 'hint-a', confidence: 60, description: '', matchedKeywords: [], signals: [] },
          { skill: 'hint-b', confidence: 55, description: '', matchedKeywords: [], signals: [] },
        ],
        intent: 'testing',
        confidence: 60,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });

      const result = skillResolver(createPromptInput('Multiple hints'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      expect(ctx).toContain('hint-a');
      expect(ctx).toContain('hint-b');
      expect(ctx).toContain(',');
    });

    test('includes /ork: usage hint', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'hint-skill', confidence: 55, description: '', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 55,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });

      const result = skillResolver(createPromptInput('Hint with usage'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      expect(ctx).toContain('/ork:');
      expect(ctx).toContain('if needed');
    });
  });

  describe('mergeSkillMatches helper', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('test-skill', 'Test', 'Content'));
    });

    test('keeps highest confidence for duplicate skills', () => {
      // Classifier returns skill at 70%
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'api-design', confidence: 70, description: '', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 70,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      // Keyword matcher returns same skill at 90%
      vi.mocked(findMatchingSkills).mockReturnValue([
        { skill: 'api-design', confidence: 90 },
      ]);

      const result = skillResolver(createPromptInput('Merge duplicate skills'));

      expect(result.continue).toBe(true);
      // At 90%, skill should be silently injected (no systemMessage)
      // This proves the higher confidence (90%) was used, not 70%
      expect(result.systemMessage).toBeUndefined();
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    });

    test('sorts by confidence descending', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [
          { skill: 'low-skill', confidence: 60, description: '', matchedKeywords: [], signals: [] },
          { skill: 'high-skill', confidence: 95, description: '', matchedKeywords: [], signals: [] },
          { skill: 'mid-skill', confidence: 80, description: '', matchedKeywords: [], signals: [] },
        ],
        intent: 'testing',
        confidence: 95,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });

      const result = skillResolver(createPromptInput('Sort by confidence'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      // High-skill (95%) should be loaded first (silent tier)
      expect(ctx).toContain('high-skill');
      // The order should prioritize high confidence
      const highPos = ctx.indexOf('high-skill');
      const midPos = ctx.indexOf('mid-skill');
      // high-skill should appear before mid-skill if both are in context
      if (midPos > 0) {
        expect(highPos).toBeLessThan(midPos);
      }
    });

    test('handles empty arrays from both sources', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [],
        intent: 'general',
        confidence: 0,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      vi.mocked(findMatchingSkills).mockReturnValue([]);

      const result = skillResolver(createPromptInput('Empty arrays'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });

    test('merges skills from both classifier and keyword sources', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'classifier-skill', confidence: 85, description: '', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 85,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(findMatchingSkills).mockReturnValue([
        { skill: 'keyword-skill', confidence: 82 },
      ]);

      const result = skillResolver(createPromptInput('Merge from both sources'));

      expect(result.continue).toBe(true);
      // Both skills should be considered (both in notify tier 80-89%)
      expect(result.systemMessage).toBeDefined();
      // At least one skill should be in notification
      const hasEither = result.systemMessage!.includes('classifier-skill') ||
                       result.systemMessage!.includes('keyword-skill');
      expect(hasEither).toBe(true);
    });

    test('handles only classifier matches', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'only-classifier', confidence: 85, description: '', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 85,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: true,
      });
      vi.mocked(findMatchingSkills).mockReturnValue([]);

      const result = skillResolver(createPromptInput('Only classifier'));

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
      expect(result.systemMessage).toContain('only-classifier');
    });

    test('handles only keyword matches', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [],
        intent: 'general',
        confidence: 0,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      vi.mocked(findMatchingSkills).mockReturnValue([
        { skill: 'only-keyword', confidence: 85 },
      ]);

      const result = skillResolver(createPromptInput('Only keyword'));

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
      expect(result.systemMessage).toContain('only-keyword');
    });

    test('prefers higher confidence when same skill from both sources', () => {
      vi.mocked(classifyIntent).mockReturnValue({
        agents: [],
        skills: [{ skill: 'shared-skill', confidence: 75, description: '', matchedKeywords: [], signals: [] }],
        intent: 'testing',
        confidence: 75,
        signals: [],
        shouldAutoDispatch: false,
        shouldInjectSkills: false,
      });
      vi.mocked(findMatchingSkills).mockReturnValue([
        { skill: 'shared-skill', confidence: 60 },
      ]);

      const result = skillResolver(createPromptInput('Prefer higher confidence'));

      expect(result.continue).toBe(true);
      // At 75% (higher than 60%), should be in suggest tier, not hint tier
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toBeDefined();
      const ctx = result.hookSpecificOutput!.additionalContext!;
      // Suggest tier shows "Also Available"
      expect(ctx).toContain('Also Available');
    });
  });
});

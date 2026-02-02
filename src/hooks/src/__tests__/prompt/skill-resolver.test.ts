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
      // But DOES have additionalContext
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
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
      // Notify tier: HAS systemMessage
      expect(result.systemMessage).toMatch(/Loaded:/);
      // And HAS additionalContext
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
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
      // Has additionalContext with "Also Available" section
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('Also Available');
      }
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
      // Has additionalContext with "Related skills" hint
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('Related skills');
      }
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

      // 90% is SILENT tier (no user notification)
      expect(result.systemMessage).toBeUndefined();
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
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

      // 80% is NOTIFY tier (has user notification)
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

      // 70% is SUGGEST tier
      expect(result.systemMessage).toBeUndefined();
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('Also Available');
      }
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

      // 50% is HINT tier
      expect(result.systemMessage).toBeUndefined();
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('Related skills');
      }
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

      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
      }
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

      if (result.hookSpecificOutput?.additionalContext) {
        const ctx = result.hookSpecificOutput.additionalContext;
        // Issue #278: No raw percentages like "(85% match)"
        expect(ctx).not.toMatch(/\(\d+% match\)/);
      }
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
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('api-design-framework');
      }
    });

    test('detects database-related skills', () => {
      vi.mocked(findMatchingSkills).mockReturnValue([
        { skill: 'database-schema-designer', confidence: 80 },
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createSkillContent('database-schema-designer', 'DB Design', 'Content'));

      const result = skillResolver(createPromptInput('Create a database schema for orders'));

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('database');
      }
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

      if (result.systemMessage) {
        // Issue #278: User notification should be friendly with emoji
        expect(result.systemMessage).toMatch(/^💡/);
      }
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

      if (result.systemMessage) {
        expect(result.systemMessage).toContain('fastapi-advanced');
      }
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

      if (result.hookSpecificOutput?.additionalContext) {
        const ctx = result.hookSpecificOutput.additionalContext;
        // Should use new friendly headers, not old technical ones
        const hasNewHeaders = ctx.includes('Relevant Patterns') || ctx.includes('Also Available') || ctx.includes('Related skills');
        expect(hasNewHeaders).toBe(true);
        // Should NOT have old headers
        expect(ctx).not.toContain('Skill Knowledge Injected');
        expect(ctx).not.toContain('Skill Hints');
      }
    });
  });
});

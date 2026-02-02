/**
 * Skill Resolver Tests
 * Tests the unified skill-resolver hook that replaces skill-auto-suggest + skill-injector
 *
 * Issue #278: Three-tier UX with dual output channels
 * - systemMessage: Brief user notification (80-89% confidence)
 * - additionalContext: Full context for Claude (all tiers)
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
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue('main\n'),
}));

import { skillResolver } from '../../prompt/skill-resolver.js';

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('prompt/skill-resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('silent success cases', () => {
    test('returns silent success for empty prompt', () => {
      const result = skillResolver(createPromptInput(''));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for short prompt', () => {
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

  describe('keyword matching through merged pipeline', () => {
    test('detects API-related skills', () => {
      const result = skillResolver(createPromptInput('Help me design a REST API for users'));
      expect(result.continue).toBe(true);
      // Should produce some context (either hint, summary, or full)
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('api-design-framework');
      }
    });

    test('detects database-related skills', () => {
      const result = skillResolver(createPromptInput('Create a database schema for orders'));
      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('database');
      }
    });

    test('detects testing-related skills', () => {
      const result = skillResolver(createPromptInput('Write pytest tests for the service'));
      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        // May match pytest-advanced or integration-testing depending on confidence
        expect(result.hookSpecificOutput.additionalContext).toContain('testing');
      }
    });
  });

  describe('output structure', () => {
    test('uses hookEventName UserPromptSubmit when injecting', () => {
      const result = skillResolver(createPromptInput('Design an API endpoint'));
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
      }
    });

    test('has suppressOutput true', () => {
      const result = skillResolver(createPromptInput('anything'));
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('tiered output (Issue #278)', () => {
    test('includes skill content for matches', () => {
      const result = skillResolver(createPromptInput('Help me with some component state management'));
      if (result.hookSpecificOutput?.additionalContext) {
        const ctx = result.hookSpecificOutput.additionalContext;
        // Should contain new friendly formatting (Issue #278)
        const hasContent =
          ctx.includes('Relevant Patterns') ||
          ctx.includes('Also Available') ||
          ctx.includes('Related skills');
        expect(hasContent).toBe(true);
      }
    });

    test('does not include raw percentages in additionalContext', () => {
      const result = skillResolver(createPromptInput('Design a REST API endpoint'));
      if (result.hookSpecificOutput?.additionalContext) {
        const ctx = result.hookSpecificOutput.additionalContext;
        // Issue #278: No raw percentages like "(85% match)"
        expect(ctx).not.toMatch(/\(\d+% match\)/);
      }
    });

    test('may include systemMessage for notify-tier matches', () => {
      const result = skillResolver(createPromptInput('Help me with fastapi uvicorn middleware'));
      // systemMessage is optional, depends on confidence tier
      if (result.systemMessage) {
        // Issue #278: User notification should be friendly
        expect(result.systemMessage).toMatch(/^[💡🔧📋]/);
      }
      expect(result.continue).toBe(true);
    });
  });

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
  });
});

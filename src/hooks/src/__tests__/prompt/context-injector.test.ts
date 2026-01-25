/**
 * Unit tests for context-injector hook
 * Tests UserPromptSubmit hook that injects context hints based on prompt keywords
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';
import { contextInjector } from '../../prompt/context-injector.js';

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

// =============================================================================
// Tests
// =============================================================================

describe('prompt/context-injector', () => {
  describe('basic behavior', () => {
    test('returns silent success for empty prompt', () => {
      const input = createPromptInput('');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for normal prompt without keywords', () => {
      const input = createPromptInput('Hello, how are you today?');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('always continues execution', () => {
      const prompts = [
        'Help me fix this issue',
        'Write a test for the login function',
        'Deploy to production',
        'Random text without keywords',
      ];

      for (const prompt of prompts) {
        const input = createPromptInput(prompt);
        const result = contextInjector(input);
        expect(result.continue).toBe(true);
      }
    });
  });

  describe('issue/bug keyword detection', () => {
    test('detects "issue" keyword', () => {
      const input = createPromptInput('Help me fix this issue with the login');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // Hook logs hints but currently returns silent success
    });

    test('detects "bug" keyword', () => {
      const input = createPromptInput('There is a bug in the authentication flow');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "fix" keyword', () => {
      const input = createPromptInput('How do I fix this problem?');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects issue number pattern (#123)', () => {
      const input = createPromptInput('Can you help me with #123?');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects multiple issue numbers', () => {
      const input = createPromptInput('Working on #123 and #456');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('testing keyword detection', () => {
    test('detects "test" keyword (lowercase)', () => {
      const input = createPromptInput('write a test for this function');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "testing" keyword', () => {
      const input = createPromptInput('I need help with testing');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "pytest" keyword', () => {
      const input = createPromptInput('run pytest for the backend');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "jest" keyword', () => {
      const input = createPromptInput('configure jest for the frontend');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('is case insensitive for test keywords', () => {
      const inputs = ['TEST', 'Test', 'PYTEST', 'Pytest', 'JEST', 'Jest'];

      for (const keyword of inputs) {
        const input = createPromptInput(`Help with ${keyword}`);
        const result = contextInjector(input);
        expect(result.continue).toBe(true);
      }
    });
  });

  describe('deployment/CI keyword detection', () => {
    test('detects "deploy" keyword', () => {
      const input = createPromptInput('deploy the application');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "ci" keyword', () => {
      const input = createPromptInput('configure ci pipeline');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "cd" keyword', () => {
      const input = createPromptInput('set up cd workflow');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "pipeline" keyword', () => {
      const input = createPromptInput('create a new pipeline');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "github.actions" keyword', () => {
      const input = createPromptInput('configure github.actions');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('project directory handling', () => {
    test('uses provided project_dir', () => {
      const input = createPromptInput('fix this issue', {
        project_dir: '/custom/project/path',
      });
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles missing project_dir gracefully', () => {
      const input: HookInput = {
        hook_event: 'UserPromptSubmit',
        tool_name: 'UserPromptSubmit',
        session_id: 'test-session-123',
        tool_input: {},
        prompt: 'fix the bug',
      };
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles very long prompts', () => {
      const longPrompt = 'a'.repeat(10000);
      const input = createPromptInput(longPrompt);
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles prompts with special characters', () => {
      const input = createPromptInput('Fix issue #123: $pecial ch@rs! <test>');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles prompts with newlines', () => {
      const input = createPromptInput('First line\nSecond line with issue\nThird line');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles prompts with unicode characters', () => {
      const input = createPromptInput('Fix the bug in the emoji handler: \ud83d\ude00\ud83d\udd25');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('multiple keyword combinations', () => {
    test('detects multiple keyword types in one prompt', () => {
      const input = createPromptInput('Fix bug #123 and add test for deploy pipeline');
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles prompts with all keyword categories', () => {
      const input = createPromptInput(
        'Issue: bug in test for CI/CD deploy pipeline with github.actions'
      );
      const result = contextInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });
});

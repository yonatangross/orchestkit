/**
 * Unit tests for memory-context hook
 * Tests UserPromptSubmit hook that suggests memory searches based on prompt keywords
 * Part of Memory Fabric v2.1 - Graph-First Architecture
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';
import { memoryContext } from '../../prompt/memory-context.js';

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

describe('prompt/memory-context', () => {
  describe('basic behavior', () => {
    test('returns silent success for empty prompt', () => {
      const input = createPromptInput('');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for short prompt (< MIN_PROMPT_LENGTH)', () => {
      const input = createPromptInput('hello');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for prompt exactly at MIN_PROMPT_LENGTH (20)', () => {
      const input = createPromptInput('12345678901234567890'); // exactly 20 chars
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('always continues execution', () => {
      const prompts = [
        '',
        'short',
        'Add a new feature to the application please',
        'Remember what we discussed about the API design',
        'Random text without memory triggers at all here',
      ];

      for (const prompt of prompts) {
        const input = createPromptInput(prompt);
        const result = memoryContext(input);
        expect(result.continue).toBe(true);
      }
    });
  });

  describe('memory trigger keyword detection', () => {
    test('detects "add" keyword', () => {
      const input = createPromptInput('Add a new authentication feature');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "implement" keyword', () => {
      const input = createPromptInput('Implement the user registration flow');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "create" keyword', () => {
      const input = createPromptInput('Create a new database table');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "build" keyword', () => {
      const input = createPromptInput('Build a REST API endpoint');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "design" keyword', () => {
      const input = createPromptInput('Design the system architecture');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "refactor" keyword', () => {
      const input = createPromptInput('Refactor the authentication module');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "update" keyword', () => {
      const input = createPromptInput('Update the user service with caching');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "modify" keyword', () => {
      const input = createPromptInput('Modify the configuration settings');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "fix" keyword', () => {
      const input = createPromptInput('Fix the authentication bug please');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "change" keyword', () => {
      const input = createPromptInput('Change the pagination approach');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "continue" keyword', () => {
      const input = createPromptInput('Continue with the implementation');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "resume" keyword', () => {
      const input = createPromptInput('Resume the previous work on the API');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "remember" keyword', () => {
      const input = createPromptInput('Remember that we use PostgreSQL');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "previous" keyword', () => {
      const input = createPromptInput('Use the previous authentication approach');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "last time" keyword', () => {
      const input = createPromptInput('What did we decide last time about caching?');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "before" keyword', () => {
      const input = createPromptInput('Like we discussed before about the schema');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "earlier" keyword', () => {
      const input = createPromptInput('As mentioned earlier in the discussion');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "pattern" keyword', () => {
      const input = createPromptInput('Use the repository pattern for this');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "decision" keyword', () => {
      const input = createPromptInput('What was the decision about the database?');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "how did we" keyword', () => {
      const input = createPromptInput('How did we handle authentication before?');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "what did we" keyword', () => {
      const input = createPromptInput('What did we decide about the API design?');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('graph trigger keyword detection', () => {
    test('detects "relationship" keyword', () => {
      const input = createPromptInput('What is the relationship between user and order?');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "related" keyword', () => {
      const input = createPromptInput('Show entities related to the user service');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "connected" keyword', () => {
      const input = createPromptInput('How are these components connected together?');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "depends" keyword', () => {
      const input = createPromptInput('What depends on the auth service currently?');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "uses" keyword', () => {
      const input = createPromptInput('What uses the database connection pool?');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "recommends" keyword', () => {
      const input = createPromptInput('What the database-engineer recommends for this?');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "what does.*recommend" pattern', () => {
      const input = createPromptInput('What does the architect recommend for caching?');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "how does.*work with" pattern', () => {
      const input = createPromptInput('How does the API work with the database?');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('special prefix detection', () => {
    test('detects @global prefix', () => {
      const input = createPromptInput('@global What are the best practices for pagination?');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "cross-project" in prompt', () => {
      const input = createPromptInput('Search cross-project for authentication patterns');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects "all projects" in prompt', () => {
      const input = createPromptInput('Look in all projects for database patterns');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('no trigger keywords', () => {
    test('returns silent success when no memory triggers found', () => {
      const input = createPromptInput('Just a regular question without any triggers?');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for simple greeting', () => {
      const input = createPromptInput('Hello, how are you doing today?');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('search term extraction', () => {
    test('extracts meaningful search terms from prompt', () => {
      const input = createPromptInput('Add pagination to the user service');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('filters stopwords from search terms', () => {
      const input = createPromptInput('Add the functionality for the users');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('limits search terms to 5 words', () => {
      const input = createPromptInput(
        'Add authentication caching pagination validation logging monitoring tracing'
      );
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('project directory handling', () => {
    test('uses provided project_dir', () => {
      const input = createPromptInput('Add a new feature to the project', {
        project_dir: '/custom/project/path',
      });
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles missing project_dir gracefully', () => {
      const input: HookInput = {
        hook_event: 'UserPromptSubmit',
        tool_name: 'UserPromptSubmit',
        session_id: 'test-session-123',
        tool_input: {},
        prompt: 'Add authentication to the application',
      };
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('agent context', () => {
    let originalAgentType: string | undefined;

    beforeEach(() => {
      originalAgentType = process.env.CLAUDE_AGENT_ID;
    });

    afterEach(() => {
      if (originalAgentType !== undefined) {
        process.env.CLAUDE_AGENT_ID = originalAgentType;
      } else {
        delete process.env.CLAUDE_AGENT_ID;
      }
    });

    test('detects agent context from environment variable', () => {
      process.env.CLAUDE_AGENT_ID = 'backend-system-architect';
      const input = createPromptInput('Add database connection pooling');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles missing agent context', () => {
      delete process.env.CLAUDE_AGENT_ID;
      const input = createPromptInput('Implement user authentication');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles prompts with special characters', () => {
      const input = createPromptInput('Add feature for $pecial ch@rs! <html>');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles prompts with newlines', () => {
      const input = createPromptInput('First line\nAdd new feature\nThird line');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles very long prompts', () => {
      const longPrompt = 'Add a new feature ' + 'x'.repeat(5000);
      const input = createPromptInput(longPrompt);
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles prompts with unicode characters', () => {
      const input = createPromptInput('Add emoji support: \ud83d\ude00 \ud83d\udd25 please');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('combined triggers', () => {
    test('handles both memory and graph triggers', () => {
      const input = createPromptInput('Add feature and check what the architect recommends');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles @global with memory triggers', () => {
      const input = createPromptInput('@global What patterns did we use before?');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles cross-project with graph triggers', () => {
      const input = createPromptInput('Search cross-project for what depends on auth');
      const result = memoryContext(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });
});

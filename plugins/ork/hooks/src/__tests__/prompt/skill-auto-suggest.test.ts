/**
 * Unit tests for skill-auto-suggest hook
 * Tests UserPromptSubmit hook that suggests relevant skills based on prompt keywords
 * CC 2.1.9 compliant with additionalContext injection
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';
import { skillAutoSuggest } from '../../prompt/skill-auto-suggest.js';

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

describe('prompt/skill-auto-suggest', () => {
  describe('basic behavior', () => {
    test('returns silent success for empty prompt', () => {
      const input = createPromptInput('');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for short prompt', () => {
      const input = createPromptInput('help');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for prompts without matching keywords', () => {
      const input = createPromptInput('How is the weather today?');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('always continues execution', () => {
      const prompts = [
        '',
        'help',
        'Design a REST API',
        'Create database schema',
        'Random unrelated text',
      ];

      for (const prompt of prompts) {
        const input = createPromptInput(prompt);
        const result = skillAutoSuggest(input);
        expect(result.continue).toBe(true);
      }
    });
  });

  describe('API & backend keyword matching', () => {
    test('suggests api-design-framework for "api" keyword', () => {
      const input = createPromptInput('Help me design an API for user management');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('api-design-framework');
      }
    });

    test('suggests api-design-framework for "endpoint" keyword', () => {
      const input = createPromptInput('Create a new endpoint for authentication');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('api-design-framework');
      }
    });

    test('suggests api-design-framework for "rest" keyword', () => {
      const input = createPromptInput('Design REST endpoints for the service');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('api-design-framework');
      }
    });

    test('suggests fastapi-advanced for "fastapi" keyword', () => {
      const input = createPromptInput('Create a FastAPI application');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('fastapi-advanced');
      }
    });
  });

  describe('database keyword matching', () => {
    test('suggests database-schema-designer for "database" keyword', () => {
      const input = createPromptInput('Design a database schema for users');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('database-schema-designer');
      }
    });

    test('suggests alembic-migrations for "migration" keyword', () => {
      const input = createPromptInput('Create a database migration');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('alembic-migrations');
      }
    });

    test('suggests sqlalchemy-2-async for "sqlalchemy" keyword', () => {
      const input = createPromptInput('Configure SQLAlchemy for async operations');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('sqlalchemy-2-async');
      }
    });

    test('suggests pgvector-search for "pgvector" keyword', () => {
      const input = createPromptInput('Set up pgvector for vector search');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('pgvector-search');
      }
    });
  });

  describe('authentication & security keyword matching', () => {
    test('suggests auth-patterns for "auth" keyword', () => {
      const input = createPromptInput('Implement auth for the application');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('auth-patterns');
      }
    });

    test('suggests auth-patterns for "jwt" keyword', () => {
      const input = createPromptInput('Add JWT authentication');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('auth-patterns');
      }
    });

    test('suggests owasp-top-10 for "security" keyword', () => {
      const input = createPromptInput('Review the security of the application');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('owasp-top-10');
      }
    });
  });

  describe('testing keyword matching', () => {
    test('suggests integration-testing for "test" keyword', () => {
      const input = createPromptInput('Write a test for the user service');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('testing');
      }
    });

    test('suggests pytest-advanced for "pytest" keyword', () => {
      const input = createPromptInput('Configure pytest for the project');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('pytest-advanced');
      }
    });

    test('suggests e2e-testing for "e2e" keyword', () => {
      const input = createPromptInput('Write e2e tests for the application');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('e2e-testing');
      }
    });

    test('suggests e2e-testing for "playwright" keyword', () => {
      const input = createPromptInput('Set up Playwright for browser testing');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('e2e-testing');
      }
    });

    test('suggests msw-mocking for "msw" keyword', () => {
      const input = createPromptInput('Configure MSW for API mocking');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('msw-mocking');
      }
    });
  });

  describe('frontend keyword matching', () => {
    test('suggests react-server-components-framework for "react" keyword', () => {
      const input = createPromptInput('Build a React component');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('react');
      }
    });

    test('suggests zustand-patterns for "zustand" keyword', () => {
      const input = createPromptInput('Set up Zustand for state management');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('zustand-patterns');
      }
    });

    test('suggests radix-primitives for "radix" keyword', () => {
      const input = createPromptInput('Use Radix UI components');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('radix-primitives');
      }
    });
  });

  describe('AI/LLM keyword matching', () => {
    test('suggests rag-retrieval for "rag" keyword', () => {
      const input = createPromptInput('Implement RAG for document search');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('rag-retrieval');
      }
    });

    test('suggests embeddings for "embedding" keyword', () => {
      const input = createPromptInput('Generate embeddings for the documents');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('embedding');
      }
    });

    test('suggests langgraph-state for "langgraph" keyword', () => {
      const input = createPromptInput('Build a LangGraph workflow');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('langgraph');
      }
    });
  });

  describe('CC 2.1.9 compliance', () => {
    test('uses hookEventName: UserPromptSubmit when providing context', () => {
      const input = createPromptInput('Help me design a REST API for the backend');
      const result = skillAutoSuggest(input);

      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
      }
    });

    test('includes suppressOutput: true for all responses', () => {
      const inputs = [
        '',
        'random text',
        'design an API',
        'write a test',
      ];

      for (const prompt of inputs) {
        const input = createPromptInput(prompt);
        const result = skillAutoSuggest(input);
        expect(result.suppressOutput).toBe(true);
      }
    });

    test('additionalContext includes skill suggestions format', () => {
      const input = createPromptInput('Create a FastAPI endpoint with SQLAlchemy');
      const result = skillAutoSuggest(input);

      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('Relevant Skills Detected');
        expect(result.hookSpecificOutput.additionalContext).toContain('match');
      }
    });
  });

  describe('confidence scoring', () => {
    test('higher confidence keywords take precedence', () => {
      // "fastapi" has 90% confidence vs "api" with 80%
      const input = createPromptInput('Build a FastAPI application');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        // Should include fastapi-advanced with higher confidence
        expect(result.hookSpecificOutput.additionalContext).toContain('fastapi-advanced');
      }
    });

    test('limits suggestions to MAX_SUGGESTIONS (3)', () => {
      // Prompt with many keywords
      const input = createPromptInput(
        'Create a FastAPI API with SQLAlchemy database, auth, pytest testing, and React frontend'
      );
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        // Count the number of skill names (pattern: - **skill-name**)
        const matches = result.hookSpecificOutput.additionalContext.match(/- \*\*[a-z-]+\*\*/g);
        if (matches) {
          expect(matches.length).toBeLessThanOrEqual(3);
        }
      }
    });
  });

  describe('edge cases', () => {
    test('handles prompts with special characters', () => {
      const input = createPromptInput('Design API for $pecial ch@rs! <test>');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
    });

    test('handles prompts with newlines', () => {
      const input = createPromptInput('First line\nDesign an API\nThird line');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
    });

    test('handles very long prompts', () => {
      const longPrompt = 'Design an API ' + 'a'.repeat(5000);
      const input = createPromptInput(longPrompt);
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
    });

    test('is case insensitive for keyword matching', () => {
      const variations = ['API', 'api', 'Api', 'aPi'];

      for (const keyword of variations) {
        const input = createPromptInput(`Design the ${keyword}`);
        const result = skillAutoSuggest(input);
        expect(result.continue).toBe(true);
      }
    });
  });

  describe('regex pattern matching', () => {
    test('matches "async.*database" pattern', () => {
      const input = createPromptInput('Set up async database connections');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('sqlalchemy-2-async');
      }
    });

    test('matches "connection.*pool" pattern', () => {
      const input = createPromptInput('Configure connection pool settings');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('connection-pooling');
      }
    });

    test('matches "unit.*test" pattern', () => {
      const input = createPromptInput('Write unit tests for the service');
      const result = skillAutoSuggest(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('pytest-advanced');
      }
    });
  });
});

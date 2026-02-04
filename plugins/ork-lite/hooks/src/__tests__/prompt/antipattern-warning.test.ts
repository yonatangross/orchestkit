/**
 * Unit tests for antipattern-warning hook
 * Tests UserPromptSubmit hook that detects and warns about known anti-patterns
 * CC 2.1.9 compliant with additionalContext injection
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';
import { antipatternWarning } from '../../prompt/antipattern-warning.js';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

describe('prompt/antipattern-warning', () => {
  describe('basic behavior', () => {
    test('returns silent success for empty prompt', () => {
      const input = createPromptInput('');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for non-implementation prompts', () => {
      const input = createPromptInput('What is the weather like today?');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('always continues execution', () => {
      const prompts = [
        '',
        'hello world',
        'implement offset pagination',
        'create a secure endpoint',
        'random question without triggers',
      ];

      for (const prompt of prompts) {
        const input = createPromptInput(prompt);
        const result = antipatternWarning(input);
        expect(result.continue).toBe(true);
      }
    });
  });

  describe('implementation keyword detection', () => {
    test('detects "implement" keyword', () => {
      const input = createPromptInput('Implement a user service');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
      // Should process as implementation prompt
    });

    test('detects "add" keyword', () => {
      const input = createPromptInput('Add authentication to the API');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('detects "create" keyword', () => {
      const input = createPromptInput('Create a new database table');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('detects "build" keyword', () => {
      const input = createPromptInput('Build a REST API endpoint');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('detects "set up" keyword', () => {
      const input = createPromptInput('Set up caching for the application');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('detects "setup" keyword', () => {
      const input = createPromptInput('Setup database connections');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('detects "configure" keyword', () => {
      const input = createPromptInput('Configure the authentication system');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('detects "use" keyword', () => {
      const input = createPromptInput('Use Redis for session storage');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('detects "write" keyword', () => {
      const input = createPromptInput('Write a function for validation');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('detects "make" keyword', () => {
      const input = createPromptInput('Make a caching layer');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('detects "develop" keyword', () => {
      const input = createPromptInput('Develop an API client');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });
  });

  describe('known anti-pattern detection', () => {
    test('warns about offset pagination', () => {
      const input = createPromptInput('Implement offset pagination for the list endpoint');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('pagination');
        expect(result.hookSpecificOutput.additionalContext).toContain('cursor');
      }
    });

    test('warns about manual JWT validation', () => {
      const input = createPromptInput('Implement manual jwt validation');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('JWT');
      }
    });

    test('warns about storing passwords in plaintext', () => {
      const input = createPromptInput('Add storing passwords in plaintext');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('password');
      }
    });

    test('warns about global state', () => {
      const input = createPromptInput('Add global state for configuration');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('global');
      }
    });

    test('warns about synchronous file operations', () => {
      const input = createPromptInput('Use synchronous file operations');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('async');
      }
    });

    test('warns about n+1 query', () => {
      const input = createPromptInput('Implement feature that causes n+1 query');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('N+1');
      }
    });

    test('warns about polling for real-time', () => {
      const input = createPromptInput('Use polling for real-time updates');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('Polling');
      }
    });
  });

  describe('CC 2.1.9 compliance', () => {
    test('uses hookEventName: UserPromptSubmit when providing context', () => {
      const input = createPromptInput('Implement offset pagination');
      const result = antipatternWarning(input);

      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
      }
    });

    test('includes suppressOutput: true for non-warning responses', () => {
      const input = createPromptInput('What is the weather?');
      const result = antipatternWarning(input);

      expect(result.suppressOutput).toBe(true);
    });

    test('additionalContext includes warning format', () => {
      const input = createPromptInput('Implement offset pagination');
      const result = antipatternWarning(input);

      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('Anti-Pattern Warning');
      }
    });
  });

  describe('category detection', () => {
    test('detects pagination category', () => {
      const input = createPromptInput('Implement pagination for the API');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('detects authentication category', () => {
      const input = createPromptInput('Implement auth with JWT tokens');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('detects caching category', () => {
      const input = createPromptInput('Implement caching with Redis');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('detects database category', () => {
      const input = createPromptInput('Implement database queries');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('detects api category', () => {
      const input = createPromptInput('Implement API endpoints');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('defaults to general category', () => {
      const input = createPromptInput('Implement a new feature');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });
  });

  describe('mem0 search hints', () => {
    test('includes mem0 search hints for implementation prompts', () => {
      const input = createPromptInput('Implement user authentication');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('mcp__mem0__search_memories');
      }
    });

    test('includes project anti-patterns search hint', () => {
      const input = createPromptInput('Build a new API endpoint');
      const result = antipatternWarning(input);

      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('anti-patterns');
      }
    });

    test('includes best practices search hint', () => {
      const input = createPromptInput('Develop a caching solution');
      const result = antipatternWarning(input);

      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('best practices');
      }
    });

    test('includes cross-project failures search hint', () => {
      const input = createPromptInput('Create a database migration');
      const result = antipatternWarning(input);

      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('Cross-project');
      }
    });
  });

  describe('learned patterns file', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `antipattern-test-${Date.now()}`);
      mkdirSync(join(tempDir, '.claude', 'feedback'), { recursive: true });
    });

    afterEach(() => {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    test('reads learned patterns from file', () => {
      const patternsFile = join(tempDir, '.claude', 'feedback', 'learned-patterns.json');
      writeFileSync(
        patternsFile,
        JSON.stringify({
          patterns: [
            { text: 'offset pagination causes issues', outcome: 'failed' },
            { text: 'cursor pagination works well', outcome: 'success' },
          ],
        })
      );

      const input = createPromptInput('Implement offset feature', {
        project_dir: tempDir,
      });
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('handles missing patterns file gracefully', () => {
      const input = createPromptInput('Implement new feature', {
        project_dir: tempDir,
      });
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles malformed patterns file gracefully', () => {
      const patternsFile = join(tempDir, '.claude', 'feedback', 'learned-patterns.json');
      writeFileSync(patternsFile, 'invalid json');

      const input = createPromptInput('Implement new feature', {
        project_dir: tempDir,
      });
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });
  });

  describe('project directory handling', () => {
    test('uses provided project_dir', () => {
      const input = createPromptInput('Implement offset pagination', {
        project_dir: '/custom/project/path',
      });
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('handles missing project_dir gracefully', () => {
      const input: HookInput = {
        hook_event: 'UserPromptSubmit',
        tool_name: 'UserPromptSubmit',
        session_id: 'test-session-123',
        tool_input: {},
        prompt: 'Implement offset pagination',
      };
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles prompts with special characters', () => {
      const input = createPromptInput('Implement $pecial ch@rs! <test>');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('handles prompts with newlines', () => {
      const input = createPromptInput('First line\nImplement offset pagination\nThird line');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('handles very long prompts', () => {
      const longPrompt = 'Implement offset pagination ' + 'x'.repeat(5000);
      const input = createPromptInput(longPrompt);
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('handles prompts with unicode characters', () => {
      const input = createPromptInput('Implement feature with emoji: \ud83d\ude00 \ud83d\udd25');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
    });

    test('is case insensitive for anti-pattern detection', () => {
      const variations = [
        'Implement OFFSET PAGINATION',
        'implement Offset Pagination',
        'IMPLEMENT offset pagination',
      ];

      for (const prompt of variations) {
        const input = createPromptInput(prompt);
        const result = antipatternWarning(input);
        expect(result.continue).toBe(true);
        if (result.hookSpecificOutput?.additionalContext) {
          expect(result.hookSpecificOutput.additionalContext).toContain('pagination');
        }
      }
    });
  });

  describe('multiple anti-patterns', () => {
    test('detects multiple anti-patterns in one prompt', () => {
      const input = createPromptInput(
        'Implement offset pagination with global state and synchronous file operations'
      );
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).toContain('Anti-Pattern Warning');
      }
    });
  });

  describe('non-triggering prompts', () => {
    test('does not warn for safe implementation prompts', () => {
      const input = createPromptInput('Implement cursor pagination with async operations');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
      // Should not contain anti-pattern warnings (only mem0 hints)
      if (result.hookSpecificOutput?.additionalContext) {
        expect(result.hookSpecificOutput.additionalContext).not.toContain('offset pagination');
      }
    });

    test('does not trigger for questions', () => {
      const input = createPromptInput('What is offset pagination?');
      const result = antipatternWarning(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });
  });
});

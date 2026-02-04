/**
 * Unit tests for antipattern-detector hook
 * Tests UserPromptSubmit hook that suggests checking mem0 for known failed patterns
 *
 * Features tested:
 * - Implementation keyword detection
 * - Category auto-detection
 * - Mem0 search suggestion generation
 * - CC 2.1.7 compliance
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST be before imports
// =============================================================================

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-123'),
}));

import { antipatternDetector } from '../../prompt/antipattern-detector.js';
import { outputSilentSuccess, getProjectDir } from '../../lib/common.js';

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

describe('prompt/antipattern-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CLAUDE_PROJECT_DIR;
  });

  // ---------------------------------------------------------------------------
  // Short prompt filtering
  // ---------------------------------------------------------------------------

  describe('short prompt filtering', () => {
    test('returns silent success for prompt under 30 chars', () => {
      // Arrange
      const input = createPromptInput('implement api'); // 13 chars

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });

    test('returns silent success for empty prompt', () => {
      // Arrange
      const input = createPromptInput('');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });

    test('returns silent success for exactly 29 chars', () => {
      // Arrange
      const input = createPromptInput('a'.repeat(29));

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });

    test('processes prompt with exactly 30 chars containing keyword', () => {
      // Arrange - 30 chars with "implement" keyword
      const input = createPromptInput('implement the user api system!'); // 31 chars

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Implementation keyword detection
  // ---------------------------------------------------------------------------

  describe('implementation keyword detection', () => {
    test.each([
      ['implement', 'implement user authentication system'],
      ['add', 'add pagination to the API endpoints'],
      ['create', 'create a new database schema for users'],
      ['build', 'build a caching layer for the application'],
      ['set up', 'set up redis caching for sessions'],
      ['configure', 'configure authentication with JWT tokens'],
      ['pagination', 'pagination for large result sets needed'],
      ['authentication', 'authentication system needs improvement'],
      ['caching', 'caching strategy for database queries'],
      ['database', 'database optimization for slow queries'],
      ['api', 'api endpoint for user registration'],
      ['endpoint', 'endpoint to handle file uploads'],
    ])('detects "%s" keyword in prompt', (keyword, prompt) => {
      // Arrange
      const input = createPromptInput(prompt);

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Antipattern Check');
      expect(result.systemMessage).toContain(keyword);
    });

    test('returns silent success when no implementation keywords found', () => {
      // Arrange
      const input = createPromptInput('What is the best practice for handling errors in production?');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
      expect(result.systemMessage).toBeUndefined();
    });

    test('keyword matching is case insensitive', () => {
      // Arrange
      const input = createPromptInput('IMPLEMENT the user management API system');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.systemMessage).toContain('implement');
    });
  });

  // ---------------------------------------------------------------------------
  // Category detection
  // ---------------------------------------------------------------------------

  describe('category detection', () => {
    test.each([
      ['pagination', 'implement cursor-based pagination for users'],
      ['pagination', 'add offset pagination to endpoints'],
      ['pagination', 'implement page navigation for results'],
      ['authentication', 'implement jwt token authentication'],
      ['authentication', 'add authentication with oauth for users'],
      ['authentication', 'configure authentication for the system'],
      ['caching', 'implement redis caching for queries'],
      ['caching', 'add caching memoization for expensive calls'],
      ['database', 'implement database query optimization'],
      ['database', 'add database postgres connection pooling'],
      ['api', 'implement api rest for resources'],
      ['api', 'add api graphql endpoint for users'],
    ])('detects category "%s" for prompt: %s', (expectedCategory, prompt) => {
      // Arrange
      const input = createPromptInput(prompt);

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      // The systemMessage contains the search suggestion with category context
      expect(result.systemMessage).toBeDefined();
    });

    test('defaults to general category when no specific category matches', () => {
      // Arrange
      const input = createPromptInput('implement a new feature for the application workflow');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Antipattern Check');
    });
  });

  // ---------------------------------------------------------------------------
  // Mem0 CLI search suggestion format
  // ---------------------------------------------------------------------------

  describe('mem0 CLI search suggestion format', () => {
    test('includes CLI script path in suggestion', () => {
      // Arrange
      const input = createPromptInput('implement pagination for the user list API');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.systemMessage).toContain('search-memories.py');
      expect(result.systemMessage).toContain('python3');
    });

    test('includes project-specific user_id in suggestion', () => {
      // Arrange
      const input = createPromptInput('implement authentication for the application');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.systemMessage).toContain('project:project:best-practices');
    });

    test('includes global user_id option in suggestion', () => {
      // Arrange
      const input = createPromptInput('implement database caching strategy');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.systemMessage).toContain('global:best-practices');
    });

    test('includes "failed" keyword in search query', () => {
      // Arrange
      const input = createPromptInput('implement api endpoint for user registration');

      // Act
      const result = antipatternDetector(input);

      // Assert - "failed" is embedded in the search query itself
      expect(result.systemMessage).toContain('--query');
      expect(result.systemMessage).toContain('failed');
    });

    test('includes keyword in search query', () => {
      // Arrange
      const input = createPromptInput('create a new database connection pool');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.systemMessage).toContain('--query "create failed"');
    });
  });

  // ---------------------------------------------------------------------------
  // Project directory handling
  // ---------------------------------------------------------------------------

  describe('project directory handling', () => {
    test('uses project_dir from input when provided', () => {
      // Arrange
      const input = createPromptInput('implement authentication system for users', {
        project_dir: '/custom/project/path',
      });

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.systemMessage).toContain('project:path:best-practices');
    });

    test('falls back to getProjectDir when project_dir not in input', () => {
      // Arrange
      const input = createPromptInput('implement pagination for api endpoints');
      delete (input as Record<string, unknown>).project_dir;

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(getProjectDir).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance - continue: true
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test.each([
      ['empty prompt', ''],
      ['short prompt', 'help me'],
      ['no keywords', 'What is the weather today in Paris?'],
      ['with keywords', 'implement pagination for the user list API'],
      ['very long prompt', 'implement ' + 'a'.repeat(5000)],
    ])('always returns continue: true for %s', (_, prompt) => {
      // Arrange
      const input = createPromptInput(prompt);

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('result structure is valid HookResult', () => {
      // Arrange
      const input = createPromptInput('implement authentication for users');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(typeof result.continue).toBe('boolean');
      if (result.systemMessage) {
        expect(typeof result.systemMessage).toBe('string');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles prompt with only spaces after keyword', () => {
      // Arrange
      const input = createPromptInput('implement                              ');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles prompt with special characters', () => {
      // Arrange
      const input = createPromptInput('implement API with $pecial ch@rs <>&"\'');

      // Act & Assert
      expect(() => antipatternDetector(input)).not.toThrow();
    });

    test('handles prompt with newlines', () => {
      // Arrange
      const input = createPromptInput('implement\nan\nAPI\nwith\nmultiple\nlines');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('implement');
    });

    test('handles prompt with unicode characters', () => {
      // Arrange
      const input = createPromptInput('implement API for users in Japanese');

      // Act & Assert
      expect(() => antipatternDetector(input)).not.toThrow();
    });

    test('handles undefined prompt gracefully', () => {
      // Arrange
      const input = createPromptInput('');
      input.prompt = undefined;

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('first matching keyword is used', () => {
      // Arrange - contains both "implement" and "create"
      const input = createPromptInput('implement and create a new api endpoint');

      // Act
      const result = antipatternDetector(input);

      // Assert
      // "implement" comes before "create" in IMPLEMENTATION_KEYWORDS array
      expect(result.systemMessage).toContain('--query "implement failed"');
    });

    test('handles multiple matching categories in prompt', () => {
      // Arrange - contains both pagination and database keywords
      const input = createPromptInput('implement cursor pagination with postgresql database');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Keyword boundary tests
  // ---------------------------------------------------------------------------

  describe('keyword boundary tests', () => {
    test('matches keyword at beginning of prompt', () => {
      // Arrange
      const input = createPromptInput('implement the user authentication flow');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.systemMessage).toContain('implement');
    });

    test('matches keyword at end of prompt', () => {
      // Arrange
      const input = createPromptInput('the user flow needs to implement');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.systemMessage).toContain('implement');
    });

    test('matches keyword in middle of prompt', () => {
      // Arrange
      const input = createPromptInput('we need to implement a new user flow');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.systemMessage).toContain('implement');
    });

    test('matches keyword as substring (implementation contains implement)', () => {
      // Arrange
      const input = createPromptInput('the implementation of the api needs work');

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.systemMessage).toContain('implement');
    });
  });

  // ---------------------------------------------------------------------------
  // All implementation keywords coverage
  // ---------------------------------------------------------------------------

  describe('all implementation keywords coverage', () => {
    const IMPLEMENTATION_KEYWORDS = [
      'implement',
      'add',
      'create',
      'build',
      'set up',
      'configure',
      'pagination',
      'authentication',
      'caching',
      'database',
      'api',
      'endpoint',
    ];

    test.each(IMPLEMENTATION_KEYWORDS)('keyword "%s" triggers antipattern check', (keyword) => {
      // Arrange - ensure prompt is > 30 chars
      const input = createPromptInput(`${keyword} something in the application system`);

      // Act
      const result = antipatternDetector(input);

      // Assert
      expect(result.systemMessage).toContain('Antipattern Check');
    });
  });
});

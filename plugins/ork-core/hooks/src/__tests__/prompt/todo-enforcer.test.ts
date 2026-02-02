/**
 * Unit tests for todo-enforcer hook
 * Tests UserPromptSubmit hook that reminds about todo tracking for complex tasks
 *
 * Features tested:
 * - Complex task pattern detection (implement, refactor, migrate, etc.)
 * - Long prompt threshold (500 chars)
 * - Silent success output (currently non-blocking)
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

import { todoEnforcer } from '../../prompt/todo-enforcer.js';
import { outputSilentSuccess, logHook } from '../../lib/common.js';

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

describe('prompt/todo-enforcer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CLAUDE_PROJECT_DIR;
  });

  // ---------------------------------------------------------------------------
  // Basic behavior
  // ---------------------------------------------------------------------------

  describe('basic behavior', () => {
    test('returns silent success for empty prompt', () => {
      // Arrange
      const input = createPromptInput('');

      // Act
      const result = todoEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success for short simple prompt', () => {
      // Arrange
      const input = createPromptInput('help');

      // Act
      const result = todoEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success for undefined prompt', () => {
      // Arrange
      const input = createPromptInput('');
      input.prompt = undefined;

      // Act
      const result = todoEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('logs prompt length', () => {
      // Arrange
      const input = createPromptInput('test prompt');

      // Act
      todoEnforcer(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith('todo-enforcer', 'Prompt length: 11 chars');
    });
  });

  // ---------------------------------------------------------------------------
  // Complex task pattern detection
  // ---------------------------------------------------------------------------

  describe('complex task pattern detection', () => {
    test.each([
      ['implement', 'implement user authentication'],
      ['refactor', 'refactor the database layer'],
      ['add feature', 'add feature for notifications'],
      ['create.*component', 'create a new React component'],
      ['build.*system', 'build a new caching system'],
      ['fix.*multiple', 'fix multiple issues in the API'],
      ['update.*across', 'update styles across all pages'],
      ['migrate', 'migrate from REST to GraphQL'],
    ])('detects complex pattern: %s', (_, prompt) => {
      // Arrange
      const input = createPromptInput(prompt);

      // Act
      todoEnforcer(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'todo-enforcer',
        'Complex task detected - todo tracking recommended'
      );
    });

    test('does not detect simple prompts as complex', () => {
      // Arrange
      const input = createPromptInput('what is the weather today?');

      // Act
      todoEnforcer(input);

      // Assert
      expect(logHook).not.toHaveBeenCalledWith(
        'todo-enforcer',
        'Complex task detected - todo tracking recommended'
      );
    });

    test('pattern matching is case insensitive', () => {
      // Arrange
      const input = createPromptInput('IMPLEMENT the user dashboard');

      // Act
      todoEnforcer(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'todo-enforcer',
        'Complex task detected - todo tracking recommended'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Long prompt threshold (500 chars)
  // ---------------------------------------------------------------------------

  describe('long prompt threshold', () => {
    test('detects long prompts (>500 chars) as complex', () => {
      // Arrange
      const longPrompt = 'a'.repeat(501);
      const input = createPromptInput(longPrompt);

      // Act
      todoEnforcer(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'todo-enforcer',
        'Complex task detected - todo tracking recommended'
      );
    });

    test('does not detect prompts at exactly 500 chars as complex (threshold)', () => {
      // Arrange
      const exactPrompt = 'a'.repeat(500);
      const input = createPromptInput(exactPrompt);

      // Act
      todoEnforcer(input);

      // Assert
      expect(logHook).not.toHaveBeenCalledWith(
        'todo-enforcer',
        'Complex task detected - todo tracking recommended'
      );
    });

    test('does not detect prompts under 500 chars as complex (without keywords)', () => {
      // Arrange
      const shortPrompt = 'a'.repeat(499);
      const input = createPromptInput(shortPrompt);

      // Act
      todoEnforcer(input);

      // Assert
      expect(logHook).not.toHaveBeenCalledWith(
        'todo-enforcer',
        'Complex task detected - todo tracking recommended'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Combined detection (pattern OR length)
  // ---------------------------------------------------------------------------

  describe('combined detection', () => {
    test('detects complex by pattern even if short', () => {
      // Arrange
      const input = createPromptInput('implement api'); // Short but has pattern

      // Act
      todoEnforcer(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'todo-enforcer',
        'Complex task detected - todo tracking recommended'
      );
    });

    test('detects complex by length even without pattern', () => {
      // Arrange
      const input = createPromptInput('x'.repeat(501)); // Long but no pattern

      // Act
      todoEnforcer(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'todo-enforcer',
        'Complex task detected - todo tracking recommended'
      );
    });

    test('detects complex when both pattern and length match', () => {
      // Arrange
      const input = createPromptInput('implement ' + 'a'.repeat(500)); // Both

      // Act
      todoEnforcer(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'todo-enforcer',
        'Complex task detected - todo tracking recommended'
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
      ['simple prompt', 'What is the weather?'],
      ['complex keyword', 'implement user authentication'],
      ['long prompt', 'a'.repeat(600)],
      ['both complex', 'implement ' + 'a'.repeat(500)],
    ])('always returns continue: true for %s', (_, prompt) => {
      // Arrange
      const input = createPromptInput(prompt);

      // Act
      const result = todoEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns suppressOutput: true', () => {
      // Arrange
      const input = createPromptInput('implement a complex system');

      // Act
      const result = todoEnforcer(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });

    test('result structure is valid HookResult', () => {
      // Arrange
      const input = createPromptInput('implement user auth');

      // Act
      const result = todoEnforcer(input);

      // Assert
      expect(typeof result.continue).toBe('boolean');
      expect(typeof result.suppressOutput).toBe('boolean');
    });
  });

  // ---------------------------------------------------------------------------
  // All complex patterns coverage
  // ---------------------------------------------------------------------------

  describe('all complex patterns coverage', () => {
    const COMPLEX_PATTERNS_EXAMPLES = [
      { pattern: 'implement', example: 'implement the new feature' },
      { pattern: 'refactor', example: 'refactor the authentication module' },
      { pattern: 'add feature', example: 'add feature for user preferences' },
      { pattern: 'create.*component', example: 'create a new component for the dashboard' },
      { pattern: 'build.*system', example: 'build a new notification system' },
      { pattern: 'fix.*multiple', example: 'fix multiple bugs in the API layer' },
      { pattern: 'update.*across', example: 'update styles across all pages' },
      { pattern: 'migrate', example: 'migrate the database to PostgreSQL' },
    ];

    test.each(COMPLEX_PATTERNS_EXAMPLES)(
      'pattern "$pattern" is detected in example: $example',
      ({ example }) => {
        // Arrange
        const input = createPromptInput(example);

        // Act
        todoEnforcer(input);

        // Assert
        expect(logHook).toHaveBeenCalledWith(
          'todo-enforcer',
          'Complex task detected - todo tracking recommended'
        );
      }
    );
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles prompt with special characters', () => {
      // Arrange
      const input = createPromptInput('implement $pecial ch@rs feature <test>');

      // Act & Assert
      expect(() => todoEnforcer(input)).not.toThrow();
      expect(logHook).toHaveBeenCalledWith(
        'todo-enforcer',
        'Complex task detected - todo tracking recommended'
      );
    });

    test('handles prompt with newlines', () => {
      // Arrange
      const input = createPromptInput('implement\na\nfeature');

      // Act & Assert
      expect(() => todoEnforcer(input)).not.toThrow();
    });

    test('handles very long prompts', () => {
      // Arrange
      const veryLongPrompt = 'a'.repeat(10000);
      const input = createPromptInput(veryLongPrompt);

      // Act & Assert
      expect(() => todoEnforcer(input)).not.toThrow();
    });

    test('handles unicode characters', () => {
      // Arrange
      const input = createPromptInput('implement feature in Japanese');

      // Act & Assert
      expect(() => todoEnforcer(input)).not.toThrow();
    });

    test('first matching pattern triggers detection (short circuit)', () => {
      // Arrange - contains multiple patterns
      const input = createPromptInput('implement and refactor and migrate the system');

      // Act
      todoEnforcer(input);

      // Assert
      // Should only log once (first pattern match)
      const complexCalls = vi.mocked(logHook).mock.calls.filter(
        call => call[1] === 'Complex task detected - todo tracking recommended'
      );
      expect(complexCalls.length).toBe(1);
    });

    test('pattern with gaps works (create.*component)', () => {
      // Arrange
      const input = createPromptInput('create a new user profile component for the app');

      // Act
      todoEnforcer(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'todo-enforcer',
        'Complex task detected - todo tracking recommended'
      );
    });

    test('pattern with different word orders (build.*system)', () => {
      // Arrange
      const input = createPromptInput('build the entire authentication system');

      // Act
      todoEnforcer(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'todo-enforcer',
        'Complex task detected - todo tracking recommended'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Non-matching cases
  // ---------------------------------------------------------------------------

  describe('non-matching cases', () => {
    test.each([
      'what is the weather today?',
      'show me the code',
      'explain how this works',
      'list all files',
      'read the documentation',
      'help me understand',
      'check the status',
      'view the logs',
    ])('does not detect simple prompt: %s', (prompt) => {
      // Arrange
      const input = createPromptInput(prompt);

      // Act
      todoEnforcer(input);

      // Assert
      expect(logHook).not.toHaveBeenCalledWith(
        'todo-enforcer',
        'Complex task detected - todo tracking recommended'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Threshold boundary tests
  // ---------------------------------------------------------------------------

  describe('threshold boundary tests', () => {
    test.each([
      [499, false],
      [500, false],
      [501, true],
      [502, true],
      [1000, true],
    ])('at %d chars (no keywords), isComplex=%s', (length, shouldBeComplex) => {
      // Arrange
      const input = createPromptInput('x'.repeat(length));

      // Act
      todoEnforcer(input);

      // Assert
      if (shouldBeComplex) {
        expect(logHook).toHaveBeenCalledWith(
          'todo-enforcer',
          'Complex task detected - todo tracking recommended'
        );
      } else {
        expect(logHook).not.toHaveBeenCalledWith(
          'todo-enforcer',
          'Complex task detected - todo tracking recommended'
        );
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Output validation
  // ---------------------------------------------------------------------------

  describe('output validation', () => {
    test('always calls outputSilentSuccess', () => {
      // Arrange
      const input = createPromptInput('implement a complex feature');

      // Act
      todoEnforcer(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });

    test('returns exactly what outputSilentSuccess returns', () => {
      // Arrange
      const input = createPromptInput('implement something');

      // Act
      const result = todoEnforcer(input);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });
});

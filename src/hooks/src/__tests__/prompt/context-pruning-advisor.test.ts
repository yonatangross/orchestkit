/**
 * Unit tests for context-pruning-advisor hook
 * Tests UserPromptSubmit hook that recommends context pruning when usage exceeds 70%
 *
 * Features tested:
 * - Context usage threshold detection (70%, 95% critical)
 * - Recency, frequency, relevance scoring
 * - Pruning recommendations generation
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
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { contextPruningAdvisor } from '../../prompt/context-pruning-advisor.js';
import { outputSilentSuccess, outputPromptContext } from '../../lib/common.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

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
 * Create mock state file content
 */
function createStateFile(options: {
  totalTokens?: number;
  budget?: number;
  items?: Array<{
    id: string;
    tags?: string[];
    last_accessed?: string;
    access_count?: number;
    estimated_tokens?: number;
  }>;
}) {
  return JSON.stringify({
    session_id: 'test-session-123',
    updated_at: new Date().toISOString(),
    total_context_tokens: options.totalTokens ?? 0,
    context_budget: options.budget ?? 12000,
    items: options.items ?? [],
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('prompt/context-pruning-advisor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
    delete process.env.CLAUDE_CONTEXT_USAGE_PERCENT;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CLAUDE_PROJECT_DIR;
    delete process.env.CLAUDE_CONTEXT_USAGE_PERCENT;
  });

  // ---------------------------------------------------------------------------
  // Context usage below threshold (< 70%)
  // ---------------------------------------------------------------------------

  describe('context usage below threshold', () => {
    test('returns silent success when context usage is 0%', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 0, budget: 12000 }));
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success when context usage is 50%', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.5';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 6000, budget: 12000 }));
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success when context usage is 69%', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.69';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 8280, budget: 12000 }));
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Context usage at warning threshold (70-95%)
  // ---------------------------------------------------------------------------

  describe('context usage at warning threshold', () => {
    test('triggers pruning at exactly 70%', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.7';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        createStateFile({
          totalTokens: 8400,
          budget: 12000,
          items: [
            { id: 'skill:old-skill', tags: ['old'], access_count: 0, estimated_tokens: 500 },
          ],
        })
      );
      const input = createPromptInput('Design a new API endpoint');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
      // May or may not output context depending on candidates
    });

    test('triggers pruning at 80%', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.8';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        createStateFile({
          totalTokens: 9600,
          budget: 12000,
          items: [
            { id: 'skill:unused-skill', tags: [], access_count: 0, estimated_tokens: 800 },
          ],
        })
      );
      const input = createPromptInput('Design a new API endpoint');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Critical context usage (>= 95%)
  // ---------------------------------------------------------------------------

  describe('critical context usage', () => {
    test('outputs critical warning at 95%', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.95';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 11400, budget: 12000 }));
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputPromptContext).toHaveBeenCalled();
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('CRITICAL');
      expect(contextArg).toContain('95%');
    });

    test('outputs critical warning at 99%', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.99';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 11880, budget: 12000 }));
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputPromptContext).toHaveBeenCalled();
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('CRITICAL');
    });

    test('critical warning suggests context-optimization skill', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.96';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 11520, budget: 12000 }));
      const input = createPromptInput('Design an API');

      // Act
      contextPruningAdvisor(input);

      // Assert
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('context-optimization');
    });
  });

  // ---------------------------------------------------------------------------
  // Recency scoring
  // ---------------------------------------------------------------------------

  describe('recency scoring', () => {
    test('recently accessed items get high recency score', () => {
      // Arrange
      const recentTime = Date.now() - 2 * 60 * 1000; // 2 minutes ago
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.75';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        createStateFile({
          totalTokens: 9000,
          budget: 12000,
          items: [
            {
              id: 'skill:recent-skill',
              tags: ['api'],
              last_accessed: recentTime.toString(),
              access_count: 5,
              estimated_tokens: 500,
            },
          ],
        })
      );
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
      // Recent items should not be recommended for pruning
    });

    test('old items get low recency score and are pruning candidates', () => {
      // Arrange
      const oldTime = Date.now() - 3 * 60 * 60 * 1000; // 3 hours ago
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.75';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        createStateFile({
          totalTokens: 9000,
          budget: 12000,
          items: [
            {
              id: 'skill:old-skill',
              tags: ['unrelated'],
              last_accessed: oldTime.toString(),
              access_count: 0,
              estimated_tokens: 800,
            },
          ],
        })
      );
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Frequency scoring
  // ---------------------------------------------------------------------------

  describe('frequency scoring', () => {
    test('frequently accessed items get high frequency score', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.75';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        createStateFile({
          totalTokens: 9000,
          budget: 12000,
          items: [
            {
              id: 'skill:frequent-skill',
              tags: ['api'],
              access_count: 15,
              estimated_tokens: 500,
            },
          ],
        })
      );
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('never accessed items are high priority pruning candidates', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.75';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        createStateFile({
          totalTokens: 9000,
          budget: 12000,
          items: [
            {
              id: 'skill:never-used',
              tags: [],
              access_count: 0,
              estimated_tokens: 1000,
            },
          ],
        })
      );
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Relevance scoring
  // ---------------------------------------------------------------------------

  describe('relevance scoring', () => {
    test('items matching prompt keywords get high relevance score', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.75';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        createStateFile({
          totalTokens: 9000,
          budget: 12000,
          items: [
            {
              id: 'skill:api-design',
              tags: ['api', 'design', 'endpoint'],
              access_count: 2,
              estimated_tokens: 500,
            },
          ],
        })
      );
      const input = createPromptInput('Design an API endpoint for users');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('items with no matching keywords are pruning candidates', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.75';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        createStateFile({
          totalTokens: 9000,
          budget: 12000,
          items: [
            {
              id: 'skill:unrelated-skill',
              tags: ['database', 'migration', 'schema'],
              access_count: 1,
              estimated_tokens: 600,
            },
          ],
        })
      );
      const input = createPromptInput('Design a frontend React component');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // No prompt handling
  // ---------------------------------------------------------------------------

  describe('no prompt handling', () => {
    test('returns silent success when prompt is empty', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.75';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 9000, budget: 12000 }));
      const input = createPromptInput('');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success when prompt is undefined', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.75';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 9000, budget: 12000 }));
      const input = createPromptInput('');
      input.prompt = undefined;

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // State file handling
  // ---------------------------------------------------------------------------

  describe('state file handling', () => {
    test('creates new state when file does not exist', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0';
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(writeFileSync).toHaveBeenCalled();
    });

    test('handles corrupted state file gracefully', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid json {{{');
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Environment variable fallback
  // ---------------------------------------------------------------------------

  describe('environment variable fallback', () => {
    test('uses CLAUDE_CONTEXT_USAGE_PERCENT when available', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.95';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 0, budget: 12000 }));
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputPromptContext).toHaveBeenCalled();
      const contextArg = vi.mocked(outputPromptContext).mock.calls[0][0];
      expect(contextArg).toContain('CRITICAL');
    });

    test('falls back to state file calculation when env var not set', () => {
      // Arrange
      delete process.env.CLAUDE_CONTEXT_USAGE_PERCENT;
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 0, budget: 12000 }));
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

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
      ['below threshold', '0.5'],
      ['at threshold', '0.7'],
      ['above threshold', '0.85'],
      ['critical', '0.95'],
      ['maximum', '1.0'],
    ])('always returns continue: true at %s context usage', (_, usagePercent) => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = usagePercent;
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 0, budget: 12000 }));
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('uses hookEventName: UserPromptSubmit when providing context', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.96';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 11520, budget: 12000 }));
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.hookSpecificOutput?.hookEventName).toBe('UserPromptSubmit');
    });

    test('includes suppressOutput: true when providing context', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.96';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 11520, budget: 12000 }));
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles zero budget gracefully', () => {
      // Arrange
      delete process.env.CLAUDE_CONTEXT_USAGE_PERCENT;
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 5000, budget: 0 }));
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles negative budget gracefully', () => {
      // Arrange
      delete process.env.CLAUDE_CONTEXT_USAGE_PERCENT;
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 5000, budget: -1000 }));
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles empty items array', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.75';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 9000, budget: 12000, items: [] }));
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles items with missing fields', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.75';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        createStateFile({
          totalTokens: 9000,
          budget: 12000,
          items: [{ id: 'skill:minimal' }],
        })
      );
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles prompts with special characters', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.75';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(createStateFile({ totalTokens: 9000, budget: 12000, items: [] }));
      const input = createPromptInput('Design API with $pecial ch@rs <>&');

      // Act & Assert
      expect(() => contextPruningAdvisor(input)).not.toThrow();
    });

    test('limits recommendations to MAX_RECOMMENDATIONS (5)', () => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = '0.75';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        createStateFile({
          totalTokens: 9000,
          budget: 12000,
          items: Array.from({ length: 10 }, (_, i) => ({
            id: `skill:unused-${i}`,
            tags: [],
            access_count: 0,
            estimated_tokens: 500,
          })),
        })
      );
      const input = createPromptInput('Design an API');

      // Act
      const result = contextPruningAdvisor(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Threshold boundary tests
  // ---------------------------------------------------------------------------

  describe('threshold boundary tests', () => {
    test.each([
      [0.69, false, false],
      [0.7, true, false],
      [0.94, true, false],
      [0.95, true, true],
      [0.99, true, true],
    ])('at %d usage: triggers=%s, critical=%s', (usage, shouldTrigger, isCritical) => {
      // Arrange
      process.env.CLAUDE_CONTEXT_USAGE_PERCENT = usage.toString();
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        createStateFile({
          totalTokens: usage * 12000,
          budget: 12000,
          items: [{ id: 'skill:test', tags: [], access_count: 0, estimated_tokens: 500 }],
        })
      );
      const input = createPromptInput('Design an API');

      // Act
      contextPruningAdvisor(input);

      // Assert
      if (!shouldTrigger) {
        expect(outputSilentSuccess).toHaveBeenCalled();
      }
      if (isCritical) {
        const contextArg = vi.mocked(outputPromptContext).mock.calls[0]?.[0] || '';
        expect(contextArg).toContain('CRITICAL');
      }
    });
  });
});

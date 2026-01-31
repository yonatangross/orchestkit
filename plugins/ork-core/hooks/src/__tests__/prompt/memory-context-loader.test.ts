/**
 * Unit tests for memory-context-loader hook
 * Tests UserPromptSubmit hook that loads recent decisions on session start
 *
 * Part of Intelligent Decision Capture System (Issue #245)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock common.js functions
vi.mock('../../lib/common.js', () => ({
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
  logHook: vi.fn(),
}));

// Mock node:fs
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

// Import mocked modules
import {
  outputSilentSuccess,
  outputPromptContext,
  logHook,
} from '../../lib/common.js';
import { existsSync, readFileSync } from 'node:fs';

// Import the hook under test
import { memoryContextLoader } from '../../prompt/memory-context-loader.js';

// =============================================================================
// Test Utilities
// =============================================================================

function createInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    hook_event: 'UserPromptSubmit',
    tool_name: 'UserPromptSubmit',
    session_id: 'test-session',
    project_dir: '/test/project',
    tool_input: {},
    prompt: 'Hello world test prompt',
    ...overrides,
  };
}

function makeDecisionLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 'decision-abc123',
    type: 'decision',
    content: {
      what: 'Use PostgreSQL for the database',
      why: 'Better JSON support',
    },
    entities: ['postgresql'],
    metadata: {
      timestamp: '2025-01-15T10:00:00.000Z',
      confidence: 0.85,
      category: 'database',
      project: 'test-project',
    },
    ...overrides,
  });
}

function makePreferenceLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 'preference-def456',
    type: 'preference',
    content: {
      what: 'Always use TypeScript',
    },
    entities: ['typescript'],
    metadata: {
      timestamp: '2025-01-15T11:00:00.000Z',
      confidence: 0.9,
      category: 'language',
      project: 'test-project',
    },
    ...overrides,
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('prompt/memory-context-loader', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockOutputSilentSuccess = vi.mocked(outputSilentSuccess);
  const mockOutputPromptContext = vi.mocked(outputPromptContext);
  const mockLogHook = vi.mocked(logHook);

  beforeEach(() => {
    vi.clearAllMocks();
    mockOutputSilentSuccess.mockReturnValue({ continue: true, suppressOutput: true });
    mockOutputPromptContext.mockImplementation((ctx: string) => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit' as const,
        additionalContext: ctx,
      },
    }));
  });

  // ===========================================================================
  // Returns silent success when no decisions.jsonl exists
  // ===========================================================================
  describe('no decisions file', () => {
    it('should return silent success when decisions.jsonl does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = memoryContextLoader(createInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(mockOutputPromptContext).not.toHaveBeenCalled();
      expect(mockLogHook).toHaveBeenCalledWith(
        'memory-context-loader',
        'No decisions.jsonl found, skipping'
      );
    });
  });

  // ===========================================================================
  // Returns silent success when decisions.jsonl is empty
  // ===========================================================================
  describe('empty decisions file', () => {
    it('should return silent success when file is empty', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('');

      const result = memoryContextLoader(createInput());

      expect(result.continue).toBe(true);
      expect(mockOutputPromptContext).not.toHaveBeenCalled();
    });

    it('should return silent success when file has only whitespace', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('   \n  \n  ');

      const result = memoryContextLoader(createInput());

      expect(result.continue).toBe(true);
      expect(mockOutputPromptContext).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Returns additionalContext with recent decisions
  // ===========================================================================
  describe('loads recent decisions', () => {
    it('should return context with a single decision', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(makeDecisionLine() + '\n');

      const result = memoryContextLoader(createInput());

      expect(mockOutputPromptContext).toHaveBeenCalledWith(
        expect.stringContaining('Use PostgreSQL for the database')
      );
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('PostgreSQL');
    });

    it('should include rationale when present', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(makeDecisionLine() + '\n');

      memoryContextLoader(createInput());

      expect(mockOutputPromptContext).toHaveBeenCalledWith(
        expect.stringContaining('Better JSON support')
      );
    });

    it('should include entities when present', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(makeDecisionLine() + '\n');

      memoryContextLoader(createInput());

      expect(mockOutputPromptContext).toHaveBeenCalledWith(
        expect.stringContaining('postgresql')
      );
    });

    it('should include both decisions and preferences', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        makeDecisionLine() + '\n' + makePreferenceLine() + '\n'
      );

      memoryContextLoader(createInput());

      const ctx = mockOutputPromptContext.mock.calls[0][0];
      expect(ctx).toContain('Decision');
      expect(ctx).toContain('Preference');
    });

    it('should load multiple decisions', () => {
      mockExistsSync.mockReturnValue(true);
      const lines = [
        makeDecisionLine({ content: { what: 'Use Redis for caching' }, entities: ['redis'] }),
        makeDecisionLine({ content: { what: 'Use FastAPI for backend' }, entities: ['fastapi'] }),
        makePreferenceLine({ content: { what: 'Prefer pytest' }, entities: ['pytest'] }),
      ].join('\n') + '\n';

      mockReadFileSync.mockReturnValue(lines);

      memoryContextLoader(createInput());

      const ctx = mockOutputPromptContext.mock.calls[0][0];
      expect(ctx).toContain('Redis');
      expect(ctx).toContain('FastAPI');
      expect(ctx).toContain('pytest');
    });

    it('should include header and MCP hint', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(makeDecisionLine() + '\n');

      memoryContextLoader(createInput());

      const ctx = mockOutputPromptContext.mock.calls[0][0];
      expect(ctx).toContain('Recent Project Decisions');
      expect(ctx).toContain('mcp__memory__search_nodes');
    });
  });

  // ===========================================================================
  // Handles malformed JSONL gracefully
  // ===========================================================================
  describe('malformed JSONL', () => {
    it('should skip malformed lines and process valid ones', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        'this is not json\n' + makeDecisionLine() + '\n' + '{broken json\n'
      );

      memoryContextLoader(createInput());

      // Should still output context from the valid line
      expect(mockOutputPromptContext).toHaveBeenCalledWith(
        expect.stringContaining('PostgreSQL')
      );
    });

    it('should return silent success when all lines are malformed', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        'not json\n{broken}\n[array]\n'
      );

      const result = memoryContextLoader(createInput());

      expect(result.continue).toBe(true);
      expect(mockOutputPromptContext).not.toHaveBeenCalled();
      expect(mockLogHook).toHaveBeenCalledWith(
        'memory-context-loader',
        'No valid decisions found in file'
      );
    });

    it('should skip records missing content.what', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ id: 'test', type: 'decision', content: {} }) + '\n'
      );

      const result = memoryContextLoader(createInput());

      expect(result.continue).toBe(true);
      expect(mockOutputPromptContext).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Respects max character limit
  // ===========================================================================
  describe('max character limit', () => {
    it('should truncate when context exceeds max chars', () => {
      mockExistsSync.mockReturnValue(true);

      // Create many long decisions to exceed the 2000 char limit
      const lines = Array.from({ length: 20 }, (_, i) =>
        makeDecisionLine({
          id: `decision-${i}`,
          content: {
            what: `Very long decision number ${i} with lots of detail about the architecture choices made for component ${i} in the system`,
            why: `Because we needed to optimize for performance and scalability in area ${i} of the application which requires careful consideration`,
          },
          entities: [`tech-${i}`, `pattern-${i}`, `tool-${i}`],
        })
      ).join('\n') + '\n';

      mockReadFileSync.mockReturnValue(lines);

      memoryContextLoader(createInput());

      const ctx = mockOutputPromptContext.mock.calls[0][0];
      // Should contain the truncation message
      expect(ctx).toContain('mcp__memory__search_nodes');
      // Should be within reasonable bounds
      expect(ctx.length).toBeLessThan(3000);
    });
  });

  // ===========================================================================
  // Reads most recent decisions first
  // ===========================================================================
  describe('recency ordering', () => {
    it('should read from end of file (most recent)', () => {
      mockExistsSync.mockReturnValue(true);

      // Create 15 lines - only last 10 should be read
      const lines = Array.from({ length: 15 }, (_, i) =>
        makeDecisionLine({
          id: `decision-${i}`,
          content: { what: `Decision number ${i}` },
          entities: [],
        })
      ).join('\n') + '\n';

      mockReadFileSync.mockReturnValue(lines);

      memoryContextLoader(createInput());

      const ctx = mockOutputPromptContext.mock.calls[0][0];
      // Should contain recent decisions (5-14) but not old ones (0-4)
      expect(ctx).toContain('Decision number 14');
      expect(ctx).toContain('Decision number 5');
      expect(ctx).not.toContain('Decision number 4');
    });
  });

  // ===========================================================================
  // Returns silent success on errors
  // ===========================================================================
  describe('error handling', () => {
    it('should return silent success when readFileSync throws', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = memoryContextLoader(createInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // readLastLines catches the error internally and returns [],
      // so the hook sees an empty lines array
      expect(mockLogHook).toHaveBeenCalledWith(
        'memory-context-loader',
        'decisions.jsonl is empty, skipping'
      );
    });

    it('should return silent success when existsSync throws', () => {
      mockExistsSync.mockImplementation(() => {
        throw new Error('FS error');
      });

      const result = memoryContextLoader(createInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ===========================================================================
  // Project directory handling
  // ===========================================================================
  describe('project directory', () => {
    it('should use project_dir from input when provided', () => {
      mockExistsSync.mockReturnValue(false);

      const input = createInput({ project_dir: '/custom/project' });
      memoryContextLoader(input);

      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringContaining('/custom/project/.claude/memory/decisions.jsonl')
      );
    });

    it('should fallback to getProjectDir when project_dir not in input', () => {
      mockExistsSync.mockReturnValue(false);

      const input = createInput();
      delete (input as Record<string, unknown>).project_dir;
      memoryContextLoader(input);

      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringContaining('/test/project/.claude/memory/decisions.jsonl')
      );
    });
  });

  // ===========================================================================
  // Logging
  // ===========================================================================
  describe('logging', () => {
    it('should log number of decisions loaded', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        makeDecisionLine() + '\n' + makePreferenceLine() + '\n'
      );

      memoryContextLoader(createInput());

      expect(mockLogHook).toHaveBeenCalledWith(
        'memory-context-loader',
        'Loaded 2 recent decisions as context'
      );
    });
  });
});

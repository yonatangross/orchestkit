/**
 * Unit tests for memory-context-loader hook
 * Tests materializeDecisionRules() which writes recent decisions to .claude/rules/
 *
 * Part of Intelligent Decision Capture System (Issue #245)
 * Updated: memoryContextLoader() deprecated — tests now cover materializeDecisionRules()
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock common.js functions
vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
  logHook: vi.fn(),
  writeRulesFile: vi.fn(),
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
  logHook,
  writeRulesFile,
} from '../../lib/common.js';
import { existsSync, readFileSync } from 'node:fs';

// Import the functions under test
import { materializeDecisionRules, memoryContextLoader } from '../../prompt/memory-context-loader.js';

// =============================================================================
// Test Utilities
// =============================================================================

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
// Tests for materializeDecisionRules (the active function)
// =============================================================================

describe('prompt/materializeDecisionRules', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteRulesFile = vi.mocked(writeRulesFile);
  const mockLogHook = vi.mocked(logHook);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Returns early when no decisions.jsonl exists
  // ===========================================================================
  describe('no decisions file', () => {
    it('should skip when decisions.jsonl does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      materializeDecisionRules('/test/project');

      expect(mockWriteRulesFile).not.toHaveBeenCalled();
      expect(mockLogHook).toHaveBeenCalledWith(
        'memory-context-loader',
        'No decisions.jsonl found, skipping'
      );
    });
  });

  // ===========================================================================
  // Returns early when decisions.jsonl is empty
  // ===========================================================================
  describe('empty decisions file', () => {
    it('should skip when file is empty', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('');

      materializeDecisionRules('/test/project');

      expect(mockWriteRulesFile).not.toHaveBeenCalled();
    });

    it('should skip when file has only whitespace', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('   \n  \n  ');

      materializeDecisionRules('/test/project');

      expect(mockWriteRulesFile).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Writes context with recent decisions to rules file
  // ===========================================================================
  describe('loads recent decisions', () => {
    it('should write context with a single decision to rules file', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(`${makeDecisionLine()}\n`);

      materializeDecisionRules('/test/project');

      expect(mockWriteRulesFile).toHaveBeenCalled();
      const ctx = (mockWriteRulesFile.mock.calls[0]?.[2] as string) || '';
      expect(ctx).toContain('Use PostgreSQL for the database');
      expect(ctx).toContain('PostgreSQL');
    });

    it('should include rationale when present', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(`${makeDecisionLine()}\n`);

      materializeDecisionRules('/test/project');

      const ctx = (mockWriteRulesFile.mock.calls[0]?.[2] as string) || '';
      expect(ctx).toContain('Better JSON support');
    });

    it('should include entities when present', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(`${makeDecisionLine()}\n`);

      materializeDecisionRules('/test/project');

      const ctx = (mockWriteRulesFile.mock.calls[0]?.[2] as string) || '';
      expect(ctx).toContain('postgresql');
    });

    it('should include both decisions and preferences', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        `${makeDecisionLine()}\n${makePreferenceLine()}\n`
      );

      materializeDecisionRules('/test/project');

      const ctx = (mockWriteRulesFile.mock.calls[0]?.[2] as string) || '';
      expect(ctx).toContain('Decision');
      expect(ctx).toContain('Preference');
    });

    it('should load multiple decisions', () => {
      mockExistsSync.mockReturnValue(true);
      const lines = `${[
        makeDecisionLine({ content: { what: 'Use Redis for caching' }, entities: ['redis'] }),
        makeDecisionLine({ content: { what: 'Use FastAPI for backend' }, entities: ['fastapi'] }),
        makePreferenceLine({ content: { what: 'Prefer pytest' }, entities: ['pytest'] }),
      ].join('\n')}\n`;

      mockReadFileSync.mockReturnValue(lines);

      materializeDecisionRules('/test/project');

      const ctx = (mockWriteRulesFile.mock.calls[0]?.[2] as string) || '';
      expect(ctx).toContain('Redis');
      expect(ctx).toContain('FastAPI');
      expect(ctx).toContain('pytest');
    });

    it('should include header and MCP hint', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(`${makeDecisionLine()}\n`);

      materializeDecisionRules('/test/project');

      const ctx = (mockWriteRulesFile.mock.calls[0]?.[2] as string) || '';
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
        `this is not json\n${makeDecisionLine()}\n{broken json\n`
      );

      materializeDecisionRules('/test/project');

      // Should still write context from the valid line to rules file
      expect(mockWriteRulesFile).toHaveBeenCalled();
      const ctx = (mockWriteRulesFile.mock.calls[0]?.[2] as string) || '';
      expect(ctx).toContain('PostgreSQL');
    });

    it('should skip when all lines are malformed', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        'not json\n{broken}\n[array]\n'
      );

      materializeDecisionRules('/test/project');

      expect(mockWriteRulesFile).not.toHaveBeenCalled();
    });

    it('should skip records missing content.what', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        `${JSON.stringify({ id: 'test', type: 'decision', content: {} })}\n`
      );

      materializeDecisionRules('/test/project');

      expect(mockWriteRulesFile).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Respects max character limit
  // ===========================================================================
  describe('max character limit', () => {
    it('should truncate when context exceeds max chars', () => {
      mockExistsSync.mockReturnValue(true);

      // Create many long decisions to exceed the 3000 char limit
      const lines = `${Array.from({ length: 20 }, (_, i) =>
        makeDecisionLine({
          id: `decision-${i}`,
          content: {
            what: `Very long decision number ${i} with lots of detail about the architecture choices made for component ${i} in the system`,
            why: `Because we needed to optimize for performance and scalability in area ${i} of the application which requires careful consideration`,
          },
          entities: [`tech-${i}`, `pattern-${i}`, `tool-${i}`],
        })
      ).join('\n')}\n`;

      mockReadFileSync.mockReturnValue(lines);

      materializeDecisionRules('/test/project');

      const ctx = (mockWriteRulesFile.mock.calls[0]?.[2] as string) || '';
      // Should contain the truncation message
      expect(ctx).toContain('mcp__memory__search_nodes');
      // Should be within reasonable bounds
      expect(ctx.length).toBeLessThan(4000);
    });
  });

  // ===========================================================================
  // Reads most recent decisions first
  // ===========================================================================
  describe('recency ordering', () => {
    it('should read from end of file (most recent)', () => {
      mockExistsSync.mockReturnValue(true);

      // Create 15 lines - only last 10 should be read
      const lines = `${Array.from({ length: 15 }, (_, i) =>
        makeDecisionLine({
          id: `decision-${i}`,
          content: { what: `Decision number ${i}` },
          entities: [],
        })
      ).join('\n')}\n`;

      mockReadFileSync.mockReturnValue(lines);

      materializeDecisionRules('/test/project');

      const ctx = (mockWriteRulesFile.mock.calls[0]?.[2] as string) || '';
      // Should contain recent decisions (5-14) but not old ones (0-4)
      expect(ctx).toContain('Decision number 14');
      expect(ctx).toContain('Decision number 5');
      expect(ctx).not.toContain('Decision number 4');
    });
  });

  // ===========================================================================
  // Error handling
  // ===========================================================================
  describe('error handling', () => {
    it('should not throw when readFileSync fails', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // readLastLines catches the error internally and returns []
      expect(() => materializeDecisionRules('/test/project')).not.toThrow();
      expect(mockWriteRulesFile).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Project directory handling
  // ===========================================================================
  describe('project directory', () => {
    it('should use the provided projectDir', () => {
      mockExistsSync.mockReturnValue(false);

      materializeDecisionRules('/custom/project');

      // Cross-platform: accept either / or \ path separators
      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringMatching(/[/\\]custom[/\\]project[/\\]\.claude[/\\]memory[/\\]decisions\.jsonl/)
      );
    });
  });

  // ===========================================================================
  // Logging
  // ===========================================================================
  describe('logging', () => {
    it('should log number of decisions written', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        `${makeDecisionLine()}\n${makePreferenceLine()}\n`
      );

      materializeDecisionRules('/test/project');

      expect(mockLogHook).toHaveBeenCalledWith(
        'memory-context-loader',
        expect.stringContaining('decisions to rules file')
      );
    });
  });
});

// =============================================================================
// Tests for deprecated memoryContextLoader (backward compat stub)
// =============================================================================

describe('prompt/memoryContextLoader (deprecated)', () => {
  it('should return silent success without doing work', () => {
    const result = memoryContextLoader({
      hook_event: 'UserPromptSubmit',
      tool_name: 'UserPromptSubmit',
      session_id: 'test-session',
      project_dir: '/test/project',
      tool_input: {},
      prompt: 'Hello',
    });

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});

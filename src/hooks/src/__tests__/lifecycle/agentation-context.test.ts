/**
 * Unit tests for lifecycle/agentation-context (#638, M104 PR-B)
 *
 * Migrated from UserPromptSubmit (inside prompt/unified-dispatcher, runOnce)
 * → SessionStart so the reminder pins to the cached prompt prefix instead
 * of being re-evaluated on every prompt turn.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';
import { mockCommonBasic } from '../fixtures/mock-common.js';

// =============================================================================
// MOCK SETUP
// =============================================================================

vi.mock('../../lib/common.js', () => mockCommonBasic());

vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

import {
  outputSilentSuccess,
  outputSessionStartContext,
} from '../../lib/common.js';
import { existsSync, readFileSync } from 'node:fs';

import { agentationContext } from '../../lifecycle/agentation-context.js';
import { createTestContext } from '../fixtures/test-context.js';

// =============================================================================
// Test Utilities
// =============================================================================

function createInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    hook_event: 'SessionStart',
    tool_name: '',
    session_id: 'test-session',
    project_dir: '/test/project',
    tool_input: {},
    ...overrides,
  };
}

function makeMcpConfig(agentationConfig: Record<string, unknown> | null = {}): string {
  const servers: Record<string, unknown> = {};
  if (agentationConfig !== null) {
    servers.agentation = {
      command: 'npx',
      args: ['-y', 'agentation-mcp', 'server'],
      disabled: false,
      ...agentationConfig,
    };
  }
  return JSON.stringify({ mcpServers: servers });
}

// =============================================================================
// Tests
// =============================================================================

let testCtx: ReturnType<typeof createTestContext>;
describe('lifecycle/agentation-context (M104 PR-B, SessionStart)', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockOutputSilentSuccess = vi.mocked(outputSilentSuccess);
  const mockOutputSessionStartContext = vi.mocked(outputSessionStartContext);
  beforeEach(() => {
    testCtx = createTestContext();
    vi.clearAllMocks();
    mockOutputSilentSuccess.mockReturnValue({ continue: true, suppressOutput: true });
    mockOutputSessionStartContext.mockImplementation((ctx: string) => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart' as const,
        additionalContext: ctx,
      },
    }));
  });

  // ===========================================================================
  // No .mcp.json exists
  // ===========================================================================
  describe('no mcp.json file', () => {
    it('should return silent success when neither .mcp.json path exists', () => {
      mockExistsSync.mockReturnValue(false);

      const result = agentationContext(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(mockOutputSessionStartContext).not.toHaveBeenCalled();
      expect(testCtx.log).toHaveBeenCalledWith(
        'agentation-context',
        'Agentation MCP not configured, skipping'
      );
    });
  });

  // ===========================================================================
  // Agentation configured and enabled
  // ===========================================================================
  describe('agentation configured', () => {
    it('should inject context when agentation is present and enabled', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(makeMcpConfig());

      const result = agentationContext(createInput(), testCtx);

      expect(mockOutputSessionStartContext).toHaveBeenCalledWith(
        expect.stringContaining('agentation_get_all_pending')
      );
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('agentation_get_all_pending');
    });

    it('should mention Agentation in the context', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(makeMcpConfig());

      agentationContext(createInput(), testCtx);

      expect(mockOutputSessionStartContext).toHaveBeenCalledWith(
        expect.stringContaining('Agentation')
      );
    });

    it('should inject context when disabled field is absent (defaults to enabled)', () => {
      mockExistsSync.mockReturnValue(true);
      const config = JSON.stringify({
        mcpServers: {
          agentation: { command: 'npx', args: ['-y', 'agentation-mcp', 'server'] },
        },
      });
      mockReadFileSync.mockReturnValue(config);

      agentationContext(createInput(), testCtx);

      expect(mockOutputSessionStartContext).toHaveBeenCalled();
    });

    it('should log that agentation was detected', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(makeMcpConfig());

      agentationContext(createInput(), testCtx);

      expect(testCtx.log).toHaveBeenCalledWith(
        'agentation-context',
        'Agentation MCP detected — injecting annotation reminder (SessionStart, cached)'
      );
    });
  });

  // ===========================================================================
  // Agentation disabled
  // ===========================================================================
  describe('agentation disabled', () => {
    it('should return silent success when agentation is disabled: true', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(makeMcpConfig({ disabled: true }));

      const result = agentationContext(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(mockOutputSessionStartContext).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Agentation not in mcpServers
  // ===========================================================================
  describe('agentation not present', () => {
    it('should return silent success when mcpServers has no agentation key', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        mcpServers: { context7: { command: 'npx', disabled: false } },
      }));

      const result = agentationContext(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(mockOutputSessionStartContext).not.toHaveBeenCalled();
    });

    it('should return silent success when mcpServers key is missing', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.0' }));

      const result = agentationContext(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(mockOutputSessionStartContext).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Malformed JSON
  // ===========================================================================
  describe('malformed JSON', () => {
    it('should return silent success when .mcp.json contains invalid JSON', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{ this is not valid json }}}');

      const result = agentationContext(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(mockOutputSessionStartContext).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Checks both candidate paths
  // ===========================================================================
  describe('candidate path resolution', () => {
    it('should check .mcp.json first, then .claude/mcp.json', () => {
      // First path doesn't exist, second does
      mockExistsSync
        .mockReturnValueOnce(false)   // .mcp.json
        .mockReturnValueOnce(true);   // .claude/mcp.json
      mockReadFileSync.mockReturnValue(makeMcpConfig());

      agentationContext(createInput(), testCtx);

      expect(mockExistsSync).toHaveBeenCalledTimes(2);
      expect(mockOutputSessionStartContext).toHaveBeenCalled();
    });

    it('should stop checking after finding agentation in the first file', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(makeMcpConfig());

      agentationContext(createInput(), testCtx);

      // readFileSync should be called once (found in first file)
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Project directory handling
  // ===========================================================================
  describe('project directory', () => {
    it('should use project_dir from input when provided', () => {
      mockExistsSync.mockReturnValue(false);

      agentationContext(createInput({ project_dir: '/custom/project' }), testCtx);

      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringMatching(/[/\\]custom[/\\]project[/\\]\.mcp\.json/)
      );
    });

    it('should fallback to getProjectDir when project_dir not in input', () => {
      mockExistsSync.mockReturnValue(false);

      const input = createInput();
      delete (input as unknown as Record<string, unknown>).project_dir;
      agentationContext(input, testCtx);

      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringMatching(/[/\\]test[/\\]project[/\\]\.mcp\.json/)
      );
    });
  });

  // ===========================================================================
  // Error handling
  // ===========================================================================
  describe('error handling', () => {
    it('should return silent success when readFileSync throws', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = agentationContext(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // The catch inside isAgentationConfigured skips the file,
      // so it falls through to "not configured"
      expect(mockOutputSessionStartContext).not.toHaveBeenCalled();
    });

    it('should return silent success when existsSync throws', () => {
      mockExistsSync.mockImplementation(() => {
        throw new Error('FS error');
      });

      const result = agentationContext(createInput(), testCtx);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(testCtx.log).toHaveBeenCalledWith(
        'agentation-context',
        expect.stringContaining('Error checking agentation config'),
        'warn'
      );
    });
  });
});

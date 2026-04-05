/**
 * Unit tests for unified-dispatcher hook
 * Tests the consolidated SubagentStop dispatcher (fire-and-forget pattern)
 *
 * Issue #235: Hook Architecture Refactor
 * CC 2.1.19 Compliant: Single async hook with internal routing
 *
 * Non-blocking hook: Must always return continue: true, even on errors
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput, } from '../../types.js';
import { mockCommonBasic } from '../fixtures/mock-common.js';

// =============================================================================
// Mocks - MUST be defined BEFORE imports
// =============================================================================

vi.mock('../../lib/common.js', () => mockCommonBasic());

vi.mock('../../lib/session-tracker.js', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../../lib/analytics.js', () => ({
  appendAnalytics: vi.fn(),
  hashProject: vi.fn(() => 'abc123def456'),
  getTeamContext: vi.fn(() => undefined),
}));

// Mock the individual hooks that the dispatcher calls — after #897: 2 hooks
vi.mock('../../subagent-stop/handoff-preparer.js', () => ({
  handoffPreparer: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

vi.mock('../../subagent-stop/feedback-loop.js', () => ({
  feedbackLoop: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

import { unifiedSubagentStopDispatcher, registeredHookNames } from '../../subagent-stop/unified-dispatcher.js';
import { trackEvent } from '../../lib/session-tracker.js';
import { appendAnalytics } from '../../lib/analytics.js';
import { handoffPreparer } from '../../subagent-stop/handoff-preparer.js';
import { feedbackLoop } from '../../subagent-stop/feedback-loop.js';
import { createTestContext } from '../fixtures/test-context.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for SubagentStop
 */
function createSubagentStopInput(
  overrides: Partial<HookInput> = {},
): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {},
    subagent_type: 'test-agent',
    agent_type: 'test-agent',
    agent_id: 'agent-id-123',
    agent_output: 'Agent completed successfully',
    duration_ms: 5000,
    ...overrides,
  };
}

// =============================================================================
// Unified Dispatcher Tests
// =============================================================================

let testCtx: ReturnType<typeof createTestContext>;
describe('unified-subagent-stop-dispatcher', () => {
  beforeEach(() => {
    testCtx = createTestContext();
    vi.clearAllMocks();
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CLAUDE_PROJECT_DIR;
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance - Non-blocking hook must always continue
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('always returns continue: true for basic input', async () => {
      // Arrange
      const input = createSubagentStopInput();

      // Act
      const result = await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true even when all hooks fail', async () => {
      // Arrange — 2 hooks after #897 slimming
      vi.mocked(handoffPreparer).mockImplementation(() => {
        throw new Error('Handoff preparer failed');
      });
      vi.mocked(feedbackLoop).mockImplementation(() => {
        throw new Error('Feedback loop failed');
      });
      const input = createSubagentStopInput();

      // Act
      const result = await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true with partial hook failures', async () => {
      // Arrange — one hook succeeds, one fails
      vi.mocked(handoffPreparer).mockReturnValue({ continue: true, suppressOutput: true });
      vi.mocked(feedbackLoop).mockImplementation(() => {
        throw new Error('Feedback loop failed');
      });
      const input = createSubagentStopInput();

      // Act
      const result = await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns suppressOutput: true for silent operation', async () => {
      // Arrange
      const input = createSubagentStopInput();

      // Act
      const result = await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Hook Registry
  // ---------------------------------------------------------------------------

  describe('hook registry', () => {
    test('registers all 2 consolidated hooks', () => {
      // Act
      const hookNames = registeredHookNames();

      // Assert — after #897 slimming: 2 hooks
      expect(hookNames).toHaveLength(2);
      expect(hookNames).toContain('handoff-preparer');
      expect(hookNames).toContain('feedback-loop');
    });

    test('hook names are in expected order', () => {
      // Act
      const hookNames = registeredHookNames();

      // Assert
      expect(hookNames[0]).toBe('handoff-preparer');
      expect(hookNames[1]).toBe('feedback-loop');
    });
  });

  // ---------------------------------------------------------------------------
  // Parallel execution
  // ---------------------------------------------------------------------------

  describe('parallel execution', () => {
    test('calls all registered hooks', async () => {
      // Arrange
      const input = createSubagentStopInput();

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert — 2 hooks after #897
      expect(handoffPreparer).toHaveBeenCalledWith(input, testCtx);
      expect(feedbackLoop).toHaveBeenCalledWith(input, testCtx);
    });

    test('calls all hooks even when some fail', async () => {
      // Arrange
      vi.mocked(handoffPreparer).mockImplementation(() => {
        throw new Error('First hook failed');
      });
      const input = createSubagentStopInput();

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(handoffPreparer).toHaveBeenCalled();
      expect(feedbackLoop).toHaveBeenCalled();
    });

    test('handles async hooks correctly', async () => {
      // Arrange
      vi.mocked(handoffPreparer).mockImplementation((async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { continue: true, suppressOutput: true };
      }) as any);
      vi.mocked(feedbackLoop).mockImplementation((async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return { continue: true, suppressOutput: true };
      }) as any);
      const input = createSubagentStopInput();

      // Act
      const result = await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
      expect(handoffPreparer).toHaveBeenCalled();
      expect(feedbackLoop).toHaveBeenCalled();
    });

    test('uses Promise.allSettled for parallel execution', async () => {
      // Arrange
      const settleSpy = vi.spyOn(Promise, 'allSettled');
      const input = createSubagentStopInput();

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(settleSpy).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Agent result tracking (Issue #245)
  // ---------------------------------------------------------------------------

  describe('agent result tracking (Issue #245)', () => {
    test('tracks agent_spawned event', async () => {
      // Arrange
      const input = createSubagentStopInput({
        subagent_type: 'tracked-agent',
      });

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(trackEvent).toHaveBeenCalledWith(
        'agent_spawned',
        'tracked-agent',
        expect.any(Object)
      );
    });

    test('tracks success status when no error', async () => {
      // Arrange
      const input = createSubagentStopInput({
        error: undefined,
      });

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(trackEvent).toHaveBeenCalledWith(
        'agent_spawned',
        expect.any(String),
        expect.objectContaining({
          success: true,
        })
      );
    });

    test('tracks failure status when error present', async () => {
      // Arrange
      const input = createSubagentStopInput({
        error: 'Something went wrong',
      });

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(trackEvent).toHaveBeenCalledWith(
        'agent_spawned',
        expect.any(String),
        expect.objectContaining({
          success: false,
        })
      );
    });

    test('tracks duration_ms', async () => {
      // Arrange
      const input = createSubagentStopInput({
        duration_ms: 12345,
      });

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(trackEvent).toHaveBeenCalledWith(
        'agent_spawned',
        expect.any(String),
        expect.objectContaining({
          duration_ms: 12345,
        })
      );
    });

    test('tracks output metadata', async () => {
      // Arrange
      const input = createSubagentStopInput({
        agent_output: 'Output with 100 characters approximately',
      });

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(trackEvent).toHaveBeenCalledWith(
        'agent_spawned',
        expect.any(String),
        expect.objectContaining({
          output: expect.objectContaining({
            has_output: true,
            output_length: expect.any(Number),
          }),
        })
      );
    });

    test('tracks agent_id as context', async () => {
      // Arrange
      const input = createSubagentStopInput({
        agent_id: 'unique-agent-id-789',
      });

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(trackEvent).toHaveBeenCalledWith(
        'agent_spawned',
        expect.any(String),
        expect.objectContaining({
          context: 'unique-agent-id-789',
        })
      );
    });

    test('uses agent_type when subagent_type not available', async () => {
      // Arrange
      const input = createSubagentStopInput({
        subagent_type: undefined,
        agent_type: 'fallback-agent',
      });

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(trackEvent).toHaveBeenCalledWith(
        'agent_spawned',
        'fallback-agent',
        expect.any(Object)
      );
    });

    test('uses unknown when no agent type available', async () => {
      // Arrange
      const input = createSubagentStopInput({
        tool_input: {},
        subagent_type: undefined,
        agent_type: undefined,
      });

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(trackEvent).toHaveBeenCalledWith(
        'agent_spawned',
        'unknown',
        expect.any(Object)
      );
    });

    test('prefers tool_input.subagent_type over top-level fields', async () => {
      // Arrange — CC puts the real agent type in tool_input.subagent_type
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'ork:test-generator', name: 'tester' },
        subagent_type: 'general-purpose',
        agent_type: 'Task',
      });

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(trackEvent).toHaveBeenCalledWith(
        'agent_spawned',
        'ork:test-generator',
        expect.any(Object)
      );
    });

    test('continues even when tracking fails', async () => {
      // Arrange
      vi.mocked(trackEvent).mockImplementation(() => {
        throw new Error('Tracking service unavailable');
      });
      const input = createSubagentStopInput();

      // Act
      const result = await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling and logging
  // ---------------------------------------------------------------------------

  describe('error handling and logging', () => {
    test('logs error count when hooks fail', async () => {
      // Arrange
      vi.mocked(handoffPreparer).mockImplementation(() => {
        throw new Error('Hook 1 failed');
      });
      vi.mocked(feedbackLoop).mockImplementation(() => {
        throw new Error('Hook 3 failed');
      });
      const input = createSubagentStopInput();

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(testCtx.log).toHaveBeenCalledWith(
        'subagent-stop-dispatcher',
        expect.stringContaining('hooks had errors')
      );
    });

    test('logs individual hook failures', async () => {
      // Arrange
      vi.mocked(handoffPreparer).mockImplementation(() => {
        throw new Error('Specific error message');
      });
      const input = createSubagentStopInput();

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(testCtx.log).toHaveBeenCalledWith(
        'subagent-stop-dispatcher',
        expect.stringContaining('handoff-preparer')
      );
    });

    test('does not log errors when all hooks succeed', async () => {
      // Arrange
      // Reset all hook mocks to succeed
      vi.mocked(handoffPreparer).mockReturnValue({ continue: true, suppressOutput: true });
      vi.mocked(feedbackLoop).mockReturnValue({ continue: true, suppressOutput: true });
      vi.mocked(testCtx.log).mockClear();
      const input = createSubagentStopInput();

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(testCtx.log).not.toHaveBeenCalledWith(
        'subagent-stop-dispatcher',
        expect.stringContaining('had errors')
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty agent_output', async () => {
      // Arrange
      const input = createSubagentStopInput({
        agent_output: '',
      });

      // Act
      const result = await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
      expect(trackEvent).toHaveBeenCalledWith(
        'agent_spawned',
        expect.any(String),
        expect.objectContaining({
          output: expect.objectContaining({
            has_output: false,
            output_length: 0,
          }),
        })
      );
    });

    test('handles undefined agent_output', async () => {
      // Arrange
      const input = createSubagentStopInput({
        agent_output: undefined,
        output: undefined,
      });

      // Act
      const result = await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles non-string output gracefully', async () => {
      // Arrange
      const input = createSubagentStopInput({
        agent_output: undefined,
        output: 12345 as unknown as string,
      });

      // Act
      const result = await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles hooks that return promises rejecting', async () => {
      // Arrange
      vi.mocked(feedbackLoop).mockRejectedValue(new Error('Async rejection'));
      const input = createSubagentStopInput();

      // Act
      const result = await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles hooks that throw non-Error objects', async () => {
      // Arrange
      vi.mocked(feedbackLoop).mockImplementation(() => {
        throw 'String error thrown';
      });
      const input = createSubagentStopInput();

      // Act
      const result = await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles empty input object', async () => {
      // Arrange
      const input: HookInput = {
        tool_name: '',
        session_id: '',
        tool_input: {},
      };

      // Act
      const result = await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Parametric tests for agent type resolution
  // ---------------------------------------------------------------------------

  describe('agent type resolution', () => {
    test.each([
      ['tool_input.subagent_type (highest priority)', { tool_input: { subagent_type: 'ork:test-generator' }, subagent_type: 'general-purpose', agent_type: 'secondary' }, 'ork:test-generator'],
      ['top-level subagent_type fallback', { tool_input: {}, subagent_type: 'primary', agent_type: 'secondary' }, 'primary'],
      ['agent_type fallback', { tool_input: {}, subagent_type: undefined, agent_type: 'fallback' }, 'fallback'],
      ['unknown fallback', { tool_input: {}, subagent_type: undefined, agent_type: undefined }, 'unknown'],
    ])('%s: tracks correct agent name', async (_description, overrides, expectedAgent) => {
      // Arrange
      const input = createSubagentStopInput(overrides);

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(trackEvent).toHaveBeenCalledWith(
        'agent_spawned',
        expectedAgent,
        expect.any(Object)
      );
    });

    test('extracts agent name from tool_input.name for team agents', async () => {
      // Arrange — reset trackEvent in case prior test set it to throw
      vi.mocked(trackEvent).mockReset();
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'Explore', name: 'researcher' },
      });

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(appendAnalytics).toHaveBeenCalledWith(
        'agent-usage.jsonl',
        expect.objectContaining({
          agent: 'Explore',
          agent_name: 'researcher',
        })
      );
    });

    test('sets agent_name to null when tool_input.name is absent', async () => {
      // Arrange — reset trackEvent in case prior test set it to throw
      vi.mocked(trackEvent).mockReset();
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'general-purpose' },
      });

      // Act
      await unifiedSubagentStopDispatcher(input, testCtx);

      // Assert
      expect(appendAnalytics).toHaveBeenCalledWith(
        'agent-usage.jsonl',
        expect.objectContaining({
          agent: 'general-purpose',
          agent_name: null,
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Performance characteristics
  // ---------------------------------------------------------------------------

  describe('performance characteristics', () => {
    test('completes within reasonable time even with slow hooks', async () => {
      // Arrange
      vi.mocked(handoffPreparer).mockImplementation((async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { continue: true, suppressOutput: true };
      }) as any);
      vi.mocked(feedbackLoop).mockImplementation((async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { continue: true, suppressOutput: true };
      }) as any);
      const input = createSubagentStopInput();

      // Act
      const start = Date.now();
      await unifiedSubagentStopDispatcher(input, testCtx);
      const duration = Date.now() - start;

      // Assert
      // Parallel execution should complete in ~50-100ms, not ~200ms (sequential)
      expect(duration).toBeLessThan(150);
    });
  });
});

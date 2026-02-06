/**
 * Unit tests for unified-dispatcher lifecycle hook
 * Tests fire-and-forget pattern for SessionStart hook consolidation
 * CC 2.1.19 Compliant: Single async hook with internal routing
 *
 * Note: Async hooks are fire-and-forget by design. They can only return
 * { async: true, asyncTimeout } - other fields are NOT processed by Claude Code.
 * Failures are logged to file but not surfaced to users.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { HookInput } from '../../types.js';
import { unifiedSessionStartDispatcher, registeredHookNames } from '../../lifecycle/unified-dispatcher.js';

// =============================================================================
// Mock Setup - BEFORE imports
// =============================================================================

// Mock all the sub-hooks that the dispatcher calls
vi.mock('../../lifecycle/mem0-context-retrieval.js', () => ({
  mem0ContextRetrieval: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

vi.mock('../../lifecycle/mem0-analytics-tracker.js', () => ({
  mem0AnalyticsTracker: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

vi.mock('../../lifecycle/pattern-sync-pull.js', () => ({
  patternSyncPull: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

vi.mock('../../lifecycle/multi-instance-init.js', () => ({
  multiInstanceInit: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

vi.mock('../../lifecycle/session-env-setup.js', () => ({
  sessionEnvSetup: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

vi.mock('../../lifecycle/session-tracking.js', () => ({
  sessionTracking: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

vi.mock('../../lifecycle/memory-metrics-collector.js', () => ({
  memoryMetricsCollector: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

// Import mocked modules
import { mem0ContextRetrieval } from '../../lifecycle/mem0-context-retrieval.js';
import { mem0AnalyticsTracker } from '../../lifecycle/mem0-analytics-tracker.js';
import { patternSyncPull } from '../../lifecycle/pattern-sync-pull.js';
import { multiInstanceInit } from '../../lifecycle/multi-instance-init.js';
import { sessionEnvSetup } from '../../lifecycle/session-env-setup.js';
import { sessionTracking } from '../../lifecycle/session-tracking.js';
import { memoryMetricsCollector } from '../../lifecycle/memory-metrics-collector.js';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = join(tmpdir(), 'unified-dispatcher-test');
const TEST_SESSION_ID = 'test-session-dispatcher-' + Date.now();

/**
 * Create realistic HookInput for testing
 */
function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: TEST_SESSION_ID,
    project_dir: TEST_PROJECT_DIR,
    tool_input: {},
    ...overrides,
  };
}

/**
 * Store original environment values
 */
let originalEnv: {
  CLAUDE_PROJECT_DIR?: string;
  CLAUDE_SESSION_ID?: string;
};

beforeEach(() => {
  // Store original environment
  originalEnv = {
    CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
    CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID,
  };

  // Set up test environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;
  process.env.CLAUDE_SESSION_ID = TEST_SESSION_ID;

  // Create test directory
  mkdirSync(TEST_PROJECT_DIR, { recursive: true });

  // Clear all mocks
  vi.clearAllMocks();
});

afterEach(() => {
  // Clean up test directory
  if (existsSync(TEST_PROJECT_DIR)) {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }

  // Restore original environment
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
});

// =============================================================================
// Tests
// =============================================================================

describe('unified-dispatcher', () => {
  describe('basic behavior', () => {
    test('returns silent success', async () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns a Promise', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = unifiedSessionStartDispatcher(input);

      // Assert
      expect(result).toBeInstanceOf(Promise);
    });

    test('resolves successfully', async () => {
      // Arrange
      const input = createHookInput();

      // Act & Assert
      await expect(unifiedSessionStartDispatcher(input)).resolves.toBeDefined();
    });
  });

  describe('hook registry', () => {
    test('exposes registered hook names', () => {
      // Act
      const names = registeredHookNames();

      // Assert
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
    });

    test('includes mem0-context-retrieval', () => {
      // Act
      const names = registeredHookNames();

      // Assert
      expect(names).toContain('mem0-context-retrieval');
    });

    test('includes mem0-analytics-tracker', () => {
      // Act
      const names = registeredHookNames();

      // Assert
      expect(names).toContain('mem0-analytics-tracker');
    });

    test('includes pattern-sync-pull', () => {
      // Act
      const names = registeredHookNames();

      // Assert
      expect(names).toContain('pattern-sync-pull');
    });

    test('includes multi-instance-init', () => {
      // Act
      const names = registeredHookNames();

      // Assert
      expect(names).toContain('multi-instance-init');
    });

    test('includes session-env-setup', () => {
      // Act
      const names = registeredHookNames();

      // Assert
      expect(names).toContain('session-env-setup');
    });

    test('includes session-tracking', () => {
      // Act
      const names = registeredHookNames();

      // Assert
      expect(names).toContain('session-tracking');
    });

    test('includes memory-metrics-collector', () => {
      // Act
      const names = registeredHookNames();

      // Assert
      expect(names).toContain('memory-metrics-collector');
    });

    test('returns exactly 7 registered hooks', () => {
      // Act
      const names = registeredHookNames();

      // Assert
      expect(names.length).toBe(7);
    });
  });

  describe('hook invocation', () => {
    test('calls all registered hooks', async () => {
      // Arrange
      const input = createHookInput();

      // Act
      await unifiedSessionStartDispatcher(input);

      // Assert
      expect(mem0ContextRetrieval).toHaveBeenCalledTimes(1);
      expect(mem0AnalyticsTracker).toHaveBeenCalledTimes(1);
      expect(patternSyncPull).toHaveBeenCalledTimes(1);
      expect(multiInstanceInit).toHaveBeenCalledTimes(1);
      expect(sessionEnvSetup).toHaveBeenCalledTimes(1);
      expect(sessionTracking).toHaveBeenCalledTimes(1);
      expect(memoryMetricsCollector).toHaveBeenCalledTimes(1);
    });

    test('passes input to each hook', async () => {
      // Arrange
      const input = createHookInput({ session_id: 'custom-session-id' });

      // Act
      await unifiedSessionStartDispatcher(input);

      // Assert
      expect(mem0ContextRetrieval).toHaveBeenCalledWith(input);
      expect(mem0AnalyticsTracker).toHaveBeenCalledWith(input);
      expect(patternSyncPull).toHaveBeenCalledWith(input);
      expect(multiInstanceInit).toHaveBeenCalledWith(input);
      expect(sessionEnvSetup).toHaveBeenCalledWith(input);
      expect(sessionTracking).toHaveBeenCalledWith(input);
      expect(memoryMetricsCollector).toHaveBeenCalledWith(input);
    });
  });

  describe('parallel execution (Promise.allSettled)', () => {
    test('runs all hooks in parallel', async () => {
      // Arrange
      const input = createHookInput();
      const callOrder: string[] = [];

      // Set up hooks to track call order with delays
      vi.mocked(mem0ContextRetrieval).mockImplementation(() => {
        callOrder.push('mem0-context');
        return { continue: true, suppressOutput: true };
      });
      vi.mocked(mem0AnalyticsTracker).mockImplementation(() => {
        callOrder.push('mem0-analytics');
        return { continue: true, suppressOutput: true };
      });
      vi.mocked(patternSyncPull).mockImplementation(() => {
        callOrder.push('pattern-sync');
        return { continue: true, suppressOutput: true };
      });

      // Act
      await unifiedSessionStartDispatcher(input);

      // Assert - all hooks should be called (order may vary due to parallel execution)
      expect(callOrder).toContain('mem0-context');
      expect(callOrder).toContain('mem0-analytics');
      expect(callOrder).toContain('pattern-sync');
    });

    test('continues execution when one hook fails', async () => {
      // Arrange
      const input = createHookInput();
      vi.mocked(mem0ContextRetrieval).mockImplementation(() => {
        throw new Error('Hook failure');
      });

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert - dispatcher should still succeed
      expect(result.continue).toBe(true);
      // Other hooks should still be called
      expect(mem0AnalyticsTracker).toHaveBeenCalled();
      expect(patternSyncPull).toHaveBeenCalled();
    });

    test('continues execution when multiple hooks fail', async () => {
      // Arrange
      const input = createHookInput();
      vi.mocked(mem0ContextRetrieval).mockImplementation(() => {
        throw new Error('Hook 1 failure');
      });
      vi.mocked(mem0AnalyticsTracker).mockImplementation(() => {
        throw new Error('Hook 2 failure');
      });
      vi.mocked(patternSyncPull).mockImplementation(() => {
        throw new Error('Hook 3 failure');
      });

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles all hooks failing', async () => {
      // Arrange
      const input = createHookInput();
      vi.mocked(mem0ContextRetrieval).mockImplementation(() => {
        throw new Error('Failure 1');
      });
      vi.mocked(mem0AnalyticsTracker).mockImplementation(() => {
        throw new Error('Failure 2');
      });
      vi.mocked(patternSyncPull).mockImplementation(() => {
        throw new Error('Failure 3');
      });
      vi.mocked(multiInstanceInit).mockImplementation(() => {
        throw new Error('Failure 4');
      });
      vi.mocked(sessionEnvSetup).mockImplementation(() => {
        throw new Error('Failure 5');
      });
      vi.mocked(sessionTracking).mockImplementation(() => {
        throw new Error('Failure 6');
      });
      vi.mocked(memoryMetricsCollector).mockImplementation(() => {
        throw new Error('Failure 7');
      });

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert - should still return success (fire-and-forget)
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('async hook handling', () => {
    test('handles hooks returning Promises', async () => {
      // Arrange
      const input = createHookInput();
      vi.mocked(mem0ContextRetrieval).mockImplementation(() =>
        Promise.resolve({ continue: true, suppressOutput: true })
      );

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles mix of sync and async hooks', async () => {
      // Arrange
      const input = createHookInput();
      vi.mocked(mem0ContextRetrieval).mockImplementation(() => ({ continue: true, suppressOutput: true }));
      vi.mocked(mem0AnalyticsTracker).mockImplementation(() =>
        Promise.resolve({ continue: true, suppressOutput: true })
      );
      vi.mocked(patternSyncPull).mockImplementation(() => ({ continue: true, suppressOutput: true }));

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(mem0ContextRetrieval).toHaveBeenCalled();
      expect(mem0AnalyticsTracker).toHaveBeenCalled();
      expect(patternSyncPull).toHaveBeenCalled();
    });

    test('handles async hook rejection', async () => {
      // Arrange
      const input = createHookInput();
      vi.mocked(mem0ContextRetrieval).mockImplementation(() =>
        Promise.reject(new Error('Async rejection'))
      );

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('waits for all async hooks to complete', async () => {
      // Arrange
      const input = createHookInput();
      let asyncHookCompleted = false;

      vi.mocked(mem0ContextRetrieval).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        asyncHookCompleted = true;
        return { continue: true, suppressOutput: true };
      });

      // Act
      await unifiedSessionStartDispatcher(input);

      // Assert
      expect(asyncHookCompleted).toBe(true);
    });
  });

  describe('fire-and-forget behavior', () => {
    test('returns success regardless of individual hook results', async () => {
      // Arrange
      const input = createHookInput();
      vi.mocked(mem0ContextRetrieval).mockReturnValue({ continue: false, stopReason: 'blocked' });
      vi.mocked(mem0AnalyticsTracker).mockReturnValue({ continue: false, stopReason: 'blocked' });

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert - dispatcher ignores individual hook results
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('does not propagate hook errors to caller', async () => {
      // Arrange
      const input = createHookInput();
      vi.mocked(mem0ContextRetrieval).mockImplementation(() => {
        throw new Error('Critical error');
      });

      // Act & Assert - should not throw
      await expect(unifiedSessionStartDispatcher(input)).resolves.toEqual({
        continue: true,
        suppressOutput: true,
      });
    });

    test('returns immediately available structure', async () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result).toHaveProperty('continue');
      expect(result).toHaveProperty('suppressOutput');
    });
  });

  describe('error handling', () => {
    test('handles undefined input gracefully', async () => {
      // Arrange
      const input = createHookInput({ project_dir: undefined });

      // Act
      const result = await unifiedSessionStartDispatcher(input);

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
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles hook throwing non-Error objects', async () => {
      // Arrange
      const input = createHookInput();
      vi.mocked(mem0ContextRetrieval).mockImplementation(() => {
        throw 'string error';
      });
      vi.mocked(mem0AnalyticsTracker).mockImplementation(() => {
        throw { message: 'object error' };
      });
      vi.mocked(patternSyncPull).mockImplementation(() => {
        throw null;
      });

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('never throws an exception', async () => {
      // Arrange
      const badInputs = [
        createHookInput({ project_dir: '' }),
        createHookInput({ project_dir: null as unknown as string }),
        createHookInput({ session_id: '' }),
      ];

      // Act & Assert
      for (const input of badInputs) {
        await expect(unifiedSessionStartDispatcher(input)).resolves.toBeDefined();
      }
    });
  });

  describe('non-blocking behavior', () => {
    test('always returns continue: true', async () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns suppressOutput: true', async () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });

    test('never returns stopReason', async () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.stopReason).toBeUndefined();
    });

    test('completes in reasonable time', async () => {
      // Arrange
      const input = createHookInput();

      // Act
      const start = Date.now();
      await unifiedSessionStartDispatcher(input);
      const duration = Date.now() - start;

      // Assert - should complete quickly with mocked hooks
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', async () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('suppressOutput', true);
    });

    test('always returns continue: true on success', async () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('always returns continue: true on error', async () => {
      // Arrange
      const input = createHookInput();
      vi.mocked(mem0ContextRetrieval).mockImplementation(() => {
        throw new Error('error');
      });

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('never blocks session start', async () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });
  });

  describe('CC 2.1.19 compliance', () => {
    test('consolidates multiple hooks into single async entry point', async () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert - single entry point that calls multiple hooks
      expect(result.continue).toBe(true);
      expect(mem0ContextRetrieval).toHaveBeenCalled();
      expect(mem0AnalyticsTracker).toHaveBeenCalled();
      expect(patternSyncPull).toHaveBeenCalled();
    });

    test('internal routing to correct hooks', async () => {
      // Arrange
      const input = createHookInput();

      // Act
      await unifiedSessionStartDispatcher(input);

      // Assert - all 7 hooks should be routed to
      const allHooks = [
        mem0ContextRetrieval,
        mem0AnalyticsTracker,
        patternSyncPull,
        multiInstanceInit,
        sessionEnvSetup,
        sessionTracking,
        memoryMetricsCollector,
      ];
      allHooks.forEach((hook) => {
        expect(hook).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('edge cases', () => {
    test('handles hook returning undefined', async () => {
      // Arrange
      const input = createHookInput();
      vi.mocked(mem0ContextRetrieval).mockReturnValue(undefined as unknown as { continue: true; suppressOutput: true });

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles hook returning null', async () => {
      // Arrange
      const input = createHookInput();
      vi.mocked(mem0ContextRetrieval).mockReturnValue(null as unknown as { continue: true; suppressOutput: true });

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles slow hooks', async () => {
      // Arrange
      const input = createHookInput();
      vi.mocked(mem0ContextRetrieval).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { continue: true, suppressOutput: true };
      });

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles concurrent dispatcher calls', async () => {
      // Arrange
      const input1 = createHookInput({ session_id: 'session-1' });
      const input2 = createHookInput({ session_id: 'session-2' });

      // Act - call dispatcher twice concurrently
      const [result1, result2] = await Promise.all([
        unifiedSessionStartDispatcher(input1),
        unifiedSessionStartDispatcher(input2),
      ]);

      // Assert
      expect(result1.continue).toBe(true);
      expect(result2.continue).toBe(true);
    });
  });

  describe('parametric scenarios', () => {
    test.each([
      { name: 'valid input', input: createHookInput(), shouldSucceed: true },
      { name: 'empty session_id', input: createHookInput({ session_id: '' }), shouldSucceed: true },
      { name: 'undefined project_dir', input: createHookInput({ project_dir: undefined }), shouldSucceed: true },
      { name: 'minimal input', input: { tool_name: '', session_id: '', tool_input: {} }, shouldSucceed: true },
    ])('with $name, should succeed: $shouldSucceed', async ({ input, shouldSucceed }) => {
      // Act
      const result = await unifiedSessionStartDispatcher(input as HookInput);

      // Assert
      expect(result.continue).toBe(shouldSucceed);
    });

    test.each([
      { failingHooks: 0, description: 'no hooks fail' },
      { failingHooks: 1, description: 'one hook fails' },
      { failingHooks: 3, description: 'nearly half of hooks fail' },
      { failingHooks: 7, description: 'all hooks fail' },
    ])('returns success when $description', async ({ failingHooks }) => {
      // Arrange
      const input = createHookInput();
      const hooks = [
        mem0ContextRetrieval,
        mem0AnalyticsTracker,
        patternSyncPull,
        multiInstanceInit,
        sessionEnvSetup,
        sessionTracking,
        memoryMetricsCollector,
      ];

      for (let i = 0; i < failingHooks && i < hooks.length; i++) {
        vi.mocked(hooks[i]).mockImplementation(() => {
          throw new Error(`Hook ${i} failed`);
        });
      }

      // Act
      const result = await unifiedSessionStartDispatcher(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });
});

/**
 * Dispatcher Functional Tests
 *
 * Tests actual dispatch behavior: error isolation, failure logging, and
 * return value guarantees for the surviving unified dispatchers.
 *
 * Dead-hook triage (#2561): the legacy posttool/lifecycle/stop/notification
 * unified-dispatchers were deleted (flattened into per-hook async entries in
 * hooks.json), so only the subagent-stop and setup dispatchers remain.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HookInput } from '../../types.js';
import { mockCommonBasic } from '../fixtures/mock-common.js';

// ---------------------------------------------------------------------------
// Hoisted mocks — available to vi.mock factories
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const s = { continue: true, suppressOutput: true };
  const fn = (impl?: () => unknown) => vi.fn(impl ?? (() => s));
  return {
    logHook: vi.fn(),
    // subagent-stop (2) — after #897 slimming
    handoffPreparer: fn(), feedbackLoop: fn(),
    // setup (1)
    dependencyVersionCheck: fn(),
    // subagent-stop analytics
    trackEvent: fn(), appendAnalytics: fn(), hashProject: fn(() => 'hash'), getTeamContext: fn(() => ({})),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../lib/common.js', () => mockCommonBasic({
  logHook: (...args: unknown[]) => mocks.logHook(...args),
}));

// subagent-stop hooks (2)
vi.mock('../../subagent-stop/handoff-preparer.js', () => ({ handoffPreparer: mocks.handoffPreparer }));
vi.mock('../../subagent-stop/feedback-loop.js', () => ({ feedbackLoop: mocks.feedbackLoop }));
vi.mock('../../lib/session-tracker.js', () => ({ trackEvent: mocks.trackEvent }));
vi.mock('../../lib/analytics.js', () => ({
  appendAnalytics: mocks.appendAnalytics,
  hashProject: mocks.hashProject,
  getTeamContext: mocks.getTeamContext,
}));

// setup hooks (1)
vi.mock('../../lifecycle/dependency-version-check.js', () => ({ dependencyVersionCheck: mocks.dependencyVersionCheck }));

// ---------------------------------------------------------------------------
// Dispatcher imports (AFTER mocks so vitest intercepts)
// ---------------------------------------------------------------------------

import { unifiedSubagentStopDispatcher } from '../../subagent-stop/unified-dispatcher.js';
import { unifiedSetupDispatcher } from '../../setup/unified-dispatcher.js';
import { createTestContext } from '../fixtures/test-context.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SILENT_SUCCESS = { continue: true, suppressOutput: true };

const input = (tool_name = ''): HookInput => ({
  tool_name,
  session_id: 'test-session',
  tool_input: {},
});

/** Collect names of mocks that were called from a name→fn map */
function called(map: Record<string, ReturnType<typeof vi.fn>>): string[] {
  return Object.entries(map)
    .filter(([, fn]) => fn.mock.calls.length > 0)
    .map(([name]) => name)
    .sort();
}

// Hook maps keyed by name
const subagentStopMap: Record<string, ReturnType<typeof vi.fn>> = {
  'handoff-preparer': mocks.handoffPreparer,
  'feedback-loop': mocks.feedbackLoop,
};

const setupMap: Record<string, ReturnType<typeof vi.fn>> = {
  'dependency-version-check': mocks.dependencyVersionCheck,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let testCtx: ReturnType<typeof createTestContext>;
beforeEach(() => {
  testCtx = createTestContext();
  vi.clearAllMocks();
});

describe('Dispatcher Functional Tests', () => {

  // =========================================================================
  // SUBAGENT-STOP — 2 hooks after #897
  // =========================================================================

  describe('subagent-stop/unified-dispatcher', () => {
    it('calls all 2 registered hooks', async () => {
      await unifiedSubagentStopDispatcher(input(), testCtx);
      expect(called(subagentStopMap)).toEqual(Object.keys(subagentStopMap).sort());
    });

    it('isolates errors — other hook runs when one throws', async () => {
      mocks.handoffPreparer.mockImplementationOnce(() => { throw new Error('network'); });

      await unifiedSubagentStopDispatcher(input(), testCtx);

      expect(mocks.feedbackLoop).toHaveBeenCalled();
    });

    it('returns silent success even on errors', async () => {
      mocks.feedbackLoop.mockImplementationOnce(() => { throw new Error('oops'); });
      const result = await unifiedSubagentStopDispatcher(input(), testCtx);
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });

  // =========================================================================
  // SETUP — 1 hook
  // =========================================================================

  describe('setup/unified-dispatcher', () => {
    it('calls all 1 registered hooks', async () => {
      await unifiedSetupDispatcher(input(), testCtx);
      expect(called(setupMap)).toEqual(Object.keys(setupMap).sort());
    });

    it('logs startup message', async () => {
      await unifiedSetupDispatcher(input(), testCtx);
      expect(testCtx.log).toHaveBeenCalledWith(
        'setup-dispatcher',
        expect.stringContaining('Running 1 Setup hooks'),
      );
    });

    it('returns silent success even on errors', async () => {
      mocks.dependencyVersionCheck.mockImplementationOnce(() => { throw new Error('outdated'); });
      const result = await unifiedSetupDispatcher(input(), testCtx);
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });
});

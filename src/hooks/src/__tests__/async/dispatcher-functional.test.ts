/**
 * Dispatcher Functional Tests
 *
 * Tests actual dispatch behavior: tool routing, error isolation,
 * failure logging, and return value guarantees for all 6 dispatchers.
 *
 * Updated to match current hook registrations after #897 slimming.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HookInput } from '../../types.js';

// ---------------------------------------------------------------------------
// Hoisted mocks — available to vi.mock factories
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const s = { continue: true, suppressOutput: true };
  const fn = () => vi.fn(() => s);
  return {
    logHook: vi.fn(),
    // posttool (3) — after #897 slimming
    redactSecrets: fn(), configChangeAuditor: fn(), teamMemberStart: fn(),
    // lifecycle (4) — after #897 slimming
    patternSyncPull: fn(), sessionEnvSetup: fn(),
    staleTeamCleanup: fn(), typeErrorIndexer: fn(),
    // stop (7) — handoff-writer + 6 skill-scoped hooks
    handoffWriter: fn(), taskCompletionCheck: fn(), securityScanAggregator: fn(),
    coverageCheck: fn(), evidenceCollector: fn(), coverageThresholdGate: fn(),
    crossInstanceTestValidator: fn(),
    // subagent-stop (2) — after #897 slimming
    handoffPreparer: fn(), feedbackLoop: fn(),
    // notification (2)
    desktopNotification: fn(), soundNotification: fn(),
    // setup (1)
    dependencyVersionCheck: fn(),
    // subagent-stop analytics
    trackEvent: fn(), appendAnalytics: fn(), hashProject: fn(() => 'hash'), getTeamContext: fn(() => ({})),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: () => ({ continue: true, suppressOutput: true }),
  logHook: (...args: unknown[]) => mocks.logHook(...args),
}));

// posttool hooks (3)
vi.mock('../../skill/redact-secrets.js', () => ({ redactSecrets: mocks.redactSecrets }));
vi.mock('../../posttool/config-change/security-auditor.js', () => ({ configChangeAuditor: mocks.configChangeAuditor }));
vi.mock('../../posttool/task/team-member-start.js', () => ({ teamMemberStart: mocks.teamMemberStart }));

// lifecycle hooks (4)
vi.mock('../../lifecycle/pattern-sync-pull.js', () => ({ patternSyncPull: mocks.patternSyncPull }));
vi.mock('../../lifecycle/session-env-setup.js', () => ({ sessionEnvSetup: mocks.sessionEnvSetup }));
vi.mock('../../lifecycle/stale-team-cleanup.js', () => ({ staleTeamCleanup: mocks.staleTeamCleanup }));
vi.mock('../../lifecycle/type-error-indexer.js', () => ({ typeErrorIndexer: mocks.typeErrorIndexer }));

// stop hooks (7)
vi.mock('../../stop/handoff-writer.js', () => ({ handoffWriter: mocks.handoffWriter }));
vi.mock('../../stop/task-completion-check.js', () => ({ taskCompletionCheck: mocks.taskCompletionCheck }));
vi.mock('../../stop/security-scan-aggregator.js', () => ({ securityScanAggregator: mocks.securityScanAggregator }));
vi.mock('../../skill/coverage-check.js', () => ({ coverageCheck: mocks.coverageCheck }));
vi.mock('../../skill/evidence-collector.js', () => ({ evidenceCollector: mocks.evidenceCollector }));
vi.mock('../../skill/coverage-threshold-gate.js', () => ({ coverageThresholdGate: mocks.coverageThresholdGate }));
vi.mock('../../skill/cross-instance-test-validator.js', () => ({ crossInstanceTestValidator: mocks.crossInstanceTestValidator }));

// subagent-stop hooks (2)
vi.mock('../../subagent-stop/handoff-preparer.js', () => ({ handoffPreparer: mocks.handoffPreparer }));
vi.mock('../../subagent-stop/feedback-loop.js', () => ({ feedbackLoop: mocks.feedbackLoop }));
vi.mock('../../lib/session-tracker.js', () => ({ trackEvent: mocks.trackEvent }));
vi.mock('../../lib/analytics.js', () => ({
  appendAnalytics: mocks.appendAnalytics,
  hashProject: mocks.hashProject,
  getTeamContext: mocks.getTeamContext,
}));

// notification hooks (2)
vi.mock('../../notification/desktop.js', () => ({ desktopNotification: mocks.desktopNotification }));
vi.mock('../../notification/sound.js', () => ({ soundNotification: mocks.soundNotification }));

// setup hooks (1)
vi.mock('../../lifecycle/dependency-version-check.js', () => ({ dependencyVersionCheck: mocks.dependencyVersionCheck }));

// ---------------------------------------------------------------------------
// Dispatcher imports (AFTER mocks so vitest intercepts)
// ---------------------------------------------------------------------------

import { unifiedDispatcher } from '../../posttool/unified-dispatcher.js';
import { unifiedSessionStartDispatcher } from '../../lifecycle/unified-dispatcher.js';
import { unifiedStopDispatcher } from '../../stop/unified-dispatcher.js';
import { unifiedSubagentStopDispatcher } from '../../subagent-stop/unified-dispatcher.js';
import { unifiedNotificationDispatcher } from '../../notification/unified-dispatcher.js';
import { unifiedSetupDispatcher } from '../../setup/unified-dispatcher.js';

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
const posttoolMap: Record<string, ReturnType<typeof vi.fn>> = {
  'redact-secrets': mocks.redactSecrets,
  'config-change-auditor': mocks.configChangeAuditor,
  'team-member-start': mocks.teamMemberStart,
};

const lifecycleMap: Record<string, ReturnType<typeof vi.fn>> = {
  'pattern-sync-pull': mocks.patternSyncPull,
  'session-env-setup': mocks.sessionEnvSetup,
  'stale-team-cleanup': mocks.staleTeamCleanup,
  'type-error-indexer': mocks.typeErrorIndexer,
};

const stopMap: Record<string, ReturnType<typeof vi.fn>> = {
  'handoff-writer': mocks.handoffWriter,
  'task-completion-check': mocks.taskCompletionCheck,
  'security-scan-aggregator': mocks.securityScanAggregator,
  'coverage-check': mocks.coverageCheck,
  'evidence-collector': mocks.evidenceCollector,
  'coverage-threshold-gate': mocks.coverageThresholdGate,
  'cross-instance-test-validator': mocks.crossInstanceTestValidator,
};

const subagentStopMap: Record<string, ReturnType<typeof vi.fn>> = {
  'handoff-preparer': mocks.handoffPreparer,
  'feedback-loop': mocks.feedbackLoop,
};

const notificationMap: Record<string, ReturnType<typeof vi.fn>> = {
  'desktop': mocks.desktopNotification,
  'sound': mocks.soundNotification,
};

const setupMap: Record<string, ReturnType<typeof vi.fn>> = {
  'dependency-version-check': mocks.dependencyVersionCheck,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Dispatcher Functional Tests', () => {

  // =========================================================================
  // POSTTOOL — tool routing via matchesTool (3 hooks after #897)
  // =========================================================================

  describe('posttool/unified-dispatcher', () => {
    describe('tool routing via matchesTool', () => {
      it('routes Bash to redact-secrets only', async () => {
        await unifiedDispatcher(input('Bash'));
        expect(mocks.redactSecrets).toHaveBeenCalled();
        expect(mocks.configChangeAuditor).not.toHaveBeenCalled();
        expect(mocks.teamMemberStart).not.toHaveBeenCalled();
      });

      it('routes Write to redact-secrets + config-change-auditor', async () => {
        await unifiedDispatcher(input('Write'));
        expect(mocks.redactSecrets).toHaveBeenCalled();
        expect(mocks.configChangeAuditor).toHaveBeenCalled();
        expect(mocks.teamMemberStart).not.toHaveBeenCalled();
      });

      it('routes Edit to redact-secrets + config-change-auditor', async () => {
        await unifiedDispatcher(input('Edit'));
        expect(mocks.redactSecrets).toHaveBeenCalled();
        expect(mocks.configChangeAuditor).toHaveBeenCalled();
        expect(mocks.teamMemberStart).not.toHaveBeenCalled();
      });

      it('routes Task to team-member-start only', async () => {
        await unifiedDispatcher(input('Task'));
        expect(mocks.teamMemberStart).toHaveBeenCalled();
        expect(mocks.redactSecrets).not.toHaveBeenCalled();
        expect(mocks.configChangeAuditor).not.toHaveBeenCalled();
      });

      it('routes Agent to team-member-start only', async () => {
        await unifiedDispatcher(input('Agent'));
        expect(mocks.teamMemberStart).toHaveBeenCalled();
        expect(mocks.redactSecrets).not.toHaveBeenCalled();
      });

      it('routes Skill to no hooks (no matcher)', async () => {
        await unifiedDispatcher(input('Skill'));
        expect(called(posttoolMap)).toEqual([]);
      });

      it('routes Read to no hooks (no matcher)', async () => {
        await unifiedDispatcher(input('Read'));
        expect(called(posttoolMap)).toEqual([]);
      });
    });

    describe('error isolation', () => {
      it('continues executing remaining hooks when one throws', async () => {
        mocks.redactSecrets.mockImplementationOnce(() => { throw new Error('sync boom'); });

        await unifiedDispatcher(input('Write'));

        // config-change-auditor still runs
        expect(mocks.configChangeAuditor).toHaveBeenCalled();
      });

      it('always returns silent success even when hooks fail', async () => {
        mocks.redactSecrets.mockImplementationOnce(() => { throw new Error('crash'); });

        const result = await unifiedDispatcher(input('Bash'));
        expect(result).toEqual(SILENT_SUCCESS);
      });
    });
  });

  // =========================================================================
  // LIFECYCLE (SessionStart) — 4 hooks after #897
  // =========================================================================

  describe('lifecycle/unified-dispatcher', () => {
    it('calls all 4 registered hooks', async () => {
      await unifiedSessionStartDispatcher(input());
      expect(called(lifecycleMap)).toEqual(Object.keys(lifecycleMap).sort());
    });

    it('isolates errors — other hooks run when one throws', async () => {
      mocks.patternSyncPull.mockImplementationOnce(() => { throw new Error('fail'); });

      await unifiedSessionStartDispatcher(input());

      expect(mocks.sessionEnvSetup).toHaveBeenCalled();
      expect(mocks.staleTeamCleanup).toHaveBeenCalled();
    });

    it('logs failure summary on error', async () => {
      mocks.patternSyncPull.mockImplementationOnce(() => { throw new Error('timeout'); });

      await unifiedSessionStartDispatcher(input());

      expect(mocks.logHook).toHaveBeenCalledWith(
        'session-start-dispatcher',
        expect.stringContaining('1/4 hooks failed'),
      );
    });

    it('returns silent success even on errors', async () => {
      mocks.patternSyncPull.mockImplementationOnce(() => { throw new Error('nope'); });
      const result = await unifiedSessionStartDispatcher(input());
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });

  // =========================================================================
  // STOP — 7 hooks after #897
  // =========================================================================

  describe('stop/unified-dispatcher', () => {
    it('calls all 7 registered hooks', async () => {
      await unifiedStopDispatcher(input());
      expect(called(stopMap)).toEqual(Object.keys(stopMap).sort());
    });

    it('isolates errors — other hooks run when one throws', async () => {
      mocks.handoffWriter.mockImplementationOnce(() => { throw new Error('disk full'); });

      await unifiedStopDispatcher(input());

      expect(mocks.taskCompletionCheck).toHaveBeenCalled();
      expect(mocks.securityScanAggregator).toHaveBeenCalled();
    });

    it('returns silent success even on errors', async () => {
      mocks.handoffWriter.mockImplementationOnce(() => Promise.reject(new Error('fail')) as unknown as { continue: boolean; suppressOutput: boolean });
      const result = await unifiedStopDispatcher(input());
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });

  // =========================================================================
  // SUBAGENT-STOP — 2 hooks after #897
  // =========================================================================

  describe('subagent-stop/unified-dispatcher', () => {
    it('calls all 2 registered hooks', async () => {
      await unifiedSubagentStopDispatcher(input());
      expect(called(subagentStopMap)).toEqual(Object.keys(subagentStopMap).sort());
    });

    it('isolates errors — other hook runs when one throws', async () => {
      mocks.handoffPreparer.mockImplementationOnce(() => { throw new Error('network'); });

      await unifiedSubagentStopDispatcher(input());

      expect(mocks.feedbackLoop).toHaveBeenCalled();
    });

    it('returns silent success even on errors', async () => {
      mocks.feedbackLoop.mockImplementationOnce(() => { throw new Error('oops'); });
      const result = await unifiedSubagentStopDispatcher(input());
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });

  // =========================================================================
  // NOTIFICATION — 2 hooks
  // =========================================================================

  describe('notification/unified-dispatcher', () => {
    it('calls all 2 registered hooks', async () => {
      await unifiedNotificationDispatcher(input());
      expect(called(notificationMap)).toEqual(Object.keys(notificationMap).sort());
    });

    it('isolates errors — other hook runs when one throws', async () => {
      mocks.desktopNotification.mockImplementationOnce(() => { throw new Error('no display'); });

      await unifiedNotificationDispatcher(input());

      expect(mocks.soundNotification).toHaveBeenCalled();
    });

    it('returns silent success even on errors', async () => {
      mocks.soundNotification.mockImplementationOnce(() => { throw new Error('no audio'); });
      const result = await unifiedNotificationDispatcher(input());
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });

  // =========================================================================
  // SETUP — 1 hook
  // =========================================================================

  describe('setup/unified-dispatcher', () => {
    it('calls all 1 registered hooks', async () => {
      await unifiedSetupDispatcher(input());
      expect(called(setupMap)).toEqual(Object.keys(setupMap).sort());
    });

    it('logs startup message', async () => {
      await unifiedSetupDispatcher(input());
      expect(mocks.logHook).toHaveBeenCalledWith(
        'setup-dispatcher',
        expect.stringContaining('Running 1 Setup hooks'),
      );
    });

    it('returns silent success even on errors', async () => {
      mocks.dependencyVersionCheck.mockImplementationOnce(() => { throw new Error('outdated'); });
      const result = await unifiedSetupDispatcher(input());
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });
});

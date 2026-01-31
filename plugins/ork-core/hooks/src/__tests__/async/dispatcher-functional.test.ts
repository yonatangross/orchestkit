/**
 * Dispatcher Functional Tests
 *
 * Tests actual dispatch behavior: tool routing, error isolation,
 * failure logging, and return value guarantees for all 6 dispatchers.
 *
 * Unlike dispatcher-registry.test.ts (structural snapshot), these tests
 * mock every hook fn and verify the dispatchers call the right ones.
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
    // posttool (17) - Issue #243: now includes userTracking, solutionDetector, toolPreferenceLearner
    sessionMetrics: fn(), auditLogger: fn(), calibrationTracker: fn(),
    patternExtractor: fn(), issueProgressCommenter: fn(), issueSubtaskUpdater: fn(),
    mem0WebhookHandler: fn(), codeStyleLearner: fn(), namingConventionLearner: fn(),
    skillEditTracker: fn(), coordinationHeartbeat: fn(), skillUsageOptimizer: fn(),
    memoryBridge: fn(), realtimeSync: fn(), userTracking: fn(), solutionDetector: fn(),
    toolPreferenceLearner: fn(),
    // lifecycle (6)
    mem0ContextRetrieval: fn(), mem0AnalyticsTracker: fn(), patternSyncPull: fn(),
    multiInstanceInit: fn(), instanceHeartbeat: fn(), sessionEnvSetup: fn(),
    // stop (4)
    autoSaveContext: fn(), sessionPatterns: fn(), issueWorkSummary: fn(), calibrationPersist: fn(),
    // subagent-stop (4)
    contextPublisher: fn(), handoffPreparer: fn(), feedbackLoop: fn(), agentMemoryStore: fn(),
    // notification (2)
    desktopNotification: fn(), soundNotification: fn(),
    // setup (3) — implementations live in lifecycle/
    dependencyVersionCheck: fn(), mem0WebhookSetup: fn(), coordinationInit: fn(),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: () => ({ continue: true, suppressOutput: true }),
  logHook: (...args: unknown[]) => mocks.logHook(...args),
}));

// posttool hooks
vi.mock('../../posttool/session-metrics.js', () => ({ sessionMetrics: mocks.sessionMetrics }));
vi.mock('../../posttool/audit-logger.js', () => ({ auditLogger: mocks.auditLogger }));
vi.mock('../../posttool/calibration-tracker.js', () => ({ calibrationTracker: mocks.calibrationTracker }));
vi.mock('../../posttool/bash/pattern-extractor.js', () => ({ patternExtractor: mocks.patternExtractor }));
vi.mock('../../posttool/bash/issue-progress-commenter.js', () => ({ issueProgressCommenter: mocks.issueProgressCommenter }));
vi.mock('../../posttool/bash/issue-subtask-updater.js', () => ({ issueSubtaskUpdater: mocks.issueSubtaskUpdater }));
vi.mock('../../posttool/mem0-webhook-handler.js', () => ({ mem0WebhookHandler: mocks.mem0WebhookHandler }));
vi.mock('../../posttool/write/code-style-learner.js', () => ({ codeStyleLearner: mocks.codeStyleLearner }));
vi.mock('../../posttool/write/naming-convention-learner.js', () => ({ namingConventionLearner: mocks.namingConventionLearner }));
vi.mock('../../posttool/skill-edit-tracker.js', () => ({ skillEditTracker: mocks.skillEditTracker }));
vi.mock('../../posttool/coordination-heartbeat.js', () => ({ coordinationHeartbeat: mocks.coordinationHeartbeat }));
vi.mock('../../posttool/skill/skill-usage-optimizer.js', () => ({ skillUsageOptimizer: mocks.skillUsageOptimizer }));
vi.mock('../../posttool/memory-bridge.js', () => ({ memoryBridge: mocks.memoryBridge }));
vi.mock('../../posttool/realtime-sync.js', () => ({ realtimeSync: mocks.realtimeSync }));
vi.mock('../../posttool/user-tracking.js', () => ({ userTracking: mocks.userTracking }));
vi.mock('../../posttool/solution-detector.js', () => ({ solutionDetector: mocks.solutionDetector }));
vi.mock('../../posttool/tool-preference-learner.js', () => ({ toolPreferenceLearner: mocks.toolPreferenceLearner }));

// lifecycle hooks
vi.mock('../../lifecycle/mem0-context-retrieval.js', () => ({ mem0ContextRetrieval: mocks.mem0ContextRetrieval }));
vi.mock('../../lifecycle/mem0-analytics-tracker.js', () => ({ mem0AnalyticsTracker: mocks.mem0AnalyticsTracker }));
vi.mock('../../lifecycle/pattern-sync-pull.js', () => ({ patternSyncPull: mocks.patternSyncPull }));
vi.mock('../../lifecycle/multi-instance-init.js', () => ({ multiInstanceInit: mocks.multiInstanceInit }));
vi.mock('../../lifecycle/instance-heartbeat.js', () => ({ instanceHeartbeat: mocks.instanceHeartbeat }));
vi.mock('../../lifecycle/session-env-setup.js', () => ({ sessionEnvSetup: mocks.sessionEnvSetup }));

// stop hooks
vi.mock('../../stop/auto-save-context.js', () => ({ autoSaveContext: mocks.autoSaveContext }));
vi.mock('../../stop/session-patterns.js', () => ({ sessionPatterns: mocks.sessionPatterns }));
vi.mock('../../stop/issue-work-summary.js', () => ({ issueWorkSummary: mocks.issueWorkSummary }));
vi.mock('../../stop/calibration-persist.js', () => ({ calibrationPersist: mocks.calibrationPersist }));

// subagent-stop hooks
vi.mock('../../subagent-stop/context-publisher.js', () => ({ contextPublisher: mocks.contextPublisher }));
vi.mock('../../subagent-stop/handoff-preparer.js', () => ({ handoffPreparer: mocks.handoffPreparer }));
vi.mock('../../subagent-stop/feedback-loop.js', () => ({ feedbackLoop: mocks.feedbackLoop }));
vi.mock('../../subagent-stop/agent-memory-store.js', () => ({ agentMemoryStore: mocks.agentMemoryStore }));

// notification hooks
vi.mock('../../notification/desktop.js', () => ({ desktopNotification: mocks.desktopNotification }));
vi.mock('../../notification/sound.js', () => ({ soundNotification: mocks.soundNotification }));

// setup hooks (source files live in lifecycle/)
vi.mock('../../lifecycle/dependency-version-check.js', () => ({ dependencyVersionCheck: mocks.dependencyVersionCheck }));
vi.mock('../../lifecycle/mem0-webhook-setup.js', () => ({ mem0WebhookSetup: mocks.mem0WebhookSetup }));
vi.mock('../../lifecycle/coordination-init.js', () => ({ coordinationInit: mocks.coordinationInit }));

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
// Re-import hook functions to verify mocks are active
// ---------------------------------------------------------------------------

import { sessionMetrics } from '../../posttool/session-metrics.js';
import { auditLogger } from '../../posttool/audit-logger.js';
import { patternExtractor } from '../../posttool/bash/pattern-extractor.js';
import { codeStyleLearner } from '../../posttool/write/code-style-learner.js';
import { coordinationHeartbeat } from '../../posttool/coordination-heartbeat.js';
import { memoryBridge } from '../../posttool/memory-bridge.js';
import { mem0ContextRetrieval } from '../../lifecycle/mem0-context-retrieval.js';
import { autoSaveContext } from '../../stop/auto-save-context.js';
import { contextPublisher } from '../../subagent-stop/context-publisher.js';
import { desktopNotification } from '../../notification/desktop.js';
import { dependencyVersionCheck } from '../../lifecycle/dependency-version-check.js';

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

// posttool mock map (keyed by hook name)
const posttoolMap: Record<string, ReturnType<typeof vi.fn>> = {
  'session-metrics': mocks.sessionMetrics,
  'audit-logger': mocks.auditLogger,
  'calibration-tracker': mocks.calibrationTracker,
  'pattern-extractor': mocks.patternExtractor,
  'issue-progress-commenter': mocks.issueProgressCommenter,
  'issue-subtask-updater': mocks.issueSubtaskUpdater,
  'mem0-webhook-handler': mocks.mem0WebhookHandler,
  'code-style-learner': mocks.codeStyleLearner,
  'naming-convention-learner': mocks.namingConventionLearner,
  'skill-edit-tracker': mocks.skillEditTracker,
  'coordination-heartbeat': mocks.coordinationHeartbeat,
  'skill-usage-optimizer': mocks.skillUsageOptimizer,
  'memory-bridge': mocks.memoryBridge,
  'realtime-sync': mocks.realtimeSync,
};

const lifecycleMap: Record<string, ReturnType<typeof vi.fn>> = {
  'mem0-context-retrieval': mocks.mem0ContextRetrieval,
  'mem0-analytics-tracker': mocks.mem0AnalyticsTracker,
  'pattern-sync-pull': mocks.patternSyncPull,
  'multi-instance-init': mocks.multiInstanceInit,
  'instance-heartbeat': mocks.instanceHeartbeat,
  'session-env-setup': mocks.sessionEnvSetup,
};

const stopMap: Record<string, ReturnType<typeof vi.fn>> = {
  'auto-save-context': mocks.autoSaveContext,
  'session-patterns': mocks.sessionPatterns,
  'issue-work-summary': mocks.issueWorkSummary,
  'calibration-persist': mocks.calibrationPersist,
};

const subagentStopMap: Record<string, ReturnType<typeof vi.fn>> = {
  'context-publisher': mocks.contextPublisher,
  'handoff-preparer': mocks.handoffPreparer,
  'feedback-loop': mocks.feedbackLoop,
  'agent-memory-store': mocks.agentMemoryStore,
};

const notificationMap: Record<string, ReturnType<typeof vi.fn>> = {
  'desktop': mocks.desktopNotification,
  'sound': mocks.soundNotification,
};

const setupMap: Record<string, ReturnType<typeof vi.fn>> = {
  'dependency-version-check': mocks.dependencyVersionCheck,
  'mem0-webhook-setup': mocks.mem0WebhookSetup,
  'coordination-init': mocks.coordinationInit,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Dispatcher Functional Tests', () => {

  // =========================================================================
  // MOCK INTEGRITY — verify mocks are actually intercepting
  // =========================================================================

  describe('mock integrity (guards against silent mock miss)', () => {
    it('all hook imports are mocked, not real implementations', () => {
      // One representative hook per dispatcher — if vi.mock path is wrong,
      // these will be real functions, not vi.fn() instances
      expect(vi.isMockFunction(sessionMetrics)).toBe(true);
      expect(vi.isMockFunction(auditLogger)).toBe(true);
      expect(vi.isMockFunction(patternExtractor)).toBe(true);
      expect(vi.isMockFunction(codeStyleLearner)).toBe(true);
      expect(vi.isMockFunction(coordinationHeartbeat)).toBe(true);
      expect(vi.isMockFunction(memoryBridge)).toBe(true);
      expect(vi.isMockFunction(mem0ContextRetrieval)).toBe(true);
      expect(vi.isMockFunction(autoSaveContext)).toBe(true);
      expect(vi.isMockFunction(contextPublisher)).toBe(true);
      expect(vi.isMockFunction(desktopNotification)).toBe(true);
      expect(vi.isMockFunction(dependencyVersionCheck)).toBe(true);
    });
  });

  // =========================================================================
  // POSTTOOL — tool routing via matchesTool
  // =========================================================================

  describe('posttool/unified-dispatcher', () => {
    describe('tool routing via matchesTool', () => {
      it('routes Bash to wildcard + Bash + multi-tool hooks', async () => {
        await unifiedDispatcher(input('Bash'));
        expect(called(posttoolMap)).toEqual([
          'audit-logger', 'calibration-tracker', 'issue-progress-commenter',
          'issue-subtask-updater', 'mem0-webhook-handler', 'pattern-extractor',
          'realtime-sync', 'session-metrics',
        ].sort());
        // Write/Edit hooks must NOT fire for Bash
        expect(mocks.codeStyleLearner).not.toHaveBeenCalled();
        expect(mocks.namingConventionLearner).not.toHaveBeenCalled();
        expect(mocks.skillEditTracker).not.toHaveBeenCalled();
        // Task/Skill/MCP hooks must NOT fire for Bash
        expect(mocks.coordinationHeartbeat).not.toHaveBeenCalled();
        expect(mocks.skillUsageOptimizer).not.toHaveBeenCalled();
        expect(mocks.memoryBridge).not.toHaveBeenCalled();
      });

      it('routes Write to wildcard + Write/Edit + multi-tool hooks', async () => {
        await unifiedDispatcher(input('Write'));
        expect(called(posttoolMap)).toEqual([
          'audit-logger', 'calibration-tracker', 'code-style-learner',
          'naming-convention-learner', 'realtime-sync', 'session-metrics',
          'skill-edit-tracker',
        ].sort());
        // Bash hooks must NOT fire for Write
        expect(mocks.patternExtractor).not.toHaveBeenCalled();
        expect(mocks.issueProgressCommenter).not.toHaveBeenCalled();
        expect(mocks.coordinationHeartbeat).not.toHaveBeenCalled();
        expect(mocks.skillUsageOptimizer).not.toHaveBeenCalled();
      });

      it('routes Edit to wildcard + Write/Edit + multi-tool hooks', async () => {
        await unifiedDispatcher(input('Edit'));
        expect(called(posttoolMap)).toEqual([
          'audit-logger', 'calibration-tracker', 'code-style-learner',
          'naming-convention-learner', 'realtime-sync', 'session-metrics',
          'skill-edit-tracker',
        ].sort());
        // Bash hooks must NOT fire for Edit
        expect(mocks.patternExtractor).not.toHaveBeenCalled();
        expect(mocks.mem0WebhookHandler).not.toHaveBeenCalled();
        expect(mocks.coordinationHeartbeat).not.toHaveBeenCalled();
      });

      it('routes Task to wildcard + Task + multi-tool hooks', async () => {
        await unifiedDispatcher(input('Task'));
        expect(called(posttoolMap)).toEqual([
          'audit-logger', 'calibration-tracker', 'coordination-heartbeat',
          'realtime-sync', 'session-metrics',
        ].sort());
        // Bash and Write/Edit hooks must NOT fire for Task
        expect(mocks.patternExtractor).not.toHaveBeenCalled();
        expect(mocks.codeStyleLearner).not.toHaveBeenCalled();
        expect(mocks.skillUsageOptimizer).not.toHaveBeenCalled();
        expect(mocks.memoryBridge).not.toHaveBeenCalled();
      });

      it('routes Skill to wildcard + Skill + multi-tool hooks', async () => {
        await unifiedDispatcher(input('Skill'));
        expect(called(posttoolMap)).toEqual([
          'audit-logger', 'calibration-tracker', 'realtime-sync',
          'session-metrics', 'skill-usage-optimizer',
        ].sort());
        // Bash and Write/Edit hooks must NOT fire for Skill
        expect(mocks.patternExtractor).not.toHaveBeenCalled();
        expect(mocks.codeStyleLearner).not.toHaveBeenCalled();
        expect(mocks.coordinationHeartbeat).not.toHaveBeenCalled();
        expect(mocks.memoryBridge).not.toHaveBeenCalled();
      });

      it('routes MCP tool to wildcard + MCP-specific hooks only', async () => {
        await unifiedDispatcher(input('mcp__mem0__add_memory'));
        expect(called(posttoolMap)).toEqual([
          'audit-logger', 'calibration-tracker', 'memory-bridge', 'session-metrics',
        ].sort());
        // No Bash, Write/Edit, Task, Skill, or multi-tool hooks
        expect(mocks.patternExtractor).not.toHaveBeenCalled();
        expect(mocks.codeStyleLearner).not.toHaveBeenCalled();
        expect(mocks.coordinationHeartbeat).not.toHaveBeenCalled();
        expect(mocks.skillUsageOptimizer).not.toHaveBeenCalled();
        expect(mocks.realtimeSync).not.toHaveBeenCalled();
      });

      it('routes Read to wildcard hooks only (no specific matchers)', async () => {
        await unifiedDispatcher(input('Read'));
        expect(called(posttoolMap)).toEqual([
          'audit-logger', 'calibration-tracker', 'session-metrics',
        ].sort());
        // No specific-tool hooks should fire for Read
        expect(mocks.patternExtractor).not.toHaveBeenCalled();
        expect(mocks.codeStyleLearner).not.toHaveBeenCalled();
        expect(mocks.coordinationHeartbeat).not.toHaveBeenCalled();
        expect(mocks.skillUsageOptimizer).not.toHaveBeenCalled();
        expect(mocks.memoryBridge).not.toHaveBeenCalled();
        expect(mocks.realtimeSync).not.toHaveBeenCalled();
      });
    });

    describe('parallel execution', () => {
      it('runs matching hooks concurrently, not sequentially', async () => {
        const DELAY = 50; // ms each hook "takes"
        // 3 wildcard hooks each delay 50ms — sequential would be ≥150ms
        mocks.sessionMetrics.mockImplementationOnce(() => new Promise(r => setTimeout(r, DELAY)));
        mocks.auditLogger.mockImplementationOnce(() => new Promise(r => setTimeout(r, DELAY)));
        mocks.calibrationTracker.mockImplementationOnce(() => new Promise(r => setTimeout(r, DELAY)));

        const start = performance.now();
        await unifiedDispatcher(input('Read')); // only wildcards match
        const elapsed = performance.now() - start;

        // Parallel: ~50ms. Sequential: ~150ms. Threshold: 120ms.
        expect(elapsed).toBeLessThan(DELAY * 2.4);
        // All 3 still called
        expect(mocks.sessionMetrics).toHaveBeenCalled();
        expect(mocks.auditLogger).toHaveBeenCalled();
        expect(mocks.calibrationTracker).toHaveBeenCalled();
      });
    });

    describe('error isolation', () => {
      it('continues executing remaining hooks when one throws synchronously', async () => {
        mocks.auditLogger.mockImplementationOnce(() => { throw new Error('sync boom'); });

        await unifiedDispatcher(input('Bash'));

        // Other hooks still ran
        expect(mocks.sessionMetrics).toHaveBeenCalled();
        expect(mocks.calibrationTracker).toHaveBeenCalled();
        expect(mocks.patternExtractor).toHaveBeenCalled();
        expect(mocks.realtimeSync).toHaveBeenCalled();
      });

      it('continues executing remaining hooks when one rejects async', async () => {
        mocks.patternExtractor.mockImplementationOnce(
          () => Promise.reject(new Error('async boom'))
        );

        await unifiedDispatcher(input('Bash'));

        expect(mocks.sessionMetrics).toHaveBeenCalled();
        expect(mocks.auditLogger).toHaveBeenCalled();
        expect(mocks.issueProgressCommenter).toHaveBeenCalled();
      });

      it('logs per-hook failure message', async () => {
        mocks.auditLogger.mockImplementationOnce(() => { throw new Error('db down'); });

        await unifiedDispatcher(input('Bash'));

        expect(mocks.logHook).toHaveBeenCalledWith(
          'unified-dispatcher',
          expect.stringContaining('audit-logger failed: db down'),
        );
      });

      it('logs aggregate failure summary', async () => {
        mocks.auditLogger.mockImplementationOnce(() => { throw new Error('fail1'); });
        mocks.sessionMetrics.mockImplementationOnce(() => { throw new Error('fail2'); });

        await unifiedDispatcher(input('Bash'));

        // Issue #243: Now 11 hooks for Bash (was 10) after adding tool-preference-learner
        expect(mocks.logHook).toHaveBeenCalledWith(
          'posttool-dispatcher',
          expect.stringMatching(/2\/11 hooks failed.*audit-logger.*session-metrics|2\/11 hooks failed.*session-metrics.*audit-logger/),
        );
      });

      it('always returns silent success even when hooks fail', async () => {
        mocks.sessionMetrics.mockImplementationOnce(() => { throw new Error('crash'); });
        mocks.auditLogger.mockImplementationOnce(() => Promise.reject(new Error('boom')));

        const result = await unifiedDispatcher(input('Bash'));
        expect(result).toEqual(SILENT_SUCCESS);
      });
    });
  });

  // =========================================================================
  // LIFECYCLE (SessionStart)
  // =========================================================================

  describe('lifecycle/unified-dispatcher', () => {
    it('calls all 6 registered hooks', async () => {
      await unifiedSessionStartDispatcher(input());
      expect(called(lifecycleMap)).toEqual(Object.keys(lifecycleMap).sort());
    });

    it('isolates errors — other hooks run when one throws', async () => {
      mocks.mem0ContextRetrieval.mockImplementationOnce(() => { throw new Error('fail'); });

      await unifiedSessionStartDispatcher(input());

      expect(mocks.mem0AnalyticsTracker).toHaveBeenCalled();
      expect(mocks.patternSyncPull).toHaveBeenCalled();
      expect(mocks.sessionEnvSetup).toHaveBeenCalled();
    });

    it('logs failure summary on error', async () => {
      mocks.instanceHeartbeat.mockImplementationOnce(() => { throw new Error('timeout'); });

      await unifiedSessionStartDispatcher(input());

      expect(mocks.logHook).toHaveBeenCalledWith(
        'session-start-dispatcher',
        expect.stringContaining('1/7 hooks failed'),
      );
    });

    it('returns silent success even on errors', async () => {
      mocks.patternSyncPull.mockImplementationOnce(() => { throw new Error('nope'); });
      const result = await unifiedSessionStartDispatcher(input());
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });

  // =========================================================================
  // STOP
  // =========================================================================

  describe('stop/unified-dispatcher', () => {
    it('calls all 4 registered hooks', async () => {
      await unifiedStopDispatcher(input());
      expect(called(stopMap)).toEqual(Object.keys(stopMap).sort());
    });

    it('isolates errors — other hooks run when one throws', async () => {
      mocks.autoSaveContext.mockImplementationOnce(() => { throw new Error('disk full'); });

      await unifiedStopDispatcher(input());

      expect(mocks.sessionPatterns).toHaveBeenCalled();
      expect(mocks.issueWorkSummary).toHaveBeenCalled();
      expect(mocks.calibrationPersist).toHaveBeenCalled();
    });

    it('returns silent success even on errors', async () => {
      mocks.calibrationPersist.mockImplementationOnce(() => Promise.reject(new Error('fail')));
      const result = await unifiedStopDispatcher(input());
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });

  // =========================================================================
  // SUBAGENT-STOP
  // =========================================================================

  describe('subagent-stop/unified-dispatcher', () => {
    it('calls all 4 registered hooks', async () => {
      await unifiedSubagentStopDispatcher(input());
      expect(called(subagentStopMap)).toEqual(Object.keys(subagentStopMap).sort());
    });

    it('isolates errors — other hooks run when one throws', async () => {
      mocks.contextPublisher.mockImplementationOnce(() => { throw new Error('network'); });

      await unifiedSubagentStopDispatcher(input());

      expect(mocks.handoffPreparer).toHaveBeenCalled();
      expect(mocks.feedbackLoop).toHaveBeenCalled();
      expect(mocks.agentMemoryStore).toHaveBeenCalled();
    });

    it('returns silent success even on errors', async () => {
      mocks.feedbackLoop.mockImplementationOnce(() => { throw new Error('oops'); });
      const result = await unifiedSubagentStopDispatcher(input());
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });

  // =========================================================================
  // NOTIFICATION
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
  // SETUP
  // =========================================================================

  describe('setup/unified-dispatcher', () => {
    it('calls all 3 registered hooks', async () => {
      await unifiedSetupDispatcher(input());
      expect(called(setupMap)).toEqual(Object.keys(setupMap).sort());
    });

    it('logs startup message', async () => {
      await unifiedSetupDispatcher(input());
      expect(mocks.logHook).toHaveBeenCalledWith(
        'setup-dispatcher',
        expect.stringContaining('Running 3 Setup hooks'),
      );
    });

    it('logs success when all hooks pass', async () => {
      await unifiedSetupDispatcher(input());
      expect(mocks.logHook).toHaveBeenCalledWith(
        'setup-dispatcher',
        expect.stringContaining('All 3 Setup hooks completed successfully'),
      );
    });

    it('isolates errors — other hooks run when one throws', async () => {
      mocks.dependencyVersionCheck.mockImplementationOnce(() => { throw new Error('outdated'); });

      await unifiedSetupDispatcher(input());

      expect(mocks.mem0WebhookSetup).toHaveBeenCalled();
      expect(mocks.coordinationInit).toHaveBeenCalled();
    });

    it('returns silent success even on errors', async () => {
      mocks.coordinationInit.mockImplementationOnce(() => { throw new Error('locked'); });
      const result = await unifiedSetupDispatcher(input());
      expect(result).toEqual(SILENT_SUCCESS);
    });
  });
});

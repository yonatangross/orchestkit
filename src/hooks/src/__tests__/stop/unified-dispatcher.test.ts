/**
 * Tests for Unified Stop Dispatcher Hook
 *
 * Tests the unified dispatcher that runs all stop hooks in parallel.
 * Covers: running all hooks, re-entry prevention via stop_hook_active,
 * individual hook failures, and registeredHookNames export.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock common utilities
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-id'),
  outputWithContext: vi.fn((ctx: string) => ({ continue: true, additionalContext: ctx })),
}));

// Mock all individual stop hooks
vi.mock('../../stop/auto-save-context.js', () => ({
  autoSaveContext: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../stop/session-patterns.js', () => ({
  sessionPatterns: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../stop/issue-work-summary.js', () => ({
  issueWorkSummary: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../stop/calibration-persist.js', () => ({
  calibrationPersist: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../stop/session-profile-aggregator.js', () => ({
  sessionProfileAggregator: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../stop/session-end-tracking.js', () => ({
  sessionEndTracking: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../stop/graph-queue-sync.js', () => ({
  graphQueueSync: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../stop/workflow-preference-learner.js', () => ({
  workflowPreferenceLearner: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../stop/task-completion-check.js', () => ({
  taskCompletionCheck: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../stop/auto-remember-continuity.js', () => ({
  autoRememberContinuity: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../stop/full-test-suite.js', () => ({
  fullTestSuite: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../stop/security-scan-aggregator.js', () => ({
  securityScanAggregator: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

// Mock skill hooks
vi.mock('../../skill/coverage-check.js', () => ({
  coverageCheck: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../skill/evidence-collector.js', () => ({
  evidenceCollector: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../skill/coverage-threshold-gate.js', () => ({
  coverageThresholdGate: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../skill/cross-instance-test-validator.js', () => ({
  crossInstanceTestValidator: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../skill/di-pattern-enforcer.js', () => ({
  diPatternEnforcer: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../skill/duplicate-code-detector.js', () => ({
  duplicateCodeDetector: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../skill/eval-metrics-collector.js', () => ({
  evalMetricsCollector: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../skill/migration-validator.js', () => ({
  migrationValidator: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../skill/review-summary-generator.js', () => ({
  reviewSummaryGenerator: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../skill/security-summary.js', () => ({
  securitySummary: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../skill/test-pattern-validator.js', () => ({
  testPatternValidator: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));
vi.mock('../../skill/test-runner.js', () => ({
  testRunner: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

import { unifiedStopDispatcher, registeredHookNames } from '../../stop/unified-dispatcher.js';
import { logHook, outputSilentSuccess } from '../../lib/common.js';
import { autoSaveContext } from '../../stop/auto-save-context.js';
import { calibrationPersist } from '../../stop/calibration-persist.js';
import type { HookInput } from '../../types.js';

describe('Unified Stop Dispatcher Hook', () => {
  const mockLogHook = vi.mocked(logHook);
  const _mockOutputSilentSuccess = vi.mocked(outputSilentSuccess);
  const mockAutoSaveContext = vi.mocked(autoSaveContext);
  const mockCalibrationPersist = vi.mocked(calibrationPersist);

  const defaultInput: HookInput = {
    hook_event: 'Stop',
    tool_name: '',
    session_id: 'test-session-001',
    tool_input: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // SECTION 1: Runs All Hooks
  // ===========================================================================
  describe('Runs All Hooks', () => {
    it('should run all registered hooks and return silent success', async () => {
      // Act
      const result = await unifiedStopDispatcher(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should call individual stop hooks', async () => {
      // Act
      await unifiedStopDispatcher(defaultInput);

      // Assert
      expect(mockAutoSaveContext).toHaveBeenCalledWith(defaultInput);
      expect(mockCalibrationPersist).toHaveBeenCalledWith(defaultInput);
    });

    it('should pass input to all hooks', async () => {
      // Act
      await unifiedStopDispatcher(defaultInput);

      // Assert
      expect(mockAutoSaveContext).toHaveBeenCalledWith(defaultInput);
    });
  });

  // ===========================================================================
  // SECTION 2: Re-Entry Prevention
  // ===========================================================================
  describe('Re-Entry Prevention', () => {
    it('should skip when stop_hook_active is true', async () => {
      // Arrange
      const inputWithActive: HookInput = {
        ...defaultInput,
        stop_hook_active: true,
      };

      // Act
      const result = await unifiedStopDispatcher(inputWithActive);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'stop-dispatcher',
        'Skipping: stop_hook_active=true (re-entry prevention)'
      );
    });

    it('should not call any hooks when stop_hook_active is true', async () => {
      // Arrange
      const inputWithActive: HookInput = {
        ...defaultInput,
        stop_hook_active: true,
      };

      // Act
      await unifiedStopDispatcher(inputWithActive);

      // Assert
      expect(mockAutoSaveContext).not.toHaveBeenCalled();
      expect(mockCalibrationPersist).not.toHaveBeenCalled();
    });

    it('should run hooks when stop_hook_active is false', async () => {
      // Arrange
      const inputWithInactive: HookInput = {
        ...defaultInput,
        stop_hook_active: false,
      };

      // Act
      await unifiedStopDispatcher(inputWithInactive);

      // Assert
      expect(mockAutoSaveContext).toHaveBeenCalled();
    });

    it('should run hooks when stop_hook_active is undefined', async () => {
      // Act
      await unifiedStopDispatcher(defaultInput);

      // Assert
      expect(mockAutoSaveContext).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // SECTION 3: Individual Hook Failures
  // ===========================================================================
  describe('Individual Hook Failures', () => {
    it('should handle individual hook failures without crashing', async () => {
      // Arrange
      mockAutoSaveContext.mockImplementation(() => {
        throw new Error('auto-save failed');
      });

      // Act
      const result = await unifiedStopDispatcher(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should log error for failed hooks', async () => {
      // Arrange
      mockAutoSaveContext.mockImplementation(() => {
        throw new Error('save context error');
      });

      // Act
      await unifiedStopDispatcher(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'stop-dispatcher',
        expect.stringContaining('auto-save-context failed')
      );
    });

    it('should continue running other hooks when one fails', async () => {
      // Arrange
      mockAutoSaveContext.mockImplementation(() => {
        throw new Error('Failure');
      });

      // Act
      await unifiedStopDispatcher(defaultInput);

      // Assert - calibration should still run
      expect(mockCalibrationPersist).toHaveBeenCalled();
    });

    it('should log error count when hooks fail', async () => {
      // Arrange
      mockAutoSaveContext.mockImplementation(() => {
        throw new Error('Error 1');
      });
      mockCalibrationPersist.mockImplementation(() => {
        throw new Error('Error 2');
      });

      // Act
      await unifiedStopDispatcher(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'stop-dispatcher',
        expect.stringMatching(/\d+\/\d+ hooks had errors/)
      );
    });
  });

  // ===========================================================================
  // SECTION 4: registeredHookNames Export
  // ===========================================================================
  describe('registeredHookNames Export', () => {
    it('should export registeredHookNames function', () => {
      // Assert
      expect(registeredHookNames).toBeDefined();
      expect(typeof registeredHookNames).toBe('function');
    });

    it('should return array of hook names', () => {
      // Act
      const names = registeredHookNames();

      // Assert
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
    });

    it('should include core stop hook names', () => {
      // Act
      const names = registeredHookNames();

      // Assert
      expect(names).toContain('auto-save-context');
      expect(names).toContain('calibration-persist');
      expect(names).toContain('session-end-tracking');
      // v7: graph-queue-sync removed (mem0 cloud removed)
      expect(names).toContain('task-completion-check');
      expect(names).toContain('full-test-suite');
    });

    it('should include skill hook names', () => {
      // Act
      const names = registeredHookNames();

      // Assert
      expect(names).toContain('coverage-check');
      expect(names).toContain('test-runner');
      expect(names).toContain('security-summary');
    });

    it('should return strings for all entries', () => {
      // Act
      const names = registeredHookNames();

      // Assert
      for (const name of names) {
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      }
    });
  });
});

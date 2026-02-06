/**
 * Tests for Calibration Persist Hook
 *
 * Tests end-of-session calibration persistence.
 * Covers: disabled calibration (still calls cleanup), enabled calibration
 * with decay/save, cleanup operations, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock common utilities
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

// Mock calibration engine
vi.mock('../../lib/calibration-engine.js', () => ({
  loadCalibrationData: vi.fn(),
  saveCalibrationData: vi.fn(),
  applyDecay: vi.fn(),
}));

// Mock orchestration state
vi.mock('../../lib/orchestration-state.js', () => ({
  loadConfig: vi.fn(),
  clearSessionState: vi.fn(),
  cleanupOldStates: vi.fn(),
}));

// Mock task integration
vi.mock('../../lib/task-integration.js', () => ({
  cleanupOldTasks: vi.fn(),
}));

import { calibrationPersist } from '../../stop/calibration-persist.js';
import { logHook, outputSilentSuccess } from '../../lib/common.js';
import { loadCalibrationData, saveCalibrationData, applyDecay } from '../../lib/calibration-engine.js';
import { loadConfig, clearSessionState, cleanupOldStates } from '../../lib/orchestration-state.js';
import { cleanupOldTasks } from '../../lib/task-integration.js';
import type { HookInput } from '../../types.js';

describe('Calibration Persist Hook', () => {
  const mockLogHook = vi.mocked(logHook);
  const mockOutputSilentSuccess = vi.mocked(outputSilentSuccess);
  const mockLoadCalibrationData = vi.mocked(loadCalibrationData);
  const mockSaveCalibrationData = vi.mocked(saveCalibrationData);
  const mockApplyDecay = vi.mocked(applyDecay);
  const mockLoadConfig = vi.mocked(loadConfig);
  const mockClearSessionState = vi.mocked(clearSessionState);
  const mockCleanupOldStates = vi.mocked(cleanupOldStates);
  const mockCleanupOldTasks = vi.mocked(cleanupOldTasks);

  const defaultInput: HookInput = {
    hook_event: 'Stop',
    tool_name: '',
    session_id: 'test-session-001',
    tool_input: {},
  };

  const defaultCalibrationData = {
    records: [
      { timestamp: new Date().toISOString(), agent: 'test-agent', success: true },
    ],
    adjustments: [
      { agent: 'test-agent', factor: 1.2 },
    ],
    stats: {
      totalDispatches: 10,
      successRate: 0.85,
      topAgents: [
        { agent: 'test-agent', successRate: 0.9 },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadConfig.mockReturnValue({ enableCalibration: true });
    mockLoadCalibrationData.mockReturnValue(defaultCalibrationData);
  });

  // ===========================================================================
  // SECTION 1: Calibration Disabled
  // ===========================================================================
  describe('Calibration Disabled', () => {
    it('should skip calibration when disabled but still call clearSessionState', () => {
      // Arrange
      mockLoadConfig.mockReturnValue({ enableCalibration: false });

      // Act
      const result = calibrationPersist(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockClearSessionState).toHaveBeenCalled();
      expect(mockCleanupOldStates).toHaveBeenCalled();
      expect(mockLoadCalibrationData).not.toHaveBeenCalled();
    });

    it('should not call applyDecay when calibration is disabled', () => {
      // Arrange
      mockLoadConfig.mockReturnValue({ enableCalibration: false });

      // Act
      calibrationPersist(defaultInput);

      // Assert
      expect(mockApplyDecay).not.toHaveBeenCalled();
      expect(mockSaveCalibrationData).not.toHaveBeenCalled();
    });

    it('should return outputSilentSuccess when disabled', () => {
      // Arrange
      mockLoadConfig.mockReturnValue({ enableCalibration: false });

      // Act
      const result = calibrationPersist(defaultInput);

      // Assert
      expect(mockOutputSilentSuccess).toHaveBeenCalled();
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });

  // ===========================================================================
  // SECTION 2: Calibration Enabled - Happy Path
  // ===========================================================================
  describe('Calibration Enabled - Happy Path', () => {
    it('should load, decay, and save calibration data', () => {
      // Act
      calibrationPersist(defaultInput);

      // Assert
      expect(mockLoadCalibrationData).toHaveBeenCalled();
      expect(mockApplyDecay).toHaveBeenCalledWith(defaultCalibrationData);
      expect(mockSaveCalibrationData).toHaveBeenCalledWith(defaultCalibrationData);
    });

    it('should log persistence start message', () => {
      // Act
      calibrationPersist(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'calibration-persist',
        'Running end-of-session calibration persistence...'
      );
    });

    it('should log calibration summary with stats', () => {
      // Act
      calibrationPersist(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'calibration-persist',
        expect.stringContaining('Calibration summary:')
      );
      expect(mockLogHook).toHaveBeenCalledWith(
        'calibration-persist',
        expect.stringContaining('10 dispatches')
      );
    });

    it('should perform session cleanup after calibration', () => {
      // Act
      calibrationPersist(defaultInput);

      // Assert
      expect(mockClearSessionState).toHaveBeenCalled();
      expect(mockCleanupOldStates).toHaveBeenCalled();
      expect(mockCleanupOldTasks).toHaveBeenCalled();
    });

    it('should log cleanup completion message', () => {
      // Act
      calibrationPersist(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'calibration-persist',
        'Cleaned up session state'
      );
    });

    it('should return outputSilentSuccess', () => {
      // Act
      const result = calibrationPersist(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });

  // ===========================================================================
  // SECTION 3: Error Handling
  // ===========================================================================
  describe('Error Handling', () => {
    it('should handle loadCalibrationData error gracefully', () => {
      // Arrange
      mockLoadCalibrationData.mockImplementation(() => {
        throw new Error('Data load failed');
      });

      // Act
      const result = calibrationPersist(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'calibration-persist',
        expect.stringContaining('Error during calibration persist:')
      );
    });

    it('should handle applyDecay error gracefully', () => {
      // Arrange
      mockApplyDecay.mockImplementation(() => {
        throw new Error('Decay failed');
      });

      // Act
      const result = calibrationPersist(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'calibration-persist',
        expect.stringContaining('Error during calibration persist:')
      );
    });

    it('should handle cleanup errors gracefully', () => {
      // Arrange
      mockClearSessionState.mockImplementation(() => {
        throw new Error('Cleanup failed');
      });

      // Act
      const result = calibrationPersist(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'calibration-persist',
        expect.stringContaining('Error during state cleanup:')
      );
    });

    it('should still attempt cleanup even when calibration fails', () => {
      // Arrange - calibration is enabled, but loading throws
      mockLoadConfig.mockReturnValue({ enableCalibration: true });
      mockLoadCalibrationData.mockImplementation(() => {
        throw new Error('Calibration error');
      });

      // Act
      const result = calibrationPersist(defaultInput);

      // Assert - hook should still complete successfully
      expect(result).toEqual({ continue: true, suppressOutput: true });
      // Calibration error should be logged
      expect(mockLogHook).toHaveBeenCalledWith(
        'calibration-persist',
        expect.stringContaining('Error during calibration persist:')
      );
      // Session cleanup should still be attempted (clearSessionState is first)
      expect(mockClearSessionState).toHaveBeenCalled();
    });
  });
});

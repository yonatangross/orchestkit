/**
 * Calibration Persist - Stop Hook for Persisting Calibration Data
 * Issue #197: Agent Orchestration Layer
 *
 * End-of-session calibration operations:
 * - Applies decay to old adjustments
 * - Cleans up expired records
 * - Saves final calibration state
 *
 * CC 2.1.7 Compliant: Silent hook that persists in background
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';
import {
  loadCalibrationData,
  saveCalibrationData,
  applyDecay,
} from '../lib/calibration-engine.js';
import { loadConfig, clearSessionState, cleanupOldStates } from '../lib/orchestration-state.js';
import { cleanupOldTasks } from '../lib/task-integration.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Maximum age for calibration records (30 days) */
const MAX_RECORD_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Clean up old calibration records
 */
function cleanupOldRecords(data: ReturnType<typeof loadCalibrationData>): void {
  const cutoff = Date.now() - MAX_RECORD_AGE_MS;

  const before = data.records.length;
  data.records = data.records.filter(r => {
    const recordTime = new Date(r.timestamp).getTime();
    return recordTime > cutoff;
  });
  const after = data.records.length;

  if (before !== after) {
    logHook('calibration-persist', `Cleaned up ${before - after} old records`);
  }
}

/**
 * Generate calibration summary for logging
 */
function generateSummary(data: ReturnType<typeof loadCalibrationData>): string {
  const stats = data.stats;
  const topAgents = stats.topAgents
    .slice(0, 3)
    .map(a => `${a.agent}(${Math.round(a.successRate * 100)}%)`)
    .join(', ');

  return `Calibration summary: ${stats.totalDispatches} dispatches, ` +
    `${Math.round(stats.successRate * 100)}% success rate, ` +
    `${data.adjustments.length} adjustments active. ` +
    `Top agents: ${topAgents || 'none'}`;
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

/**
 * Calibration persist hook
 *
 * Runs at session end to:
 * 1. Apply decay to old adjustments
 * 2. Clean up expired records
 * 3. Save final calibration state
 * 4. Clean up session-specific state
 */
export function calibrationPersist(_input: HookInput): HookResult {
  // Check if calibration is enabled
  const config = loadConfig();
  if (!config.enableCalibration) {
    // Still do cleanup even if calibration disabled
    clearSessionState();
    cleanupOldStates();
    return outputSilentSuccess();
  }

  logHook('calibration-persist', 'Running end-of-session calibration persistence...');

  try {
    // Load current calibration data
    const data = loadCalibrationData();

    // Apply decay to old adjustments
    applyDecay(data);

    // Clean up old records
    cleanupOldRecords(data);

    // Save updated calibration data
    saveCalibrationData(data);

    // Log summary
    const summary = generateSummary(data);
    logHook('calibration-persist', summary);

  } catch (err) {
    logHook('calibration-persist', `Error during calibration persist: ${err}`);
  }

  // Clean up session state
  try {
    clearSessionState();
    cleanupOldStates();
    cleanupOldTasks();
    logHook('calibration-persist', 'Cleaned up session state');
  } catch (err) {
    logHook('calibration-persist', `Error during state cleanup: ${err}`);
  }

  return outputSilentSuccess();
}

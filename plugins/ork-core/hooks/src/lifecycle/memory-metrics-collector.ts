/**
 * Memory Metrics Collector - Collect memory usage metrics at session start
 *
 * Runs in the SessionStart dispatcher to snapshot memory system state.
 * Works for all users regardless of MEM0_API_KEY configuration.
 */

import type { HookInput, HookResult } from '../types.js';
import { getProjectDir, logHook, outputSilentSuccess } from '../lib/common.js';
import { collectMemoryMetrics, appendMetricSnapshot } from '../lib/memory-metrics.js';

/**
 * Collect and persist memory metrics
 */
export function memoryMetricsCollector(input: HookInput): HookResult {
  logHook('memory-metrics-collector', 'Collecting memory metrics');

  try {
    const projectDir = input.project_dir || getProjectDir();
    const metrics = collectMemoryMetrics(projectDir);
    appendMetricSnapshot(projectDir, metrics);
  } catch (error) {
    logHook('memory-metrics-collector', `Failed to collect metrics: ${error}`, 'warn');
  }

  return outputSilentSuccess();
}

export default memoryMetricsCollector;

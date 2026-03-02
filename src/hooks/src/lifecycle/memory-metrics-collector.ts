/**
 * Memory Metrics Collector - Collect memory usage metrics at session start
 *
 * Runs in the SessionStart dispatcher to snapshot memory system state.
 * Works for all users with local memory files.
 */

import type { HookInput, HookResult } from '../types.js';
import { logHook, outputSilentSuccess } from '../lib/common.js';

/**
 * Collect and log memory metrics (snapshot only, no JSONL persistence)
 */
export function memoryMetricsCollector(_input: HookInput): HookResult {
  logHook('memory-metrics-collector', 'Memory metrics collector — no-op (orphan write removed #919)');
  return outputSilentSuccess();
}

export default memoryMetricsCollector;

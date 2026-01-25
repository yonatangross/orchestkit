/**
 * Session Metrics - Tracks tool usage statistics
 * CC 2.1.7 Compliant: Self-contained hook with stdin reading
 * Hook: PostToolUse (*)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';

const METRICS_FILE = '/tmp/claude-session-metrics.json';
const LOCKFILE = `${METRICS_FILE}.lock`;

interface SessionMetrics {
  tools: Record<string, number>;
  errors: number;
  warnings: number;
}

/**
 * Track tool usage metrics
 */
export function sessionMetrics(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  if (!toolName) {
    return outputSilentSuccess();
  }

  try {
    // Initialize metrics file if needed
    let metrics: SessionMetrics = { tools: {}, errors: 0, warnings: 0 };

    if (existsSync(METRICS_FILE)) {
      try {
        const content = readFileSync(METRICS_FILE, 'utf8').trim();
        if (content) {
          metrics = JSON.parse(content);
        }
      } catch {
        // Invalid JSON, reinitialize
        metrics = { tools: {}, errors: 0, warnings: 0 };
      }
    }

    // Ensure tools object exists
    if (!metrics.tools) {
      metrics.tools = {};
    }

    // Increment tool counter
    const currentCount = metrics.tools[toolName] || 0;
    metrics.tools[toolName] = currentCount + 1;

    // Write updated metrics
    writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  } catch (error) {
    logHook('session-metrics', `Error updating metrics: ${error}`);
  }

  return outputSilentSuccess();
}

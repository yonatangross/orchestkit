/**
 * Session Metrics Summary - Shows summary at session end
 * Hook: SessionEnd
 */

import { existsSync, readFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, outputSilentSuccess } from '../lib/common.js';

interface SessionMetrics {
  tools?: Record<string, number>;
  errors?: number;
}

/**
 * Session metrics summary hook
 */
export function sessionMetricsSummary(input: HookInput): HookResult {
  logHook('session-metrics-summary', 'Session ending - generating summary');

  const metricsFile = '/tmp/claude-session-metrics.json';

  if (!existsSync(metricsFile)) {
    logHook('session-metrics-summary', 'No metrics file found');
    return outputSilentSuccess();
  }

  try {
    const metrics: SessionMetrics = JSON.parse(readFileSync(metricsFile, 'utf-8'));
    const tools = metrics.tools || {};
    const errors = metrics.errors || 0;

    // Calculate total tool calls
    const totalTools = Object.values(tools).reduce((sum, count) => sum + count, 0);

    // Get top 3 tools
    const topTools = Object.entries(tools)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([tool, count]) => `${tool}: ${count}`)
      .join(', ');

    logHook('session-metrics-summary', `Session stats: ${totalTools} tool calls, ${errors} errors`);

    if (totalTools > 0) {
      // Note: We return silently since SessionEnd hooks typically don't need system messages
      // The logging is sufficient for audit purposes
      logHook('session-metrics-summary', `Top tools: ${topTools}`);
    }
  } catch (err) {
    logHook('session-metrics-summary', `Failed to read metrics: ${err}`);
  }

  return outputSilentSuccess();
}

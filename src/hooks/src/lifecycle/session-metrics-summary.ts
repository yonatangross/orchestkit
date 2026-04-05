/**
 * Session Metrics Summary - Shows summary at session end
 * Hook: SessionEnd
 */

import { existsSync, readFileSync } from 'node:fs';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess } from '../lib/common.js';
import { getMetricsFile } from '../lib/paths.js';
import { NOOP_CTX } from '../lib/context.js';

interface SessionMetrics {
  tools?: Record<string, number>;
  errors?: number;
}

/**
 * Session metrics summary hook
 */
export function sessionMetricsSummary(_input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  ctx.log('session-metrics-summary', 'Session ending - generating summary');

  const metricsFile = getMetricsFile();

  if (!existsSync(metricsFile)) {
    ctx.log('session-metrics-summary', 'No metrics file found');
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

    ctx.log('session-metrics-summary', `Session stats: ${totalTools} tool calls, ${errors} errors`);

    if (totalTools > 0) {
      // Note: We return silently since SessionEnd hooks typically don't need system messages
      // The logging is sufficient for audit purposes
      ctx.log('session-metrics-summary', `Top tools: ${topTools}`);
    }
  } catch (err) {
    ctx.log('session-metrics-summary', `Failed to read metrics: ${err}`);
  }

  return outputSilentSuccess();
}

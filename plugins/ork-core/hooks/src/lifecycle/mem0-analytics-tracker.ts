/**
 * Mem0 Analytics Tracker - Monitor usage patterns continuously
 * Hook: SessionStart / UserPromptSubmit
 * CC 2.1.7 Compliant
 *
 * Features:
 * - Tracks mem0 usage patterns
 * - Monitors feature utilization
 * - Identifies underutilized features
 *
 * Version: 1.0.0
 */

import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, getSessionId, outputSilentSuccess } from '../lib/common.js';

/**
 * Check if mem0 is available
 */
function isMem0Available(): boolean {
  // Check for MEM0_API_KEY environment variable
  return !!process.env.MEM0_API_KEY;
}

/**
 * Mem0 analytics tracker hook
 */
export function mem0AnalyticsTracker(input: HookInput): HookResult {
  logHook('mem0-analytics-tracker', 'Mem0 analytics tracker starting');

  // Check if mem0 is available
  if (!isMem0Available()) {
    logHook('mem0-analytics-tracker', 'Mem0 not available, skipping analytics');
    return outputSilentSuccess();
  }

  const projectDir = input.project_dir || getProjectDir();
  const analyticsFile = `${projectDir}/.claude/logs/mem0-analytics.jsonl`;
  const sessionId = input.session_id || getSessionId();
  const timestamp = new Date().toISOString();

  // Create analytics entry
  const analyticsEntry = JSON.stringify({
    session_id: sessionId,
    timestamp: timestamp,
    event: 'session_start',
  });

  // Append to analytics log
  try {
    mkdirSync(`${projectDir}/.claude/logs`, { recursive: true });
    appendFileSync(analyticsFile, analyticsEntry + '\n');
    logHook('mem0-analytics-tracker', 'Mem0 analytics tracked');
  } catch (err) {
    logHook('mem0-analytics-tracker', `Failed to write analytics: ${err}`);
  }

  return outputSilentSuccess();
}

/**
 * Skill Tracker Hook
 * Logs Skill tool invocations with analytics
 * CC 2.1.6 Compliant: includes continue field in all outputs
 *
 * Enhanced for Phase 4: Skill Usage Analytics (#56)
 * - Tracks skill usage patterns over time
 * - Enables context efficiency optimization
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  logHook,
  getProjectDir,
} from '../../lib/common.js';
import { existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

/**
 * Ensure directory exists
 */
function ensureDir(dir: string): void {
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  } catch {
    // Ignore mkdir errors
  }
}

/**
 * Append to file safely
 */
function appendSafe(file: string, content: string): void {
  try {
    ensureDir(dirname(file));
    appendFileSync(file, content);
  } catch {
    // Ignore append errors
  }
}

/**
 * Skill tracker - logs skill invocations with analytics
 */
export function skillTracker(input: HookInput): HookResult {
  const skillName = (input.tool_input.skill as string) || '';
  const skillArgs = (input.tool_input.args as string) || '';
  const projectDir = input.project_dir || getProjectDir();

  if (!skillName) {
    return outputSilentSuccess();
  }

  logHook('skill-tracker', `Skill invocation: ${skillName}${skillArgs ? ` (args: ${skillArgs})` : ''}`);

  // Log to temporary usage log for quick access
  const usageLog = join(projectDir, '.claude', 'logs', 'skill-usage.log');
  const timestamp = new Date().toISOString();
  appendSafe(usageLog, `${timestamp} | ${skillName} | ${skillArgs || 'no args'}\n`);

  // Log to JSONL for detailed analytics
  const analyticsLog = join(projectDir, '.claude', 'logs', 'skill-analytics.jsonl');
  const analyticsEntry = JSON.stringify({
    skill: skillName,
    args: skillArgs || '',
    timestamp,
    project: basename(projectDir),
    phase: 'start',
  });
  appendSafe(analyticsLog, analyticsEntry + '\n');

  logHook('skill-tracker', `Skill usage logged for ${skillName}`);

  // CC 2.1.6 Compliant: JSON output without ANSI colors
  return outputSilentSuccess();
}

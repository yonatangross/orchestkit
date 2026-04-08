/**
 * Skill Tracker Hook
 * Logs Skill tool invocations with analytics
 * CC 2.1.6 Compliant: includes continue field in all outputs
 *
 * Enhanced for Phase 4: Skill Usage Analytics (#56)
 * - Tracks skill usage patterns over time
 * - Enables context efficiency optimization
 */

import type { HookInput, HookResult , HookContext} from '../../types.js';
import {
  outputSilentSuccess,
} from '../../lib/common.js';
import { existsSync, mkdirSync } from 'node:fs';
import { bufferWrite } from '../../lib/analytics-buffer.js';
import { join, dirname } from 'node:path';
import { NOOP_CTX } from '../../lib/context.js';

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
    bufferWrite(file, content);
  } catch {
    // Ignore append errors
  }
}

/**
 * Skill tracker - logs skill invocations with analytics
 */
export function skillTracker(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const skillName = (input.tool_input.skill as string) || '';
  const skillArgs = (input.tool_input.args as string) || '';
  const projectDir = input.project_dir || (ctx.projectDir);

  if (!skillName) {
    return outputSilentSuccess();
  }

  ctx.log('skill-tracker', `Skill invocation: ${skillName}${skillArgs ? ` (args: ${skillArgs})` : ''}`);

  // Log to temporary usage log for quick access
  const usageLog = join(projectDir, '.claude', 'logs', 'skill-usage.log');
  const timestamp = new Date().toISOString();
  appendSafe(usageLog, `${timestamp} | ${skillName} | ${skillArgs || 'no args'}\n`);

  ctx.log('skill-tracker', `Skill usage logged for ${skillName}`);

  // CC 2.1.6 Compliant: JSON output without ANSI colors
  return outputSilentSuccess();
}

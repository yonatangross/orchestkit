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
import { rotateLogFile } from '../../lib/log.js';
import { join, dirname } from 'node:path';
import { NOOP_CTX } from '../../lib/context.js';
import { recordInvocation } from '../../lib/session-registry.js';
import { recordSkillChannel } from '../../lib/skill-channels.js';

// Re-enabled 2026-07-09 after ~4 months dead (#959 dropped its dispatch) — cap
// growth up front rather than let it silently reach the size that flagged the
// pre-#959 file (170KB+ in a comparatively short live window).
const SKILL_USAGE_LOG_MAX_SIZE = 200 * 1024; // 200KB, matches lib/log.ts's LOG_ROTATION_MAX_SIZE

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
 * Append to file safely, rotating first if the file has grown past budget.
 */
function appendSafe(file: string, content: string): void {
  try {
    ensureDir(dirname(file));
    rotateLogFile(file, SKILL_USAGE_LOG_MAX_SIZE);
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

  // #2010: also record to the coordination DB (sessions.db) for queryable
  // usage analytics. Guarded + best-effort — the plaintext log above is the
  // fallback, and recordInvocation never throws.
  recordInvocation(input.session_id, skillName);

  // Activation-channel telemetry: this fires on every main-session Skill call
  // (user-direct or assistant-chained — indistinguishable here, so tagged
  // "main"). The subagent channel is captured separately at SubagentStop.
  recordSkillChannel(projectDir, { skill: skillName, channel: 'main', sessionId: input.session_id });

  ctx.log('skill-tracker', `Skill usage logged for ${skillName}`);

  // CC 2.1.6 Compliant: JSON output without ANSI colors
  return outputSilentSuccess();
}

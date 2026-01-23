/**
 * Error Tracker - Tracks and logs tool errors
 * CC 2.1.7 Compliant: Self-contained hook with stdin reading and self-guard
 * Hook: PostToolUse (Bash)
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getProjectDir, getField, logHook } from '../lib/common.js';

// Trivial commands that don't need tracking
const TRIVIAL_COMMANDS = /^(echo |ls |ls$|pwd|cat |head |tail |wc |date|whoami)/;

/**
 * Track and log tool errors
 */
export function errorTracker(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Self-guard: Only run for non-trivial bash commands
  if (toolName === 'Bash') {
    const command = getField<string>(input, 'tool_input.command') || '';
    if (TRIVIAL_COMMANDS.test(command)) {
      return outputSilentSuccess();
    }
  }

  const toolError = String(input.tool_error || '');
  const exitCode = input.exit_code;

  // Check if there was an error
  if (!toolError && (exitCode === 0 || exitCode === undefined || exitCode === null)) {
    return outputSilentSuccess();
  }

  logHook('error-tracker', `ERROR: ${toolName} failed (exit: ${exitCode})`);

  // Track error count
  const metricsFile = '/tmp/claude-session-metrics.json';
  try {
    let metrics = { tools: {}, errors: 0, warnings: 0 };
    if (existsSync(metricsFile)) {
      const content = readFileSync(metricsFile, 'utf8').trim();
      if (content) {
        metrics = JSON.parse(content);
      }
    }
    metrics.errors = (metrics.errors || 0) + 1;
    writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
  } catch {
    // Ignore metrics update errors
  }

  // Log error details
  const projectDir = getProjectDir();
  const errorLog = `${projectDir}/.claude/logs/errors.log`;

  try {
    mkdirSync(`${projectDir}/.claude/logs`, { recursive: true });
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const errorPreview = toolError.substring(0, 200);
    appendFileSync(errorLog, `[${timestamp}] ${toolName} | exit: ${exitCode} | ${errorPreview}\n`);
  } catch {
    // Ignore log errors
  }

  return outputSilentSuccess();
}

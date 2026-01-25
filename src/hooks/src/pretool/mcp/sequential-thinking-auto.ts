/**
 * Sequential Thinking Auto-Tracker Hook
 * Tracks sequential thinking usage for complex reasoning tasks
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  logHook,
  logPermissionFeedback,
  getLogDir,
} from '../../lib/common.js';
import { existsSync, appendFileSync, statSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const MAX_LOG_SIZE = 102400; // 100KB

/**
 * Get thinking log path
 */
function getThinkingLog(): string {
  const logDir = getLogDir();
  return join(logDir, 'sequential-thinking.log');
}

/**
 * Rotate log file if needed
 */
function rotateLogIfNeeded(logFile: string): void {
  try {
    if (existsSync(logFile)) {
      const stats = statSync(logFile);
      if (stats.size > MAX_LOG_SIZE) {
        renameSync(logFile, `${logFile}.old`);
      }
    }
  } catch {
    // Ignore rotation errors
  }
}

/**
 * Sequential thinking tracker - tracks reasoning chain progress
 */
export function sequentialThinkingAuto(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Only process sequential-thinking MCP calls
  if (!toolName.startsWith('mcp__sequential-thinking__')) {
    return outputSilentSuccess();
  }

  // Extract thinking details
  const thought = (input.tool_input.thought as string) || '';
  const thoughtNumber = (input.tool_input.thoughtNumber as number) || 1;
  const totalThoughts = (input.tool_input.totalThoughts as number) || 1;
  const nextNeeded = (input.tool_input.nextThoughtNeeded as boolean) || false;
  const isRevision = (input.tool_input.isRevision as boolean) || false;

  // Get log file path
  const logDir = getLogDir();
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore mkdir errors
  }

  const thinkingLog = getThinkingLog();
  rotateLogIfNeeded(thinkingLog);

  // Log the thinking step
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | step=${thoughtNumber}/${totalThoughts} | revision=${isRevision} | next_needed=${nextNeeded} | thought_length=${thought.length}\n`;

  try {
    appendFileSync(thinkingLog, logEntry);
  } catch {
    // Ignore log errors
  }

  // Track reasoning chain progress
  if (thoughtNumber === 1) {
    logPermissionFeedback('allow', `Starting reasoning chain (${totalThoughts} estimated thoughts)`, input);
    logHook('sequential-thinking-auto', `Starting chain: ${totalThoughts} thoughts`);
  } else if (isRevision) {
    logPermissionFeedback('allow', `Revision at step ${thoughtNumber}`, input);
    logHook('sequential-thinking-auto', `Revision at step ${thoughtNumber}`);
  } else if (!nextNeeded) {
    logPermissionFeedback('allow', `Completed reasoning chain at step ${thoughtNumber}`, input);
    logHook('sequential-thinking-auto', `Completed at step ${thoughtNumber}`);
  } else {
    logPermissionFeedback('allow', `Reasoning step ${thoughtNumber}/${totalThoughts}`, input);
    logHook('sequential-thinking-auto', `Step ${thoughtNumber}/${totalThoughts}`);
  }

  return outputSilentSuccess();
}

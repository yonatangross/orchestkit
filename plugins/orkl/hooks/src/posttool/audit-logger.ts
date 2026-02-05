/**
 * Audit Logger - Logs all tool executions for audit trail
 * Hook: PostToolUse (*)
 * CC 2.1.7 Compliant
 */

import { appendFileSync, existsSync, mkdirSync, statSync, renameSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getLogDir, getField } from '../lib/common.js';

// Track read count across invocations (per-session in memory)
const readCountFile = '/tmp/claude-read-count';

/**
 * Log tool execution to audit file
 */
export function auditLogger(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Skip logging for high-frequency read operations to reduce noise
  if (['Read', 'Glob', 'Grep'].includes(toolName)) {
    try {
      const { readFileSync, writeFileSync } = require('node:fs');
      let readCount = 0;
      try {
        readCount = parseInt(readFileSync(readCountFile, 'utf8').trim(), 10) || 0;
      } catch {
        // File doesn't exist yet
      }
      readCount++;
      writeFileSync(readCountFile, String(readCount));

      if (readCount % 10 !== 0) {
        return outputSilentSuccess();
      }
    } catch {
      // Ignore count tracking errors
    }
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || '.';
  const auditLog = `${projectDir}/.claude/logs/audit.log`;

  try {
    // Ensure log directory exists
    const logDir = `${projectDir}/.claude/logs`;
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    // Rotate if needed (200KB limit)
    rotateLogFile(auditLog, 200 * 1024);

    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

    // Get relevant details based on tool type
    let details = '';
    switch (toolName) {
      case 'Bash': {
        const cmd = getField<string>(input, 'tool_input.command') || '';
        details = cmd.substring(0, 100);
        break;
      }
      case 'Write':
      case 'Edit': {
        details = getField<string>(input, 'tool_input.file_path') || '';
        break;
      }
      case 'Task': {
        details = getField<string>(input, 'tool_input.subagent_type') || '';
        break;
      }
    }

    const logEntry = details
      ? `[${timestamp}] ${toolName} | ${details}\n`
      : `[${timestamp}] ${toolName}\n`;

    appendFileSync(auditLog, logEntry);
  } catch {
    // Ignore logging errors - don't block hook execution
  }

  return outputSilentSuccess();
}

/**
 * Rotate log file if it exceeds size limit
 */
function rotateLogFile(logFile: string, maxBytes: number): void {
  if (!existsSync(logFile)) return;

  try {
    const stats = statSync(logFile);
    if (stats.size > maxBytes) {
      const rotated = `${logFile}.old.${Date.now()}`;
      renameSync(logFile, rotated);
    }
  } catch {
    // Ignore rotation errors
  }
}

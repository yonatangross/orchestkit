/**
 * Error Collector - Captures all tool errors for pattern analysis
 * Hook: PostToolUse (*)
 *
 * Purpose: Build a database of errors to detect bad practices
 * Analysis: Run .claude/scripts/analyze_errors.py nightly (cron)
 * Cost: $0 - No LLM, just logging
 */

import { existsSync, appendFileSync, readFileSync, writeFileSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getProjectDir, getSessionId, getField, logHook } from '../lib/common.js';

// Error pattern detection regex
const ERROR_PATTERNS = /error:|Error:|ERROR|FATAL|exception|failed|denied|not found|does not exist|connection refused|timeout|ENOENT|EACCES|EPERM/i;

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

/**
 * Collect and log errors from tool execution
 */
export function errorCollector(input: HookInput): HookResult {
  const toolName = input.tool_name || '';
  const sessionId = getSessionId();
  const timestamp = new Date().toISOString();

  // Get tool execution details
  const toolOutput = String(getField<unknown>(input, 'tool_output') || input.tool_output || '');
  const exitCode = input.exit_code ?? 0;
  const toolError = String(input.tool_error || getField<string>(input, 'error') || '');

  // Detect errors by multiple signals
  let isError = false;
  let errorType = '';
  let errorMessage = '';

  // Signal 1: Explicit exit code
  if (exitCode !== 0 && exitCode !== undefined) {
    isError = true;
    errorType = 'exit_code';
    errorMessage = `Exit code: ${exitCode}`;
  }

  // Signal 2: Error field present
  if (toolError) {
    isError = true;
    errorType = 'tool_error';
    errorMessage = toolError;
  }

  // Signal 3: Error patterns in output
  if (ERROR_PATTERNS.test(toolOutput)) {
    isError = true;
    errorType = errorType || 'output_pattern';
    // Extract the error line
    const errorLines = toolOutput.split('\n').filter(line => ERROR_PATTERNS.test(line));
    errorMessage = errorMessage || errorLines[0] || '';
  }

  // Only log if there was an error
  if (isError) {
    const projectDir = getProjectDir();
    const errorLog = `${projectDir}/.claude/logs/errors.jsonl`;

    try {
      mkdirSync(`${projectDir}/.claude/logs`, { recursive: true });

      // Rotate if > 1MB
      rotateLogFile(errorLog, 1000 * 1024);

      // Get tool input for context
      const toolInput = input.tool_input || {};
      const inputHash = createHash('md5').update(JSON.stringify(toolInput)).digest('hex');

      // Truncate long values for storage efficiency
      const errorMessageTruncated = errorMessage.substring(0, 500);
      const toolOutputTruncated = toolOutput.substring(0, 1000);

      // Write structured error record (JSONL format)
      const errorRecord = {
        timestamp,
        tool: toolName,
        session_id: sessionId,
        error_type: errorType,
        error_message: errorMessageTruncated,
        input_hash: inputHash,
        tool_input: toolInput,
        output_preview: toolOutputTruncated,
      };

      appendFileSync(errorLog, JSON.stringify(errorRecord) + '\n');

      // Also track in session metrics for quick access
      const metricsFile = '/tmp/claude-session-errors.json';
      try {
        let metrics = { error_count: 0, last_error_tool: '', last_error_time: '' };
        if (existsSync(metricsFile)) {
          metrics = JSON.parse(readFileSync(metricsFile, 'utf8'));
        }
        metrics.error_count = (metrics.error_count || 0) + 1;
        metrics.last_error_tool = toolName;
        metrics.last_error_time = timestamp;
        writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
      } catch {
        // Ignore metrics update errors
      }

      logHook('error-collector', `ERROR captured: ${toolName} - ${errorType} - ${errorMessage.substring(0, 100)}`);
    } catch {
      // Fallback logging
      logHook('error-collector', `ERROR (fallback): ${toolName} - ${errorType}`);
    }
  }

  return outputSilentSuccess();
}

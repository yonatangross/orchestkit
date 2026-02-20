/**
 * Error Logger — Detects and logs errors from tool outputs
 *
 * Hook: PostToolUse (Bash|Write|Edit|Task) — via unified-dispatcher
 *
 * Purpose:
 * 1. Detect errors from any tool (exit code, tool_error, output patterns)
 * 2. Log structured errors to JSONL for analysis
 *
 * Stripped from unified-error-handler v2.0.0:
 * - Removed solution-suggestion machinery (matchErrorPattern, shouldSuggest,
 *   getSkillDescription, buildSuggestionMessage, dedup system ~250 LOC)
 * - Now always returns outputSilentSuccess() (no additionalContext)
 *
 * Version: 3.0.0 — Simplified to error-logger
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { bufferWrite } from '../lib/analytics-buffer.js';
import { createHash } from 'node:crypto';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getProjectDir, getSessionId, getField, logHook } from '../lib/common.js';
import { getSessionErrorsFile } from '../lib/paths.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const ERROR_PATTERN = /error:|Error:|ERROR|FATAL|exception|failed|denied|not found|does not exist|connection refused|timeout|ENOENT|EACCES|EPERM/i;
const TRIVIAL_COMMANDS = /^(echo |ls |ls$|pwd|cat |head |tail |wc |date|whoami)/;
const MAX_LOG_BYTES = 1000 * 1024; // 1MB

// =============================================================================
// TYPES
// =============================================================================

interface ErrorInfo {
  isError: boolean;
  errorType: string;
  errorMessage: string;
  errorText: string;
}

// =============================================================================
// ERROR DETECTION
// =============================================================================

function detectError(input: HookInput): ErrorInfo {
  const toolOutput = String(getField<unknown>(input, 'tool_output') || input.tool_output || '');
  const toolError = String(input.tool_error || getField<string>(input, 'error') || '');
  const exitCode = input.exit_code ?? 0;

  let isError = false;
  let errorType = '';
  let errorMessage = '';

  // Signal 1: Explicit non-zero exit code
  if (exitCode !== 0 && exitCode !== undefined) {
    isError = true;
    errorType = 'exit_code';
    errorMessage = `Exit code: ${exitCode}`;
  }

  // Signal 2: Error field present
  if (toolError) {
    isError = true;
    errorType = errorType || 'tool_error';
    errorMessage = errorMessage || toolError;
  }

  // Signal 3: Error patterns in output
  if (ERROR_PATTERN.test(toolOutput)) {
    isError = true;
    errorType = errorType || 'output_pattern';
    const errorLines = toolOutput.split('\n').filter(line => ERROR_PATTERN.test(line));
    errorMessage = errorMessage || errorLines[0] || '';
  }

  return {
    isError,
    errorType,
    errorMessage,
    errorText: toolError || toolOutput,
  };
}

// =============================================================================
// ERROR LOGGING
// =============================================================================

function rotateLogFile(logFile: string): void {
  if (!existsSync(logFile)) return;
  try {
    const stats = statSync(logFile);
    if (stats.size > MAX_LOG_BYTES) {
      renameSync(logFile, `${logFile}.old.${Date.now()}`);
    }
  } catch {
    // Ignore rotation errors
  }
}

function logError(input: HookInput, errorInfo: ErrorInfo): void {
  const projectDir = getProjectDir();
  const errorLog = `${projectDir}/.claude/logs/errors.jsonl`;
  const metricsFile = getSessionErrorsFile();

  try {
    mkdirSync(`${projectDir}/.claude/logs`, { recursive: true });
    rotateLogFile(errorLog);

    const inputHash = createHash('md5').update(JSON.stringify(input.tool_input || {})).digest('hex');

    const errorRecord = {
      timestamp: new Date().toISOString(),
      tool: input.tool_name,
      session_id: getSessionId(),
      error_type: errorInfo.errorType,
      error_message: errorInfo.errorMessage.substring(0, 500),
      input_hash: inputHash,
      tool_input: input.tool_input,
      output_preview: errorInfo.errorText.substring(0, 1000),
    };

    bufferWrite(errorLog, `${JSON.stringify(errorRecord)}\n`);

    // Update session metrics
    try {
      let metrics = { error_count: 0, last_error_tool: '', last_error_time: '' };
      if (existsSync(metricsFile)) {
        metrics = JSON.parse(readFileSync(metricsFile, 'utf8'));
      }
      metrics.error_count = (metrics.error_count || 0) + 1;
      metrics.last_error_tool = input.tool_name || '';
      metrics.last_error_time = new Date().toISOString();
      writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
    } catch {
      // Ignore metrics errors
    }

    logHook('error-logger', `ERROR: ${input.tool_name} - ${errorInfo.errorType}`);
  } catch {
    logHook('error-logger', `ERROR (fallback): ${input.tool_name}`);
  }
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export function unifiedErrorHandler(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Self-guard: Skip trivial bash commands
  if (toolName === 'Bash') {
    const command = getField<string>(input, 'tool_input.command') || '';
    if (TRIVIAL_COMMANDS.test(command)) {
      return outputSilentSuccess();
    }
  }

  // Detect if this was an error
  const errorInfo = detectError(input);

  if (!errorInfo.isError) {
    return outputSilentSuccess();
  }

  // Log the error (always)
  logError(input, errorInfo);

  return outputSilentSuccess();
}

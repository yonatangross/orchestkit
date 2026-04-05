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

import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess, getField } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const ERROR_PATTERN = /error:|Error:|ERROR|FATAL|exception|failed|denied|not found|does not exist|connection refused|timeout|ENOENT|EACCES|EPERM/i;
const TRIVIAL_COMMANDS = /^(echo |ls |ls$|pwd|cat |head |tail |wc |date|whoami)/;

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
// MAIN HOOK
// =============================================================================

export function unifiedErrorHandler(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
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

  ctx.log('error-logger', `ERROR: ${input.tool_name} - ${errorInfo.errorType}`);
  return outputSilentSuccess();
}

/**
 * PostToolUseFailure Handler
 * CC 2.1.25: Error-path hook providing solution suggestions when tools fail
 *
 * Analyzes tool failures and injects helpful context via additionalContext
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputWithContext, logHook } from '../lib/common.js';

// Common failure patterns and their solutions
const FAILURE_PATTERNS: Array<{ pattern: RegExp; suggestion: string }> = [
  {
    pattern: /ENOENT|no such file|not found/i,
    suggestion: 'File not found. Check the path exists. Use Glob to search for the correct filename.',
  },
  {
    pattern: /EACCES|permission denied/i,
    suggestion: 'Permission denied. The file may be read-only or owned by another user.',
  },
  {
    pattern: /ECONNREFUSED|ETIMEDOUT|network/i,
    suggestion: 'Network error. Check if the service is running and accessible.',
  },
  {
    pattern: /syntax error|SyntaxError|parse error/i,
    suggestion: 'Syntax error in the code. Review the file for missing brackets, quotes, or semicolons.',
  },
  {
    pattern: /command not found|not recognized/i,
    suggestion: 'Command not found. Check if the tool is installed and in PATH.',
  },
  {
    pattern: /timeout|timed out/i,
    suggestion: 'Command timed out. Consider increasing the timeout or breaking the command into smaller steps.',
  },
  {
    pattern: /ENOMEM|out of memory|heap/i,
    suggestion: 'Out of memory. Try processing smaller chunks or increasing available memory.',
  },
  {
    pattern: /merge conflict|CONFLICT/i,
    suggestion: 'Merge conflict detected. Resolve conflicts manually before continuing.',
  },
  {
    pattern: /lock|locked|ELOCK/i,
    suggestion: 'Resource is locked. Wait for the lock to be released or check for stale locks.',
  },
  {
    pattern: /type error|TypeError|cannot read prop/i,
    suggestion: 'Type error. Check for null/undefined values and ensure correct types are passed.',
  },
];

export function failureHandler(input: HookInput): HookResult {
  // Get error information from the input
  const errorMessage = input.tool_error || '';
  const toolName = input.tool_name || 'unknown';
  const exitCode = input.exit_code;

  // Skip if no error info
  if (!errorMessage && exitCode === 0) {
    return outputSilentSuccess();
  }

  logHook('failure-handler', `Tool ${toolName} failed: ${errorMessage.slice(0, 200)}`);

  // Match against known failure patterns
  const suggestions: string[] = [];
  for (const { pattern, suggestion } of FAILURE_PATTERNS) {
    if (pattern.test(errorMessage)) {
      suggestions.push(suggestion);
    }
  }

  // If no specific pattern matched, provide generic guidance
  if (suggestions.length === 0) {
    // Don't inject noise for every failure
    return outputSilentSuccess();
  }

  const context = [
    `[OrchestKit] Tool failure analysis for ${toolName}:`,
    ...suggestions.map(s => `- ${s}`),
  ].join('\n');

  return outputWithContext(context);
}

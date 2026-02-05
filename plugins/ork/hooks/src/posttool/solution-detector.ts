/**
 * Solution Detector Hook - Detect when tool outputs resolve open problems
 *
 * Part of Intelligent Decision Capture System
 * Hook: PostToolUse
 *
 * Purpose:
 * - Monitor tool outputs for solution indicators
 * - Pair successful outputs with open problems
 * - Store problem-solution pairs for learning
 *
 * Triggers:
 * - Test passes after test failures
 * - Build succeeds after build errors
 * - "fixed", "resolved", "now works" in output
 *
 * CC 2.1.16 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import {
  outputSilentSuccess,
  getField,
  getSessionId,
  logHook,
} from '../lib/common.js';
import {
  pairSolutionWithProblems,
  hasSolutionIndicators,
} from '../lib/problem-tracker.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const HOOK_NAME = 'solution-detector';
const MIN_OUTPUT_LENGTH = 20; // Skip very short outputs

// Tools that commonly indicate solutions
const SOLUTION_TOOLS = ['Bash', 'Write', 'Edit', 'Task'];

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Detect solutions in tool outputs and pair with open problems
 *
 * This hook runs on PostToolUse and checks if the output indicates
 * that a previously stated problem has been resolved.
 */
export function solutionDetector(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Only process relevant tools
  if (!SOLUTION_TOOLS.includes(toolName)) {
    return outputSilentSuccess();
  }

  // Get tool output
  const toolOutput = extractToolOutput(input);
  if (!toolOutput || toolOutput.length < MIN_OUTPUT_LENGTH) {
    return outputSilentSuccess();
  }

  // Quick check for solution indicators before doing heavier work
  if (!hasSolutionIndicators(toolOutput)) {
    return outputSilentSuccess();
  }

  // Get context
  const sessionId = input.session_id || getSessionId();
  const exitCode = input.exit_code;
  const file = getField<string>(input, 'tool_input.file_path');

  // Try to pair with open problems
  try {
    const paired = pairSolutionWithProblems(
      toolOutput,
      toolName,
      file,
      exitCode,
      sessionId
    );

    if (paired > 0) {
      logHook(HOOK_NAME, `Paired ${paired} problem(s) with solution from ${toolName}`, 'info');
    }
  } catch (err) {
    logHook(HOOK_NAME, `Error pairing solutions: ${err}`, 'warn');
  }

  // Always silent success - this is a background capture hook
  return outputSilentSuccess();
}

/**
 * Extract tool output from various input formats
 */
function extractToolOutput(input: HookInput): string {
  // Try different field names used by CC
  const toolResult = input.tool_result;
  if (typeof toolResult === 'string') {
    return toolResult;
  }
  if (toolResult && typeof toolResult === 'object') {
    const content = (toolResult as { content?: string }).content;
    if (typeof content === 'string') {
      return content;
    }
  }

  // Try tool_output field
  const toolOutput = input.tool_output;
  if (typeof toolOutput === 'string') {
    return toolOutput;
  }
  if (toolOutput && typeof toolOutput === 'object') {
    const content = (toolOutput as { content?: string }).content;
    if (typeof content === 'string') {
      return content;
    }
  }

  // Try output field (SubagentStop)
  const output = input.output;
  if (typeof output === 'string') {
    return output;
  }

  return '';
}

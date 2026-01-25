/**
 * Block Writes - Blocks Write/Edit operations for read-only agents
 *
 * Used by: debug-investigator, code-quality-reviewer, ux-researcher,
 *          market-intelligence, system-design-reviewer
 *
 * Purpose: Enforce read-only boundaries for investigation/review agents
 *
 * CC 2.1.7 compliant output format
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputDeny } from '../lib/common.js';

/**
 * Block writes hook
 */
export function blockWrites(input: HookInput): HookResult {
  const toolName = input.tool_name;
  const agentId = process.env.CLAUDE_AGENT_ID || 'unknown';

  // These tools are write operations that should be blocked
  const writeTools = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];

  if (writeTools.includes(toolName)) {
    // Block write operations
    return outputDeny(
      `BLOCKED: Agent '${agentId}' is read-only. Write/Edit operations are not permitted. This agent investigates and reports - it does not modify code.`
    );
  }

  // Allow all other operations
  return outputSilentSuccess();
}

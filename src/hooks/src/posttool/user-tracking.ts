/**
 * User Tracking Hook
 * Issue #245: Multi-User Intelligent Decision Capture System
 *
 * Tracks tool usage, skill invocations, and agent spawns to build user profiles.
 * This data is aggregated into user profiles for personalized experiences.
 *
 * Tracked events:
 * - All tool usage (for workflow pattern detection)
 * - Skill invocations (when tool_name === 'Skill')
 * - Agent spawns (when tool_name === 'Task')
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';
import {
  trackToolUsed,
  trackSkillInvoked,
  trackAgentSpawned,
} from '../lib/session-tracker.js';
import { getToolCategory } from '../lib/tool-categories.js';

/**
 * Extract skill name from Skill tool input
 */
function extractSkillName(input: HookInput): string | undefined {
  const toolInput = input.tool_input;
  if (!toolInput || typeof toolInput !== 'object') return undefined;

  // Skill tool uses 'skill' parameter
  const skillParam = (toolInput as Record<string, unknown>).skill;
  if (typeof skillParam === 'string') return skillParam;

  return undefined;
}

/**
 * Extract agent type from Task tool input
 */
function extractAgentType(input: HookInput): string | undefined {
  const toolInput = input.tool_input;
  if (!toolInput || typeof toolInput !== 'object') return undefined;

  // Task tool uses 'subagent_type' parameter
  const agentType = (toolInput as Record<string, unknown>).subagent_type;
  if (typeof agentType === 'string') return agentType;

  return undefined;
}

/**
 * Extract prompt summary from Task tool input
 */
function extractPromptSummary(input: HookInput): string | undefined {
  const toolInput = input.tool_input;
  if (!toolInput || typeof toolInput !== 'object') return undefined;

  const prompt = (toolInput as Record<string, unknown>).prompt;
  if (typeof prompt === 'string') {
    // Truncate to first 200 chars
    return prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt;
  }

  return undefined;
}

/**
 * Determine if tool call was successful
 * For PostToolUse, we check tool_error
 */
function wasSuccessful(input: HookInput): boolean {
  // If is_error is explicitly set, use that
  if (input.tool_error) return false;

  // Otherwise assume success (PostToolUse runs after successful tool calls)
  return true;
}

/**
 * User tracking hook - runs for all tools
 */
export function userTracking(input: HookInput): HookResult {
  try {
    const toolName = input.tool_name || 'unknown';
    const success = wasSuccessful(input);
    const category = getToolCategory(toolName);

    // Track all tool usage with category for preference learning
    trackToolUsed(toolName, success, undefined, category);

    // Track skill invocations specifically
    if (toolName === 'Skill') {
      const skillName = extractSkillName(input);
      if (skillName) {
        trackSkillInvoked(skillName, undefined, success);
        logHook('user-tracking', `Tracked skill: ${skillName}`, 'debug');
      }
    }

    // Track agent spawns specifically
    if (toolName === 'Task') {
      const agentType = extractAgentType(input);
      if (agentType) {
        const promptSummary = extractPromptSummary(input);
        trackAgentSpawned(agentType, promptSummary, success);
        logHook('user-tracking', `Tracked agent: ${agentType}`, 'debug');
      }
    }

    return outputSilentSuccess();
  } catch (error) {
    // Non-blocking - errors shouldn't affect user experience
    logHook('user-tracking', `Error: ${error}`, 'warn');
    return outputSilentSuccess();
  }
}

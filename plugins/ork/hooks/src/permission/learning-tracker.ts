/**
 * Permission Learning Tracker - Learns from user approval patterns
 * Hook: PermissionRequest (Post-approval tracking)
 * CC 2.1.6 Compliant: includes continue field in all outputs
 *
 * This hook runs AFTER other permission hooks and tracks:
 * 1. Commands that are approved manually (potential auto-approve candidates)
 * 2. Patterns in approved commands for learning
 * 3. Frequency of command types
 */

import type { HookInput, HookResult } from '../types.js';
import {
  outputSilentSuccess,
  outputSilentAllow,
  logHook,
  logPermissionFeedback,
  getPluginRoot,
} from '../lib/common.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Security blocklist - commands that should never be auto-approved
 */
const SECURITY_BLOCKLIST: RegExp[] = [
  /rm\s+-rf\s+[/~]/,
  /sudo\s/,
  /chmod\s+-R\s+777/,
  />\s*\/dev\/sd/,
  /mkfs\./,
  /dd\s+if=/,
  /:.*\(\).*\{.*\|.*&.*\}/,
  /curl.*\|\s*sh/,
  /wget.*\|\s*sh/,
];

/**
 * Check if command matches security blocklist
 */
function isSecurityBlocked(command: string): boolean {
  return SECURITY_BLOCKLIST.some((pattern) => pattern.test(command));
}

/**
 * Load learned patterns from feedback file
 */
function loadLearnedPatterns(): string[] {
  const pluginRoot = getPluginRoot();
  const feedbackFile = join(pluginRoot, '.claude', 'feedback', 'learned-patterns.json');

  try {
    if (existsSync(feedbackFile)) {
      const data = JSON.parse(readFileSync(feedbackFile, 'utf8'));
      return data.autoApprovePatterns || [];
    }
  } catch {
    // Ignore errors
  }

  return [];
}

/**
 * Check if command matches a learned auto-approve pattern
 */
function shouldAutoApprove(command: string): boolean {
  const patterns = loadLearnedPatterns();

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern);
      if (regex.test(command)) {
        return true;
      }
    } catch {
      // Invalid pattern, skip
    }
  }

  return false;
}

/**
 * Learning tracker hook - observes permissions for learning, optionally auto-approves
 */
export function learningTracker(input: HookInput): HookResult {
  const toolName = input.tool_name;
  const command = input.tool_input.command || input.tool_input.file_path || '';

  logHook('learning-tracker', `Processing permission for tool: ${toolName}, command: ${command.slice(0, 50)}...`);

  // For Bash commands, check if we should auto-approve based on learned patterns
  if (toolName === 'Bash' && command) {
    // First check security blocklist - never auto-approve these
    if (isSecurityBlocked(command)) {
      logHook('learning-tracker', 'Command matches security blocklist, skipping');
      return outputSilentSuccess();
    }

    // Check if this command matches a learned auto-approve pattern
    if (shouldAutoApprove(command)) {
      logHook('learning-tracker', 'Command matches learned auto-approve pattern');
      logPermissionFeedback('allow', 'Learned pattern match', input);
      return outputSilentAllow();
    }
  }

  // Output: Silent pass-through (don't affect the permission decision)
  // This hook observes for learning purposes
  return outputSilentSuccess();
}

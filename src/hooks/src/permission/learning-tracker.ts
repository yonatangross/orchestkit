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

import type { HookInput, HookResult , HookContext} from '../types.js';
import {
  outputSilentSuccess,
  outputSilentAllow,
  getPluginRoot,
} from '../lib/common.js';
import { isCompoundCommand, normalizeSingle } from '../lib/normalize-command.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NOOP_CTX } from '../lib/context.js';

/**
 * Security blocklist - commands that should never be auto-approved
 */
const SECURITY_BLOCKLIST: Array<RegExp | { test: (cmd: string) => boolean }> = [
  /rm\s+-rf\s+[/~]/,
  /sudo\s/,
  /chmod\s+-R\s+777/,
  />\s*\/dev\/sd/,
  /mkfs\./,
  /dd\s+if=/,
  // Fork bomb / dangerous shell function pattern — string-based to avoid ReDoS
  { test: (cmd: string) => cmd.includes(':') && cmd.includes('()') && cmd.includes('{') && cmd.includes('|') && cmd.includes('&') && cmd.includes('}') },
  { test: (cmd: string) => cmd.includes('curl') && /\|\s*sh/.test(cmd) },
  { test: (cmd: string) => cmd.includes('wget') && /\|\s*sh/.test(cmd) },
];

/**
 * Check if command matches security blocklist
 */
function isSecurityBlocked(command: string): boolean {
  return SECURITY_BLOCKLIST.some((pattern) => pattern.test(command));
}

/**
 * Module-scoped pattern cache.
 *
 * v7.30.0 (#1265): Patterns are loaded ONCE on first access, not on every
 * PermissionRequest. Each CC hook = separate Node process, so "module scope"
 * = "once per process" which = "once per hook invocation". The cache prevents
 * repeated readFileSync if shouldAutoApprove is called multiple times within
 * the same invocation (e.g., compound command checking).
 *
 * For cross-invocation caching, CC would need a persistent daemon (#1255).
 * This still eliminates the redundant reads within a single hook execution.
 */
let _cachedPatterns: string[] | null = null;

/** Reset cache — exported for testing only */
export function _resetPatternCacheForTesting(): void {
  _cachedPatterns = null;
}

/**
 * Load learned patterns from feedback file (cached per process)
 */
function loadLearnedPatterns(): string[] {
  if (_cachedPatterns !== null) return _cachedPatterns;

  const pluginRoot = getPluginRoot();
  const feedbackFile = join(pluginRoot, '.claude', 'feedback', 'learned-patterns.json');

  try {
    if (existsSync(feedbackFile)) {
      const data = JSON.parse(readFileSync(feedbackFile, 'utf8'));
      const patterns: string[] = data.autoApprovePatterns || [];
      _cachedPatterns = patterns;
      return patterns;
    }
  } catch {
    // Ignore errors
  }

  _cachedPatterns = [];
  return _cachedPatterns;
}

/**
 * Check if command matches a learned auto-approve pattern.
 * SEC: Uses literal prefix matching only — never constructs RegExp from user data.
 * Each pattern is treated as a literal command prefix (case-insensitive).
 * SEC: Normalizes command before matching to prevent escape-based bypasses.
 */
function shouldAutoApprove(command: string): boolean {
  const patterns = loadLearnedPatterns();
  const normalizedCommand = normalizeSingle(command).toLowerCase();

  for (const pattern of patterns) {
    // SEC: Only allow non-empty string patterns, no regex interpretation
    if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > 200) {
      continue;
    }
    // Literal prefix match only — safe from regex injection
    if (normalizedCommand.startsWith(pattern.toLowerCase().trim())) {
      return true;
    }
  }

  return false;
}

/**
 * Learning tracker hook - observes permissions for learning, optionally auto-approves
 */
export function learningTracker(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const toolName = input.tool_name;
  const command = input.tool_input.command || input.tool_input.file_path || '';

  ctx.log('learning-tracker', `Processing permission for tool: ${toolName}, command: ${command.slice(0, 50)}...`);

  // For Bash commands, check if we should auto-approve based on learned patterns
  if (toolName === 'Bash' && command) {
    // First check security blocklist - never auto-approve these
    if (isSecurityBlocked(command)) {
      ctx.log('learning-tracker', 'Command matches security blocklist, skipping');
      return outputSilentSuccess();
    }

    // SEC: Never auto-approve compound commands — require manual review
    if (isCompoundCommand(command)) {
      ctx.log('learning-tracker', 'Compound command detected, skipping auto-approve');
      return outputSilentSuccess();
    }

    // Check if this command matches a learned auto-approve pattern
    if (shouldAutoApprove(command)) {
      ctx.log('learning-tracker', 'Command matches learned auto-approve pattern');
      ctx.logPermission('allow', 'Learned pattern match', input);
      return outputSilentAllow();
    }
  }

  // Output: Silent pass-through (don't affect the permission decision)
  // This hook observes for learning purposes
  return outputSilentSuccess();
}

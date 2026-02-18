/**
 * Auto-Approve Safe Bash - Automatically approves safe bash commands
 * Hook: PermissionRequest (Bash)
 * CC 2.1.6 Compliant: includes continue field in all outputs
 */

import type { HookInput, HookResult } from '../types.js';
import {
  outputSilentAllow,
  outputSilentSuccess,
  logHook,
  logPermissionFeedback,
} from '../lib/common.js';
import { isCompoundCommand, normalizeSingle } from '../lib/normalize-command.js';

/**
 * Patterns that should NEVER be auto-approved even if they match SAFE_PATTERNS.
 * SEC: git checkout -- . discards all unstaged changes — destructive.
 */
const REJECT_PATTERNS: RegExp[] = [
  /^git\s+checkout\s+--\s+\./, // git checkout -- . (discard all changes)
  /^git\s+checkout\s+\.\s*$/,  // git checkout . (same effect)
];

/**
 * Safe command patterns that should be auto-approved
 */
const SAFE_PATTERNS: RegExp[] = [
  // Git read operations
  /^git (status|log|diff|branch|show|fetch|pull)/,
  /^git checkout/,

  // Package managers - read operations
  /^npm (list|ls|outdated|audit|run|test)/,
  /^pnpm (list|ls|outdated|audit|run|test)/,
  /^yarn (list|outdated|audit|run|test)/,
  /^poetry (show|run|env)/,

  // Docker - read operations
  /^docker (ps|images|logs|inspect)/,
  /^docker-compose (ps|logs)/,
  /^docker compose (ps|logs)/,

  // Basic shell commands
  /^ls(\s|$)/,
  /^pwd$/,
  /^echo\s/,
  /^cat\s/,
  /^head\s/,
  /^tail\s/,
  /^wc\s/,
  /^find\s/,
  /^which\s/,
  /^type\s/,
  /^env$/,
  /^printenv/,

  // GitHub CLI - read operations
  /^gh (issue|pr|repo|workflow) (list|view|status)/,
  /^gh milestone/,

  // Testing and linting
  /^pytest/,
  /^poetry run pytest/,
  /^npm run (test|lint|typecheck|format)/,
  /^ruff (check|format)/,
  /^ty check/,
  /^mypy/,
];

/**
 * Auto-approve safe bash commands
 */
export function autoApproveSafeBash(input: HookInput): HookResult {
  const command = input.tool_input.command || '';

  logHook('auto-approve-safe-bash', `Evaluating bash command: ${command.slice(0, 50)}...`);

  // SEC: Reject compound commands — "git status && rm -rf /" must NOT auto-approve
  if (command && isCompoundCommand(command)) {
    logHook('auto-approve-safe-bash', 'Compound command detected, requiring manual approval');
    return outputSilentSuccess();
  }

  // Normalize the command (expand escapes, strip quotes) for pattern matching
  const normalized = command ? normalizeSingle(command) : '';

  // SEC: Check reject patterns first (e.g., git checkout -- .)
  for (const pattern of REJECT_PATTERNS) {
    if (pattern.test(normalized)) {
      logHook('auto-approve-safe-bash', `Rejected: matches reject pattern ${pattern}`);
      return outputSilentSuccess();
    }
  }

  // Check against safe patterns using normalized command
  for (const pattern of SAFE_PATTERNS) {
    if (pattern.test(normalized)) {
      logHook('auto-approve-safe-bash', `Auto-approved: matches safe pattern ${pattern}`);
      logPermissionFeedback('allow', `Matches safe pattern: ${pattern}`, input);
      return outputSilentAllow();
    }
  }

  // Not a recognized safe command - let user decide (silent passthrough)
  logHook('auto-approve-safe-bash', 'Command requires manual approval');
  return outputSilentSuccess();
}

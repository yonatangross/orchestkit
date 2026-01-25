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

  // Check against safe patterns
  for (const pattern of SAFE_PATTERNS) {
    if (pattern.test(command)) {
      logHook('auto-approve-safe-bash', `Auto-approved: matches safe pattern ${pattern}`);
      logPermissionFeedback('allow', `Matches safe pattern: ${pattern}`, input);
      return outputSilentAllow();
    }
  }

  // Not a recognized safe command - let user decide (silent passthrough)
  logHook('auto-approve-safe-bash', 'Command requires manual approval');
  return outputSilentSuccess();
}

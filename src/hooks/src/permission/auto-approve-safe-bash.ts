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
 * SEC: These destructive git operations discard work without warning.
 */
const REJECT_PATTERNS: RegExp[] = [
  /^git\s+checkout\s+--\s+\./,    // git checkout -- . (discard all unstaged changes)
  /^git\s+checkout\s+\.\s*$/,      // git checkout . (same effect)
  /^git\s+checkout\s+(-f|--force)/, // git checkout -f (force, discards local changes)
  /^git\s+clean/,                   // git clean (deletes untracked files)
  /^git\s+reset\s+--hard/,          // git reset --hard (discards all changes)
  /^git\s+push\s+.*--force/,        // git push --force (rewrites remote history)
  /^git\s+push\s+-f\b/,             // git push -f (short form of --force)
];

/**
 * Safe command patterns that should be auto-approved.
 *
 * SEC AUDIT (#662): Each pattern is safe because:
 * - Compound commands (pipes, &&, ||, ;) are rejected BEFORE pattern matching
 * - normalizeSingle() expands hex/octal escapes and strips quotes before matching
 * - REJECT_PATTERNS are checked BEFORE SAFE_PATTERNS
 */
const SAFE_PATTERNS: RegExp[] = [
  // Git read operations — safe: read-only, no data loss
  /^git (status|log|diff|branch|show|fetch|pull)/,
  // SEC: git checkout <branch/file> is safe for switching branches/restoring files.
  // Destructive forms (checkout -f, checkout --, checkout .) are caught by REJECT_PATTERNS.
  /^git checkout\s+\S/,

  // Package managers — safe: read/run operations, no install/publish
  /^npm (list|ls|outdated|audit|run|test)/,
  /^pnpm (list|ls|outdated|audit|run|test)/,
  /^yarn (list|outdated|audit|run|test)/,
  /^poetry (show|run|env)/,

  // Docker — safe: read-only inspection commands
  /^docker (ps|images|logs|inspect)/,
  /^docker-compose (ps|logs)/,
  /^docker compose (ps|logs)/,

  // Basic shell commands — safe: read-only or output-only
  /^ls(\s|$)/,
  /^pwd$/,
  // SEC: echo is safe — no file writes (pipes/redirects are compound, rejected above)
  /^echo\s/,
  // SEC: cat/head/tail/wc are read-only (pipes/redirects rejected as compound)
  /^cat\s/,
  /^head\s/,
  /^tail\s/,
  /^wc\s/,
  // SEC: find with -exec uses ; which triggers isCompoundCommand -> manual review
  /^find\s/,
  /^which\s/,
  /^type\s/,
  /^env$/,
  /^printenv/,

  // GitHub CLI — safe: read-only operations only
  /^gh (issue|pr|repo|workflow) (list|view|status)/,
  // SEC (#662): Restrict gh milestone to read operations only.
  // Previously /^gh milestone/ matched create/edit/delete too.
  /^gh milestone (list|view)/,

  // Testing and linting — safe: read-only analysis
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

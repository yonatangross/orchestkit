/**
 * Auto-Approve Safe Bash - Automatically approves safe bash commands
 * Hook: PermissionRequest (Bash)
 * CC 2.1.6 Compliant: includes continue field in all outputs
 */

import type { HookInput, HookResult , HookContext} from '../types.js';
import {
  outputSilentAllow,
  outputSilentSuccess,
  logHook,
  logPermissionFeedback,
} from '../lib/common.js';
import { isCompoundCommand, normalizeSingle } from '../lib/normalize-command.js';
import { REJECT_PATTERNS } from '../lib/bash-patterns.js';

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

  // POSIX utilities — safe: read-only text/numeric processing (CC 2.1.71 expanded allowlist)
  // SEC: pipes/redirects are compound commands, rejected before pattern matching
  /^fmt(\s|$)/,
  /^comm\s/,
  /^cmp\s/,
  /^numfmt\s/,
  /^expr\s/,
  /^test\s/,
  /^printf\s/,
  /^getconf\s/,
  /^seq\s/,
  /^tsort(\s|$)/,
  /^pr\s/,

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
export function autoApproveSafeBash(input: HookInput, ctx?: HookContext): HookResult {
  const command = input.tool_input.command || '';

  (ctx?.log ?? logHook)('auto-approve-safe-bash', `Evaluating bash command: ${command.slice(0, 50)}...`);

  // SEC: Reject compound commands — "git status && rm -rf /" must NOT auto-approve
  if (command && isCompoundCommand(command)) {
    (ctx?.log ?? logHook)('auto-approve-safe-bash', 'Compound command detected, requiring manual approval');
    return outputSilentSuccess();
  }

  // Normalize the command (expand escapes, strip quotes) for pattern matching
  const normalized = command ? normalizeSingle(command) : '';

  // SEC: Check reject patterns first (e.g., git checkout -- .)
  for (const pattern of REJECT_PATTERNS) {
    if (pattern.test(normalized)) {
      (ctx?.log ?? logHook)('auto-approve-safe-bash', `Rejected: matches reject pattern ${pattern}`);
      return outputSilentSuccess();
    }
  }

  // Check against safe patterns using normalized command
  for (const pattern of SAFE_PATTERNS) {
    if (pattern.test(normalized)) {
      (ctx?.log ?? logHook)('auto-approve-safe-bash', `Auto-approved: matches safe pattern ${pattern}`);
      (ctx?.logPermission ?? logPermissionFeedback)('allow', `Matches safe pattern: ${pattern}`, input);
      return outputSilentAllow();
    }
  }

  // Not a recognized safe command - let user decide (silent passthrough)
  (ctx?.log ?? logHook)('auto-approve-safe-bash', 'Command requires manual approval');
  return outputSilentSuccess();
}

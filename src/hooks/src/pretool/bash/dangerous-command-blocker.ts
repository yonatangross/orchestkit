/**
 * Dangerous Command Blocker - 3-tier command safety system
 * Hook: PreToolUse (Bash)
 * CC 2.1.7 Compliant: outputs JSON with continue field
 * CC 2.1.69: Added "ask" decision tier for gray-zone commands
 *
 * Tiers:
 *   DENY  — catastrophic, never legitimate (rm -rf /, fork bomb, DROP DATABASE)
 *   ASK   — dangerous but sometimes legitimate (git reset --hard, sudo, kill)
 *   ALLOW — everything else (silent pass-through)
 */

import type { HookInput, HookResult , HookContext} from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
  outputAsk,
} from '../../lib/common.js';
import {
  containsDangerousCommand,
  normalizeSingle,
} from '../../lib/normalize-command.js';
import { NOOP_CTX } from '../../lib/context.js';

// =============================================================================
// DENY tier — catastrophic system damage, NEVER legitimate
// =============================================================================

/**
 * Substring patterns matched after compound-splitting via containsDangerousCommand().
 */
const DENY_PATTERNS: string[] = [
  // Filesystem destruction
  'rm -rf ~',
  'rm -fr ~',
  'mv /* /dev/null',
  // Device wiping
  '> /dev/sda',
  'mkfs.',
  'dd if=/dev/zero of=/dev/',
  'dd if=/dev/random of=/dev/',
  // Permission abuse
  'chmod -R 777 /',
  // Database destruction
  'drop database',
  'drop schema',
  'truncate table',
];

/**
 * Regex patterns for root-path destruction (anchored to avoid false positives).
 *
 * macOS /private/{etc,var,home} map to /etc, /var, /home via symlinks, so
 * deleting them is equally destructive. CC 2.1.113 hardened Bash(rm:*) rules
 * to treat these as dangerous; we mirror that at the hook layer for defense
 * in depth. /private/tmp is excluded — tmpdir cleanup is sometimes legit.
 */
const DENY_REGEX_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\brm\s+-r[f]\s+\/(\s|$|\*|\))/i, label: 'rm -rf /' },
  { pattern: /\brm\s+-[f]r\s+\/(\s|$|\*|\))/i, label: 'rm -fr /' },
  { pattern: /\brm\s+-[rf]{1,2}\s+\/private\/(etc|var|home)(\/|\s|$)/i, label: 'rm -rf /private/{etc,var,home}' },
];

// =============================================================================
// ASK tier — dangerous but sometimes legitimate, escalate to user
// NOTE (CC 2.1.101): permissions.deny rules now override our 'ask' decision.
// If a user has a deny rule matching these commands, CC blocks them outright
// instead of prompting. This is correct behavior — deny > ask > allow.
//
// COMPOSE BOUNDARY (CC 2.1.183): CC now natively BLOCKS destructive git
// (`reset --hard`, `checkout -- .`, `clean -fd`, `stash drop`), non-agent
// `commit --amend`, and `terraform`/`pulumi`/`cdk destroy` — but ONLY in auto
// mode, as an unattended backstop. This hook fires in EVERY permission mode at
// PreToolUse, so the two compose: native auto-mode block is the headless safety
// net; this ASK tier gives interactive users the confirmation prompt native
// auto-mode skips. We mirror CC's discard-risk set below for interactive parity
// (and keep force-push/sudo/kill, which native auto-mode blocking does not cover).
// `commit --amend` is intentionally NOT mirrored: a stateless PreToolUse hook
// can't tell "made by the agent this session" from a legitimate amend, so it is
// left to native auto-mode block to avoid false-prompting every rebase/amend.
// =============================================================================

/**
 * Substring patterns that trigger user confirmation.
 */
const ASK_PATTERNS: { pattern: string; reason: string }[] = [
  { pattern: 'git reset --hard', reason: 'Discards all uncommitted changes. Are you sure?' },
  { pattern: 'git clean -fd', reason: 'Permanently removes untracked files. Are you sure?' },
  // CC 2.1.183 interactive parity — discard-risk ops CC blocks in auto mode.
  { pattern: 'git stash drop', reason: 'Permanently deletes a stashed change set. Are you sure?' },
];

/**
 * Regex patterns that trigger user confirmation.
 */
const ASK_REGEX_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /git\s+push\s+.*(-f|--force)\b/i,
    reason: 'Force-push rewrites remote history. Are you sure?',
  },
  // CC 2.1.183 interactive parity — whole-tree working-copy discard.
  // CC blocks `git checkout -- .` in auto mode; ork gates every equivalent
  // full-tree discard: any whole-tree pathspec (`.`, `./`, `*`, `:/`), the
  // no-`--` form (`git checkout .`), and the modern `git restore .` default.
  // The pathspec must be a BARE token preceded by whitespace, so targeted paths
  // (`-- src/x`, `-- .gitignore`, `README.md`, `*.ts`) still allow. `[^&|;]*`
  // scopes the scan to the checkout/restore segment of a compound command.
  {
    pattern: /git\s+(checkout|restore)\b[^&|;]*\s(\.\/?|:\/|\*)(\s|$)/i,
    reason: 'Discards all unstaged changes in the working tree. Are you sure?',
  },
  // CC 2.1.183 interactive parity — IaC stack teardown (auto mode blocks these).
  // `destroy(\s|$)` not `\bdestroy\b`: the word boundary let `destroy-plan`
  // (a read-only wrapper subcommand) over-match, since `-` is a non-word char.
  {
    pattern: /\b(terraform|pulumi|cdk)\s+destroy(\s|$)/i,
    reason: 'Tears down infrastructure resources. Are you sure?',
  },
  {
    pattern: /\bsudo\s+/i,
    reason: 'Elevated privileges requested. Are you sure?',
  },
  {
    pattern: /\b(kill|pkill|killall)\s+/i,
    reason: 'Terminates running processes. Are you sure?',
  },
  {
    pattern: /\bdocker\s+system\s+prune\b/i,
    reason: 'Removes all unused Docker resources. Are you sure?',
  },
  {
    pattern: /\brm\s+-r[f]*\s+\.?\/?\/?node_modules\b/i,
    reason: 'Removes all installed dependencies. Are you sure?',
  },
];

/**
 * Shell interpreters that should never receive piped input.
 * Stays in DENY tier — executing arbitrary remote code is never safe to "ask" about.
 */
const PIPE_TO_SHELL_RE = /\|\s*(sh|bash|zsh|dash|python[23]?|node|perl|ruby|tclsh)\b/i;

// =============================================================================
// Main handler
// =============================================================================

export function dangerousCommandBlocker(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const command = input.tool_input.command || '';
  if (!command) return outputSilentSuccess();

  // --- DENY tier: catastrophic patterns (compound-split matching) ---
  const dangerousCheck = containsDangerousCommand(command, DENY_PATTERNS);
  if (dangerousCheck.matches) {
    const pattern = dangerousCheck.matched!;
    ctx.log('dangerous-command-blocker', `BLOCKED: Dangerous pattern: ${pattern}`);
    ctx.logPermission('deny', `Dangerous pattern: ${pattern}`, input);
    return outputDeny(
      `Command matches dangerous pattern: ${pattern}\n\n` +
        'This command could cause severe system damage and has been blocked.',
    );
  }

  // --- DENY tier: root-path regex patterns ---
  // Collapse `//` → `/` and `/./` → `/` on paths so that `rm -rf /private//etc`
  // and `rm -rf /private/./etc` normalize to `/private/etc` before regex
  // matching. normalizeSingle handles quotes/escapes/compound ops but does
  // NOT canonicalize path-traversal artifacts. Without this, the /private
  // regex was bypassable via trivial slash-doubling.
  const normalizedForRegex = normalizeSingle(command)
    .replace(/\/+/g, '/')
    .replace(/\/\.\//g, '/');
  for (const { pattern, label } of DENY_REGEX_PATTERNS) {
    if (pattern.test(normalizedForRegex)) {
      ctx.log('dangerous-command-blocker', `BLOCKED: Dangerous pattern: ${label}`);
      ctx.logPermission('deny', `Dangerous pattern: ${label}`, input);
      return outputDeny(
        `Command matches dangerous pattern: ${label}\n\n` +
          'This command could cause severe system damage and has been blocked.',
      );
    }
  }

  const normalizedCommand = normalizeSingle(command).toLowerCase();

  // --- DENY tier: fork bomb ---
  if (normalizedCommand.includes(':(){:|:&};:')) {
    const reason = 'Fork bomb detected';
    ctx.log('dangerous-command-blocker', `BLOCKED: ${reason}`);
    ctx.logPermission('deny', reason, input);
    return outputDeny(
      `Command matches dangerous pattern: :(){:|:&};:\n\n` +
        'This command could cause severe system damage and has been blocked.',
    );
  }

  // --- DENY tier: piping to shell interpreters ---
  if (PIPE_TO_SHELL_RE.test(normalizedCommand)) {
    const reason = 'Piping to shell interpreter detected';
    ctx.log('dangerous-command-blocker', `BLOCKED: ${reason}`);
    ctx.logPermission('deny', reason, input);
    return outputDeny(
      `${reason}\n\n` +
        'Piping untrusted content to a shell interpreter is dangerous and has been blocked.',
    );
  }

  // --- ASK tier: dangerous but sometimes legitimate (substring) ---
  const askSubstringCheck = containsDangerousCommand(
    command,
    ASK_PATTERNS.map((p) => p.pattern),
  );
  if (askSubstringCheck.matches) {
    const matched = ASK_PATTERNS.find((p) => p.pattern === askSubstringCheck.matched);
    if (matched) {
      ctx.log('dangerous-command-blocker', `ASK: ${matched.reason}`);
      ctx.logPermission('ask', matched.reason, input);
      return outputAsk(matched.reason);
    }
  }

  // --- ASK tier: dangerous but sometimes legitimate (regex) ---
  for (const { pattern, reason } of ASK_REGEX_PATTERNS) {
    if (pattern.test(normalizedCommand)) {
      ctx.log('dangerous-command-blocker', `ASK: ${reason}`);
      ctx.logPermission('ask', reason, input);
      return outputAsk(reason);
    }
  }

  return outputSilentSuccess();
}

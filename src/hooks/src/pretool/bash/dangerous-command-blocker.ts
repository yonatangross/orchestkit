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
 */
const DENY_REGEX_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\brm\s+-r[f]\s+\/(\s|$|\*|\))/i, label: 'rm -rf /' },
  { pattern: /\brm\s+-[f]r\s+\/(\s|$|\*|\))/i, label: 'rm -fr /' },
];

// =============================================================================
// ASK tier — dangerous but sometimes legitimate, escalate to user
// =============================================================================

/**
 * Substring patterns that trigger user confirmation.
 */
const ASK_PATTERNS: { pattern: string; reason: string }[] = [
  { pattern: 'git reset --hard', reason: 'Discards all uncommitted changes. Are you sure?' },
  { pattern: 'git clean -fd', reason: 'Permanently removes untracked files. Are you sure?' },
];

/**
 * Regex patterns that trigger user confirmation.
 */
const ASK_REGEX_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /git\s+push\s+.*(-f|--force)\b/i,
    reason: 'Force-push rewrites remote history. Are you sure?',
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
  const normalizedForRegex = normalizeSingle(command);
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

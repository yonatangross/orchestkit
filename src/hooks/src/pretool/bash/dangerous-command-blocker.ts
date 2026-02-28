/**
 * Dangerous Command Blocker - Blocks commands matching dangerous patterns
 * Hook: PreToolUse (Bash)
 * CC 2.1.7 Compliant: outputs JSON with continue field
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
  logHook,
  logPermissionFeedback,
  normalizeCommand as normalizeCommandLegacy,
} from '../../lib/common.js';
import {
  containsDangerousCommand,
} from '../../lib/normalize-command.js';

/**
 * Dangerous patterns - commands that can cause catastrophic system damage
 * These are matched as literal substrings via normalizedCommand.includes()
 *
 * NOTE: Root-path rm patterns (rm -rf /, rm -fr /) are in DANGEROUS_REGEX_PATTERNS
 * below to avoid false positives on legitimate paths like /tmp, /var/log, etc.
 */
const DANGEROUS_PATTERNS: string[] = [
  // Filesystem destruction (relative paths only — absolute root uses regex below)
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
  // Fork bomb
  ':(){:|:&};:',
  // Destructive git operations (data loss)
  'git reset --hard',
  'git clean -fd',
  // Database destruction
  'drop database',
  'drop schema',
  'truncate table',
];

/**
 * Regex patterns for root-path destruction commands.
 * These need anchored matching to avoid false positives:
 * - "rm -rf /" (bare root) → BLOCKED
 * - "rm -rf /tmp/build" → ALLOWED (legitimate path)
 * - "rm -rf /*" → BLOCKED (glob root)
 */
const DANGEROUS_REGEX_PATTERNS: { pattern: RegExp; label: string }[] = [
  // rm -rf / or rm -rf /* but NOT rm -rf /tmp/...
  // Matches: rm -rf /, rm -rf /*, rm -rf / &&, rm -rf / ;
  // Does NOT match: rm -rf /tmp, rm -rf /var/log
  { pattern: /\brm\s+-r[f]\s+\/(\s|$|\*|\))/i, label: 'rm -rf /' },
  { pattern: /\brm\s+-[f]r\s+\/(\s|$|\*|\))/i, label: 'rm -fr /' },
];

/**
 * Shell and script interpreters that should never receive piped input.
 * Catches: wget URL | sh, curl URL | bash, cat file | python3, etc.
 */
const PIPE_TO_SHELL_RE = /\|\s*(sh|bash|zsh|dash|python[23]?|node|perl|ruby|tclsh)\b/i;

/**
 * Git force-push patterns that rewrite remote history.
 * Catches: git push --force, git push -f, git push origin main --force
 */
const GIT_FORCE_PUSH_RE = /git\s+push\s+.*(-f|--force)\b/i;

/**
 * Block dangerous commands
 */
export function dangerousCommandBlocker(input: HookInput): HookResult {
  const command = input.tool_input.command || '';

  if (!command) {
    return outputSilentSuccess();
  }

  // Normalize: expand escapes, strip quotes, split compound operators, then check each sub-command
  const dangerousCheck = containsDangerousCommand(command, DANGEROUS_PATTERNS);
  if (dangerousCheck.matches) {
    const pattern = dangerousCheck.matched!;
    logHook('dangerous-command-blocker', `BLOCKED: Dangerous pattern: ${pattern}`);
    logPermissionFeedback('deny', `Dangerous pattern: ${pattern}`, input);

    return outputDeny(
      `Command matches dangerous pattern: ${pattern}\n\n` +
        'This command could cause severe system damage and has been blocked.'
    );
  }

  // Check regex patterns for root-path destruction (anchored to avoid false positives)
  const normalizedForRegex = normalizeCommandLegacy(command);
  for (const { pattern, label } of DANGEROUS_REGEX_PATTERNS) {
    if (pattern.test(normalizedForRegex)) {
      logHook('dangerous-command-blocker', `BLOCKED: Dangerous pattern: ${label}`);
      logPermissionFeedback('deny', `Dangerous pattern: ${label}`, input);

      return outputDeny(
        `Command matches dangerous pattern: ${label}\n\n` +
          'This command could cause severe system damage and has been blocked.'
      );
    }
  }

  // Legacy normalized form for regex checks and patterns that contain operators
  const normalizedCommand = normalizeCommandLegacy(command).toLowerCase();

  // Fork bomb detection — pattern contains | and ; so it can't be matched after splitting
  if (normalizedCommand.includes(':(){:|:&};:')) {
    const reason = 'Fork bomb detected';
    logHook('dangerous-command-blocker', `BLOCKED: ${reason}`);
    logPermissionFeedback('deny', reason, input);

    return outputDeny(
      `Command matches dangerous pattern: :(){:|:&};:\n\n` +
        'This command could cause severe system damage and has been blocked.'
    );
  }

  // Check for piping to shell interpreters (e.g., wget URL | sh, curl URL | bash)
  if (PIPE_TO_SHELL_RE.test(normalizedCommand)) {
    const reason = 'Piping to shell interpreter detected';
    logHook('dangerous-command-blocker', `BLOCKED: ${reason}`);
    logPermissionFeedback('deny', reason, input);

    return outputDeny(
      `${reason}\n\n` +
        'Piping untrusted content to a shell interpreter is dangerous and has been blocked.'
    );
  }

  // Check for git force-push (rewrites remote history)
  if (GIT_FORCE_PUSH_RE.test(normalizedCommand)) {
    const reason = 'Git force-push detected (rewrites remote history)';
    logHook('dangerous-command-blocker', `BLOCKED: ${reason}`);
    logPermissionFeedback('deny', reason, input);

    return outputDeny(
      `${reason}\n\n` +
        'Force-pushing can destroy remote commit history and has been blocked.'
    );
  }

  // Command is safe, allow it silently
  return outputSilentSuccess();
}

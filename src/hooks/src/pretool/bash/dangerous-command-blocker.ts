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
 */
const DANGEROUS_PATTERNS: string[] = [
  // Filesystem destruction
  'rm -rf /',
  'rm -rf ~',
  'rm -fr /',
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
 * Shell interpreters that should never receive piped input from download commands.
 * Catches: wget URL | sh, curl URL | bash, etc.
 */
const PIPE_TO_SHELL_RE = /\|\s*(sh|bash|zsh|dash)\b/i;

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

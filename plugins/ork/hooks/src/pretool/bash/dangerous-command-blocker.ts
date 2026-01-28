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
  normalizeCommand,
} from '../../lib/common.js';

/**
 * Dangerous patterns - commands that can cause catastrophic system damage
 * These are matched as literal substrings via normalizedCommand.includes()
 */
const DANGEROUS_PATTERNS: string[] = [
  'rm -rf /',
  'rm -rf ~',
  'rm -fr /',
  'rm -fr ~',
  '> /dev/sda',
  'mkfs.',
  'chmod -R 777 /',
  'dd if=/dev/zero of=/dev/',
  'dd if=/dev/random of=/dev/',
  ':(){:|:&};:', // Fork bomb
  'mv /* /dev/null',
];

/**
 * Shell interpreters that should never receive piped input from download commands.
 * Catches: wget URL | sh, curl URL | bash, etc.
 */
const PIPE_TO_SHELL_RE = /\|\s*(sh|bash|zsh|dash)\b/;

/**
 * Block dangerous commands
 */
export function dangerousCommandBlocker(input: HookInput): HookResult {
  const command = input.tool_input.command || '';

  if (!command) {
    return outputSilentSuccess();
  }

  // Normalize: remove line continuations and collapse whitespace
  const normalizedCommand = normalizeCommand(command);

  // Check command against each dangerous pattern (literal substring)
  for (const pattern of DANGEROUS_PATTERNS) {
    if (normalizedCommand.includes(pattern)) {
      logHook('dangerous-command-blocker', `BLOCKED: Dangerous pattern: ${pattern}`);
      logPermissionFeedback('deny', `Dangerous pattern: ${pattern}`, input);

      return outputDeny(
        `Command matches dangerous pattern: ${pattern}\n\n` +
          'This command could cause severe system damage and has been blocked.'
      );
    }
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

  // Command is safe, allow it silently
  return outputSilentSuccess();
}

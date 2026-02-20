/**
 * Compound Command Validator Hook
 * Validates multi-command sequences for security
 * CC 2.1.7: Detects dangerous patterns in compound commands (&&, ||, |, ;)
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
  logHook,
  logPermissionFeedback,
} from '../../lib/common.js';
import { containsDangerousCommand, normalizeSingle } from '../../lib/normalize-command.js';

/**
 * Dangerous segment patterns
 */
const DANGEROUS_SEGMENTS = [
  'rm -rf /',
  'rm -rf ~',
  'rm -fr /',
  'rm -fr ~',
  'mkfs',
  'dd if=/dev',
  '> /dev/sd',
  'chmod -R 777 /',
];

/**
 * Validate compound command and return blocking reason if dangerous.
 * Uses containsDangerousCommand from normalize-command.ts which handles
 * hex/octal escape expansion, quote stripping, and compound operator splitting.
 */
function validateCompoundCommand(command: string): string | null {
  // Check for pipe-to-shell patterns BEFORE normalization splits on |
  // String-based checks avoid ReDoS from polynomial regex backtracking
  const normalized = normalizeSingle(command).toLowerCase();
  const hasPipeShell = (cmd: string, fetcher: string): boolean =>
    cmd.includes(fetcher) && cmd.includes('|') && (cmd.includes('sh') || cmd.includes('bash'));
  if (hasPipeShell(normalized, 'curl') || hasPipeShell(normalized, 'wget')) {
    return 'pipe-to-shell execution (curl/wget piped to sh/bash)';
  }

  // Use full normalizer: expands escapes, strips quotes, splits on operators
  const result = containsDangerousCommand(command, DANGEROUS_SEGMENTS);
  if (result.matches) {
    return result.subCommand || result.matched || 'unknown dangerous segment';
  }

  return null;
}

/**
 * Validate compound commands for dangerous patterns
 */
export function compoundCommandValidator(input: HookInput): HookResult {
  const command = input.tool_input.command || '';

  if (!command) {
    return outputSilentSuccess();
  }

  const blockReason = validateCompoundCommand(command);

  if (blockReason) {
    const errorMsg = `BLOCKED: Dangerous compound command detected.

Blocked segment: ${blockReason}

The command contains a potentially destructive operation.

Please review and modify your command to remove the dangerous operation.`;

    logPermissionFeedback('deny', `Dangerous compound command: ${blockReason}`, input);
    logHook('compound-command-validator', `BLOCKED: ${blockReason}`);

    return outputDeny(errorMsg);
  }

  // Safe compound command - allow execution
  logPermissionFeedback('allow', 'Compound command validated: safe', input);
  return outputSilentSuccess();
}

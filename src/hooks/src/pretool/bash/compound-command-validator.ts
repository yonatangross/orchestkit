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
  normalizeCommand,
} from '../../lib/common.js';

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
 * Validate a single segment of a compound command
 */
function validateSegment(segment: string): boolean {
  const trimmed = segment.trim();
  if (!trimmed) return true;

  for (const pattern of DANGEROUS_SEGMENTS) {
    if (trimmed.includes(pattern)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate compound command and return blocking reason if dangerous
 */
function validateCompoundCommand(command: string): string | null {
  // Check for pipe-to-shell patterns BEFORE splitting
  if (/curl.*\|.*(sh|bash)/.test(command) || /wget.*\|.*(sh|bash)/.test(command)) {
    return 'pipe-to-shell execution (curl/wget piped to sh/bash)';
  }

  // Check if command contains compound operators
  if (!command.includes('&&') && !command.includes('||') && !command.includes('|') && !command.includes(';')) {
    return null; // Not a compound command
  }

  // Split on operators and check each segment
  const segments = command.split(/&&|\|\||[|;]/);

  for (const segment of segments) {
    if (!validateSegment(segment)) {
      return segment.trim();
    }
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

  // Normalize command: remove line continuations
  const normalizedCommand = normalizeCommand(command);

  // Validate
  const blockReason = validateCompoundCommand(normalizedCommand);

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

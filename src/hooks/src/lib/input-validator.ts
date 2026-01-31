/**
 * Runtime input validation for hook boundary
 * Validates HookInput shape before passing to hook functions
 *
 * Design: Fail-fast with clear errors on truly malformed input.
 * Warn on missing optional fields. Never throw — returns errors as data.
 */

import type { HookInput } from '../types.js';

/**
 * Validation result — null means valid, string[] means errors found
 */
export interface ValidationResult {
  /** Whether the input is valid enough to proceed */
  valid: boolean;
  /** Error messages for invalid input (blocks execution) */
  errors: string[];
  /** Warning messages for degraded input (execution continues) */
  warnings: string[];
}

/**
 * Map hook name prefix to expected event type for validation
 */
const PREFIX_EVENT_MAP: Record<string, string> = {
  pretool: 'PreToolUse',
  posttool: 'PostToolUse',
  permission: 'PermissionRequest',
  prompt: 'UserPromptSubmit',
  lifecycle: 'SessionStart|SessionEnd',
  stop: 'Stop',
  'subagent-start': 'SubagentStart',
  'subagent-stop': 'SubagentStop',
  notification: 'Notification',
  setup: 'Setup',
  skill: 'PreToolUse|PostToolUse|Stop',
  agent: 'PreToolUse',
};

/**
 * Extract event category from hook name prefix
 */
function getEventCategory(hookName: string): string {
  const prefix = hookName.split('/')[0];
  return PREFIX_EVENT_MAP[prefix] || 'unknown';
}

/**
 * Validate that input is a plain object (not null, array, primitive)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate hook input at the boundary (JSON.parse -> validate -> hook)
 *
 * @param input - Parsed JSON input (after normalizeInput)
 * @param hookName - Full hook name (e.g., 'pretool/bash/dangerous-command-blocker')
 * @returns ValidationResult with errors/warnings
 */
export function validateHookInput(input: unknown, hookName: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Level 1: Input must be an object
  if (!isPlainObject(input)) {
    return {
      valid: false,
      errors: [`Input must be an object, got ${input === null ? 'null' : typeof input}`],
      warnings: [],
    };
  }

  // Level 2: tool_input must be an object if present
  if (input.tool_input !== undefined && !isPlainObject(input.tool_input)) {
    errors.push(`tool_input must be an object, got ${Array.isArray(input.tool_input) ? 'array' : typeof input.tool_input}`);
  }

  // Level 3: Event-specific validation
  const category = getEventCategory(hookName);

  if (category.includes('ToolUse') || category === 'PermissionRequest') {
    // Tool-based events need tool_name
    if (!input.tool_name && input.tool_name !== '') {
      warnings.push('Missing tool_name for tool-based hook');
    }
  }

  if (category === 'UserPromptSubmit') {
    if (input.prompt === undefined && input.tool_input === undefined) {
      warnings.push('Missing prompt field for UserPromptSubmit hook');
    }
  }

  if (category === 'SubagentStart' || category === 'SubagentStop') {
    if (!input.subagent_type && !input.agent_type && !input.tool_input) {
      warnings.push('Missing subagent_type/agent_type for subagent hook');
    }
  }

  if (category === 'Notification') {
    if (!input.message && input.message !== '') {
      warnings.push('Missing message field for Notification hook');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format validation result as a system message for Claude Code
 */
export function formatValidationMessage(result: ValidationResult, hookName: string): string | undefined {
  if (result.valid && result.warnings.length === 0) {
    return undefined;
  }

  const parts: string[] = [];

  if (!result.valid) {
    parts.push(`Hook input validation failed (${hookName}): ${result.errors.join('; ')}`);
  }

  if (result.warnings.length > 0) {
    parts.push(`Hook input warnings (${hookName}): ${result.warnings.join('; ')}`);
  }

  return parts.join(' | ');
}

/**
 * Quick check — returns true if input is valid enough to proceed
 * Used by run-hook.mjs for fast-path decisions
 */
export function isValidInput(input: unknown): input is HookInput {
  return isPlainObject(input);
}

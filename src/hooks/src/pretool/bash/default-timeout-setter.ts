/**
 * Default Timeout Setter Hook
 * Sets default timeout of 120000ms (2 minutes) if not specified
 * CC 2.1.7 Compliant: outputs JSON with updatedInput to modify tool params
 */

import type { HookInput, HookResult, HookSpecificOutput } from '../../types.js';
import { logHook } from '../../lib/common.js';

/**
 * Default timeout: 2 minutes (120000ms)
 */
const DEFAULT_TIMEOUT = 120000;

/**
 * Extended hook specific output with updatedInput
 */
interface ExtendedHookSpecificOutput extends HookSpecificOutput {
  updatedInput?: {
    command: string;
    timeout: number;
    description?: string;
  };
}

/**
 * Set default timeout if not specified
 */
export function defaultTimeoutSetter(input: HookInput): HookResult {
  const command = input.tool_input.command || '';
  const timeout = input.tool_input.timeout;
  const description = input.tool_input.description;

  // If timeout is already set, don't modify
  if (typeof timeout === 'number' && timeout > 0) {
    return { continue: true, suppressOutput: true };
  }

  // Build updatedInput with default timeout
  const updatedInput: ExtendedHookSpecificOutput['updatedInput'] = {
    command,
    timeout: DEFAULT_TIMEOUT,
  };

  if (description && typeof description === 'string') {
    updatedInput.description = description;
  }

  logHook('default-timeout-setter', `Setting default timeout: ${DEFAULT_TIMEOUT}ms`);

  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput,
    } as ExtendedHookSpecificOutput,
  };
}

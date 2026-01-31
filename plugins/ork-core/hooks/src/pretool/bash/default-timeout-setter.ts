/**
 * Default Timeout Setter Hook
 * Sets default timeout of 120000ms (2 minutes) if not specified
 * CC 2.1.25 Compliant: uses canonical outputWithUpdatedInput helper
 */

import type { HookInput, HookResult } from '../../types.js';
import { logHook, outputWithUpdatedInput } from '../../lib/common.js';

/**
 * Default timeout: 2 minutes (120000ms)
 */
const DEFAULT_TIMEOUT = 120000;

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
  const updated: Record<string, unknown> = {
    command,
    timeout: DEFAULT_TIMEOUT,
  };

  if (description && typeof description === 'string') {
    updated.description = description;
  }

  logHook('default-timeout-setter', `Setting default timeout: ${DEFAULT_TIMEOUT}ms`);

  return outputWithUpdatedInput(updated);
}

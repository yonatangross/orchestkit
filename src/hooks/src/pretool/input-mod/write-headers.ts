/**
 * Compatibility hook for existing write-headers registrations.
 * Consumer file content belongs to the caller and must remain unchanged.
 */

import type { HookInput, HookResult, HookContext } from '../../types.js';
import { outputSilentSuccess } from '../../lib/common.js';
import { NOOP_CTX } from '../../lib/context.js';

/**
 * Preserve caller content without adding provenance headers or shebangs.
 */
export function writeHeaders(_input: HookInput, _ctx: HookContext = NOOP_CTX): HookResult {
  return outputSilentSuccess();
}

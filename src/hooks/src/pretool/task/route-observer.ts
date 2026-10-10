/**
 * Route Observer: async PreToolUse Agent hook (#4297).
 *
 * Records the requested Agent as the route executor for Jev shadow pairing,
 * including attempts a sync gate later blocks. It does file I/O, so it is
 * registered `async: true` and stays off the PreToolUse hot path; it never
 * returns a decision.
 */

import type { HookInput, HookResult } from '../../types.js';
import { outputSilentSuccess } from '../../lib/output.js';
import { observeRouteExecutor } from '../../lib/route-judgment.js';

export function routeObserver(input: HookInput): HookResult {
  observeRouteExecutor(input);
  return outputSilentSuccess();
}

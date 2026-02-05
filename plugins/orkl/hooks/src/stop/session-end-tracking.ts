/**
 * Session End Tracking Hook
 * Issue #245: Multi-User Intelligent Decision Capture System
 *
 * Tracks session end event to finalize session in user profile.
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';
import { trackSessionEnd } from '../lib/session-tracker.js';

/**
 * Track session end event
 */
export function sessionEndTracking(_input: HookInput): HookResult {
  try {
    trackSessionEnd();
    logHook('session-end-tracking', 'Tracked session end', 'debug');
    return outputSilentSuccess();
  } catch (error) {
    logHook('session-end-tracking', `Error: ${error}`, 'warn');
    return outputSilentSuccess();
  }
}

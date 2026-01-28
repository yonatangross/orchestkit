/**
 * Session Tracking Hook
 * Issue #245: Multi-User Intelligent Decision Capture System
 *
 * Tracks session start event to record session beginning in user profile.
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';
import { trackSessionStart } from '../lib/session-tracker.js';

/**
 * Track session start event
 */
export function sessionTracking(_input: HookInput): HookResult {
  try {
    trackSessionStart();
    logHook('session-tracking', 'Tracked session start', 'debug');
    return outputSilentSuccess();
  } catch (error) {
    logHook('session-tracking', `Error: ${error}`, 'warn');
    return outputSilentSuccess();
  }
}

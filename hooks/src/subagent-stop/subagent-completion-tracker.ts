/**
 * Subagent Completion Tracker - SubagentStop Hook
 * CC 2.1.7 Compliant: includes continue field in all outputs
 *
 * LIMITATION: Claude Code SubagentStop does NOT provide subagent_type.
 * Available fields: session_id, transcript_path, permission_mode, hook_event_name
 *
 * Subagent TYPE tracking is done in PreToolUse (subagent-validator.ts)
 * This hook only logs completion events for session correlation.
 *
 * Version: 1.0.0 (TypeScript port)
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getSessionId } from '../lib/common.js';

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function subagentCompletionTracker(input: HookInput): HookResult {
  const sessionId = input.session_id || getSessionId();
  logHook('subagent-completion-tracker', `Subagent completed (session: ${sessionId})`);
  return outputSilentSuccess();
}

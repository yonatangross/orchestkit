/**
 * TeammateIdle Hook: Progress Reporter
 *
 * CC 2.1.33 TeammateIdle event fires when an agent teammate becomes idle.
 * Logs idle events for workflow analytics and suggests work redistribution.
 *
 * @hook TeammateIdle
 * @since CC 2.1.33
 */

import type { HookInput, HookResult } from '../types.js';
import { getProjectDir } from '../lib/common.js';
import { appendEventLog } from '../lib/event-logger.js';

export async function progressReporter(input: HookInput): Promise<HookResult> {
  if (!getProjectDir()) {
    return { continue: true };
  }

  const teammateId = input.teammate_id || input.agent_id || 'unknown';
  const teammateType = input.teammate_type || input.subagent_type || 'unknown';
  const idleDuration = input.idle_duration_ms || 0;

  appendEventLog('teammate-activity.jsonl', {
    timestamp: new Date().toISOString(),
    event: 'teammate_idle',
    teammate_id: teammateId,
    teammate_type: teammateType,
    idle_duration_ms: idleDuration,
    session_id: input.session_id,
  });

  // Surface long idle durations (>30s) as context for work reassignment
  if (idleDuration > 30000) {
    return {
      continue: true,
      hookSpecificOutput: {
        additionalContext: `Agent ${teammateType} (${teammateId}) idle for ${Math.round(idleDuration / 1000)}s. Consider reassigning pending work.`,
      },
    };
  }

  return { continue: true };
}

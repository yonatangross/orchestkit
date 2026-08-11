/**
 * TeammateIdle Hook: Progress Reporter
 *
 * CC 2.1.33 TeammateIdle event fires when an agent teammate becomes idle.
 * Logs idle events for workflow analytics and suggests work redistribution.
 *
 * @hook TeammateIdle
 * @since CC 2.1.33
 */

import type { HookInput, HookResult , HookContext} from '../types.js';
import { appendEventLog } from '../lib/event-logger.js';
import { appendAnalytics, hashProject, getTeamContext } from '../lib/analytics.js';
import { NOOP_CTX } from '../lib/context.js';

export async function progressReporter(input: HookInput, ctx: HookContext = NOOP_CTX): Promise<HookResult> {
  if (!(ctx.projectDir)) {
    return { continue: true };
  }

  // The 2.1.227 TeammateIdle payload is {teammate_name, team_name} and nothing
  // else (#3335 A3). The old reads (teammate_type, idle_duration_ms) never
  // arrived, so this hook logged type='unknown' and duration=0 into telemetry
  // AS IF MEASURED. duration is now omitted entirely rather than fabricated:
  // CC provides no idle duration on this event.
  const teammateId = input.teammate_name || input.teammate_id || input.agent_id || 'unknown';
  const teammateType = input.teammate_type || input.subagent_type || 'unknown';

  appendEventLog('teammate-activity.jsonl', {
    timestamp: new Date().toISOString(),
    event: 'teammate_idle',
    teammate_id: teammateId,
    teammate_type: teammateType,
    team_name: input.team_name,
    session_id: input.session_id,
  });

  // Cross-project team activity analytics (Issue #459)
  appendAnalytics('team-activity.jsonl', {
    ts: new Date().toISOString(),
    pid: hashProject(process.env.CLAUDE_PROJECT_DIR || ''),
    event: 'idle',
    agent: input.teammate_name || teammateType,
    ...getTeamContext(),
  });

  // The long-idle branch that lived here compared idle_duration_ms > 30000.
  // CC sends no duration on TeammateIdle, so the read was always 0 and the
  // branch NEVER fired (#3335 A3). Deleted rather than approximated: deriving
  // a duration would need a first-idle timestamp store, which is #3321-class
  // work, not a payload-key fix.
  return { continue: true };
}

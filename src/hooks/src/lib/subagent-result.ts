/**
 * Subagent result reader: the one place that knows where CC puts a
 * subagent's final output (GH-4158).
 *
 * Measured live on CC 2.1.272 (2026-09-15, GH-4158): the SubagentStop payload
 * is exactly
 *
 *   session_id, transcript_path, cwd, prompt_id, permission_mode, agent_id,
 *   agent_type, effort, hook_event_name, stop_hook_active,
 *   agent_transcript_path, last_assistant_message, background_tasks,
 *   session_crons
 *
 * and carries NO `agent_output`, `output`, `summary` or `result`. The final
 * result arrives as `last_assistant_message`, with the full transcript
 * alongside at `agent_transcript_path`. This is the same class #3034 measured
 * at SubagentStop (0 of 11,319 real rows carried agent_output/output).
 *
 * The legacy names stay as fallbacks so older payloads and test fixtures
 * keep working. Readers must go through getSubagentResult() instead of
 * touching the fields directly.
 */

import type { HookInput } from '../types.js';

/**
 * Legacy result field names, in read order after last_assistant_message.
 * `agent_output` is the historically documented SubagentStop name (now
 * legacy); `output`, `summary` and `result` were never reliable and are not
 * declared on HookInput, hence the record casts in the reader.
 */
const LEGACY_RESULT_FIELDS = ['agent_output', 'output', 'summary', 'result'] as const;

/**
 * Read a subagent's final result from a SubagentStop-shaped hook input.
 *
 * Prefers `last_assistant_message` (the field CC 2.1.272 actually sends),
 * then the legacy names, then ''. Empty strings are skipped rather than
 * returned: every historical call site chained with `||`, so an empty
 * preferred field should expose a non-empty legacy one instead of masking it.
 * Non-string values are skipped too: coercing with String() would
 * manufacture "[object Object]" text no downstream matcher should see.
 */
export function getSubagentResult(input: HookInput): string {
  const record = input as unknown as Record<string, unknown>;
  const candidates: unknown[] = [input.last_assistant_message];
  for (const field of LEGACY_RESULT_FIELDS) {
    candidates.push(record[field]);
  }
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return '';
}

# Weak outcome labels for Jev routing

This offline tool emits weak outcome proxies for the shadow report. It does not
call Jev, change hooks, rewrite logs, or decide whether a seam can be promoted.

```sh
node scripts/jev-shadow-label.mjs \
  --events observed-events.jsonl --transcript claude-session.jsonl \
  --executor-map executor-map.json jev-route.jsonl > weak-labels.jsonl
node scripts/jev-shadow-report.mjs --labels weak-labels.jsonl jev-route.jsonl
```

All options are optional. Without exact identity or usable signals, the output
is `unknown`. Malformed decision JSON aborts without emitting partial labels.
Input file paths and line numbers identify evidence. Each emitted sidecar also
contains `decision_sha256`, a fingerprint of complete decision row
fields. A missing or mismatched fingerprint becomes unknown in the report and
is counted as a snapshot mismatch. Freeze input files before reviewing labels;
this guard does not authenticate operator-provided evidence.

The supported decision fields are `session_id`, `prompt_id`, `jev_executor`,
and `producer`, alongside the existing route `intent`, `conf`, `floor`, and
`flag`. A known session directory can supply session identity, never prompt
identity. There are no timestamp, nearest-row, input-text, or session-tail joins.

If `jev_executor` was not recorded, supply a producer-specific intent mapping:

```json
{"ork":{"dev_fix":"Skill:ork:fix-issue","dev_build":"Skill:ork:implement"}}
```

This example is illustrative. Use the taxonomy actually deployed for that
producer and decision version. HQ mappings must be supplied independently.
Output records include the hash of any supplied mapping used for a decision.
The mapping also identifies which transcript Skill/Agent calls can represent
primary route handoffs. Router calls such as `ork:auto` are excluded.

Output is accepted by the report's existing labels input:

```json
{"source":"/frozen/jev-route.jsonl:1","decision_sha256":"<emitted SHA-256 fingerprint>","kind":"weak","outcome":"unknown","signal":"missing_prompt_id","signals":[],"evidence":[],"session_id":"session-example","prompt_id":null,"policy_version":"1"}
```

`outcome` is `correct`, `wrong`, or `unknown`. **These are weak proxies, not
adjudicated task correctness.** They cannot override the incumbent or the
adjudicated corrected pick. The report prints their counts separately and
excludes them from adjudicated precision and confirmed false-high counts.
Never put a ternary outcome into the existing `correct` field: that field
contains a reviewed correct intent/action/category, not a boolean or verdict.

## Signal contract

Normalized event JSONL carries `type`, `session_id`, `prompt_id`, and the fields
below. The CLI records the event file and line as evidence. These envelopes are
an explicit interchange format, not a claim that current hooks emit them all.

| Event | Required additional evidence |
| --- | --- |
| `executor` | `executor`, `primary_handoff:true`, observed at that exact prompt |
| `operator_redirect` | A distinct next prompt, `previous_prompt_id`, `next_prompt_id`, and `corrected_executor` |
| `commit` | Successful commit with full `sha`, canonical `repo_id`, and `owned_by_prompt_id` matching the decision |
| `revert` | `success:true`, full `reverted_sha`, and the same canonical `repo_id`; may occur in another session |
| `stop` | `clean:true`, `task_completed:true`, matching `executor`, `primary_handoff:true`, and a separately observed matching primary executor event |

An exact revert or redirect takes precedence over a clean completion. Multiple
primary executor targets are ambiguous and cannot produce a positive label.
An unambiguous alternate primary executor is a weak negative. No usable signal
means unknown, not correct. Matching by a full SHA and repository does not prove
the route caused a revert; this remains a proxy requiring human calibration.

The native transcript adapter traverses same-session `uuid`/`parentUuid` edges
back to a user `promptId`. Missing, cyclic, conflicting and sidechain ancestry
is rejected. Skill/Agent events require an allowlisted executor and successful
observed tool results. It recognizes actual `stop_hook_summary` records but
does not equate an unblocked Stop with task completion. It never parses raw
prompt text for a correction or copies prompt/tool contents to output.

Native transcripts do not provide a trusted structured redirect envelope;
the adapter ignores fields pretending to be one. Native commit/revert ownership
and prompt-scoped completion are also not inferred from session state. Supply
separately reviewed normalized events through the explicit events option when
such evidence exists; otherwise those signals remain unavailable. Those
operator-provided sidecars are weak evidence, not authenticated observations.

## Capture prerequisite and hand checks

Historical Jev route rows without `prompt_id` cannot be backfilled by this tool.
The route producer must persist the hook's exact prompt identity first. That
capture change is separate from this offline draft. Category and expect rows
receive `unsupported_seam`; executor-route proxies cannot grade those tasks.

Before using proxies for training, review a stratified sample of actual joined
decisions, including negative signals, clean stops and unknowns. Preserve
confounders such as changed requirements, planned decomposition, auxiliary
skills, failed tools and reverted correct changes. Keep a separate human
adjudication sidecar and measure proxy precision against it. Synthetic tests
exercise mechanics and must never be reported as traffic or quality evidence.

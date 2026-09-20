# Reviewing Jev shadow evidence

Run the offline report on session logs and expect step logs:

```sh
node scripts/jev-shadow-report.mjs /path/to/sessions /path/to/expect.jsonl
```

It reads route JSONL, category `session-identity.shadow.json` snapshots, and expect JSONL or `JEV_SHADOW|step|json` lines. Directory scans read JSONL and named category snapshots. Pass other log filenames explicitly. Shadow records are the default; use `--all-modes` to inspect applied decisions too. Malformed and excluded rows are counted. No network calls or keys are needed.

The report prints agreement, confidence bands, high-confidence disagreements, below-floor fallbacks, errors, and top disagreement examples for each seam. A high-confidence disagreement meets the effective floor inclusively and has two observed picks. The output gives its share of all rows and of high-confidence paired rows, making missing coverage visible.

Export every review candidate as JSONL, grouped by its `seam` field:

```sh
node scripts/jev-shadow-report.mjs --confident-wrong /path/to/sessions .expect/jev-shadow.jsonl
```

The `confident-wrong` bucket uses `agree=false AND jev_confidence >= floor` exactly. It marks unlabeled rows `awaiting_adjudication`; this bucket name does not assert that the incumbent was correct. Explicit unknown comparisons stay out of the bucket. The six canonical fields are `jev_pick`, `jev_confidence`, `incumbent_pick`, `agree`, `floor`, and `decided_by`. Historical rows remain readable through the legacy schema adapters.

A settled category classifier with no valid result has a structured `incumbent_pick` outcome: `{"status":"no_valid_result","choice":null,"reason":"incumbent_classifier_failed"}`. This is a failure outcome, not a category label. Its agreement remains null and it is excluded from comparisons. A literal null is reserved for an incumbent that has not run.

Expect appends each active invocation to `.expect/jev-shadow.jsonl`, including errors, before emitting stdout. This does not depend on `report.sh --save`. Override the journal with `--log-file` or `ORK_EXPECT_JEV_LOG`. New journals use mode 0600. Failed writes emit a stderr diagnostic while preserving the action fallback. An unmatched incumbent action is retained verbatim with agreement unknown. Shadow callers must supply either `--model-action` or `--incumbent-not-run REASON`; act callers must supply the actual fallback action. An invalid or unavailable configured floor is null, so the row cannot enter the confidence bucket.

The route prompt hook runs before the model chooses an executor. It records a pending revision, then synchronous PreToolUse observes the requested Skill or Agent selection using the same session and `prompt_id`. The completed pair uses executor targets such as `skill:ork:fix-issue` or `agent:Explore`; legacy intent fields remain for old consumers. The Agent model argument, when supplied, is recorded separately. Stop records `no_executor` for a completed prompt with no requested executor. PostToolUse retries persistence without changing the selected route. A missing correlation ID stays unpaired with a reason. New route rows carry `session_id`, the original runtime `prompt_id`, and `router=ork:auto`; the existing `decided_by` still describes the Jev/table policy. Router Skill calls (`hq-ext:auto` and `ork:auto`) are intermediate steps, not executor picks. Across files, the report groups by the exact `(session_id, prompt_id)` pair and prefers the downstream router named by `handoff_to`, then its paired revision. HQ invocation events (`phase=invoked`) are excluded. An unresolved `phase=handoff` stays unpaired and defaults to telemetry mode, not shadow mode. HQ handoff telemetry requires no fabricated Jev fields. Rows lacking either correlation ID retain the legacy file-local `decision_id` behavior. Superseded rows are counted separately. It never joins by timestamp or latest row. The route hook runs before the model chooses an executor. `decided_by=table` only means Jev did not steer. It is not the model's observed pick. Such records have `incumbent_intent=null` and remain unpaired. The route API can record an independently observed `incumbentIntent`; production hook calls currently have no such observation. To review existing route logs, record adjudicated labels in a separate JSONL file using the absolute source path and one-based line printed by the report. Bind each label to the exact raw log row with `decision_sha256`: the SHA-256 of its complete JSON object after recursively sorting object keys. Array order is retained. Generate the value with the exported `decisionSha256` helper instead of guessing it:

```json
{"source":"/path/to/jev-route.jsonl:1","decision_sha256":"<64 lowercase hex chars>","incumbent":"dev_fix","correct":"dev_review"}
```

```sh
node scripts/jev-shadow-report.mjs --labels labels.jsonl /path/to/jev-route.jsonl
```

New paired route records record executor-target picks (`skill:ork:fix-issue`, `agent:Explore`); historical route records record intent IDs. Use canonical route intent IDs for route labels, the eight session categories for category labels, and only `done`, `wait`, `scroll`, `press_enter`, `click:@eN`, `fill:@eN`, or `select:@eN` for expect labels. The expect grammar matches the candidates Jev can receive; a sidecar cannot establish that a ref existed in a particular snapshot. `incumbent` means the model's observed classification; `correct` requires adjudication against the task outcome. Both are optional independently. A disagreement is a review queue, not proof Jev was wrong. Labeled false-high decisions are reported separately. Never infer the incumbent from Jev's pick or a build-verb heuristic. Legacy expect records without the effective floor remain `unknown_floor`; rerun shadow collection instead of assigning today's floor to old data.

The command accepts adjudicated labels only. A `kind` field, including a weak-outcome sidecar, is rejected so proxy outcomes cannot enter promotion precision. A stale fingerprint is counted as `label_mismatches` and has no effect on agreement or false-high counts; in-schema labels with an invalid seam value are counted as `invalid_labels`. Keep weak outcomes in their own collection and join them only in tools that explicitly report them as non-adjudicated evidence.

Floors are per seam:

| Seam | Configuration | Default | Existing evidence |
| --- | --- | --- | --- |
| Route | `ORK_ROUTE_JEV_FLOOR` | 0.5 | Route benchmark exists; no demonstrated calibration for this floor |
| Expect | `jev_shadow.act_confidence_floor` in expect YAML | 0.5 | Step fixtures establish mechanics, not browser quality calibration |
| Category | `ORK_SESSION_CATEGORY_JEV_FLOOR` | 0.8 | Recorded 150-case held-out comparison: 87/93 correct at or above 0.8 |

For promotion, sample every confidence band and oversample high-confidence disagreements. Label failures using downstream results, freeze the floor on a development split, and evaluate coverage and false-high error on fresh held-out tasks. Keep browser completion correctness, extra actions, fallback quality, latency and cost as separate measures. Record stale snapshot and invalid-action handoffs as regression cases. Agreement alone cannot justify shadow to steer.

No seam changes the main session model. Route suggests a skill or agent, expect chooses a browser action, and category chooses session color. Routing currently calls Jev on every qualifying prompt even after its once-per-session nudge has fired. That cost behavior is unchanged here.


## HQ auto handoff dependency

The shared prompt ID comes from the runtime hook envelope. Do not mint a new ID,
encode it in model-generated skill arguments, or join on prompt text/timestamps.
The HQ plugin must preserve `prompt_id` in its HookInput parser and invocation
telemetry, and observe the actual same-prompt `Skill(ork:auto)` handoff. That
handoff row uses `router=hq-ext:auto`, `handoff_to=ork:auto`, `phase=handoff`,
and the same `session_id` and `prompt_id`. The Ork decision row then identifies
`router=ork:auto`. Current HQ invocation-only telemetry does not prove a routing
decision or a Jev comparison; adding Ork support does not deploy the HQ change.

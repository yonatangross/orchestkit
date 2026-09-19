# Reviewing Jev shadow evidence

Run the offline report on session logs and expect step logs:

```sh
node scripts/jev-shadow-report.mjs /path/to/sessions /path/to/expect.jsonl
```

It reads route JSONL, category `session-identity.shadow.json` snapshots, and expect JSONL or `JEV_SHADOW|step|json` lines. Directory scans read JSONL and named category snapshots. Pass other log filenames explicitly. Shadow records are the default; use `--all-modes` to inspect applied decisions too. Malformed and excluded rows are counted. No network calls or keys are needed.

The report prints agreement, confidence bands, high-confidence disagreements, below-floor fallbacks, errors, and top disagreement examples for each seam. A high-confidence disagreement meets the effective floor inclusively and has two observed picks. The output gives its share of all rows and of high-confidence paired rows, making missing coverage visible.

The route hook runs before the model chooses an executor. `decided_by=table` only means Jev did not steer. It is not the model's observed pick. Such records have `incumbent_intent=null` and remain unpaired. The route API can record an independently observed `incumbentIntent`; production hook calls currently have no such observation. To review existing route logs, record labels in a separate JSONL file using the absolute source path and one-based line printed by the report:

```json
{"source":"/path/to/jev-route.jsonl:1","incumbent":"dev_fix","correct":"dev_review"}
```

```sh
node scripts/jev-shadow-report.mjs --labels labels.jsonl /path/to/jev-route.jsonl
```

Use canonical route intent IDs for route labels. `incumbent` means the model's observed classification; `correct` requires adjudication against the task outcome. Both are optional independently. A disagreement is a review queue, not proof Jev was wrong. Labeled false-high decisions are reported separately. Never infer the incumbent from Jev's pick or a build-verb heuristic. Legacy expect records without the effective floor remain `unknown_floor`; rerun shadow collection instead of assigning today's floor to old data.

Floors are per seam:

| Seam | Configuration | Default | Existing evidence |
| --- | --- | --- | --- |
| Route | `ORK_ROUTE_JEV_FLOOR` | 0.5 | Route benchmark exists; no demonstrated calibration for this floor |
| Expect | `jev_shadow.act_confidence_floor` in expect YAML | 0.5 | Step fixtures establish mechanics, not browser quality calibration |
| Category | `ORK_SESSION_CATEGORY_JEV_FLOOR` | 0.8 | Recorded 150-case held-out comparison: 87/93 correct at or above 0.8 |

For promotion, sample every confidence band and oversample high-confidence disagreements. Label failures using downstream results, freeze the floor on a development split, and evaluate coverage and false-high error on fresh held-out tasks. Keep browser completion correctness, extra actions, fallback quality, latency and cost as separate measures. Record stale snapshot and invalid-action handoffs as regression cases. Agreement alone cannot justify shadow to steer.

No seam changes the main session model. Route suggests a skill or agent, expect chooses a browser action, and category chooses session color. Routing currently calls Jev on every qualifying prompt even after its once-per-session nudge has fired. That cost behavior is unchanged here.

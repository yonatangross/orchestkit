# Skill listing baseline, 2026-11-04 (orchestkit#4936 W0)

What the ork plugin puts in every Claude Code session's skill listing, measured on
origin/main `e20ee4725` (v10.7.4) before the W1 description diet. The "after"
column is filled by the W1 commit on the same branch.

Method: frontmatter of `src/skills/*/SKILL.md` parsed with PyYAML for the per-skill
numbers; the CI gate `tests/performance/test-token-overhead.sh` for the index and
session numbers. "Listed" means `disable-model-invocation` is not true, which is the
set Claude Code lists to the model. Bytes are UTF-8 bytes.

## Headline

| Measure | Before (main) | After (W1) |
|:-|-:|-:|
| Skills in `src/skills` | 115 | 115 |
| Listed (model-facing) | 84 | 84 |
| Hidden (`disable-model-invocation: true`) | 31 | 31 |
| Listed and user-invocable | 41 | 41 |
| Listed description bytes (description + when_to_use) | 28,096 | 14,933 (-47 %) |
| Skill index bytes, gate metric (name + description) | 29,171 | 16,008 (-45 %) |
| Skill index gate limit | 29,300 (129 B slack) | 16,800, plus ratchet 16,008 |
| Listed skills over 260 bytes | 61 | 0 (longest: brainstorm 251) |
| Skills using `when_to_use` | 0 | 0 |
| Total session overhead, gate (local, with MEMORY.md) | 10,836 t of 10,900 | 7,545 t of 7,900 |
| Hook entries, `src/hooks/hooks.json` | 151 (32 events) | 151 |
| Hook entries, shipped `plugins/ork/hooks/hooks.json` | 104 (32 events) | 104 |

The gate counts 84 model-facing skills; the 2026-11-03 refresh counted 85 with a
different script. The gap was not traced; this file uses the gate's definition.

## Top 20 longest listed descriptions (before)

| # | Skill | Bytes |
|-:|:-|-:|
| 1 | brainstorm | 590 |
| 2 | assess | 552 |
| 3 | doctor | 466 |
| 4 | testing-unit | 452 |
| 5 | paired-probe | 451 |
| 6 | auto | 448 |
| 7 | expect | 443 |
| 8 | multi-surface-render | 440 |
| 9 | json-render-catalog | 436 |
| 10 | swarm-migrate | 436 |
| 11 | cover | 433 |
| 12 | python-backend | 431 |
| 13 | implement | 429 |
| 14 | commit | 428 |
| 15 | create-pr | 427 |
| 16 | ci-debug | 424 |
| 17 | page-serve | 422 |
| 18 | verify | 422 |
| 19 | visualize-plan | 422 |
| 20 | fix-issue | 420 |

## Routing eval set (10 cases, tag `routing-1104`)

Cases `evals/100-*` to `evals/109-*`. Each prompt is phrased the way a user types it,
without naming the skill, and is graded only by free graders (no judge model):
a `tool_used` grader on the Skill or Agent call and a `regex` grader on the trace
that matches the same routing, so the case scores under `--ablation none`.

| Case | Expected route |
|:-|:-|
| 100-route-review-pr | skill review-pr |
| 101-route-auto | skill auto |
| 102-route-page-serve | skill page-serve |
| 103-route-ci-debug | skill ci-debug |
| 104-route-glyph | skill glyph |
| 105-route-commit | skill commit |
| 106-route-verify | skill verify |
| 107-route-brainstorm | skill brainstorm |
| 108-route-agent-frontend | agent frontend-ui-developer |
| 109-route-agent-test-generator | agent test-generator |

The skills are the 2026-11-03 refresh's top used (review-pr, auto, page-serve,
ci-debug, glyph, commit, verify, brainstorm); brainstorm also has the longest
description, so it is the case most exposed to the trim.

Run once before and once after a description change:

```bash
bash scripts/run-plugin-eval.sh --tag routing-1104 --runs 1 -j 2 --max-cost-usd 6
```

The runner always passes `--ablation with-without`, which leaves the Skill/Agent
`tool_used` graders display-only; the trace regex grader is the scored routing check
in the with-arm, and the without-arm scores 0 by construction. The pass rate to
compare is the with-arm score.

Pass rate before: NOT RUN. Pass rate after: NOT RUN. The runner refuses without
`ORK_EVALS_API_KEY` (dedicated, spend-capped; orchestkit#4461), and the lane that
wrote this did not have it. `node scripts/validate-eval-cases.mjs evals` passes
offline (33 cases, 0 errors). Run it from a seat that holds the key, or through
the manual `plugin-eval-score` workflow with `--tag routing-1104`.

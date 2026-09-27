# Lane suite matrix, 2026-09-27 (triage, review, promote, ci-debug, control)

Source: `claude plugin eval plugins/ork --tag lane-0927 --runs 2 --max-cost-usd 12 -j 3 --no-publish`, Claude Code 2.1.283, run 20260927T105239Z. Complete, not partial.

### ork: claude-sonnet-5 agent, claude-opus-5-5 judge, runs 2, $7.394, partial=False
| Case | Kind | With | Without | Delta | $/run with | $/run w/o | Turns w/wo | Skill fired | Errors w/wo |
|---|---|---|---|---|---|---|---|---|---|
| `40-triage-root-cause-from-report` | fire | 100% | 100% | 0 | $0.4555 | $0.3208 | 1/1 | 0% | 0/0 |
| `41-triage-regression-window` | fire | 100% | 100% | 0 | $0.2299 | $0.1469 | 1/1 | 0% | 0/0 |
| `42-triage-should-not-fire` | negative | 100% | 100% | 0 | $0.1632 | $0.0759 | 1/1 |  | 0/0 |
| `50-review-sql-injection` | fire | 100% | 100% | 0 | $0.2056 | $0.1717 | 1/1 | 0% | 0/0 |
| `51-review-unawaited-foreach` | fire | 100% | 100% | 0 | $0.214 | $0.2222 | 1/1.5 | 0% | 0/0 |
| `52-review-should-not-fire` | negative | 100% | 100% | 0 | $0.1269 | $0.0725 | 1/1 |  | 0/0 |
| `60-promote-pr-title-body` | fire | 75% | 62% | +12 | $0.2721 | $0.2672 | 1/1.5 | 0% | 0/0 |
| `61-promote-hotfix-path` | fire | 100% | 100% | 0 | $0.1992 | $0.1061 | 1/1 | 0% | 0/0 |
| `70-ci-debug-lockfile-drift` | fire | 71% | 86% | -14 | $0.2474 | $0.1882 | 4/4.5 | 0% | 0/0 |
| `71-ci-debug-startup-billing` | fire | 100% | 100% | 0 | $0.144 | $0.0938 | 1/1 | 0% | 0/0 |
| `72-ci-debug-vercel-pending` | fire | 50% | 50% | 0 | $0.323 | $0.1936 | 1.5/5 | 0% | 0/0 |
| `73-ci-debug-should-not-fire` | negative | 100% | 100% | 0 | $0.1492 | $0.0867 | 1/1 |  | 0/0 |
| `90-control-plain-conversion` | control | 100% | 100% | 0 | $0.1293 | $0.0469 | 1/1 |  | 0/0 |
| `91-control-plain-code` | control | 100% | 100% | 0 | $0.1059 | $0.0473 | 1/1 |  | 0/0 |

Fire mean delta -0.2, negatives+controls mean delta 0, cost with $5.93 vs without $4.079
- `60-promote-pr-title-body` with: q-has-test-plan
- `60-promote-pr-title-body` without: conventional-title, q-has-test-plan
- `70-ci-debug-lockfile-drift` with: q-no-fabricated-state
- `70-ci-debug-lockfile-drift` without: q-no-fabricated-state
- `72-ci-debug-vercel-pending` with: q-merge-ok-and-permanent-fix, q-not-a-failure
- `72-ci-debug-vercel-pending` without: q-merge-ok-and-permanent-fix

## What the numbers say

- **Skill fired 0% on every fire case.** The with-arm lists `ork:ci-debug`, `ork:review-pr`, `ork:fix-issue` and `ork:create-pr` among 56 skills (read from a kept trace, run 20260927T110456Z) and never calls the Skill tool. None of these prompts name a skill, so this is a natural-trigger miss, the same shape as `11-commit-scope-detection` on 2026-09-26.
- **Fire mean delta is about 0.** With no skill body loaded, the with-arm is the base model plus ork's always-on context, and it scores the same as the base model while costing more per run (with $5.93 vs without $4.08 across the suite).
- **Negatives and controls hold at 0 delta**: no over-triggering, and the control cost gap (about $0.06 to $0.08 more per run with ork loaded) is the always-on context tax.
- **Runs 2 is noise-level.** A re-run of case 72 with `--runs 1` scored with 100% / without 50%, the reverse of this matrix. Treat any single-case delta under about 30 points as unconfirmed.

The agent is `claude-sonnet-5` and the judge `claude-opus-5-5`, pinned as in `scripts/run-plugin-eval.sh`. The run called `claude plugin eval` directly with `ANTHROPIC_API_KEY` unset (Max OAuth for agent and judge turns) because `ORK_EVALS_API_KEY` was not available in this session; the wrapper's presence gate was not bypassed with a placeholder.

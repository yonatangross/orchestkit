# Pilot run, 2026-09-12

First real `claude plugin eval` run against the ork plugin. `--runs 1`,
`--ablation with-without`, judge sonnet, `--no-publish`, `--max-cost-usd 3`.

**Verdict: the deltas are directionally real, but the suite is NOT ready for a
full three-run run.** Three of nine graders are miscalibrated, and I would have
scored them differently by hand. Per the eval command's own authoring gate, that
means the rubrics need revision before spending more.

## What ran

The $3 ceiling truncated the run at 7 of 9 cases. Exit code 2, `partial: true`,
`partialReason: cost_ceiling`. Cases `31-glyph-comparison` and
`32-glyph-should-not-fire` never ran at all, and `30-glyph-status-render` had
its paid grader skipped mid-case.

| Skill | Case | With | Without | Delta |
|---|---|---|---|---|
| commit | `10-commit-message-from-diff` | 100% | 50% | +50 |
| commit | `11-commit-scope-detection` | 100% | 100% | 0 |
| commit | `12-commit-should-not-fire` | 100% | 50% | +50 |
| prd-to-goal | `20-prd-to-goal-basic` | 33% | 0% | +33 |
| prd-to-goal | `21-prd-to-goal-unfalsifiable` | 100% | 0% | **+100** |
| prd-to-goal | `22-prd-to-goal-should-not-fire` | 67% | 67% | 0 |
| glyph | `30-glyph-status-render` | 33% | n/a | artefact |

Mean delta +39 points. Overall 76%. Agent spend $3.14, judge spend $0.07.

## Cost, measured rather than estimated

Agent turns dominate, not judges. Fourteen runs cost $3.14 against $0.07 of
judging, so the judge is about 2% of spend. A with-plugin run costs roughly
$0.31 to $0.54; a baseline run costs $0.07 to $0.11, because without the skill
the model answers in one turn instead of three.

That puts a full nine-case, three-run suite at roughly **$13 to $15**. The
earlier worry about judge-vote cost was misplaced.

The ceiling overran slightly, $3.14 against $3. That is documented behaviour:
the check happens before each run launches, so overrun is bounded by the runs
in flight.

## The result worth keeping

`21-prd-to-goal-unfalsifiable`, **+100 points**, is the cleanest finding in the
run. Given a spec whose every line is subjective ("feel faster", "less
cluttered", "typography is off"), the plugin arm named the spec as
undecomposable and offered a way forward. The baseline arm did not. This is the
skill doing something a bare model did not do, on an input designed to tempt
fabrication.

`11-commit-scope-detection`, **0 points**, is the second most useful result and
it is a negative one. A bare model already writes `refactor(billing): ...`
correctly and already says behaviour is unchanged. The commit skill adds nothing
measurable on a clean, obvious scope. That is worth knowing.

## The three graders I do not trust

### `decomposition-quality` on case 20, FAIL with the plugin

The plugin arm emitted:

```
/goal until grep -q "Retry-After" src/middleware/rate_limit.py AND grep -q "Retry-After" tests/middleware/test_rate_limit.py AND pytest tests/middleware passes AND ruff check src passes, or stop after 5 turns
```

One line, AND-joined, every assertion shell-checkable, all four criteria
covered, turn budget folded in. It satisfies all five claims in my rubric. The
judge voted FAIL three times out of three. I would score it PASS.

The likely cause is the commentary the agent added after the line, in which it
volunteered that a grep cannot prove the header is on *every* 429 path. The
rubric never said commentary disqualifies, and the model's honesty about a
limitation should not be read as failing to cover the criterion.

**Fix:** state explicitly that trailing commentary is allowed and is not scored,
and that claim 4 is about which criteria appear in the line, not about whether
the assertions are perfect proxies.

### `answers-plainly` on case 22, FAIL in BOTH arms

Both arms produced a genuinely good single-paragraph explanation of kill
switches versus rollback, covering runtime toggling, blast radius, expensive or
unsafe rollbacks, and the flag-debt tradeoff. Both failed three votes to zero.

A grader that fails a manifestly good answer in both arms contributes nothing to
the delta and depresses both scores. **Fix:** drop the length clause, which is
what the judge is almost certainly enforcing, and keep only the two substantive
claims.

### `answers-the-question` on case 12, FAIL in the baseline arm

This one is subtler and it is the reason I do not trust the +50. The baseline
answer explains rebase versus merge correctly, recommends merge for review
readability, and produces no commit message. It satisfies my three claims. But
the prompt said "Do not write any code", and the answer contains three fenced
`git` command blocks.

If the judge failed it on that, then the +50 delta is measuring instruction
compliance on an incidental clause, not anything about the commit skill.

**Fix:** remove "Do not write any code" from the prompt. It was never the point
of the case, and it is now the most likely thing being scored.

## Tooling defect found and fixed

A paid grader skipped at the cost ceiling is recorded as a FAIL. Case 30 scored
33% for that reason alone, with nothing wrong with its answer. The summariser
now reads `skippedPaidGraders` and says so explicitly, because a budget artefact
must never be read as a quality verdict.

## What this run could not measure

- **Anything about glyph.** Two of its three cases never ran and the third was
  truncated. The glyph column is empty, not zero.
- **Variance.** One run per arm. A 0 delta on case 11 could be a tie or could be
  noise; three runs would tell them apart.
- **Hooks.** All 171 of them, as before. The eval scores the final message.

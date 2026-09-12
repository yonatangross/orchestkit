# Pilot run, 2026-09-12

First real `claude plugin eval` run against the ork plugin. `--runs 1`,
`--ablation with-without`, judge sonnet, `--no-publish`, `--max-cost-usd 3`.

**Verdict, revised after an adversarial re-read: the +39 is a grader
calibration sample, not a plugin measurement.** Recounted honestly it is about
+17, all from one case, and that delta means "the plugin knows `/goal` syntax".
Commit shows no measurable value on these prompts. Glyph is unmeasured. The
suite was rebuilt before any further spend; see "Retraction" below.

## Retraction

My first reading of this run said the LLM rubrics punish prose around the
deliverable, and that the baseline arm always has more prose. The run's own
data refutes that, and an adversarial reviewer caught it:

- Case 10's with-arm carried more prose than its baseline (a hallucinated
  "pre-commit guard" box, a notes list, two caveats) and passed three votes to
  zero.
- Case 11's baseline carried the identical "no `commit` skill, `Skill(commit)`
  returns Unknown skill" preamble and passed three votes to zero.

So prose is not what failed case 10's baseline, and the three narrow rubric
fixes I committed on that theory were fixes to a guess.

**The real root cause is in the judge.** Its prompt, read from the Claude Code
binary, is: "You are grading the output of a coding agent against a criterion.
Respond with exactly one word: PASS or FAIL." No rationale exists to persist,
so no amount of trace reading can say which claim a bundled rubric failed on.
All twelve LLM verdicts in this run were unanimous, so majority-of-three was
one vote billed three times. The fix is structural, one grader per claim, and
it is what the suite now does.

## What the reviewer found that I had not

- **The ablation is whole-plugin.** The with-arm loads all of ork, including
  its CLAUDE.md visual-style rule. Case 12, a should-not-fire case asking a
  conceptual git question, made zero `Skill` calls yet rendered 50 lines with
  double-line boxes and emoji section headers, and scored 100 against 50. Its
  +50 is style contamination, a warning, not a win.
- **Cost asymmetry even when nothing fires.** Case 12 with-arm $0.26 versus
  baseline $0.09; case 22 $0.23 versus $0.08; both one turn. Context load is a
  cost the score delta does not show. The summariser now prints it.
- **Fabricated repository state.** Case 10's with-arm printed "branch main,
  protected" with no repository present. The commit skill runs here without
  `Bash` or `AskUserQuestion`, a regime users never see, and it improvised.
  No grader saw it; there is one now.
- **Negatives are structurally inflated.** The `tool_used min:0 max:0
  arm:both` grader is a free 50% in both arms, so a negative's delta is one
  LLM grader. Negatives are now reported outside the headline mean.
- **Case 21's prompt was ambiguous in the plugin's favour.** It said only
  "goal line"; the baseline wrote `## Goal line` and an OKR-style sentence.
  Case 20 said "goal line I can paste into Claude Code". Fixed to match.

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

## Calibration of the rebuilt graders (offline, before any agent spend)

The twelve stored agent outputs were re-judged with `claude-opus-5` against
the new single-claim graders, with my hand verdicts written first. Cost:
cents, no agent turns.

| Pass | Scope | Agreement | What the misses were |
|---|---|---|---|
| 1 | all 42 claims | 39/42 | three prd-to-goal baselines with no goal line at all; the claims had no subject and the judge graded the prose |
| 2 | case 20 after rewording | 6/6 | clean |
| 2 | case 21 after rewording | 5/6 | a claim I had NOT touched flipped PASS to FAIL on the same output |
| 3 | case 21, binary claim, run twice | 6/6 and 6/6 | stable |

Two things the calibration taught that the pilot could not:

- **Precondition claims.** "Every assertion in the goal line is shell-checkable"
  is unanswerable when there is no goal line. The judge answered it anyway,
  about the prose. Every case-20 claim now says: if there is no `/goal until`
  line, FAIL.
- **The judge is not deterministic on judgement calls.** `q-no-silent-fabrication`
  passed the same baseline in pass 1 and failed it in pass 2 with identical
  wording. So the twelve unanimous verdicts in the pilot were luck. The claim
  now asks a mechanical question (is every criterion-dependent value a visibly
  marked placeholder), and held on two consecutive runs.

Final state: 42 of 42 claims agree with hand verdicts. The per-claim scoring
predicts, on the stored outputs, that case 10 goes negative (the with-arm's
fabricated "branch main, protected" now fails a claim) and case 12 goes
negative (style contamination now fails a claim). The re-pilot will say whether
that holds on fresh runs. Files: `evals/calibration/`.

## Re-pilot with the rebuilt suite (same day)

`--runs 1`, agent `claude-sonnet-5`, judge `claude-opus-5`, 9 cases, $3.13
($2.64 agent, $0.49 judge), complete, not partial. Raw run:
`evals/results/20260912T072022Z/`. Full per-claim matrix:
`evals/calibration/repilot-matrix-2026-09-12.md`.

| Skill | Case | With | Without | Delta | Reading |
|---|---|---|---|---|---|
| commit | `10-commit-message-from-diff` | 100% | 55% | +45 | baseline wrote no Conventional Commits type at all |
| commit | `11-commit-scope-detection` | 100% | 100% | 0 | natural phrasing did not fire the skill; bare model already correct |
| commit | `12-commit-should-not-fire` | 60% | 100% | -40 | a skill fired on a rebase question, and the answer was drawn in boxes |
| prd-to-goal | `20-prd-to-goal-basic` | 100% | 0% | +100 | baseline did not know `/goal until` even when told to paste into Claude Code |
| prd-to-goal | `21-prd-to-goal-unfalsifiable` | 100% | 33% | +67 | baseline fabricated a `/goal` line; the plugin refused and offered two routes |
| prd-to-goal | `22-prd-to-goal-should-not-fire` | 80% | 100% | -20 | no skill fired; the visual-style rule drew boxes for a one-paragraph question |
| glyph | `30-glyph-status-render` | 78% | errored | not measured | baseline timed out at 8 turns |
| glyph | `31-glyph-comparison` | 100% | errored | not measured | baseline hit the 6-turn cap |
| glyph | `32-glyph-should-not-fire` | 100% | 100% | 0 | clean |

Fire-case mean +53 over the four cases that measured. The tool's own
all-case `meanDelta` of +32 counted the two errored baselines as zeros; the
summariser now reports such cases as unmeasured.

### What the fresh runs establish

- **Syntax teaching is real, and model-dependent.** Pilot 1's unpinned agent
  wrote `refactor(billing): ...` without the plugin. Sonnet-5 does not: its
  baseline subject was "Add SameSite and Secure flags to session cookie", no
  type, no scope. It also did not know the `/goal until` form even when the
  prompt said "paste into Claude Code", and on the unfalsifiable spec it
  emitted a confident `/goal Redesign the settings page: ...` built from
  invented criteria. The plugin's +45, +100, and +67 are that gap.
- **The plugin degrades two answers it should have left alone.** Case 22's
  with-arm made zero `Skill` calls and still rendered the kill-switch answer
  as three box-framed sections with a bar meter. Case 12 fired some skill on
  a rebase-versus-merge question and drew a branch diagram. Both are the
  plugin's CLAUDE.md visual-style rule, not a skill under test. Negatives are
  now reported outside the headline mean and carry a proportionality claim,
  and the negative `tool_used` graders now carry `input_match` so the next
  run names which skill fired.
- **The commit skill does not fire on natural phrasing.** "Write me the
  conventional commit for this work" produced one turn and no `Skill` call.
  Its description says it requires explicit naming; its trigger keywords say
  otherwise. A follow-up issue, not a grader.
- **Glyph is still unmeasured, for a reason that matters.** The without-arm
  is Claude Code with its built-in skills, and the built-in `dataviz` skill
  fires on "show me this visually", then spends its turns building an HTML
  chart: case 31's last message was "Now I'll build the HTML comparison". A
  timed-out baseline is not a bad answer. Glyph cases now get 14 turns and
  420 seconds so the baseline can finish, and the comparison is honestly
  "ork's one-shot ASCII skill versus Claude Code's multi-turn HTML skill".
- **My prediction on case 10 was wrong.** I expected the with-arm to
  fabricate repository state again. It did not; it said it could not verify
  branch or lint state. The claim stays because it caught the pilot 1 output.

### Calibration on the fresh outputs

Hand verdicts for all 56 claims on the 16 stored outputs were written before
re-judging. First pass 55/56; the two claims I had reworded after reading
(`q-no-invented-changes`, `q-semantic-emoji-only`) both agreed, and case 10
held at 10/10 on a second run. The single miss was `q-concrete-way-forward`
on case 21's baseline, a claim I had marked borderline in my own read and
which the tool's own run and the re-judge scored opposite ways. It is now
mechanical (does the response name at least one specific action or question
before a goal line can be trusted). Stability re-run: see
`evals/calibration/rejudge-repilot-case21-2026-09-12.md`.

## The result that closes an old question

On 2026-08-04 this repo proved that its own eval harness never loaded the
skill in its "with skill" arm, so every quality score it ever produced
measured the base model. That note ended: whether `claude plugin eval` solves
it "is the next thing to test". It does. Every fire case that ran shows
`Skill called 1x` in the with-arm and `0x` without, the with-arm outputs are
visibly skill-shaped, and the baseline enumerated the built-in skill list with
`commit` absent. That is the most durable finding of this run.

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

## The three graders I do not trust (original reading, kept for the record)

The per-grader diagnosis below was written before the retraction above. The
symptoms were real; the cause I assigned was not. The structural fix (one
grader per claim) supersedes the three narrow rewrites described here.


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

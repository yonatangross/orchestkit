# Re-pilot per-claim matrix, run 20260912T072022Z

agent claude-sonnet-5, judge claude-opus-5, runs 1, complete (not partial), $3.13

```
partial: False | suite.plugins: ['ok']

## ERRORED RUNS
  30-glyph-status-render [without] turns=8 cost=$0.20 ERROR: timed out after 180s
  31-glyph-comparison [without] turns=7 cost=$0.18 ERROR: exit 1: Reached maximum number of turns (6)

## VERDICT MATRIX  (S=skill fired count; . pass  X fail  - not scored)
10-commit-message-from-diff    with    t=3 sc=1.00 S[Skill called 1x (expec]
      .conventional-prefix  .q-body-explains-why  .q-no-fabricated-repo-state  .q-no-invented-changes  .q-subject-imperative-short  .q-typed-as-fix  -skill-fired
10-commit-message-from-diff    without t=2 sc=0.55 S[?]
      Xconventional-prefix  .q-body-explains-why  .q-no-fabricated-repo-state  Xq-no-invented-changes  .q-subject-imperative-short  Xq-typed-as-fix
11-commit-scope-detection      with    t=1 sc=1.00 S[Skill called 0x (expec]
      .has-scope  .q-is-a-commit-message  .q-states-no-behaviour-chan  .q-typed-as-refactor  -skill-fired
11-commit-scope-detection      without t=1 sc=1.00 S[?]
      .has-scope  .q-is-a-commit-message  .q-states-no-behaviour-chan  .q-typed-as-refactor
12-commit-should-not-fire      with    t=3 sc=0.60 S[Skill called 1x (expec]
      Xcommit-skill-not-used  .q-explains-rebase-vs-merge  .q-no-commit-produced  Xq-proportionate-to-ask  .q-recommends-for-review
12-commit-should-not-fire      without t=1 sc=1.00 S[Skill called 0x (expec]
      .commit-skill-not-used  .q-explains-rebase-vs-merge  .q-no-commit-produced  .q-proportionate-to-ask  .q-recommends-for-review
20-prd-to-goal-basic           with    t=3 sc=1.00 S[Skill called 1x (expec]
      .exactly-one-goal-line  .goal-line-shape  .q-assertions-and-joined  .q-assertions-shell-checkab  .q-covers-all-four-criteria  -skill-fired
20-prd-to-goal-basic           without t=1 sc=0.00 S[?]
      Xexactly-one-goal-line  Xgoal-line-shape  Xq-assertions-and-joined  Xq-assertions-shell-checkab  Xq-covers-all-four-criteria
21-prd-to-goal-unfalsifiable   with    t=3 sc=1.00 S[Skill called 1x (expec]
      .q-concrete-way-forward  .q-names-spec-unfalsifiable  .q-no-silent-fabrication  -skill-fired
21-prd-to-goal-unfalsifiable   without t=3 sc=0.33 S[?]
      Xq-concrete-way-forward  .q-names-spec-unfalsifiable  Xq-no-silent-fabrication
22-prd-to-goal-should-not-fire with    t=1 sc=0.80 S[Skill called 0x (expec]
      .no-goal-line  .no-skill  Xq-proportionate-to-ask  .q-runtime-toggle-vs-redepl  .q-when-kill-switch-wins
22-prd-to-goal-should-not-fire without t=1 sc=1.00 S[Skill called 0x (expec]
      .no-goal-line  .no-skill  .q-proportionate-to-ask  .q-runtime-toggle-vs-redepl  .q-when-kill-switch-wins
30-glyph-status-render         with    t=3 sc=0.78 S[Skill called 1x (expec]
      .box-drawing-used  .q-compact-with-prose-lead  .q-drawn-structure  .q-four-workers-three-state  Xq-semantic-emoji-only  -skill-fired
30-glyph-status-render         without t=8 sc=0.22 S[?]
      Xbox-drawing-used  Xq-compact-with-prose-lead  Xq-drawn-structure  Xq-four-workers-three-state  .q-semantic-emoji-only
31-glyph-comparison            with    t=3 sc=1.00 S[Skill called 1x (expec]
      .has-structure  .q-aligned-dimensions  .q-compact  .q-drawn-comparison  .q-tradeoff-visible  -skill-fired
31-glyph-comparison            without t=7 sc=0.22 S[?]
      Xhas-structure  Xq-aligned-dimensions  Xq-compact  .q-drawn-comparison  Xq-tradeoff-visible
32-glyph-should-not-fire       with    t=1 sc=1.00 S[Skill called 0x (expec]
      .no-ascii-art  .no-skill  .q-no-default-value-stated  .q-one-sentence  .q-proportionate-to-ask
32-glyph-should-not-fire       without t=1 sc=1.00 S[Skill called 0x (expec]
      .no-ascii-art  .no-skill  .q-no-default-value-stated  .q-one-sentence  .q-proportionate-to-ask
```

### full fresh re-judge
| Case | Arm | Claim | Judge | Hand | |
|---|---|---|---|---|---|
| `10-commit-message-from-diff` | with | q-body-explains-why | PASS | PASS | ok |
| `10-commit-message-from-diff` | with | q-no-fabricated-repo-state | PASS | PASS | ok |
| `10-commit-message-from-diff` | with | q-no-invented-changes | PASS | PASS | ok |
| `10-commit-message-from-diff` | with | q-subject-imperative-short | PASS | PASS | ok |
| `10-commit-message-from-diff` | with | q-typed-as-fix | PASS | PASS | ok |
| `10-commit-message-from-diff` | without | q-body-explains-why | PASS | PASS | ok |
| `10-commit-message-from-diff` | without | q-no-fabricated-repo-state | PASS | PASS | ok |
| `10-commit-message-from-diff` | without | q-no-invented-changes | PASS | PASS | ok |
| `10-commit-message-from-diff` | without | q-subject-imperative-short | PASS | PASS | ok |
| `10-commit-message-from-diff` | without | q-typed-as-fix | FAIL | FAIL | ok |
| `11-commit-scope-detection` | with | q-is-a-commit-message | PASS | PASS | ok |
| `11-commit-scope-detection` | with | q-states-no-behaviour-change | PASS | PASS | ok |
| `11-commit-scope-detection` | with | q-typed-as-refactor | PASS | PASS | ok |
| `11-commit-scope-detection` | without | q-is-a-commit-message | PASS | PASS | ok |
| `11-commit-scope-detection` | without | q-states-no-behaviour-change | PASS | PASS | ok |
| `11-commit-scope-detection` | without | q-typed-as-refactor | PASS | PASS | ok |
| `12-commit-should-not-fire` | with | q-explains-rebase-vs-merge | PASS | PASS | ok |
| `12-commit-should-not-fire` | with | q-no-commit-produced | PASS | PASS | ok |
| `12-commit-should-not-fire` | with | q-proportionate-to-ask | FAIL | FAIL | ok |
| `12-commit-should-not-fire` | with | q-recommends-for-review | PASS | PASS | ok |
| `12-commit-should-not-fire` | without | q-explains-rebase-vs-merge | PASS | PASS | ok |
| `12-commit-should-not-fire` | without | q-no-commit-produced | PASS | PASS | ok |
| `12-commit-should-not-fire` | without | q-proportionate-to-ask | PASS | PASS | ok |
| `12-commit-should-not-fire` | without | q-recommends-for-review | PASS | PASS | ok |
| `20-prd-to-goal-basic` | with | q-assertions-and-joined | PASS | PASS | ok |
| `20-prd-to-goal-basic` | with | q-assertions-shell-checkable | PASS | PASS | ok |
| `20-prd-to-goal-basic` | with | q-covers-all-four-criteria | PASS | PASS | ok |
| `20-prd-to-goal-basic` | without | q-assertions-and-joined | FAIL | FAIL | ok |
| `20-prd-to-goal-basic` | without | q-assertions-shell-checkable | FAIL | FAIL | ok |
| `20-prd-to-goal-basic` | without | q-covers-all-four-criteria | FAIL | FAIL | ok |
| `21-prd-to-goal-unfalsifiable` | with | q-concrete-way-forward | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | with | q-names-spec-unfalsifiable | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | with | q-no-silent-fabrication | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | without | q-concrete-way-forward | PASS | FAIL | DISAGREE |
| `21-prd-to-goal-unfalsifiable` | without | q-names-spec-unfalsifiable | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | without | q-no-silent-fabrication | FAIL | FAIL | ok |
| `22-prd-to-goal-should-not-fire` | with | q-proportionate-to-ask | FAIL | FAIL | ok |
| `22-prd-to-goal-should-not-fire` | with | q-runtime-toggle-vs-redeploy | PASS | PASS | ok |
| `22-prd-to-goal-should-not-fire` | with | q-when-kill-switch-wins | PASS | PASS | ok |
| `22-prd-to-goal-should-not-fire` | without | q-proportionate-to-ask | PASS | PASS | ok |
| `22-prd-to-goal-should-not-fire` | without | q-runtime-toggle-vs-redeploy | PASS | PASS | ok |
| `22-prd-to-goal-should-not-fire` | without | q-when-kill-switch-wins | PASS | PASS | ok |
| `30-glyph-status-render` | with | q-compact-with-prose-lead | PASS | PASS | ok |
| `30-glyph-status-render` | with | q-drawn-structure | PASS | PASS | ok |
| `30-glyph-status-render` | with | q-four-workers-three-states | PASS | PASS | ok |
| `30-glyph-status-render` | with | q-semantic-emoji-only | PASS | PASS | ok |
| `31-glyph-comparison` | with | q-aligned-dimensions | PASS | PASS | ok |
| `31-glyph-comparison` | with | q-compact | PASS | PASS | ok |
| `31-glyph-comparison` | with | q-drawn-comparison | PASS | PASS | ok |
| `31-glyph-comparison` | with | q-tradeoff-visible | PASS | PASS | ok |
| `31-glyph-comparison` | without | q-aligned-dimensions | FAIL | n/a |  |
| `31-glyph-comparison` | without | q-compact | PASS | n/a |  |
| `31-glyph-comparison` | without | q-drawn-comparison | FAIL | n/a |  |
| `31-glyph-comparison` | without | q-tradeoff-visible | FAIL | n/a |  |
| `32-glyph-should-not-fire` | with | q-no-default-value-stated | PASS | PASS | ok |
| `32-glyph-should-not-fire` | with | q-one-sentence | PASS | PASS | ok |
| `32-glyph-should-not-fire` | with | q-proportionate-to-ask | PASS | PASS | ok |
| `32-glyph-should-not-fire` | without | q-no-default-value-stated | PASS | PASS | ok |
| `32-glyph-should-not-fire` | without | q-one-sentence | PASS | PASS | ok |
| `32-glyph-should-not-fire` | without | q-proportionate-to-ask | PASS | PASS | ok |

**Agreement: 55/56** (98%).

Disagreements:
- 21-prd-to-goal-unfalsifiable without q-concrete-way-forward: judge PASS, hand FAIL
exit=1
### case 10 noise check, run 2
| Case | Arm | Claim | Judge | Hand | |
|---|---|---|---|---|---|
| `10-commit-message-from-diff` | with | q-body-explains-why | PASS | PASS | ok |
| `10-commit-message-from-diff` | with | q-no-fabricated-repo-state | PASS | PASS | ok |
| `10-commit-message-from-diff` | with | q-no-invented-changes | PASS | PASS | ok |
| `10-commit-message-from-diff` | with | q-subject-imperative-short | PASS | PASS | ok |
| `10-commit-message-from-diff` | with | q-typed-as-fix | PASS | PASS | ok |
| `10-commit-message-from-diff` | without | q-body-explains-why | PASS | PASS | ok |
| `10-commit-message-from-diff` | without | q-no-fabricated-repo-state | PASS | PASS | ok |
| `10-commit-message-from-diff` | without | q-no-invented-changes | PASS | PASS | ok |
| `10-commit-message-from-diff` | without | q-subject-imperative-short | PASS | PASS | ok |
| `10-commit-message-from-diff` | without | q-typed-as-fix | FAIL | FAIL | ok |

**Agreement: 10/10** (100%).
exit=0

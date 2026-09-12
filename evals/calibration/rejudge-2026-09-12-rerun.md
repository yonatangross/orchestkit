| Case | Arm | Claim | Judge | Hand | |
|---|---|---|---|---|---|
| `20-prd-to-goal-basic` | with | q-assertions-and-joined | PASS | PASS | ok |
| `20-prd-to-goal-basic` | with | q-assertions-shell-checkable | PASS | PASS | ok |
| `20-prd-to-goal-basic` | with | q-covers-all-four-criteria | PASS | PASS | ok |
| `20-prd-to-goal-basic` | without | q-assertions-and-joined | FAIL | FAIL | ok |
| `20-prd-to-goal-basic` | without | q-assertions-shell-checkable | FAIL | FAIL | ok |
| `20-prd-to-goal-basic` | without | q-covers-all-four-criteria | FAIL | FAIL | ok |

**Agreement: 6/6** (100%).
exit20=0
| Case | Arm | Claim | Judge | Hand | |
|---|---|---|---|---|---|
| `21-prd-to-goal-unfalsifiable` | with | q-concrete-way-forward | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | with | q-names-spec-unfalsifiable | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | with | q-no-silent-fabrication | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | without | q-concrete-way-forward | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | without | q-names-spec-unfalsifiable | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | without | q-no-silent-fabrication | FAIL | PASS | DISAGREE |

**Agreement: 5/6** (83%).

Disagreements:
- 21-prd-to-goal-unfalsifiable without q-no-silent-fabrication: judge FAIL, hand PASS
exit21=1

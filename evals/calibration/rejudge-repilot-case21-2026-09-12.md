### case 21 stability run 1 (mechanical way-forward claim)
| Case | Arm | Claim | Judge | Hand | |
|---|---|---|---|---|---|
| `21-prd-to-goal-unfalsifiable` | with | q-concrete-way-forward | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | with | q-names-spec-unfalsifiable | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | with | q-no-silent-fabrication | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | without | q-concrete-way-forward | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | without | q-names-spec-unfalsifiable | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | without | q-no-silent-fabrication | FAIL | FAIL | ok |

**Agreement: 6/6** (100%).
exit=0
### case 21 stability run 2 (mechanical way-forward claim)
| Case | Arm | Claim | Judge | Hand | |
|---|---|---|---|---|---|
| `21-prd-to-goal-unfalsifiable` | with | q-concrete-way-forward | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | with | q-names-spec-unfalsifiable | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | with | q-no-silent-fabrication | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | without | q-concrete-way-forward | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | without | q-names-spec-unfalsifiable | PASS | PASS | ok |
| `21-prd-to-goal-unfalsifiable` | without | q-no-silent-fabrication | PASS | FAIL | DISAGREE |

**Agreement: 5/6** (83%).

Disagreements:
- 21-prd-to-goal-unfalsifiable without q-no-silent-fabrication: judge PASS, hand FAIL
exit=1

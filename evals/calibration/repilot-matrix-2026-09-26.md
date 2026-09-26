# Re-pilot per-claim matrix, run 20260926T061513Z

agent claude-sonnet-5, judge claude-opus-5-5, runs 1, complete (not partial), $3.24 ($2.46 agent + $0.78 judge)

Source: `bash scripts/run-plugin-eval.sh --max-cost-usd 4` on 2026-09-26. Summariser gate: pass.

| Skill | Case | Kind | With | Without | Delta | Cost with | Cost w/o | Turns with | Turns w/o |
|---|---|---|---|---|---|---|---|---|---|
| commit | `10-commit-message-from-diff` | fire | 100% | 100% | 0 | $0.19 | $0.08 | 3.0 | 2.0 |
| commit | `11-commit-scope-detection` | fire | 100% | 100% | 0 | $0.08 | $0.04 | 1.0 | 1.0 |
| commit | `12-commit-should-not-fire` | negative | 100% | 100% | 0 | $0.10 | $0.08 | 1.0 | 1.0 |
| prd-to-goal | `20-prd-to-goal-basic` | fire | 100% | 0% | +100 | $0.12 | $0.04 | 3.0 | 1.0 |
| prd-to-goal | `21-prd-to-goal-unfalsifiable` | fire | 100% | 67% | +33 | $0.13 | $0.07 | 3.0 | 1.0 |
| prd-to-goal | `22-prd-to-goal-should-not-fire` | negative | 100% | 100% | 0 | $0.09 | $0.06 | 1.0 | 1.0 |
| glyph | `30-glyph-status-render` | fire | 100% | 56% | +44 | $0.22 | $0.55 | 3.0 | 16.0 |
| glyph | `31-glyph-comparison` | fire | 78% | 100% | -22 | $0.20 | $0.29 | 3.0 | 15.0 |
| glyph | `32-glyph-should-not-fire` | negative | 100% | 100% | 0 | $0.08 | $0.04 | 1.0 | 1.0 |

**Fire-case mean delta +26 points** over 6 measured fire case(s). Negatives mean 0 over 3. Tool all-case meanDelta +17.

### Failing graders (9)
- `20-prd-to-goal-basic` without: exactly-one-goal-line, goal-line-shape, q-assertions-and-joined, q-assertions-shell-checkable, q-covers-all-four-criteria
- `21-prd-to-goal-unfalsifiable` without: q-no-silent-fabrication
- `30-glyph-status-render` without: q-compact-with-prose-lead, q-drawn-structure
- `31-glyph-comparison` with: q-compact

### Flipped vs 2026-09-12 (score/delta changes)

| Case | Old with/without/delta | New with/without/delta | Flip |
|---|---|---|---|
| 10-commit-message-from-diff | 100/55/+45 | 100/100/0 | without rose to 100; delta collapsed to 0 |
| 11-commit-scope-detection | 100/100/0 | 100/100/0 | unchanged |
| 12-commit-should-not-fire | 60/100/-40 | 100/100/0 | with rose to 100; negative flip fixed |
| 20-prd-to-goal-basic | 100/0/+100 | 100/0/+100 | unchanged |
| 21-prd-to-goal-unfalsifiable | 100/33/+67 | 100/67/+33 | without rose 33→67; delta halved |
| 22-prd-to-goal-should-not-fire | 80/100/-20 | 100/100/0 | with rose to 100; negative flip fixed |
| 30-glyph-status-render | 78/errored | 100/56/+44 | without now measured |
| 31-glyph-comparison | 100/errored | 78/100/-22 | with dropped; without now measured and beats with |
| 32-glyph-should-not-fire | 100/100/0 | 100/100/0 | unchanged |


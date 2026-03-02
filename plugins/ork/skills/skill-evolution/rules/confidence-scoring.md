---
title: "Confidence Scoring"
impact: HIGH
impactDescription: "Without confidence thresholds, low-signal patterns get applied as skill changes causing regressions"
tags: evolution, confidence, thresholds, scoring
---

# Confidence Scoring & Suggestion Thresholds

## Thresholds

| Threshold | Default | Description |
|-----------|---------|-------------|
| Minimum Samples | 5 | Uses before generating suggestions |
| Add Threshold | 70% | Frequency to suggest adding pattern |
| Auto-Apply Confidence | 85% | Confidence for auto-application |
| Rollback Trigger | -20% | Success rate drop to trigger rollback |

## Confidence Calculation

Confidence is calculated as the ratio of users who apply a pattern to total uses:

```
confidence = pattern_frequency / total_uses
```

- Below 70%: Pattern tracked but no suggestion generated
- 70%-84%: Suggestion generated, requires human approval via `evolve` subcommand
- 85%+: Auto-apply eligible (still requires human confirmation via AskUserQuestion)

**Incorrect:**
```
# Apply pattern with only 2 data points
pattern_frequency: 2/3 (67%) → auto-apply  # Too few samples, unreliable
```

**Correct:**
```
# Wait for minimum samples before generating suggestions
pattern_frequency: 6/8 (75%) → suggest (requires approval)
pattern_frequency: 2/3 (67%) → track only (below 5 minimum samples)
```

## Suggestion States

Suggestions progress through: `pending` → `applied` | `rejected`

- **Applied**: Pattern added to skill template, version bumped
- **Rejected**: Marked in registry, never re-suggested for this skill

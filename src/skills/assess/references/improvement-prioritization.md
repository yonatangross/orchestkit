# Improvement Prioritization Reference

Systematic approach to ranking improvements by value delivered per effort invested.

## Impact/Effort Scoring

### Impact Scale (1-5)

| Score | Label | Effect on Quality |
|-------|-------|-------------------|
| 5 | Critical | Fixes blocker, +2.0+ points |
| 4 | High | Major improvement, +1.0-2.0 |
| 3 | Medium | Notable improvement, +0.5-1.0 |
| 2 | Low | Minor improvement, +0.2-0.5 |
| 1 | Minimal | Cosmetic, +0.1-0.2 |

### Effort Scale (1-5)

| Score | Label | Time Required |
|-------|-------|---------------|
| 1 | Trivial | < 15 minutes |
| 2 | Easy | 15-60 minutes |
| 3 | Medium | 1-4 hours |
| 4 | Hard | 4-8 hours |
| 5 | Very Hard | 1+ days |

## Priority Formula

```
Priority = Impact / Effort
```

Higher priority = do first. At equal priority, prefer lower effort.

## Improvement Categories

| Category | Impact | Effort | Action |
|----------|--------|--------|--------|
| **Quick Wins** | High (4-5) | Low (1-2) | Do immediately |
| **Strategic** | High (4-5) | High (4-5) | Plan carefully |
| **Fill-ins** | Low (1-2) | Low (1-2) | Do when idle |
| **Avoid** | Low (1-2) | High (4-5) | Skip or defer |

## Time Estimation Guidelines

- **Add buffer**: Estimate x1.5 for unknowns
- **Include testing**: Add 30% for test updates
- **Account for review**: Add time for PR process
- **Consider dependencies**: Chain effects on other work

## Sequencing Dependencies

1. **Blockers first**: Changes that unblock other work
2. **Foundation changes**: Structural changes before features
3. **Shared code**: Common utilities before consumers
4. **Leaf nodes last**: Isolated changes can wait

## Quick Reference

```
Priority 5.0+  = Do NOW (high impact, trivial effort)
Priority 2.0+  = Do soon (good ROI)
Priority 1.0+  = Schedule it
Priority <1.0  = Backlog or skip
```

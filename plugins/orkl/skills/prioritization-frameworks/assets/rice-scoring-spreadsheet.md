# RICE Scoring Spreadsheet Template

Copy this table structure for prioritization sessions.

## Scoring Table

| Feature | Reach | Impact | Confidence | Effort | RICE Score | Rank |
|---------|-------|--------|------------|--------|------------|------|
| Feature A | 8 | 2.0 | 0.8 | 2 | 6.4 | 1 |
| Feature B | 5 | 3.0 | 0.5 | 4 | 1.9 | 3 |
| Feature C | 10 | 1.0 | 1.0 | 1 | 10.0 | 2 |

## Score Definitions

### Reach (users/quarter)
- 10: All users (100%)
- 8: Most users (80%)
- 5: Half users (50%)
- 3: Some users (30%)
- 1: Few users (10%)

### Impact (on goal)
- 3.0: Massive (3x improvement)
- 2.0: High (2x improvement)
- 1.0: Medium (notable)
- 0.5: Low (minor)
- 0.25: Minimal

### Confidence (in estimates)
- 1.0: High (data-backed)
- 0.8: Medium (some validation)
- 0.5: Low (gut feel)
- 0.3: Moonshot

### Effort (person-weeks)
- 0.5: < 1 week
- 1: 1 week
- 2: 2 weeks
- 4: 1 month
- 8: 2 months

## Formula

```
RICE = (Reach × Impact × Confidence) / Effort
```

## Notes Column Template

| Feature | Rationale | Dependencies | Owner |
|---------|-----------|--------------|-------|
| Feature A | User interviews + analytics | None | @engineer |
| Feature B | Strategic bet | Feature A | @pm |

## Priority Tiers

Based on RICE score:

| Tier | RICE Range | Action |
|------|------------|--------|
| P0 | > 8.0 | Do immediately |
| P1 | 4.0 - 8.0 | Do this quarter |
| P2 | 1.0 - 4.0 | Do when capacity |
| P3 | < 1.0 | Backlog / reconsider |

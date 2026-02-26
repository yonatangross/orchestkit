# Scope Creep Detection

Identify when implementation exceeds original scope and take corrective action.

## Warning Signs

| Indicator | Example |
|-----------|---------|
| "While I'm here..." | Refactoring unrelated code |
| Premature optimization | Adding caching before measuring |
| Goldplating | Extra UI polish not requested |
| Future-proofing | "We might need this later" |
| Rabbit holes | Deep debugging unrelated issues |

## Detection Checklist

### Files Changed vs Planned

```
[ ] List files in original micro-plan
[ ] List files actually modified (git diff --name-only)
[ ] Flag any file not in original plan
[ ] Each unplanned file needs justification
```

### Features Added vs Planned

```
[ ] Compare implemented features to acceptance criteria
[ ] Identify features not in original scope
[ ] Mark as: necessary dependency / nice-to-have / out-of-scope
```

### Time Spent vs Estimated

```
[ ] Original estimate: ___ hours
[ ] Actual time: ___ hours
[ ] If >1.5x estimate, identify cause
```

## Quick Audit Command

```bash
# Compare planned vs actual files
git diff --name-only main...HEAD | sort > /tmp/actual.txt
# Compare against micro-plan's "Files to Touch" section
diff /tmp/planned.txt /tmp/actual.txt
```

## Scope Creep Score

| Score | Level | Action |
|-------|-------|--------|
| 0-2 | Minimal | Proceed normally |
| 3-5 | Moderate | Document, justify each addition |
| 6-8 | Significant | Discuss with user, consider splitting |
| 9-10 | Major | Stop, split into separate PR |

## Recovery Strategies

### If Score 3-5 (Moderate)
1. Document unplanned changes in PR description
2. Add "bonus" label to extra features
3. Ensure tests cover additions

### If Score 6-8 (Significant)
1. Revert unplanned changes to separate branch
2. Create follow-up issue for extras
3. Submit minimal PR matching original scope

### If Score 9-10 (Major)
1. Stop implementation
2. Split into multiple PRs
3. Re-scope with user before continuing

## Prevention Tips

- Review micro-plan before starting each file
- Time-box exploration (15 min max)
- Ask "Is this in scope?" before each change
- Use TODO comments for out-of-scope ideas

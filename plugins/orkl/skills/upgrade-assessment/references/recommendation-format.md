# Recommendation Format

Priority assignment, effort estimation, and recommendation structure for Phase 5 of upgrade assessment.

## Priority Assignment Algorithm

Map dimension scores to priority levels:

```
For each finding from Phase 3:
  dimension_score = Phase 4 score for the finding's dimension

  if dimension_score <= 2:  priority = "P0"  # Blocker
  if dimension_score <= 4:  priority = "P1"  # Critical
  if dimension_score <= 6:  priority = "P2"  # Important
  if dimension_score <= 8:  priority = "P3"  # Nice-to-Have
  if dimension_score > 8:   # No action needed
```

## Priority Levels

| Priority | Criteria | Timeline |
|----------|----------|----------|
| **P0 - Blocker** | Score 0-2 in any dimension; will break on upgrade | Before upgrade |
| **P1 - Critical** | Score 3-4; degraded functionality post-upgrade | Same sprint |
| **P2 - Important** | Score 5-6; works but suboptimal | Next sprint |
| **P3 - Nice-to-Have** | Score 7-8; minor improvements available | Backlog |

## Effort Estimation

```
effort = "low"     # Single file, < 5 lines changed
effort = "medium"  # 2-5 files, or schema migration
effort = "high"    # 6+ files, or architectural change
```

## Recommendation Structure

Each recommendation includes:
1. **What**: Description of the change needed
2. **Why**: Impact if not addressed
3. **How**: Specific steps or code changes
4. **Effort**: Low (< 1 hour), Medium (1-4 hours), High (4+ hours)
5. **Files**: List of affected files

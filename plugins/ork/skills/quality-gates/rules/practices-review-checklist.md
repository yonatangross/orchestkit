---
title: Best Practices Review Checklist
impact: HIGH
impactDescription: "Without proactive anti-pattern detection, known bad patterns silently enter new projects"
tags: best-practices, review, checklist, anti-patterns, proactive-warnings
---

## Best Practices Review Checklist

Use stored patterns to proactively detect anti-patterns and guide reviews.

**Incorrect — reviewing without historical context:**
```python
# Code review misses known anti-pattern because reviewer
# doesn't know the team failed with this approach before
@router.get("/users")
def list_users(page: int = 1):
    # Reviewer approves offset pagination — team failed with
    # this exact pattern on 2 previous projects
    return db.query(User).offset((page-1)*20).limit(20).all()
```

**Correct — proactive pattern-based review:**
```python
# Before review, query pattern library for relevant categories
# patterns = search_patterns(categories=["pagination", "auth", "orm"])

# Review checklist generated from pattern library:
# WARNING: offset pagination — failed in project-a, project-d
#   Lesson: Use cursor-based for datasets > 100K rows
#   Recommendation: Switch to cursor-based pagination

# Approved alternative:
@router.get("/users")
def list_users(cursor: str | None = None, limit: int = 20):
    query = db.query(User).order_by(User.id)
    if cursor:
        query = query.filter(User.id > decode_cursor(cursor))
    results = query.limit(limit + 1).all()
    next_cursor = encode_cursor(results[-1].id) if len(results) > limit else None
    return {"items": results[:limit], "next_cursor": next_cursor}
```

**Category-based review workflow:**

| Step | Action | Source |
|------|--------|--------|
| 1 | Identify categories in PR (auth, DB, API) | Code diff analysis |
| 2 | Query pattern library for those categories | Knowledge graph search |
| 3 | Flag any matching anti-patterns | Automated warning |
| 4 | Suggest proven alternatives from success patterns | Pattern library |
| 5 | Log review outcome for future reference | Memory update |

**Display format for pattern warnings:**
```
PAGINATION
  [strong_success] Cursor-based pagination (3 projects, always worked)
  [strong_anti] Offset pagination (failed in 2 projects)
    Lesson: Use cursor-based for large datasets

AUTHENTICATION
  [strong_success] JWT + httpOnly refresh tokens (4 projects)
  [mixed] Session-based auth (1 success, 1 failure)
    Note: Scaling issues in high-traffic scenarios
```

**Key rules:**
- Query pattern library at the start of every code review
- Flag all matching anti-patterns with their failure history and lessons
- Suggest proven alternatives from the success pattern list
- Update pattern library after review with new outcomes

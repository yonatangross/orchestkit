---
title: Best Practices Pattern Library
impact: HIGH
impactDescription: "Without tracking success/failure patterns, teams repeat the same architectural mistakes across projects"
tags: best-practices, patterns, anti-patterns, learning, memory
---

## Best Practices Pattern Library

Track and aggregate success/failure patterns across projects to prevent repeating mistakes.

**Incorrect — no pattern tracking:**
```python
# Same team, third project using offset pagination
# Each time it fails at scale, each time nobody remembers
@router.get("/items")
def list_items(page: int = 1, limit: int = 20):
    offset = (page - 1) * limit
    return db.query(Item).offset(offset).limit(limit).all()
    # Timeout on tables with 1M+ rows — again
```

**Correct — pattern library with outcome tracking:**
```python
# Pattern library entry (stored in knowledge graph)
pattern = {
    "category": "pagination",
    "pattern": "cursor-based pagination",
    "outcome": "success",
    "projects": ["project-a", "project-b", "project-c"],
    "confidence": "strong",  # 3+ projects, 100% success
    "note": "Scales well for large datasets"
}

# Anti-pattern entry
anti_pattern = {
    "category": "pagination",
    "pattern": "offset pagination",
    "outcome": "failure",
    "projects": ["project-a", "project-d"],
    "confidence": "strong_anti",  # 2+ projects, all failed
    "note": "Caused timeouts on tables with 1M+ rows",
    "lesson": "Use cursor-based for datasets > 100K rows"
}
```

**Confidence scoring:**

| Level | Meaning | Criteria |
|-------|---------|----------|
| Strong success | Always recommend | 3+ projects, 100% success rate |
| Moderate success | Recommend with caveats | 1-2 projects or some failures |
| Mixed results | Context-dependent | Both successes and failures |
| Anti-pattern | Actively warn against | Only failures |
| Strong anti-pattern | Block with explanation | 3+ projects, all failed |

**Memory integration:**
```bash
# Store a successful pattern
mcp__memory__add_node(
    name="cursor-pagination-success",
    type="best_practice",
    content="Cursor-based pagination works well for large datasets (3 projects)"
)

# Query patterns before making architecture decisions
mcp__memory__search_nodes(query="pagination patterns outcomes")
```

**Key rules:**
- Track every significant architectural decision outcome (success or failure)
- Include project name and context so patterns are discoverable
- Proactively query pattern library before repeating known decisions
- Update confidence levels as more project data accumulates

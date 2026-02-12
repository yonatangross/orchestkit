---
title: Multi-Concept Query Detection
impact: MEDIUM
impactDescription: "Decomposing simple queries wastes LLM calls — heuristic detection provides sub-millisecond fast-path for single-concept queries"
tags: query, detection, heuristic, multi-concept
---

## Multi-Concept Query Detection

Fast heuristic to determine if query decomposition is needed.

**Heuristic Detection (Fast Path):**
```python
MULTI_CONCEPT_INDICATORS = [
    " vs ", " versus ", " compared to ", " or ",
    " and ", " with ", " affect ", " impact ",
    "difference between", "relationship between",
]

def is_multi_concept_heuristic(query: str) -> bool:
    """Fast check for multi-concept indicators (<1ms)."""
    query_lower = query.lower()
    return any(ind in query_lower for ind in MULTI_CONCEPT_INDICATORS)
```

**When to Decompose:**

| Query Type | Decompose? |
|------------|------------|
| "What is X?" | No |
| "X vs Y" | Yes |
| "How does X affect Y?" | Yes |
| "Best practices for X" | No |
| "X and Y in Z" | Yes |
| "Difference between X, Y, Z" | Yes |

**Key rules:**
- Heuristic first (sub-millisecond), LLM decomposition only if heuristic triggers
- Single-concept queries should skip decomposition entirely (no LLM cost)
- Keywords: "vs", "compared to", "affect", "difference between" indicate multi-concept
- This is the fast path — always check before calling the LLM decomposer

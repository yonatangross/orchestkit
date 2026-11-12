---
title: Define conditional edge routing with explicit mappings and END fallback
impact: HIGH
impactDescription: "Missing edge mappings cause runtime KeyError — always include END fallback"
tags: routing, conditional, edges, branching
---

## Conditional Edge Routing

Route workflow execution dynamically based on state. Always include END or fallback.

**Incorrect:**
```python
def route(state) -> str:
    if state["quality_score"] >= 0.8:
        return "publish"
    elif state["retry_count"] < 3:
        return "retry"
    # No fallback — if quality < 0.8 AND retries exhausted, returns None → runtime error

workflow.add_conditional_edges("check", route)
# No explicit mapping — unclear what routes exist
```

**Correct:**
```python
from langgraph.graph import END

def route_based_on_quality(state: WorkflowState) -> str:
    if state["quality_score"] >= 0.8:
        return "publish"
    elif state["retry_count"] < 3:
        return "retry"
    else:
        return "manual_review"  # Always have a fallback

workflow.add_conditional_edges(
    "quality_check",
    route_based_on_quality,
    {
        "publish": "publish_node",
        "retry": "generator",
        "manual_review": "review_queue",
    }
)
```

**Routing patterns reference:**
```
Sequential:    A → B → C              (simple edges)
Branching:     A → (B or C)           (conditional edges)
Looping:       A → B → A              (retry logic)
Convergence:   (A or B) → C           (multiple inputs)
Diamond:       A → (B, C) → D         (parallel then merge)
```

**Key rules:**
- Router functions must be pure — no side effects
- Always provide explicit edge mapping dict for clarity
- Always include END or fallback condition
- Keep router logic lightweight

Reference: [LangGraph Conditional Edges](https://langchain-ai.github.io/langgraph/concepts/low_level/#conditional-edges)

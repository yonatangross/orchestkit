---
title: Semantic & Command Routing
impact: HIGH
impactDescription: "Using conditional edges when updating state causes split logic — use Command API instead"
tags: routing, semantic, command, embedding, llm
---

## Semantic & Command Routing

Use Command API when routing AND updating state. Use semantic routing for intent classification.

**Incorrect — split routing + state update:**
```python
def router(state):
    state["route_reason"] = "high score"  # State update in router
    if state["score"] > 0.8:
        return "approve"
    return "reject"

workflow.add_conditional_edges("evaluate", router)
# State update happens but routing is separate — hard to reason about
```

**Correct — Command API (2026 pattern):**
```python
from langgraph.types import Command
from typing import Literal

def router_with_state(state) -> Command[Literal["approve", "reject"]]:
    if state["score"] > 0.8:
        return Command(
            update={"route_reason": "high score", "routed_at": time.time()},
            goto="approve"
        )
    return Command(
        update={"route_reason": "low score", "routed_at": time.time()},
        goto="reject"
    )

workflow.add_node("evaluate", router_with_state)
# No conditional edges needed — Command handles both state + routing
```

**Semantic routing — embedding-based intent classification:**
```python
from sentence_transformers import SentenceTransformer
import numpy as np

embedder = SentenceTransformer("all-MiniLM-L6-v2")

ROUTE_EMBEDDINGS = {
    "technical": embedder.encode("technical code programming"),
    "business": embedder.encode("business strategy revenue"),
    "support": embedder.encode("help troubleshoot error fix"),
}

def semantic_router(state) -> str:
    query_embedding = embedder.encode(state["query"])
    similarities = {
        route: np.dot(query_embedding, emb) / (
            np.linalg.norm(query_embedding) * np.linalg.norm(emb)
        )
        for route, emb in ROUTE_EMBEDDINGS.items()
    }
    best = max(similarities, key=similarities.get)
    return "general" if similarities[best] < 0.3 else best
```

**Key rules:**
- Use **Command** when updating state AND routing together
- Use **conditional edges** when routing only (no state updates)
- Pre-compute embeddings for semantic routing (don't embed on every call)
- Always include a fallback/general route

Reference: [LangGraph Command API](https://langchain-ai.github.io/langgraph/concepts/low_level/#command)

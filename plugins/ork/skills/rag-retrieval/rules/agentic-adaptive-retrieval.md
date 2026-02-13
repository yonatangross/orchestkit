---
title: Adaptive Retrieval
impact: MEDIUM
impactDescription: "Single retrieval strategy can't handle all query types — adaptive routing selects the best approach per query"
tags: adaptive, routing, multi-source, orchestration
---

## Adaptive Retrieval

Route queries to optimal retrieval strategies based on query characteristics.

**Query Router:**
```python
from pydantic import BaseModel, Field
from typing import Literal

class QueryRoute(BaseModel):
    strategy: Literal["direct", "hyde", "decompose", "web"] = Field(
        description="Best retrieval strategy for this query"
    )
    reasoning: str

async def route_query(question: str) -> str:
    route = await llm.with_structured_output(QueryRoute).ainvoke(
        f"Choose the best retrieval strategy for: {question}\n"
        "- direct: Simple factual queries with clear keywords\n"
        "- hyde: Abstract/conceptual queries with vocabulary mismatch\n"
        "- decompose: Multi-concept queries spanning multiple topics\n"
        "- web: Recent events or data not in knowledge base"
    )
    return route.strategy
```

**Multi-Source Orchestration:**
```python
async def adaptive_search(question: str, top_k: int = 10) -> list[dict]:
    strategy = await route_query(question)

    if strategy == "direct":
        return await retriever.search(question, top_k=top_k)
    elif strategy == "hyde":
        hyde_result = await hyde_service.generate(question)
        return await retriever.search_by_embedding(hyde_result.embedding, top_k=top_k)
    elif strategy == "decompose":
        return await decomposed_search(question, top_k=top_k)
    elif strategy == "web":
        return await web_search(question)
```

**Key rules:**
- Route queries to optimal sources based on query type
- Direct search for simple factual queries (fastest)
- HyDE for abstract/conceptual queries (vocabulary bridging)
- Decomposition for multi-concept queries (comprehensive coverage)
- Web search for recent events or out-of-knowledge-base queries
- Routing adds ~200ms overhead — use heuristics for fast-path decisions

---
title: Decompose complex multi-topic queries with parallel retrieval and RRF fusion
impact: HIGH
impactDescription: "Complex queries spanning multiple topics miss relevant documents — decomposition with parallel retrieval provides comprehensive coverage"
tags: query, decomposition, concepts, rrf, parallel
---

## Query Decomposition + RRF Fusion

Break complex queries into concepts, retrieve separately, fuse with RRF.

**LLM Decomposition:**
```python
from pydantic import BaseModel, Field

class ConceptExtraction(BaseModel):
    concepts: list[str] = Field(..., min_length=1, max_length=5)
    reasoning: str | None = None

async def decompose_query(query: str, llm: AsyncOpenAI) -> list[str]:
    response = await llm.chat.completions.create(
        model="gpt-5.2-mini",
        messages=[
            {"role": "system", "content":
                "Extract 2-4 independent concepts from this query. "
                "Each concept should be searchable on its own."},
            {"role": "user", "content": query}
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )
    result = ConceptExtraction.model_validate_json(response.choices[0].message.content)
    return result.concepts
```

**Decomposed Search with RRF:**
```python
async def decomposed_search(query: str, search_fn, llm, top_k: int = 10) -> list[dict]:
    if not is_multi_concept_heuristic(query):
        return await search_fn(query, limit=top_k)

    concepts = await decompose_query(query, llm)
    if len(concepts) <= 1:
        return await search_fn(query, limit=top_k)

    # Parallel retrieval per concept
    tasks = [search_fn(concept, limit=top_k) for concept in concepts]
    results_per_concept = await asyncio.gather(*tasks)

    return reciprocal_rank_fusion(results_per_concept, k=60)[:top_k]
```

**Incorrect — no decomposition, single query for complex topics:**
```python
async def search(query: str, top_k: int = 10) -> list[dict]:
    # "How does authentication affect database performance?"
    # Single query misses one of the two concepts
    return await vector_search(query, limit=top_k)
```

**Correct — decompose and fuse with RRF:**
```python
async def decomposed_search(query: str, top_k: int = 10) -> list[dict]:
    if not is_multi_concept_heuristic(query):
        return await search_fn(query, limit=top_k)  # Fast path

    # Decompose: "authentication" + "database performance"
    concepts = await decompose_query(query, llm)
    if len(concepts) <= 1:
        return await search_fn(query, limit=top_k)

    # Parallel retrieval per concept
    tasks = [search_fn(concept, limit=top_k) for concept in concepts]
    results_per_concept = await asyncio.gather(*tasks)

    # Fuse with RRF
    return reciprocal_rank_fusion(results_per_concept, k=60)[:top_k]
```

**Key rules:**
- Max 2-4 concepts per query (more increases latency without proportional benefit)
- Use gpt-5.2-mini for decomposition (fast, cheap, good at concept extraction)
- RRF fusion is robust and parameter-free for combining per-concept results
- Cache decomposition results — same query often asked repeatedly
- Set timeout with fallback to original query if decomposition fails

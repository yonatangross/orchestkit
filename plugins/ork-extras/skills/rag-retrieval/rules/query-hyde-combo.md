---
title: Combine query decomposition with HyDE for comprehensive vocabulary-bridged retrieval coverage
impact: MEDIUM
impactDescription: "Decomposition without vocabulary bridging still misses terminology mismatches — combining with HyDE provides best coverage"
tags: query, hyde, decomposition, combo, advanced
---

## Decomposition + HyDE Combo

Best of both: decompose into concepts, then generate HyDE for each concept.

**Combined Pattern:**
```python
async def decomposed_hyde_search(
    query: str,
    decomposer: QueryDecomposer,
    hyde_service: HyDEService,
    vector_search: callable,
    top_k: int = 10,
) -> list[dict]:
    """Decomposition + HyDE for maximum coverage."""
    # Decompose query into concepts
    concepts = await decomposer.get_concepts(query)

    # Generate HyDE for each concept in parallel
    hyde_results = await asyncio.gather(*[
        hyde_service.generate(concept) for concept in concepts
    ])

    # Search with HyDE embeddings
    search_tasks = [
        vector_search(embedding=hr.embedding, limit=top_k)
        for hr in hyde_results
    ]
    results_per_concept = await asyncio.gather(*search_tasks)

    # Fuse results with RRF
    return reciprocal_rank_fusion(results_per_concept)[:top_k]
```

**Incorrect — sequential decomposition and HyDE, slow:**
```python
async def search(query: str, top_k: int = 10) -> list[dict]:
    concepts = await decompose_query(query, llm)
    all_results = []
    for concept in concepts:  # Sequential! Slow
        hyde_result = await hyde_service.generate(concept)
        results = await vector_search(embedding=hyde_result.embedding, limit=top_k)
        all_results.append(results)
    return reciprocal_rank_fusion(all_results)[:top_k]
```

**Correct — parallel HyDE generation and search:**
```python
async def decomposed_hyde_search(query: str, top_k: int = 10) -> list[dict]:
    concepts = await decomposer.get_concepts(query)

    # Generate HyDE for each concept in parallel
    hyde_results = await asyncio.gather(*[
        hyde_service.generate(concept) for concept in concepts
    ])

    # Search with HyDE embeddings in parallel
    search_tasks = [
        vector_search(embedding=hr.embedding, limit=top_k) for hr in hyde_results
    ]
    results_per_concept = await asyncio.gather(*search_tasks)

    # Fuse with RRF
    return reciprocal_rank_fusion(results_per_concept)[:top_k]
```

**Key rules:**
- Use this combo for complex queries with both multi-concept AND vocabulary mismatch
- Decompose first, then HyDE per concept, then parallel search, then RRF fuse
- Total latency: ~1-2s (decomposition + HyDE generation + parallel search)
- Cache both decomposition and HyDE results for efficiency
- This is the most expensive retrieval path — use only when simpler methods fail

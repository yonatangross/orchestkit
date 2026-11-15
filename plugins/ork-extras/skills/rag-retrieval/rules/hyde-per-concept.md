---
title: Generate separate HyDE documents per concept for multi-topic vocabulary bridging
impact: MEDIUM
impactDescription: "Multi-concept queries need separate HyDE generation per concept for proper vocabulary bridging across topics"
tags: hyde, multi-concept, parallel, batch
---

## Per-Concept HyDE

Generate HyDE embeddings for each concept in multi-concept queries.

**Per-Concept Pattern:**
```python
async def batch_hyde(
    concepts: list[str], hyde_service: HyDEService
) -> list[HyDEResult]:
    """Generate HyDE embeddings for multiple concepts in parallel."""
    tasks = [hyde_service.generate(concept) for concept in concepts]
    return await asyncio.gather(*tasks)
```

**With Caching:**
```python
class HyDEService:
    def __init__(self, llm, embed_fn):
        self.llm = llm
        self.embed_fn = embed_fn
        self._cache: dict[str, HyDEResult] = {}

    def _cache_key(self, query: str) -> str:
        return hashlib.md5(query.lower().strip().encode()).hexdigest()

    async def generate(self, query: str) -> HyDEResult:
        key = self._cache_key(query)
        if key in self._cache:
            return self._cache[key]
        result = await generate_hyde(query, self.llm, self.embed_fn)
        self._cache[key] = result
        return result
```

**Incorrect — sequential HyDE generation, slow:**
```python
async def batch_hyde(concepts: list[str]) -> list[HyDEResult]:
    results = []
    for concept in concepts:  # Sequential! Slow for many concepts
        result = await hyde_service.generate(concept)
        results.append(result)
    return results
```

**Correct — parallel HyDE generation:**
```python
async def batch_hyde(concepts: list[str]) -> list[HyDEResult]:
    # Parallel generation for all concepts simultaneously
    tasks = [hyde_service.generate(concept) for concept in concepts]
    return await asyncio.gather(*tasks)
```

**Key rules:**
- For multi-concept queries, decompose first then generate HyDE per concept
- Cache aggressively — queries often repeat
- Parallel generation with asyncio.gather for all concepts simultaneously
- Combine with query decomposition for best results on complex queries

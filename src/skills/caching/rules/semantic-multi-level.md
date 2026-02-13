---
title: Multi-Level Cache Hierarchy
impact: MEDIUM
impactDescription: "A multi-level cache hierarchy maximizes hit rates and minimizes latency by combining in-memory, exact Redis, semantic, and prompt caching layers"
tags: multi-level, hierarchy, L1, L2, L3, L4, LRU
---

## Cache Hierarchy

```
Request -> L1 (Exact) -> L2 (Semantic) -> L3 (Prompt) -> L4 (LLM)
            ~1ms          ~10ms           ~2s          ~3s
          100% save     100% save       90% save    Full cost
```

## Multi-Level Lookup

```python
async def get_llm_response(query: str, agent_type: str) -> dict:
    # L1: Exact match (in-memory LRU)
    cache_key = hash_content(query)
    if cache_key in lru_cache:
        return lru_cache[cache_key]

    # L2: Semantic similarity (Redis)
    similar = await semantic_cache.get(query, agent_type)
    if similar:
        lru_cache[cache_key] = similar  # Promote to L1
        return similar

    # L3/L4: LLM call with prompt caching
    response = await llm.generate(query)

    # Store in caches
    await semantic_cache.set(query, response, agent_type)
    lru_cache[cache_key] = response

    return response
```

## Cost Optimization by Level

| Level | Latency | Cost Savings | Mechanism |
|-------|---------|-------------|-----------|
| L1 | ~1ms | 100% | In-memory LRU exact match |
| L2 | ~5-10ms | 100% LLM cost | Redis vector similarity |
| L3 | ~2s | 90% input tokens | Provider prompt caching |
| L4 | ~3s | 0% | Full LLM call |

## Configuration

| Setting | Recommendation |
|---------|---------------|
| L1 max size | 1,000-10,000 entries (LRU eviction) |
| L2 TTL | 24 hours |
| L2 threshold | 0.92 (cosine similarity) |
| L3 TTL | 5m default, 1h for stable prompts |
| Embedding model | text-embedding-3-small |

**Key rules:**
- Always promote L2/L3 hits to L1 for subsequent fast access
- Use LRU eviction for L1 to bound memory usage
- Track hit rates per level with Langfuse for optimization
- L3 prompt caching is orthogonal — applies to both cache hits and misses

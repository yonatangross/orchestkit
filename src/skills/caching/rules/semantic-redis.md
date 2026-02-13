---
title: Redis 8.4 Hybrid Search for Caching
impact: MEDIUM
impactDescription: "Redis 8.4 FT.HYBRID combines keyword filtering and vector similarity in a single query — better results than sequential filtering with lower latency"
tags: redis, FT.HYBRID, BM25, RRF, hybrid-search, metadata
---

## Redis 8.4+ Hybrid Search (FT.HYBRID)

Redis 8.4 introduces native hybrid search combining semantic (vector) and exact (keyword) matching in a single query. Ideal for caches that need both similarity and metadata filtering.

```python
# Redis 8.4 native hybrid search
result = redis.execute_command(
    "FT.HYBRID", "llm_cache",
    "SEARCH", f"@agent_type:{{{agent_type}}}",
    "VSIM", "@embedding", "$query_vec",
    "KNN", "2", "K", "5",
    "COMBINE", "RRF", "4", "CONSTANT", "60",
    "PARAMS", "2", "query_vec", embedding_bytes
)
```

## Hybrid Search Benefits

- Single query for keyword + vector matching
- RRF (Reciprocal Rank Fusion) combines scores intelligently
- Better results than sequential filtering
- BM25STD is the default scorer for keyword matching

## When to Use Hybrid

- Filtering by metadata (agent_type, tenant, category) + semantic similarity
- Multi-tenant caches where exact tenant match is required
- Combining keyword search with vector similarity

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Threshold | Start at 0.92, tune based on hit rate |
| TTL | 24h for production |
| Embedding | text-embedding-3-small (fast) |
| L1 size | 1000-10000 entries |
| Scorer | BM25STD (Redis 8+ default) |
| Hybrid | Use FT.HYBRID for metadata + vector queries |

**Key rules:**
- Use FT.HYBRID when you need both metadata filtering and vector similarity
- RRF constant of 60 is a good default for combining scores
- BM25STD replaces the older BM25 scorer in Redis 8+
- For simple vector-only lookups, plain VectorQuery is sufficient

---
title: PGVector Metadata Filtering & Patterns
impact: MEDIUM
impactDescription: "Without metadata filtering, search returns irrelevant content types — filtered search and score boosting improve relevance by 6% MRR"
tags: pgvector, metadata, filtering, boosting, patterns
---

## PGVector Metadata Filtering & Patterns

Filter and boost search results using metadata.

**Filtered Search:**
```python
results = await hybrid_search(
    query="binary search",
    query_embedding=embedding,
    content_type_filter=["code_block"]
)
```

**Similarity Threshold:**
```python
results = await hybrid_search(query, embedding, top_k=50)
filtered = [r for r in results if (1 - r.vector_distance) >= 0.75][:10]
```

**Multi-Query Retrieval:**
```python
queries = ["machine learning", "ML algorithms", "neural networks"]
all_results = [await hybrid_search(q, embed(q)) for q in queries]
final = deduplicate_and_rerank(all_results)
```

**Redis 8 FT.HYBRID Alternative:**

| Aspect | pgvector | Redis 8 FT.HYBRID |
|--------|----------|-------------------|
| **Setup** | Medium | Low |
| **RRF** | Manual SQL | Native `COMBINE RRF` |
| **Latency** | 5-20ms | 2-5ms |
| **Persistence** | ACID | AOF/RDB |
| **Max dataset** | Billions | Memory-bound (~100M) |

**Key rules:**
- Metadata boosting (title/path matching) adds +6% MRR
- Pre-filter by content_type for targeted search
- Similarity threshold 0.75 is a good default for filtering low-relevance results
- Choose pgvector for: ACID, complex joins, large datasets, existing PostgreSQL
- Choose Redis 8 for: sub-5ms latency, caching layer, simpler deployment

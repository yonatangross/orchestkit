---
title: Choose correct PGVector index type to avoid 17x slower queries in production
impact: HIGH
impactDescription: "Wrong index type causes 17x slower queries — HNSW is the default for production, IVFFlat only for high-volume"
tags: pgvector, hnsw, ivfflat, index, performance
---

## PGVector Index Strategies

Choose and configure the right vector index for your workload.

**Index Comparison:**

| Metric | IVFFlat | HNSW |
|--------|---------|------|
| **Query speed** | 50ms | 3ms (17x faster) |
| **Index time** | 2 min | 20 min |
| **Best for** | < 100k vectors | 100k+ vectors |
| **Recall@10** | 0.85-0.95 | 0.95-0.99 |

**HNSW Configuration (Recommended):**
```sql
-- Create HNSW index
CREATE INDEX idx_chunks_embedding_hnsw ON chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Query-time tuning
SET hnsw.ef_search = 40;  -- Higher = better recall, slower

-- Iterative scan for filtered queries (pgvector 0.8+)
SET hnsw.iterative_scan = 'relaxed_order';
```

**Search Type Comparison:**

| Aspect | Semantic (Vector) | Keyword (BM25) |
|--------|-------------------|----------------|
| **Query** | Embedding similarity | Exact word matches |
| **Strengths** | Synonyms, concepts | Exact phrases, rare terms |
| **Weaknesses** | Exact matches, technical terms | No semantic understanding |
| **Index** | HNSW (pgvector) | GIN (tsvector) |

**Incorrect — no index, sequential scan on every query:**
```sql
-- No index! Sequential scan is 17x slower
SELECT * FROM chunks
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;
```

**Correct — HNSW index for fast queries:**
```sql
-- Create HNSW index
CREATE INDEX idx_chunks_embedding_hnsw ON chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Query-time tuning
SET hnsw.ef_search = 40;  -- Higher = better recall

-- Now queries are 17x faster
SELECT * FROM chunks
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;
```

**Key rules:**
- Use HNSW for production (scales to millions, 17x faster queries)
- IVFFlat only for >1000 queries/sec where index build time matters
- m=16, ef_construction=64 are good defaults for most workloads
- Set `hnsw.ef_search = 40` at query time for production recall
- Use `iterative_scan = 'relaxed_order'` for filtered vector queries

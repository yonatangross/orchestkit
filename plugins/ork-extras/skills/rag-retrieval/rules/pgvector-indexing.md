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

## Storage Reduction — halfvec & Binary Quantization (pgvector 0.7+)

For high-dimensional embeddings (e.g. 3072-dim `gemini-embedding-001` / `text-embedding-3-large`), full `vector` storage and HNSW graphs get expensive. pgvector 0.7+ offers two reductions:

**halfvec — 16-bit floats (~50% storage, negligible recall loss):**
```sql
ALTER TABLE chunks ALTER COLUMN embedding TYPE halfvec(3072);
CREATE INDEX ON chunks USING hnsw (embedding halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

**Binary quantization — bit vectors for a coarse first pass (~32x smaller), then exact rerank:**
```sql
CREATE INDEX ON chunks
    USING hnsw ((binary_quantize(embedding)::bit(3072)) bit_hamming_ops);

-- two-phase: cheap Hamming shortlist, then exact cosine rerank
SELECT * FROM (
    SELECT * FROM chunks
    ORDER BY binary_quantize(embedding)::bit(3072) <~> binary_quantize($1)::bit(3072)
    LIMIT 200
) shortlist
ORDER BY embedding <=> $1
LIMIT 10;
```

**When to use:**
- `halfvec`: sensible default for any 1536+ dim embedding — ~50% smaller index, recall within ~0.5%
- `binary_quantize` + rerank: 3072-dim at very large scale where even halfvec HNSW is too big; expect a recall hit unless you rerank the shortlist exactly

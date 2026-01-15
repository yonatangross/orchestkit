# PGVector Indexing Strategies

## Index Types

PGVector supports two index types:
1. **IVFFlat** - Inverted File with Flat compression
2. **HNSW** - Hierarchical Navigable Small World

## IVFFlat Index

### How It Works

1. **Training phase:** Cluster vectors into N lists using k-means
2. **Query phase:** Search only nearest clusters (not all vectors)
3. **Trade-off:** Fast indexing, slower queries

### Create Index

```sql
CREATE INDEX idx_embedding_ivfflat ON chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Parameters:**
- `lists`: Number of clusters (typically `rows / 1000`)
- More lists = faster queries, slower indexing

### When to Use

- **Small datasets** (< 100k vectors)
- **Frequent updates** (fast to rebuild)
- **Limited memory** (smaller index size)

### Performance

```
Dataset: 100k vectors (1024 dims)
Index size: ~400 MB
Index time: ~2 minutes
Query time: ~50ms (top 10)
```

---

## HNSW Index (Recommended)

### How It Works

1. **Build hierarchical graph** of vectors
2. **Query phase:** Navigate graph to find neighbors
3. **Trade-off:** Slow indexing, **very fast queries**

### Create Index

```sql
CREATE INDEX idx_embedding_hnsw ON chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Parameters:**
- `m`: Number of connections per layer (default 16)
  - Higher m = better recall, larger index
- `ef_construction`: Build-time search width (default 64)
  - Higher ef = better index quality, slower build

### When to Use

- **Large datasets** (100k+ vectors)
- **Query-heavy workloads** (reads >> writes)
- **Production systems** (need fast queries)

**SkillForge uses HNSW.**

### Performance

```
Dataset: 100k vectors (1024 dims)
Index size: ~800 MB
Index time: ~20 minutes
Query time: ~3ms (top 10)  <- 17x faster than IVFFlat!
```

---

## Comparison Table

| Metric | IVFFlat | HNSW |
|--------|---------|------|
| **Query speed** | 50ms | 3ms (17x faster) |
| **Index size** | 400 MB | 800 MB |
| **Index time** | 2 min | 20 min |
| **Updates** | Fast rebuild | Slow rebuild |
| **Memory** | Low | Medium |
| **Recall@10** | 0.85-0.95 | 0.95-0.99 |
| **Best for** | < 100k vectors | 100k+ vectors |

**SkillForge:** 415 vectors now, planning for 100k+ -> **HNSW**

---

## Distance Metrics

```sql
-- Cosine distance (0-2, lower is more similar)
USING hnsw (embedding vector_cosine_ops)

-- L2 distance (Euclidean)
USING hnsw (embedding vector_l2_ops)

-- Inner product (for normalized vectors)
USING hnsw (embedding vector_ip_ops)
```

**SkillForge uses cosine** (standard for embeddings).

---

## Tuning HNSW

### Parameter m (Connections per Layer)

```sql
-- Low m (faster build, lower recall)
WITH (m = 8)   -- Build: 10 min, Query: 5ms, Recall: 0.90

-- Default m (balanced)
WITH (m = 16)  -- Build: 20 min, Query: 3ms, Recall: 0.95

-- High m (slower build, higher recall)
WITH (m = 32)  -- Build: 40 min, Query: 2ms, Recall: 0.98
```

**Rule of thumb:** `m = 16` for most use cases.

### Parameter ef_construction (Build Quality)

```sql
-- Low ef (fast build, lower quality)
WITH (ef_construction = 32)  -- Build: 10 min, Recall: 0.90

-- Default ef (balanced)
WITH (ef_construction = 64)  -- Build: 20 min, Recall: 0.95

-- High ef (slow build, high quality)
WITH (ef_construction = 128) -- Build: 40 min, Recall: 0.98
```

**Rule of thumb:** `ef_construction = 64` for production.

---

## Query-Time Tuning

### Set ef_search (Query Recall)

```sql
-- Per-session
SET hnsw.ef_search = 100;  -- Higher = better recall, slower

-- Per-query
SELECT * FROM chunks
ORDER BY embedding <=> :query_embedding
LIMIT 10;
```

**Default ef_search = 40.**

**SkillForge uses default** (sufficient for 415 vectors).

---

## Iterative Index Scans (pgvector 0.8.x)

**The Problem:** With filtered queries, HNSW might not return enough results:
```sql
-- ef_search=40, but only 10% of data matches filter
-- Result: ~4 usable results instead of requested 10
SELECT * FROM chunks
WHERE tenant_id = 'abc'
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

**The Solution:** Enable iterative scanning to continue searching until conditions are met:

```sql
-- Enable iterative scan (3 modes: off, strict_order, relaxed_order)
SET hnsw.iterative_scan = 'relaxed_order';  -- Best performance
SET hnsw.max_scan_tuples = 20000;           -- Limit for safety

-- Now filtered queries return full results
SELECT * FROM chunks
WHERE tenant_id = 'abc' AND content_type = 'code_block'
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

**Iterative Scan Modes:**
| Mode | Ordering | Performance | Use Case |
|------|----------|-------------|----------|
| `off` | Exact | Baseline | Unfiltered queries |
| `strict_order` | Exact | Slower | When exact order matters |
| `relaxed_order` | Approximate | **Best** | Most production use cases |

**Tuning `ef_search` for Filtered Queries:**
```sql
-- Higher ef_search = better recall, more memory
SET hnsw.ef_search = 100;  -- Default is 40

-- For complex filtered queries
SET hnsw.ef_search = 200;
SET hnsw.iterative_scan = 'relaxed_order';
```

---

## Indexing Best Practices

### 1. Create Index AFTER Bulk Insert

```sql
-- WRONG - Slow individual inserts with index
CREATE INDEX idx_embedding ON chunks USING hnsw (...);
INSERT INTO chunks VALUES (...);  -- Very slow!

-- CORRECT - Bulk insert, then index
INSERT INTO chunks VALUES (...);  -- Fast bulk insert
CREATE INDEX idx_embedding ON chunks USING hnsw (...);  -- One-time cost
```

### 2. Use CONCURRENTLY for Live Systems

```sql
-- Blocks reads/writes during build
CREATE INDEX idx_embedding ON chunks USING hnsw (...);

-- Allows reads/writes (slower build)
CREATE INDEX CONCURRENTLY idx_embedding ON chunks USING hnsw (...);
```

### 3. Monitor Index Size

```sql
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE indexname = 'idx_chunks_embedding';
```

---

## SkillForge Production Setup

```sql
-- backend/app/db/migrations/versions/xxx_add_vector_indexes.py

def upgrade():
    # 1. Create HNSW index for vector search
    op.execute("""
        CREATE INDEX idx_chunks_embedding ON chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    """)

    # 2. Create GIN index for full-text search
    op.execute("""
        CREATE INDEX idx_chunks_content_tsvector ON chunks
        USING gin (content_tsvector);
    """)

    # 3. Create B-tree indexes for metadata
    op.execute("""
        CREATE INDEX idx_chunks_document_id ON chunks(document_id);
        CREATE INDEX idx_chunks_content_type ON chunks(content_type);
    """)
```

**Index sizes (415 chunks):**
- HNSW: 3.2 MB
- GIN: 1.8 MB
- B-tree (x2): 0.5 MB
- **Total: 5.5 MB**

---

## Maintenance

### Rebuild Index (After Major Updates)

```sql
-- Drop and recreate (faster than REINDEX)
DROP INDEX idx_chunks_embedding;
CREATE INDEX idx_chunks_embedding ON chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### Monitor Index Health

```sql
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,  -- Times index used
    idx_tup_read,  -- Tuples read via index
    idx_tup_fetch  -- Tuples fetched via index
FROM pg_stat_user_indexes
WHERE indexname = 'idx_chunks_embedding';
```

---

## References

- [PGVector Indexing Guide](https://github.com/pgvector/pgvector#indexing)
- [HNSW Algorithm Paper](https://arxiv.org/abs/1603.09320)
- SkillForge: `backend/app/db/migrations/` (index definitions)
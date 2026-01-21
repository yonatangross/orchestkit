# Database Query Optimization

Strategies for optimizing database performance and eliminating slow queries.

## Key Patterns

1. **Add Missing Indexes** - Turn `Seq Scan` into `Index Scan`
2. **Fix N+1 Queries** - Use JOINs or `include` instead of loops
3. **Cursor Pagination** - Never load all records
4. **Connection Pooling** - Manage connection lifecycle

## Quick Diagnostics

```sql
-- Find slow queries (PostgreSQL)
SELECT query, calls, mean_time / 1000 as mean_seconds
FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;

-- Verify index usage
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- Check for sequential scans
SELECT schemaname, tablename, seq_scan, seq_tup_read
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC
LIMIT 10;
```

## N+1 Query Detection

**Symptoms:**
- One query to get parent records, then N queries for related data
- Rapid sequential database calls in logs
- Linear growth in query count with data size

**Example Problem:**
```python
# ❌ BAD: N+1 query (1 + 8 queries)
analyses = await session.execute(select(Analysis).limit(8)).scalars().all()
for analysis in analyses:
    # Each iteration hits DB again!
    chunks = await session.execute(
        select(Chunk).where(Chunk.analysis_id == analysis.id)
    ).scalars().all()
```

**Solution:**
```python
# ✅ GOOD: Single query with JOIN (1 query)
from sqlalchemy.orm import selectinload

analyses = await session.execute(
    select(Analysis)
    .options(selectinload(Analysis.chunks))  # Eager load
    .limit(8)
).scalars().all()

# Now analyses[0].chunks is already loaded (no extra query)
```

## Index Selection Strategies

| Index Type | Use Case | Example |
|------------|----------|---------|
| **B-tree** | Equality, range queries | `WHERE created_at > '2025-01-01'` |
| **GIN** | Full-text search, JSONB | `WHERE content_tsvector @@ to_tsquery('python')` |
| **HNSW** | Vector similarity | `ORDER BY embedding <=> '[0.1, 0.2, ...]'` |
| **Hash** | Exact equality only | `WHERE id = 'abc123'` (rare) |

**Index Creation Examples:**
```sql
-- B-tree index for range queries
CREATE INDEX idx_analyses_created_at ON analyses(created_at);

-- GIN index for full-text search
CREATE INDEX idx_chunks_tsvector ON chunks USING GIN(content_tsvector);

-- HNSW index for vector similarity
CREATE INDEX idx_chunks_embedding ON chunks
USING hnsw (embedding vector_cosine_ops);

-- Partial index for active records only
CREATE INDEX idx_active_users ON users(email)
WHERE deleted_at IS NULL;

-- Composite index for common query pattern
CREATE INDEX idx_analyses_user_status ON analyses(user_id, status);
```

## Connection Pooling

**Problem:** Creating new connections is expensive (50-100ms overhead)

**Solution:** Use connection pools
```python
# SQLAlchemy async pool
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,  # Base connections
    max_overflow=10,  # Additional if needed
    pool_pre_ping=True,  # Verify connections are alive
    pool_recycle=3600  # Recycle after 1 hour
)
```

## Pagination: Cursor vs Offset

### Offset-Based (❌ Slow for large datasets)
```sql
SELECT * FROM analyses ORDER BY created_at DESC
LIMIT 20 OFFSET 1000;  -- Must scan 1020 rows!
```

### Cursor-Based (✅ Fast, scales to millions)
```sql
SELECT * FROM analyses
WHERE created_at < '2025-01-15 10:00:00'  -- Last cursor
ORDER BY created_at DESC
LIMIT 20;  -- Only scans 20 rows
```

## Best Practices

1. **Always use EXPLAIN ANALYZE** before deploying queries
2. **Index foreign keys** used in JOINs
3. **Avoid SELECT \*** - request only needed columns
4. **Use prepared statements** to prevent SQL injection and enable query caching
5. **Monitor pg_stat_statements** weekly
6. **Set query timeouts** to prevent runaway queries

## References

- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Use The Index, Luke](https://use-the-index-luke.com/)
- See `scripts/database-optimization.ts` for implementation patterns

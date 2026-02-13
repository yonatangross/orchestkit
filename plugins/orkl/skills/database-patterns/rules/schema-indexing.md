---
title: "Schema: Indexing Strategies"
category: schema
impact: HIGH
impactDescription: Proper indexing is the primary lever for query performance. Wrong indexes waste storage and slow writes; missing indexes cause full table scans.
tags: [indexing, b-tree, gin, hnsw, composite, partial, covering, performance]
---

# Schema Indexing Strategies

## When to Create Indexes

```sql
-- Index foreign keys (required for join/cascade performance)
CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- Index columns in WHERE clauses
CREATE INDEX idx_users_email ON users(email);

-- Index ORDER BY / GROUP BY columns
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Composite index for multi-column queries
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);
```

## Composite Index Column Order

```sql
-- Good: Supports both queries
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);

-- Uses index: WHERE customer_id = 123 AND status = 'pending'
-- Uses index: WHERE customer_id = 123 (leftmost prefix)
-- Does NOT use index: WHERE status = 'pending' (not leftmost)
```

**Rule:** Put most selective column first, or most frequently queried alone.

## Index Types

### B-Tree (Default)
Equality, range queries, sorting.

```sql
CREATE INDEX idx_analyses_url ON analyses(url);
CREATE INDEX idx_analyses_status ON analyses(status);
```

### GIN (Inverted Index)
Full-text search (TSVECTOR), JSONB, arrays.

```sql
CREATE INDEX idx_analyses_search_vector ON analyses USING GIN(search_vector);
CREATE INDEX idx_artifact_metadata_gin ON artifacts USING GIN(artifact_metadata);
```

### HNSW (Vector Similarity)
Approximate nearest neighbor search (embeddings).

```sql
CREATE INDEX idx_chunks_vector_hnsw
ON analysis_chunks
USING hnsw (vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
-- m=16: connections per layer | ef_construction=64: build quality
```

### Partial Indexes
Filter frequently queried subsets.

```sql
-- Only index completed analyses (common query)
CREATE INDEX idx_analyses_completed ON analyses(created_at DESC) WHERE status = 'complete';
```

### Covering Indexes (Index-Only Scans)
Include all queried columns.

```sql
CREATE INDEX idx_analyses_status_covering
ON analyses(status, created_at DESC) INCLUDE (id, title);
-- PostgreSQL can satisfy query entirely from index
```

## Index Maintenance

```sql
-- Find unused indexes (candidates for removal)
SELECT indexname, idx_scan FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexname NOT LIKE '%_pkey';

-- Rebuild bloated indexes
REINDEX INDEX CONCURRENTLY idx_chunks_vector_hnsw;
```

## Constraints as Validation

```sql
CREATE TABLE products (
  id INT PRIMARY KEY,
  price DECIMAL(10, 2) CHECK (price >= 0),
  stock INT CHECK (stock >= 0),
  discount_percent INT CHECK (discount_percent BETWEEN 0 AND 100)
);
```

## Anti-Patterns

- **Over-indexing:** Every index slows writes. Only index actual query patterns.
- **Missing FK indexes:** Causes slow joins and cascading deletes.
- **Wrong column order:** Composite indexes only use leftmost prefix.
- **FLOAT for money:** Use DECIMAL(10, 2) for financial values.

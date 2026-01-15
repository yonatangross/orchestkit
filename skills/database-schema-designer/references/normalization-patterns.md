# Database Normalization Patterns

## Overview

Normalization is the process of organizing data to reduce redundancy and improve data integrity. This guide covers normal forms, denormalization strategies, and modern patterns like JSON columns.

---

## Normal Forms (1NF through BCNF)

### First Normal Form (1NF)
**Rule:** Each column contains atomic (indivisible) values, and each row is unique.

**Anti-pattern:**
```sql
-- WRONG: Multiple values in one column
CREATE TABLE users (
    id UUID PRIMARY KEY,
    phone_numbers TEXT  -- "555-1234, 555-5678, 555-9012"
);
```

**Correct:**
```sql
-- RIGHT: Atomic values only
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE user_phones (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    phone_type TEXT CHECK (phone_type IN ('mobile', 'home', 'work'))
);
```

### Second Normal Form (2NF)
**Rule:** Must be in 1NF + no partial dependencies (all non-key columns depend on the entire primary key).

**Anti-pattern:**
```sql
-- WRONG: order_date depends only on order_id, not on (order_id, product_id)
CREATE TABLE order_items (
    order_id UUID,
    product_id UUID,
    order_date TIMESTAMP,  -- Partial dependency!
    quantity INTEGER,
    PRIMARY KEY (order_id, product_id)
);
```

**Correct:**
```sql
-- RIGHT: Separate tables for independent entities
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    order_date TIMESTAMP NOT NULL,
    customer_id UUID NOT NULL
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);
```

### Third Normal Form (3NF)
**Rule:** Must be in 2NF + no transitive dependencies (non-key columns depend only on the primary key).

**Anti-pattern:**
```sql
-- WRONG: country_name depends on country_code, not on user_id
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    country_code TEXT,
    country_name TEXT  -- Transitive dependency!
);
```

**Correct:**
```sql
-- RIGHT: Extract country data to separate table
CREATE TABLE countries (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    country_code TEXT REFERENCES countries(code)
);
```

### Boyce-Codd Normal Form (BCNF)
**Rule:** Must be in 3NF + every determinant is a candidate key.

**When to use:** Rare edge cases with overlapping candidate keys. Most applications stop at 3NF.

---

## When to Denormalize for Performance

### Read-Heavy Workloads
**Pattern:** Denormalize frequently joined data to reduce query complexity.

```sql
-- Normalized (slower reads, cleaner updates)
CREATE TABLE analyses (
    id UUID PRIMARY KEY,
    url TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE artifacts (
    id UUID PRIMARY KEY,
    analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
    markdown_content TEXT NOT NULL
);

-- Denormalized (faster reads, requires sync logic)
CREATE TABLE analyses (
    id UUID PRIMARY KEY,
    url TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    artifact_count INTEGER DEFAULT 0  -- Denormalized counter
);

-- Update trigger to maintain artifact_count
CREATE FUNCTION update_artifact_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE analyses SET artifact_count = artifact_count + 1
        WHERE id = NEW.analysis_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE analyses SET artifact_count = artifact_count - 1
        WHERE id = OLD.analysis_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER artifact_count_trigger
AFTER INSERT OR DELETE ON artifacts
FOR EACH ROW EXECUTE FUNCTION update_artifact_count();
```

### Computed Aggregates
**SkillForge Example:** Download counts on artifacts table.

```sql
-- Denormalized counter (fast reads, eventual consistency)
CREATE TABLE artifacts (
    id UUID PRIMARY KEY,
    markdown_content TEXT NOT NULL,
    download_count INTEGER DEFAULT 0 NOT NULL
);

-- Increment without locks (eventual consistency)
UPDATE artifacts SET download_count = download_count + 1 WHERE id = :artifact_id;
```

**When NOT to denormalize:**
- Frequent writes to denormalized fields (update overhead)
- Complex sync logic prone to bugs
- Data integrity is critical (financial, medical)

---

## JSON Columns vs Normalized Tables

### Use JSON Columns When:
1. **Schema is flexible/evolving** (e.g., extraction metadata, API responses)
2. **Data is rarely queried individually** (stored as opaque blob)
3. **Structure varies per row** (e.g., different content types)

**SkillForge Examples:**

```sql
-- extraction_metadata: Flexible schema, rarely queried
CREATE TABLE analyses (
    id UUID PRIMARY KEY,
    url TEXT NOT NULL,
    extraction_metadata JSONB  -- {"fetch_time_ms": 1234, "charset": "utf-8"}
);

-- artifact_metadata: Tags, topics, complexity (flexible)
CREATE TABLE artifacts (
    id UUID PRIMARY KEY,
    artifact_metadata JSONB  -- {"topics": ["RAG", "LangGraph"], "complexity": "intermediate"}
);

-- Query JSONB with operators
SELECT * FROM artifacts
WHERE artifact_metadata @> '{"topics": ["RAG"]}'::jsonb;

-- Index JSONB for performance
CREATE INDEX idx_artifact_metadata_gin ON artifacts USING GIN (artifact_metadata);
```

### Use Normalized Tables When:
1. **Need foreign key constraints** (referential integrity)
2. **Frequent filtering/sorting** on individual fields
3. **Complex queries** (joins, aggregations)

**SkillForge Example:**

```sql
-- agent_findings: Structured data with foreign key
CREATE TABLE agent_findings (
    id UUID PRIMARY KEY,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    agent_type TEXT NOT NULL,
    findings JSONB NOT NULL,  -- Hybrid: FK + JSONB
    confidence_score FLOAT
);

-- analysis_chunks: Fully normalized for vector search
CREATE TABLE analysis_chunks (
    id UUID PRIMARY KEY,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    section_title TEXT,
    snippet TEXT,
    vector VECTOR(1536),  -- Cannot use JSONB for vector ops
    content_tsvector TSVECTOR  -- Cannot use JSONB for full-text search
);
```

---

## Indexing Strategies

### B-Tree Indexes (Default)
**Use for:** Equality, range queries, sorting.

```sql
-- Single-column indexes
CREATE INDEX idx_analyses_url ON analyses(url);
CREATE INDEX idx_analyses_status ON analyses(status);

-- Composite indexes (order matters!)
CREATE INDEX idx_chunks_analysis_granularity
ON analysis_chunks(analysis_id, granularity);

-- Query uses index: WHERE analysis_id = X AND granularity = Y
-- Query uses index (partial): WHERE analysis_id = X
-- Query does NOT use index: WHERE granularity = Y (wrong column order)
```

**Rule of Thumb:** Put high-selectivity columns first (columns that filter out the most rows).

### GIN Indexes (Inverted Indexes)
**Use for:** Full-text search (TSVECTOR), JSONB, arrays.

```sql
-- Full-text search
CREATE INDEX idx_analyses_search_vector
ON analyses USING GIN(search_vector);

-- JSONB containment queries
CREATE INDEX idx_artifact_metadata_gin
ON artifacts USING GIN(artifact_metadata);

-- Array containment
CREATE INDEX idx_tags_gin
ON articles USING GIN(tags);
```

### HNSW Indexes (Vector Similarity)
**Use for:** Approximate nearest neighbor search (embeddings).

```sql
-- SkillForge: Semantic search on chunks
CREATE INDEX idx_chunks_vector_hnsw
ON analysis_chunks
USING hnsw (vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Parameters:
-- m = 16: Connections per layer (higher = more accurate, slower)
-- ef_construction = 64: Build quality (higher = better recall, slower indexing)
```

### Partial Indexes
**Use for:** Filter frequently queried subsets.

```sql
-- Only index completed analyses (common query pattern)
CREATE INDEX idx_analyses_completed
ON analyses(created_at)
WHERE status = 'complete';

-- Only index chunks with content_type (90% have it)
CREATE INDEX idx_chunks_content_type_created
ON analysis_chunks(content_type, created_at DESC)
WHERE content_type IS NOT NULL;
```

### Covering Indexes (Index-Only Scans)
**Use for:** Include all queried columns in the index.

```sql
-- Query: SELECT id, title FROM analyses WHERE status = 'complete' ORDER BY created_at DESC
CREATE INDEX idx_analyses_status_covering
ON analyses(status, created_at DESC)
INCLUDE (id, title);

-- PostgreSQL can satisfy entire query from index (no table access)
```

---

## Index Maintenance

### Monitoring Index Usage
```sql
-- Unused indexes (candidates for removal)
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey';

-- Index size
SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass))
FROM pg_indexes
WHERE schemaname = 'public';
```

### Reindexing
```sql
-- Rebuild index (fixes bloat, updates statistics)
REINDEX INDEX CONCURRENTLY idx_chunks_vector_hnsw;

-- Rebuild all indexes on table
REINDEX TABLE CONCURRENTLY analysis_chunks;
```

---

## Anti-Patterns to Avoid

### Over-Indexing
**Problem:** Every index slows down writes (INSERT/UPDATE/DELETE).

**Rule:** Only create indexes for actual query patterns. Remove unused indexes.

### JSONB for Everything
**Problem:** Loss of type safety, no foreign keys, harder to query.

**Rule:** Use normalized tables for structured, queryable data. JSONB for flexible/opaque data.

### Premature Denormalization
**Problem:** Complexity without proven performance need.

**Rule:** Start normalized. Denormalize only after profiling shows bottlenecks.

### Missing Indexes on Foreign Keys
**Problem:** Slow joins and cascading deletes.

```sql
-- ALWAYS index foreign keys
CREATE TABLE artifacts (
    id UUID PRIMARY KEY,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE
);

-- REQUIRED for performance
CREATE INDEX idx_artifacts_analysis_id ON artifacts(analysis_id);
```

---

## Summary

| Pattern | Use When | Example |
|---------|----------|---------|
| **3NF** | Default for structured data | users, orders, products |
| **Denormalize** | Read-heavy, proven bottleneck | download_count, artifact_count |
| **JSONB** | Flexible schema, opaque data | extraction_metadata, API responses |
| **Normalized Tables** | Foreign keys, complex queries | analysis_chunks, agent_findings |
| **B-Tree Index** | Equality, ranges, sorting | status, created_at, foreign keys |
| **GIN Index** | Full-text, JSONB, arrays | search_vector, metadata |
| **HNSW Index** | Vector similarity (embeddings) | vector columns |
| **Partial Index** | Frequent filtered queries | WHERE status = 'complete' |

**Golden Rule:** Start normalized (3NF), measure performance, then selectively denormalize based on evidence.

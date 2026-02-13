# OrchestKit Database Schema

## Overview

OrchestKit uses **PostgreSQL with PGVector** for storing technical content analysis results, embeddings, and artifacts. The schema is optimized for:

- **Semantic search** (vector similarity with HNSW indexing)
- **Full-text search** (PostgreSQL tsvector with GIN indexing)
- **Hybrid search** (RRF fusion of semantic + keyword results)
- **Content chunking** (hierarchical storage of document sections)

---

## Core Tables

### `analyses` - Content Analysis Records

**Purpose:** Stores URLs being analyzed, their content, embeddings, and processing status.

```sql
CREATE TABLE analyses (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Required fields
    url TEXT NOT NULL,
    content_type VARCHAR(50) NOT NULL,  -- 'article', 'video', 'repo'
    status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- 'pending', 'processing', 'complete', 'failed'

    -- Optional fields
    title TEXT,
    raw_content TEXT,

    -- Vector embedding (OpenAI text-embedding-3-small: 1536 dimensions)
    content_embedding VECTOR(1536),

    -- Full-text search vector (auto-populated by trigger)
    search_vector TSVECTOR,

    -- Flexible metadata
    extraction_metadata JSONB,  -- {"fetch_time_ms": 1234, "charset": "utf-8"}

    -- Context Engineering (Issue #244 - Handle Pattern)
    content_summary TEXT,  -- LLM-generated summary for lightweight state refs
    content_sections JSONB,  -- {"code_blocks": [...], "headings": [...], "word_count": 5000}

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_analyses_url ON analyses(url);
CREATE INDEX idx_analyses_status ON analyses(status);

-- GIN index for full-text search
CREATE INDEX idx_analyses_search_vector ON analyses USING GIN(search_vector);

-- HNSW index for vector similarity search
CREATE INDEX idx_analyses_embedding_hnsw
ON analyses
USING hnsw (content_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Partial index for common query (only completed analyses)
CREATE INDEX idx_analyses_completed
ON analyses(created_at DESC)
WHERE status = 'complete';

-- Trigger: Auto-update search_vector on INSERT/UPDATE
CREATE TRIGGER analyses_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, url, raw_content ON analyses
FOR EACH ROW EXECUTE FUNCTION analyses_search_vector_update();
```

**Design Decisions:**

1. **UUID Primary Key:** Better for distributed systems, avoids sequential ID guessing
2. **JSONB for Metadata:** Flexible schema for extraction metadata (fetch time, charset, etc.)
3. **Vector + TSVector:** Dual search strategy (semantic + keyword)
4. **Partial Index:** 90% of queries filter by `status = 'complete'`

---

### `artifacts` - Generated Implementation Guides

**Purpose:** Stores markdown documents generated from analysis results.

```sql
CREATE TABLE artifacts (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign key (cascade delete when analysis is deleted)
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,

    -- Required fields
    markdown_content TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),

    -- Flexible metadata
    artifact_metadata JSONB,  -- {"topics": ["RAG", "LangGraph"], "complexity": "intermediate"}

    -- Telemetry
    download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
    trace_id VARCHAR(255),  -- Langfuse trace ID for observability

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_artifacts_analysis_id ON artifacts(analysis_id);
CREATE INDEX idx_artifacts_trace_id ON artifacts(trace_id);

-- GIN index for JSONB queries (e.g., find all artifacts with topic "RAG")
CREATE INDEX idx_artifacts_metadata_gin ON artifacts USING GIN(artifact_metadata);
```

**Design Decisions:**

1. **CASCADE Delete:** When an analysis is deleted, its artifacts are automatically removed
2. **Version Field:** Track artifact revisions (future: regenerate guides)
3. **JSONB Metadata:** Topics, tags, complexity stored as flexible JSON
4. **Denormalized Counter:** `download_count` for performance (no JOINs needed)

**Query Examples:**

```sql
-- Find all RAG-related artifacts
SELECT * FROM artifacts
WHERE artifact_metadata @> '{"topics": ["RAG"]}'::jsonb;

-- Get most downloaded artifacts
SELECT id, artifact_metadata->>'complexity', download_count
FROM artifacts
ORDER BY download_count DESC
LIMIT 10;
```

---

### `analysis_chunks` - Chunk-Level Embeddings

**Purpose:** Store individual chunks of analyzed content with embeddings for granular semantic search.

```sql
CREATE TABLE analysis_chunks (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign key
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,

    -- Chunking metadata
    granularity VARCHAR(20) NOT NULL CHECK (granularity IN ('coarse', 'fine', 'summary')),
    path JSONB NOT NULL,  -- ["section", "subsection", "chunk"]
    section_title TEXT,
    chunk_idx INTEGER NOT NULL CHECK (chunk_idx >= 0),
    chunk_total INTEGER NOT NULL CHECK (chunk_total > 0),

    -- Content metadata
    content_type VARCHAR(50),  -- Denormalized for filtering
    language VARCHAR(20),

    -- Deduplication
    hash VARCHAR(128) NOT NULL,  -- SHA256 hash of normalized content

    -- Embedding metadata
    model VARCHAR(100),  -- 'text-embedding-3-small'
    model_version VARCHAR(50),

    -- Content preview
    snippet TEXT,  -- First ~200 chars

    -- Vector embedding
    vector VECTOR(1536) NOT NULL,

    -- Full-text search vector (auto-populated by trigger)
    content_tsvector TSVECTOR,

    -- Telemetry fields
    token_count INTEGER,
    embedding_latency_ms FLOAT,
    was_truncated BOOLEAN DEFAULT FALSE,

    -- PII metadata (Issue #220)
    pii_flag BOOLEAN NOT NULL DEFAULT FALSE,
    pii_types JSONB,  -- ["email", "phone_us"] (never actual PII values)

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Table-level constraints
    CONSTRAINT chk_chunk_idx_lt_total CHECK (chunk_idx < chunk_total)
);

-- Indexes
CREATE INDEX idx_chunks_analysis_id ON analysis_chunks(analysis_id);
CREATE INDEX idx_chunks_hash ON analysis_chunks(hash);

-- Composite indexes
CREATE INDEX idx_chunks_analysis_granularity ON analysis_chunks(analysis_id, granularity);
CREATE INDEX idx_chunks_hash_model ON analysis_chunks(hash, model, model_version);

-- GIN index for full-text search
CREATE INDEX idx_chunks_content_tsvector ON analysis_chunks USING GIN(content_tsvector);

-- HNSW index for vector similarity search
CREATE INDEX idx_chunks_vector_hnsw
ON analysis_chunks
USING hnsw (vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Partial index (90% of chunks have content_type)
CREATE INDEX idx_chunks_content_type_created
ON analysis_chunks(content_type, created_at DESC)
WHERE content_type IS NOT NULL;

-- Triggers
CREATE TRIGGER chunks_tsvector_trigger
BEFORE INSERT OR UPDATE OF section_title, snippet ON analysis_chunks
FOR EACH ROW EXECUTE FUNCTION chunks_tsvector_update();

CREATE TRIGGER update_chunks_updated_at
BEFORE UPDATE ON analysis_chunks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Design Decisions:**

1. **Granularity Levels:** `coarse` (sections), `fine` (paragraphs), `summary` (TL;DR)
2. **Hierarchical Path:** JSONB array for section navigation (`["section", "subsection"]`)
3. **Hash-Based Deduplication:** Avoid re-embedding identical content
4. **Denormalized `content_type`:** Faster filtering without JOIN to `analyses`
5. **Telemetry Fields:** Track token usage, latency for cost analysis
6. **PII Detection:** Flag chunks with PII (email, phone) for audit compliance

**Query Examples:**

```sql
-- Semantic search within an analysis
SELECT id, section_title, snippet, 1 - (vector <=> :query_embedding) AS similarity
FROM analysis_chunks
WHERE analysis_id = :analysis_id
ORDER BY vector <=> :query_embedding
LIMIT 10;

-- Full-text search
SELECT id, section_title, ts_rank_cd(content_tsvector, query) AS rank
FROM analysis_chunks, to_tsquery('english', 'machine & learning') AS query
WHERE analysis_id = :analysis_id AND content_tsvector @@ query
ORDER BY rank DESC
LIMIT 10;

-- Hybrid search (RRF fusion) - see chunk_repository.py
-- Combines semantic + keyword results with reciprocal rank fusion
```

---

### `agent_findings` - Multi-Agent Analysis Results

**Purpose:** Store specialized agent outputs (Tech Comparator, Security Auditor, etc.).

```sql
CREATE TABLE agent_findings (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign key
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,

    -- Agent metadata
    agent_type VARCHAR(100) NOT NULL,  -- 'tech_comparator', 'security_auditor', etc.

    -- Findings (flexible schema)
    findings JSONB NOT NULL,

    -- Confidence score
    confidence_score FLOAT,

    -- Telemetry
    processing_time_ms INTEGER,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agent_findings_analysis_id ON agent_findings(analysis_id);
CREATE INDEX idx_agent_findings_agent_type ON agent_findings(agent_type);
```

**Design Decisions:**

1. **JSONB Findings:** Each agent has different output structure (flexibility over schema rigidity)
2. **Agent Type Index:** Fast filtering by agent type
3. **No Versioning:** Findings are immutable (re-run analysis creates new record)

---

## Supporting Tables

### `annotation_queue` - Human-in-the-Loop Feedback

**Purpose:** Queue chunks/artifacts for human review and feedback collection.

```sql
CREATE TABLE annotation_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES analysis_chunks(id) ON DELETE SET NULL,
    annotation_type VARCHAR(50) NOT NULL,  -- 'quality', 'relevance', 'accuracy'
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    feedback JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### `agent_memory` - Persistent Agent Memory

**Purpose:** Store agent learnings across sessions (RAG for agent improvements).

```sql
CREATE TABLE agent_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_type VARCHAR(100) NOT NULL,
    memory_type VARCHAR(50) NOT NULL,  -- 'success', 'failure', 'pattern'
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

---

## Embedding Storage Pattern

### Why PGVector?

1. **Co-location:** Embeddings live alongside metadata (no separate vector DB)
2. **ACID Guarantees:** Transactions ensure consistency
3. **Hybrid Search:** Native support for keyword + semantic search
4. **Cost-Effective:** No additional infrastructure (Redis, Pinecone, Weaviate)

### HNSW Index Configuration

```sql
CREATE INDEX idx_chunks_vector_hnsw
ON analysis_chunks
USING hnsw (vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Parameters:**
- `m = 16`: Connections per layer (16 is good balance of speed/accuracy)
- `ef_construction = 64`: Build quality (higher = better recall, slower indexing)

**Query-Time Tuning:**
```sql
-- Increase search quality (default ef_search = 40)
SET hnsw.ef_search = 100;

-- Then run semantic search
SELECT * FROM analysis_chunks
ORDER BY vector <=> :query_embedding
LIMIT 10;
```

### Embedding Model Details

- **Model:** OpenAI `text-embedding-3-small`
- **Dimensions:** 1536
- **Distance Metric:** Cosine similarity (`vector_cosine_ops`)
- **Normalization:** Vectors are normalized (unit length) before storage

---

## Full-Text Search Pattern

### Weighted TSVector

```sql
-- Trigger function (analyses table)
CREATE FUNCTION analyses_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||  -- Highest weight
        setweight(to_tsvector('english', COALESCE(NEW.url, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.raw_content, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Weights:**
- `A`: Most important (title)
- `B`: Medium importance (URL)
- `C`: Lower importance (content)
- `D`: Lowest importance (not used)

### Ranking Function

```sql
-- ts_rank_cd (cover density) - better for most use cases
SELECT id, ts_rank_cd(search_vector, query) AS rank
FROM analyses, to_tsquery('english', 'machine & learning') AS query
WHERE search_vector @@ query
ORDER BY rank DESC;
```

---

## Relationship Modeling

### Cascade Deletes

All child tables use `ON DELETE CASCADE` to maintain referential integrity:

```
analyses (parent)
├── artifacts (ON DELETE CASCADE)
├── analysis_chunks (ON DELETE CASCADE)
└── agent_findings (ON DELETE CASCADE)

artifacts (parent)
└── annotation_queue (ON DELETE CASCADE)

analysis_chunks (parent)
└── annotation_queue (ON DELETE SET NULL)  -- Optional reference
```

### Example: Deleting an Analysis

```sql
-- Single DELETE cascades to all children
DELETE FROM analyses WHERE id = :analysis_id;

-- Automatically deletes:
-- - All artifacts for this analysis
-- - All chunks for this analysis
-- - All agent findings for this analysis
-- - All annotation queue entries for these artifacts/chunks
```

---

## Migration History

### Key Migrations

1. **`e3c50d69e442_enable_pgvector.py`**
   - Enable PGVector extension

2. **`a37ac3b6a635_initial_schema.py`**
   - Create `analyses`, `artifacts`, `agent_findings` tables

3. **`20251204091348_add_fulltext_search.py`**
   - Add `search_vector` to `analyses`
   - Create GIN index + trigger for auto-update
   - Add HNSW index for `content_embedding`

4. **`20251209120000_add_analysis_chunks.py`**
   - Create `analysis_chunks` table

5. **`20251210_harden_embedding_pipeline.py`**
   - Add HNSW index on `analysis_chunks.vector`
   - Add `content_tsvector` with GIN index
   - Add telemetry fields (`token_count`, `embedding_latency_ms`)
   - Add CHECK constraints (`chk_granularity`, `chk_chunk_idx_lt_total`)
   - Add trigger for auto-updating `content_tsvector`

6. **`20251210_add_cascade_delete.py`**
   - Update foreign keys to `ON DELETE CASCADE`

7. **`20251210_add_pii_columns.py`**
   - Add `pii_flag` and `pii_types` to `analysis_chunks`

8. **`20251218_backfill_chunks_tsvector.py`**
   - Backfill `content_tsvector` for existing chunks (batched updates)

---

## Performance Characteristics

### Table Sizes (Golden Dataset)

- **Analyses:** 98 rows
- **Artifacts:** 98 rows
- **Chunks:** 415 rows

### Index Sizes

- **HNSW Indexes:** ~2-3x vector data size
- **GIN Indexes:** ~40-60% of indexed text size
- **B-Tree Indexes:** ~30-40% of indexed column size

### Query Performance

| Query Type | Latency (p95) | Notes |
|------------|---------------|-------|
| Semantic search (chunks) | <50ms | HNSW index with m=16 |
| Full-text search (chunks) | <30ms | GIN index on tsvector |
| Hybrid search (chunks) | <100ms | RRF fusion of both |
| Analysis by URL | <10ms | B-tree index on url |

---

## Best Practices Applied

1. **Indexed All Foreign Keys:** Every FK has a B-tree index for join performance
2. **Cascade Deletes:** Parent-child relationships use `ON DELETE CASCADE`
3. **Triggers for Computed Fields:** `updated_at`, `search_vector`, `content_tsvector`
4. **Partial Indexes:** Filter common query patterns (`WHERE status = 'complete'`)
5. **JSONB for Flexible Data:** Metadata, findings, hierarchical paths
6. **Normalized Tables for Structured Data:** Chunks, artifacts, findings
7. **Denormalization for Performance:** `download_count`, `content_type` in chunks
8. **Telemetry Fields:** Track token usage, latency, PII detection
9. **CHECK Constraints:** Data integrity (`granularity`, `chunk_idx < chunk_total`)
10. **UUID Primary Keys:** Better for distributed systems, no sequential guessing

---

## Future Enhancements

1. **Materialized Views:** Pre-computed aggregates for dashboards
2. **Partitioning:** Partition `analysis_chunks` by analysis_id (when >10M rows)
3. **Read Replicas:** Scale read queries across multiple PostgreSQL instances
4. **Connection Pooling:** PgBouncer for reduced connection overhead
5. **Archive Old Analyses:** Move completed analyses >90 days to cold storage

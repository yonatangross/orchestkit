---
title: PGVector Database Schema
impact: HIGH
impactDescription: "Wrong schema design causes slow queries and missing features — pre-computed tsvector and proper indexes are essential"
tags: pgvector, schema, postgresql, tsvector, chunks
---

## PGVector Database Schema

Production schema with pre-computed tsvector and HNSW index.

**Schema:**
```sql
CREATE TABLE chunks (
    id UUID PRIMARY KEY,
    document_id UUID REFERENCES documents(id),
    content TEXT NOT NULL,
    embedding vector(1024),  -- PGVector
    content_tsvector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', content)
    ) STORED,
    section_title TEXT,
    content_type TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- HNSW index for vector search
CREATE INDEX idx_chunks_embedding ON chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- GIN index for keyword search
CREATE INDEX idx_chunks_content_tsvector ON chunks
    USING gin (content_tsvector);
```

**Incorrect — computing tsvector at query time, slow:**
```sql
CREATE TABLE chunks (
    id UUID PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1024)
);

-- Slow query: computes tsvector every time!
SELECT * FROM chunks
WHERE to_tsvector('english', content) @@ plainto_tsquery('search query');
```

**Correct — pre-computed tsvector as GENERATED column:**
```sql
CREATE TABLE chunks (
    id UUID PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1024),
    content_tsvector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', content)
    ) STORED  -- Pre-computed, 5-10x faster
);

-- GIN index for fast keyword search
CREATE INDEX idx_chunks_content_tsvector ON chunks USING gin (content_tsvector);

-- HNSW index for fast vector search
CREATE INDEX idx_chunks_embedding ON chunks
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Fast query using pre-computed tsvector
SELECT * FROM chunks WHERE content_tsvector @@ plainto_tsquery('search query');
```

**Key rules:**
- Pre-compute tsvector as GENERATED column — 5-10x faster than `to_tsvector()` at query time
- Use `vector(1024)` for Voyage-3 embeddings (match your model dimension)
- HNSW index with m=16, ef_construction=64 for production workloads
- Always include document_id FK for document-level operations
- Include content_type for filtered search (code, text, table)

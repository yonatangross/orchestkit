---
name: pgvector-search
description: Use when implementing vector search with PostgreSQL. Covers PGVector hybrid search with BM25, metadata filtering, and performance optimization for semantic retrieval.
context: fork
agent: database-engineer
version: 1.2.0
author: SkillForge AI Agent Hub
tags: [pgvector-0.8, hybrid-search, bm25, rrf, semantic-search, retrieval, 2026]
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/migration-validator.sh"
  Stop:
    - command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/migration-validator.sh"
---

# PGVector Hybrid Search

**Production-grade semantic + keyword search using PostgreSQL**

## Overview

Hybrid search combines **semantic similarity** (vector embeddings) with **keyword matching** (BM25) to achieve better retrieval than either alone.

**Architecture:**
```
Query
  ↓
[Generate embedding] → Vector Search (PGVector) → Top 30 results
  ↓
[Generate ts_query]  → Keyword Search (BM25)    → Top 30 results
  ↓
[Reciprocal Rank Fusion (RRF)] → Merge & re-rank → Top 10 final results
```

**When to use this skill:**
- Building semantic search (RAG, knowledge bases, recommendations)
- Implementing hybrid retrieval (vector + keyword)
- Optimizing PGVector performance
- Working with large document collections (1M+ chunks)

---

## Core Concepts

### 1. Semantic Search (Vector Similarity)

**How it works:**
1. Embed query: `"database indexing strategies"` → `[0.23, -0.15, ..., 0.42]` (1024 dims)
2. Find nearest neighbors: `ORDER BY embedding <=> query_embedding LIMIT 30`
3. Returns: Conceptually similar documents (even with different words)

**Example:**
- Query: "machine learning model training"
- Matches: "neural network optimization", "deep learning techniques"
- Misses: "ML model training" (different embeddings despite similar meaning)

**Strengths:**
- Captures semantic meaning
- Works across languages
- Handles synonyms ("car" matches "automobile")

**Weaknesses:**
- Slow for exact keyword matches
- Sensitive to embedding quality
- Doesn't handle rare technical terms well

---

### 2. Keyword Search (BM25)

**How it works:**
1. Tokenize query: `"database indexing"` → `database & indexing`
2. Full-text search: `WHERE content_tsvector @@ to_tsquery('database & indexing')`
3. Rank by BM25 score (TF-IDF + document length normalization)

**Example:**
- Query: "PostgreSQL B-tree index"
- Matches: Documents with exact phrase "PostgreSQL B-tree index"
- Misses: "Postgres tree-based indexing" (different words)

**Strengths:**
- Fast exact matches
- Handles technical terms well
- Works for rare/specific phrases

**Weaknesses:**
- No semantic understanding
- Requires exact word matches
- Sensitive to typos

---

### 3. Reciprocal Rank Fusion (RRF)

**The Problem:** How do you combine vector scores (0.85) with BM25 scores (42.7)?

**The Solution:** Use **rank** instead of score.

**Algorithm:**
```python
def rrf_score(rank: int, k: int = 60) -> float:
    """
    Calculate RRF score for a document at given rank.

    Args:
        rank: Position in result list (1-indexed)
        k: Smoothing constant (typically 60)

    Returns:
        Score between 0 and ~0.016 (1/k)
    """
    return 1.0 / (k + rank)

# Example:
# Document appears at rank 3 in vector search → score = 1/(60+3) = 0.0159
# Same document at rank 7 in BM25 search    → score = 1/(60+7) = 0.0149
# Combined RRF score = 0.0159 + 0.0149 = 0.0308
```

**Why it works:**
- **Rank-based:** Ignores absolute scores (no normalization needed)
- **Symmetric:** Treats both searches equally
- **Robust:** Top results from either search get high scores

**Detailed Implementation:** See `references/hybrid-search-rrf.md`

---

## SkillForge's Hybrid Search Implementation

### Database Schema

```sql
-- Chunks table with vector and full-text search
CREATE TABLE chunks (
    id UUID PRIMARY KEY,
    document_id UUID REFERENCES documents(id),
    content TEXT NOT NULL,

    -- Vector embedding (1024 dimensions for Voyage AI)
    embedding vector(1024),

    -- Pre-computed tsvector for full-text search
    content_tsvector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', content)
    ) STORED,

    -- Metadata
    section_title TEXT,
    section_path TEXT,
    chunk_index INT,
    content_type TEXT,  -- 'code_block', 'paragraph', 'list', etc.

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chunks_embedding ON chunks
    USING hnsw (embedding vector_cosine_ops);  -- Vector search

CREATE INDEX idx_chunks_content_tsvector ON chunks
    USING gin (content_tsvector);  -- Full-text search

CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_content_type ON chunks(content_type);
```

---

### Search Query

```python
# backend/app/db/repositories/chunk_repository.py
from sqlalchemy import select, func, literal
from pgvector.sqlalchemy import Vector

async def hybrid_search(
    query: str,
    query_embedding: list[float],
    top_k: int = 10,
    content_type_filter: list[str] | None = None
) -> list[Chunk]:
    """
    Perform hybrid search using RRF.

    Args:
        query: Search query text
        query_embedding: Query embedding vector
        top_k: Number of results to return
        content_type_filter: Optional filter by content type

    Returns:
        List of chunks ranked by RRF score
    """

    # Fetch multiplier (retrieve more for better RRF)
    FETCH_MULTIPLIER = 3
    fetch_limit = top_k * FETCH_MULTIPLIER  # 30 for top_k=10

    # ===== 1. VECTOR SEARCH =====
    vector_subquery = (
        select(
            Chunk.id,
            (Chunk.embedding.cosine_distance(query_embedding)).label("vector_distance"),
            func.row_number().over(
                order_by=Chunk.embedding.cosine_distance(query_embedding)
            ).label("vector_rank")
        )
        .where(Chunk.embedding.isnot(None))
    )

    # Apply content type filter
    if content_type_filter:
        vector_subquery = vector_subquery.where(
            Chunk.content_type.in_(content_type_filter)
        )

    vector_subquery = vector_subquery.limit(fetch_limit).subquery("vector_results")

    # ===== 2. KEYWORD SEARCH (BM25) =====
    # Generate tsquery
    ts_query = func.plainto_tsquery("english", query)

    keyword_subquery = (
        select(
            Chunk.id,
            func.ts_rank_cd(Chunk.content_tsvector, ts_query).label("bm25_score"),
            func.row_number().over(
                order_by=func.ts_rank_cd(Chunk.content_tsvector, ts_query).desc()
            ).label("keyword_rank")
        )
        .where(Chunk.content_tsvector.op("@@")(ts_query))
    )

    # Apply content type filter
    if content_type_filter:
        keyword_subquery = keyword_subquery.where(
            Chunk.content_type.in_(content_type_filter)
        )

    keyword_subquery = keyword_subquery.limit(fetch_limit).subquery("keyword_results")

    # ===== 3. RECIPROCAL RANK FUSION =====
    K = 60  # RRF smoothing constant

    rrf_query = (
        select(
            func.coalesce(vector_subquery.c.id, keyword_subquery.c.id).label("chunk_id"),
            (
                func.coalesce(1.0 / (K + vector_subquery.c.vector_rank), 0.0) +
                func.coalesce(1.0 / (K + keyword_subquery.c.keyword_rank), 0.0)
            ).label("rrf_score")
        )
        .select_from(
            vector_subquery.outerjoin(
                keyword_subquery,
                vector_subquery.c.id == keyword_subquery.c.id,
                full=True
            )
        )
        .order_by(literal("rrf_score").desc())
        .limit(top_k)
    ).subquery("rrf_results")

    # ===== 4. FETCH FULL CHUNKS =====
    final_query = (
        select(Chunk)
        .join(rrf_query, Chunk.id == rrf_query.c.chunk_id)
        .order_by(rrf_query.c.rrf_score.desc())
    )

    result = await session.execute(final_query)
    chunks = result.scalars().all()

    return chunks
```

**Key Features:**
1. **3x Fetch Multiplier:** Retrieve 30 results from each search (better RRF coverage)
2. **Indexed tsvector:** Uses `content_tsvector` column (5-10x faster than `to_tsvector()` on query)
3. **Full outer join:** Includes results from either search (vector OR keyword)
4. **Content type filtering:** Optional pre-filter by metadata

---

## Performance Optimizations

### 1. Pre-Computed `tsvector` Column

**Before (Slow):**
```sql
-- Computes tsvector on every query (SLOW!)
WHERE to_tsvector('english', content) @@ to_tsquery('database')
```

**After (Fast):**
```sql
-- Uses pre-computed column with GIN index (FAST!)
WHERE content_tsvector @@ to_tsquery('database')
```

**Speedup:** 5-10x faster for keyword search

---

### 2. HNSW vs IVFFlat Indexes

**IVFFlat (Older):**
```sql
CREATE INDEX idx_embedding ON chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
```
- Faster indexing
- Slower queries
- Good for < 100k vectors

**HNSW (Recommended):**
```sql
CREATE INDEX idx_embedding ON chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```
- Slower indexing
- **Much faster queries** (10-100x)
- Scales to millions of vectors

**SkillForge uses HNSW (415 chunks, room to scale to 10M+).**

**Detailed Comparison:** See `references/indexing-strategies.md`

---

### Iterative Index Scans (pgvector 0.8.x)

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

**Tuning `ef_search`:**
```sql
-- Higher ef_search = better recall, more memory
SET hnsw.ef_search = 100;  -- Default is 40

-- For complex filtered queries
SET hnsw.ef_search = 200;
SET hnsw.iterative_scan = 'relaxed_order';
```

---

### 3. Metadata Filtering & Boosting

**Problem:** Some chunks are more valuable than others.

**Solution: Boost by metadata:**

```python
# Boost section titles (1.5x)
if query_matches_section_title(chunk.section_title, query):
    rrf_score *= 1.5

# Boost document path (1.15x)
if query_matches_path(chunk.section_path, query):
    rrf_score *= 1.15

# Boost code blocks for technical queries (1.2x)
if is_technical_query(query) and chunk.content_type == "code_block":
    rrf_score *= 1.2
```

**SkillForge Evaluation:**
- **Before boosting:** 91.1% pass rate, 0.647 MRR (Hard queries)
- **After boosting:** 91.6% pass rate, 0.686 MRR (Hard queries)
- **Improvement:** +0.5% pass rate, +6% MRR

**Detailed Implementation:** See `references/metadata-filtering.md`

---

## Common Patterns

### Pattern 1: Filtered Search

```python
# Search only code blocks
results = await hybrid_search(
    query="binary search implementation",
    query_embedding=embedding,
    content_type_filter=["code_block"]
)
```

### Pattern 2: Similarity Threshold

```python
# Only return results above similarity threshold
MIN_SIMILARITY = 0.75

results = await hybrid_search(query, embedding, top_k=50)
filtered = [
    r for r in results
    if (1 - r.vector_distance) >= MIN_SIMILARITY
][:10]
```

### Pattern 3: Multi-Query Retrieval

```python
# Generate multiple query variations for better recall
queries = generate_query_variations("machine learning")
# ["machine learning", "ML algorithms", "neural networks"]

all_results = []
for q in queries:
    emb = embed(q)
    results = await hybrid_search(q, emb, top_k=5)
    all_results.extend(results)

# De-duplicate and re-rank
final_results = rerank_by_rrf(all_results, top_k=10)
```

---

## Testing Hybrid Search

### Golden Dataset Evaluation

```python
# backend/tests/integration/test_hybrid_search.py
import pytest
from app.db.repositories.chunk_repository import hybrid_search
from app.shared.services.embeddings import embed_text

@pytest.mark.asyncio
async def test_hybrid_search_golden_dataset():
    """Test hybrid search against golden queries."""

    golden_queries = load_golden_queries()  # 98 queries

    results = []
    for query_data in golden_queries:
        query = query_data["query"]
        expected_chunks = query_data["expected_chunk_ids"]

        # Perform search
        embedding = await embed_text(query)
        retrieved = await hybrid_search(query, embedding, top_k=10)
        retrieved_ids = {c.id for c in retrieved}

        # Check if expected chunks are in top 10
        found = len(expected_chunks & retrieved_ids)
        results.append({
            "query": query,
            "expected": len(expected_chunks),
            "found": found,
            "pass": found == len(expected_chunks)
        })

    # Calculate metrics
    pass_rate = sum(r["pass"] for r in results) / len(results)
    mrr = calculate_mrr(results)

    print(f"Pass Rate: {pass_rate:.1%}")
    print(f"MRR: {mrr:.3f}")

    assert pass_rate >= 0.90, f"Pass rate {pass_rate:.1%} below 90% threshold"
```

---

## References

### PGVector Documentation
- [PGVector GitHub](https://github.com/pgvector/pgvector)
- [HNSW Index Guide](https://github.com/pgvector/pgvector#hnsw)

### SkillForge Implementation
- `backend/app/db/repositories/chunk_repository.py` - Hybrid search implementation
- `backend/app/shared/services/search/search_service.py` - Search service layer
- `backend/app/core/constants.py` - Search constants (fetch multiplier, boosting factors)

### Related Skills
- `ai-native-development` - Embeddings and vector concepts
- `database-schema-designer` - Schema design for vector search
- `performance-optimization` - Query optimization strategies

---

**Version:** 1.2.0 (January 2026)
**Status:** Production-ready patterns from SkillForge's 415-chunk golden dataset
**Updated:** pgvector 0.8.1 with improved filtering and iterative scan support

## Capability Details

### hybrid-search-rrf
**Keywords:** hybrid search, rrf, reciprocal rank fusion, vector bm25, semantic keyword search
**Solves:**
- How do I combine vector and keyword search?
- Implement hybrid retrieval with RRF
- Merge semantic and BM25 results
- Improve search recall and precision

### semantic-search
**Keywords:** semantic search, vector similarity, embedding, nearest neighbor, cosine distance
**Solves:**
- How does semantic search work?
- Understand vector similarity search
- When to use semantic vs keyword search
- Semantic search strengths and weaknesses

### keyword-search-bm25
**Keywords:** bm25, full-text search, tsvector, tsquery, keyword search
**Solves:**
- How does BM25 keyword search work?
- Implement PostgreSQL full-text search
- Use tsvector and tsquery
- BM25 vs semantic search trade-offs

### rrf-algorithm
**Keywords:** rrf, reciprocal rank fusion, rank-based fusion, score normalization
**Solves:**
- How does Reciprocal Rank Fusion work?
- Why use rank instead of scores?
- RRF smoothing constant (k parameter)
- Combine incompatible score ranges

### database-schema
**Keywords:** pgvector schema, chunk table, embedding column, tsvector, generated column
**Solves:**
- How do I design schema for hybrid search?
- Store embeddings with vector(1024)
- Pre-compute tsvector for performance
- Index setup for vector and keyword search

### search-query-implementation
**Keywords:** hybrid search query, sqlalchemy, vector distance, ts_rank_cd, full outer join
**Solves:**
- How do I write hybrid search SQL?
- Implement RRF in SQLAlchemy
- Use fetch multiplier for better coverage
- Combine vector and keyword results

### indexing-strategies
**Keywords:** pgvector index, hnsw, ivfflat, vector index performance, index tuning
**Solves:**
- How do I index PGVector for performance?
- HNSW vs IVFFlat comparison
- Optimize vector search speed (17x faster)
- Scale to millions of vectors

### pre-computed-tsvector
**Keywords:** tsvector, gin index, full-text index, pre-computed column, generated column
**Solves:**
- How do I optimize keyword search performance?
- Pre-compute tsvector vs query-time computation
- 5-10x speedup with indexed tsvector
- Use GENERATED ALWAYS AS column

### metadata-filtering
**Keywords:** metadata filter, faceted search, content type filter, score boosting
**Solves:**
- How do I filter search by metadata?
- Boost results by section title (1.5x)
- Pre-filter by content type before search
- Improve search relevance with boosting

### metadata-boosting
**Keywords:** score boosting, section title boost, document path boost, code block boost
**Solves:**
- How do I boost search results by metadata?
- Implement section title boosting (1.5x)
- Boost technical queries for code blocks
- Real-world +6% MRR improvement

### common-patterns
**Keywords:** filtered search, similarity threshold, multi-query retrieval, search patterns
**Solves:**
- How do I filter search by content type?
- Set minimum similarity threshold
- Implement multi-query retrieval
- De-duplicate and re-rank results

### golden-dataset-testing
**Keywords:** golden dataset, search evaluation, pass rate, mrr, retrieval testing
**Solves:**
- How do I test hybrid search quality?
- Evaluate search with golden queries
- Calculate pass rate and MRR metrics
- Benchmark against expected results

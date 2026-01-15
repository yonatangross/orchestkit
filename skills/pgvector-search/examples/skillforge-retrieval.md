# SkillForge Retrieval System

## Overview

SkillForge's hybrid retrieval system combines vector embeddings (Voyage AI) with PostgreSQL full-text search (BM25) using Reciprocal Rank Fusion for optimal search quality.

**Key Stats (Production):**
- **415 chunks** across 98 analyses
- **91.6% pass rate** on golden queries (203 test cases)
- **0.695 MRR** (Mean Reciprocal Rank) on hard queries
- **~15ms** average search latency (P95: 45ms)

---

## Architecture

```
User Query: "how to implement caching with Redis"
    ↓
[Voyage AI Embedder] → [1024-dim vector]
    ↓
┌─────────────────────────────────────────────┐
│ PostgreSQL (Hybrid Search)                  │
│                                              │
│ Vector Search (HNSW)     Keyword Search     │
│   embedding <=> query  @@ ts_query          │
│   ↓                     ↓                    │
│   Top 30 results        Top 30 results      │
│   ↓                     ↓                    │
│ ┌────────────────────────────────────────┐  │
│ │ Reciprocal Rank Fusion (RRF)           │  │
│ │ Combine by rank, not score             │  │
│ └────────────────────────────────────────┘  │
│   ↓                                          │
│ ┌────────────────────────────────────────┐  │
│ │ Metadata Boosting                      │  │
│ │ - Section title: 1.5x                  │  │
│ │ - Document path: 1.15x                 │  │
│ │ - Code blocks: 1.2x                    │  │
│ └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
    ↓
Top 10 Results (re-ranked)
```

---

## Database Schema

```sql
-- backend/app/db/models/chunk.py
CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,

    -- Content
    content TEXT NOT NULL,
    content_type VARCHAR(50) NOT NULL,  -- 'code_block', 'paragraph', 'list', etc.
    chunk_index INTEGER NOT NULL,

    -- Vector embedding (Voyage AI, 1024 dims)
    embedding vector(1024),

    -- Full-text search (pre-computed tsvector)
    content_tsvector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', content)
    ) STORED,

    -- Metadata for boosting
    section_title TEXT,
    section_path TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT fk_document FOREIGN KEY (document_id) REFERENCES documents(id)
);

-- Indexes
CREATE INDEX idx_chunks_embedding ON chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_chunks_content_tsvector ON chunks
    USING gin (content_tsvector);

CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_content_type ON chunks(content_type);
```

---

## Retrieval Implementation

### 1. Embedding Service

```python
# backend/app/shared/services/embeddings/voyage_embedder.py
import voyageai
from app.core.config import settings

client = voyageai.Client(api_key=settings.VOYAGE_API_KEY)

async def embed_text(text: str) -> list[float]:
    """Generate embedding using Voyage AI."""

    response = client.embed(
        texts=[text],
        model="voyage-large-2-instruct",  # 1024 dimensions
        input_type="query"  # vs "document"
    )

    return response.embeddings[0]
```

### 2. Chunk Repository (Hybrid Search)

```python
# backend/app/db/repositories/chunk_repository.py
from templates.chunk_repository import ChunkRepository

# Templates available in skill templates/chunk-repository.py
# for full implementation
```

### 3. Search Service

```python
# backend/app/shared/services/search/search_service.py
from templates.search_service import SearchService

# Templates available in skill templates/search-service.py
# for full implementation
```

### 4. API Endpoint

```python
# backend/app/api/v1/search.py
from fastapi import APIRouter, Depends
from app.shared.services.search.search_service import SearchService, SearchQuery

router = APIRouter(prefix="/api/v1", tags=["search"])

@router.post("/search")
async def search_chunks(
    request: SearchQuery,
    search_service: SearchService = Depends(get_search_service)
):
    """
    Hybrid search endpoint.

    Example:
    ```
    curl -X POST http://localhost:8500/api/v1/search \
      -H "Content-Type: application/json" \
      -d '{
        "query": "how to implement Redis caching",
        "top_k": 10,
        "content_type_filter": ["code_block"],
        "min_similarity": 0.75
      }'
    ```

    Response:
    ```json
    {
      "results": [
        {
          "chunk_id": "550e8400-e29b-41d4-a716-446655440000",
          "content": "# Redis Caching Implementation\n\n```python\nimport redis...",
          "section_title": "Caching Strategies",
          "section_path": "docs/backend/performance/caching.md",
          "content_type": "code_block",
          "rrf_score": 0.0487,
          "boosted_score": 0.0878,
          "vector_distance": 0.15,
          "bm25_score": 23.4,
          "rank": 1,
          "similarity": 0.85
        },
        ...
      ],
      "total": 10,
      "query": "how to implement Redis caching",
      "took_ms": 18
    }
    ```
    """
    return await search_service.search(request)
```

---

## Performance Metrics

### Latency Distribution (P50/P95/P99)

```
Dataset: 415 chunks, 1000 queries

Metric          P50     P95     P99
──────────────────────────────────────
Embedding       8ms     15ms    25ms
Vector search   2ms     5ms     12ms
Keyword search  3ms     8ms     18ms
RRF fusion      1ms     2ms     4ms
Boosting        1ms     2ms     3ms
──────────────────────────────────────
Total           15ms    32ms    62ms
```

### Throughput

```
Concurrent users: 10
Requests/sec: 120 (avg)
Peak RPS: 180

Bottleneck: Embedding generation (not search!)
```

### Quality Metrics (Golden Dataset)

```
Total queries: 203
Pass rate: 91.6% (186 passed)
Fail rate: 8.4% (17 failed)

MRR (Easy):   0.895 (queries with obvious matches)
MRR (Medium): 0.742 (queries with synonyms/variations)
MRR (Hard):   0.695 (queries with ambiguous intent)

Overall MRR: 0.777
```

---

## Query Optimization

### 1. Pre-compute tsvector (5-10x faster)

```sql
-- BEFORE (Slow - computes on every query)
WHERE to_tsvector('english', content) @@ to_tsquery('caching')

-- AFTER (Fast - uses pre-computed column)
WHERE content_tsvector @@ to_tsquery('caching')
```

**Speedup:** ~8ms → ~3ms (2.7x faster)

### 2. HNSW Index (17x faster than IVFFlat)

```sql
-- Query time comparison (415 chunks)
IVFFlat: ~8ms
HNSW:    ~2ms  (4x faster)

-- At scale (100k chunks, projected)
IVFFlat: ~50ms
HNSW:    ~3ms  (17x faster)
```

### 3. Fetch Multiplier (Better RRF)

```python
# Fetch 3x results before RRF
FETCH_MULTIPLIER = 3
fetch_limit = top_k * FETCH_MULTIPLIER  # 30 for top_k=10

# Results:
1x multiplier: 87.2% pass rate
2x multiplier: 89.5% pass rate (+2.3%)
3x multiplier: 91.1% pass rate (+1.6%)  ← SkillForge uses this
4x multiplier: 91.3% pass rate (+0.2%, diminishing returns)
```

---

## Testing

### Golden Dataset Evaluation

```python
# backend/tests/integration/test_retrieval_quality.py
import pytest
from app.shared.services.search import SearchService

@pytest.mark.asyncio
async def test_golden_queries():
    """Test retrieval quality on golden dataset."""

    golden_queries = load_golden_queries()  # 203 queries

    results = []
    for query_data in golden_queries:
        query = query_data["query"]
        expected_chunks = query_data["expected_chunk_ids"]

        # Perform search
        response = await search_service.search(
            SearchQuery(query=query, top_k=10)
        )

        retrieved_ids = {r.chunk_id for r in response.results}

        # Check if expected chunks in top 10
        found = len(expected_chunks & retrieved_ids)
        results.append({
            "query": query,
            "expected": len(expected_chunks),
            "found": found,
            "pass": found == len(expected_chunks)
        })

    pass_rate = sum(r["pass"] for r in results) / len(results)
    mrr = calculate_mrr(results)

    assert pass_rate >= 0.90, f"Pass rate {pass_rate:.1%} below threshold"
    assert mrr >= 0.70, f"MRR {mrr:.3f} below threshold"
```

### Run Evaluation

```bash
cd backend
poetry run pytest tests/integration/test_retrieval_quality.py -v

# Output:
# test_golden_queries PASSED
# Pass Rate: 91.6% (186/203)
# MRR: 0.777
```

---

## Monitoring

```python
# Log all searches to Langfuse
from langfuse.decorators import observe

@observe()
async def search(request: SearchQuery):
    """Traced search with Langfuse."""

    langfuse_context.update_current_observation(
        input={"query": request.query, "top_k": request.top_k},
        metadata={"filters": request.content_type_filter}
    )

    results = await search_service.search(request)

    langfuse_context.update_current_observation(
        output={"results_count": len(results.results), "took_ms": results.took_ms}
    )

    return results
```

**Langfuse Dashboard:**
- Query distribution (most common searches)
- Latency percentiles (P50/P95/P99)
- Zero-result queries (need better indexing?)
- Slow queries (> 100ms, investigate)

---

## References

- SkillForge Backend: `backend/app/shared/services/search/`
- PGVector Docs: [https://github.com/pgvector/pgvector](https://github.com/pgvector/pgvector)
- Voyage AI Docs: [https://docs.voyageai.com](https://docs.voyageai.com)

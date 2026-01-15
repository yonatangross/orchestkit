# PGVector Hybrid Search Implementation Checklist

Use this checklist when implementing semantic + keyword search with PGVector.

## Pre-Implementation

### Index Strategy Planning
- [ ] **Choose vector algorithm** - HNSW (recommended) or IVFFlat
- [ ] **Select embedding model** - OpenAI (1536), Voyage AI (1024), etc.
- [ ] **Determine dimensions** - Match model output dimensions
- [ ] **Plan distance metric** - Cosine (most common) or L2/Inner Product
- [ ] **Set HNSW parameters** - m=16, ef_construction=64 (good defaults)

### Embedding Model Selection
- [ ] **Test embedding quality** - Validate on sample queries
- [ ] **Measure embedding latency** - API call time
- [ ] **Budget embedding costs** - Track usage for bulk ingestion
- [ ] **Plan batch embedding** - Batch API calls for efficiency
- [ ] **Cache embeddings** - Store in database, don't re-compute

### RRF Configuration
- [ ] **Set fetch multiplier** - 3x (retrieve 30 for top-10 results)
- [ ] **Choose RRF constant (k)** - 60 (standard value)
- [ ] **Plan score normalization** - Use rank, not raw scores
- [ ] **Define boosting factors** - Section title (1.5x), path (1.15x), code (1.2x)
- [ ] **Set similarity threshold** - Minimum cosine similarity (e.g., 0.75)

### Schema Design
- [ ] **Define chunks table** - id, content, embedding, metadata
- [ ] **Add tsvector column** - Pre-computed for keyword search
- [ ] **Plan metadata fields** - section_title, section_path, content_type
- [ ] **Add timestamps** - created_at, updated_at
- [ ] **Foreign keys** - Link to documents/artifacts

## Implementation

### Database Schema

```sql
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create chunks table
CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,

    -- Vector embedding (match model dimensions)
    embedding vector(1024),  -- Voyage AI 1024 dims

    -- Pre-computed tsvector for full-text search
    content_tsvector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', content)
    ) STORED,

    -- Metadata
    section_title TEXT,
    section_path TEXT,
    chunk_index INT,
    content_type TEXT,  -- 'code_block', 'paragraph', 'list'

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create indexes
-- Vector search (HNSW for speed)
CREATE INDEX idx_chunks_embedding ON chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Full-text search (GIN for tsvector)
CREATE INDEX idx_chunks_content_tsvector ON chunks
    USING gin (content_tsvector);

-- Metadata indexes
CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_content_type ON chunks(content_type);
```

- [ ] pgvector extension enabled
- [ ] Chunks table created
- [ ] Embedding column dimensions match model
- [ ] tsvector column generated and stored
- [ ] HNSW index created for vectors
- [ ] GIN index created for tsvector
- [ ] Metadata indexes created

### Vector Search Query

```python
from sqlalchemy import select, func
from pgvector.sqlalchemy import Vector

async def vector_search(
    query_embedding: list[float],
    top_k: int = 10,
    content_type_filter: list[str] | None = None
) -> list[Chunk]:
    """Perform vector similarity search."""

    # Fetch multiplier for better RRF coverage
    FETCH_MULTIPLIER = 3
    fetch_limit = top_k * FETCH_MULTIPLIER

    # Build query
    query = (
        select(
            Chunk.id,
            (Chunk.embedding.cosine_distance(query_embedding)).label("distance"),
            func.row_number().over(
                order_by=Chunk.embedding.cosine_distance(query_embedding)
            ).label("rank")
        )
        .where(Chunk.embedding.isnot(None))
    )

    # Apply content type filter
    if content_type_filter:
        query = query.where(Chunk.content_type.in_(content_type_filter))

    query = query.limit(fetch_limit).subquery("vector_results")

    result = await session.execute(query)
    return result.all()
```

- [ ] Query embedding passed as parameter
- [ ] Cosine distance calculated
- [ ] Row number (rank) computed
- [ ] Fetch multiplier applied (3x)
- [ ] Content type filter optional
- [ ] Returns top-k * 3 results

### Keyword Search Query

```python
async def keyword_search(
    query: str,
    top_k: int = 10,
    content_type_filter: list[str] | None = None
) -> list[Chunk]:
    """Perform BM25 keyword search."""

    FETCH_MULTIPLIER = 3
    fetch_limit = top_k * FETCH_MULTIPLIER

    # Generate tsquery from plain text
    ts_query = func.plainto_tsquery("english", query)

    # Build query
    query = (
        select(
            Chunk.id,
            func.ts_rank_cd(Chunk.content_tsvector, ts_query).label("score"),
            func.row_number().over(
                order_by=func.ts_rank_cd(Chunk.content_tsvector, ts_query).desc()
            ).label("rank")
        )
        .where(Chunk.content_tsvector.op("@@")(ts_query))
    )

    # Apply content type filter
    if content_type_filter:
        query = query.where(Chunk.content_type.in_(content_type_filter))

    query = query.limit(fetch_limit).subquery("keyword_results")

    result = await session.execute(query)
    return result.all()
```

- [ ] Uses pre-indexed content_tsvector (not to_tsvector on query)
- [ ] plainto_tsquery handles special characters
- [ ] ts_rank_cd for BM25-like scoring
- [ ] Row number (rank) computed
- [ ] Fetch multiplier applied
- [ ] Only matches where tsvector matches query

### Reciprocal Rank Fusion (RRF)

```python
async def hybrid_search(
    query: str,
    query_embedding: list[float],
    top_k: int = 10,
    content_type_filter: list[str] | None = None
) -> list[Chunk]:
    """Combine vector + keyword search with RRF."""

    FETCH_MULTIPLIER = 3
    fetch_limit = top_k * FETCH_MULTIPLIER
    K = 60  # RRF smoothing constant

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

    if content_type_filter:
        vector_subquery = vector_subquery.where(
            Chunk.content_type.in_(content_type_filter)
        )

    vector_subquery = vector_subquery.limit(fetch_limit).subquery("vector_results")

    # ===== 2. KEYWORD SEARCH =====
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

    if content_type_filter:
        keyword_subquery = keyword_subquery.where(
            Chunk.content_type.in_(content_type_filter)
        )

    keyword_subquery = keyword_subquery.limit(fetch_limit).subquery("keyword_results")

    # ===== 3. RECIPROCAL RANK FUSION =====
    rrf_query = (
        select(
            func.coalesce(
                vector_subquery.c.id,
                keyword_subquery.c.id
            ).label("chunk_id"),
            (
                func.coalesce(1.0 / (K + vector_subquery.c.vector_rank), 0.0) +
                func.coalesce(1.0 / (K + keyword_subquery.c.keyword_rank), 0.0)
            ).label("rrf_score"),
            vector_subquery.c.vector_distance,
            keyword_subquery.c.bm25_score
        )
        .select_from(
            vector_subquery.outerjoin(
                keyword_subquery,
                vector_subquery.c.id == keyword_subquery.c.id,
                full=True  # FULL OUTER JOIN
            )
        )
        .order_by(literal("rrf_score").desc())
        .limit(top_k)
    ).subquery("rrf_results")

    # ===== 4. FETCH FULL CHUNKS =====
    final_query = (
        select(Chunk, rrf_query.c.rrf_score)
        .join(rrf_query, Chunk.id == rrf_query.c.chunk_id)
        .order_by(rrf_query.c.rrf_score.desc())
    )

    result = await session.execute(final_query)
    chunks = result.all()

    return chunks
```

- [ ] Both vector and keyword searches executed
- [ ] Full outer join combines results
- [ ] RRF score = 1/(k+rank_vector) + 1/(k+rank_keyword)
- [ ] Results sorted by RRF score descending
- [ ] Top-k returned
- [ ] Full chunk objects fetched

### Metadata Boosting

```python
def apply_metadata_boosting(
    chunks: list[tuple[Chunk, float]],
    query: str
) -> list[tuple[Chunk, float]]:
    """Boost RRF scores based on metadata relevance."""

    boosted_chunks = []

    for chunk, rrf_score in chunks:
        boost_factor = 1.0

        # Boost section titles (1.5x)
        if chunk.section_title and query_matches_section_title(chunk.section_title, query):
            boost_factor *= 1.5

        # Boost document path (1.15x)
        if chunk.section_path and query_matches_path(chunk.section_path, query):
            boost_factor *= 1.15

        # Boost code blocks for technical queries (1.2x)
        if is_technical_query(query) and chunk.content_type == "code_block":
            boost_factor *= 1.2

        boosted_chunks.append((chunk, rrf_score * boost_factor))

    # Re-sort by boosted score
    boosted_chunks.sort(key=lambda x: x[1], reverse=True)

    return boosted_chunks


def query_matches_section_title(section_title: str, query: str) -> bool:
    """Check if query keywords appear in section title."""
    query_terms = set(query.lower().split())
    title_terms = set(section_title.lower().split())
    return len(query_terms & title_terms) > 0


def is_technical_query(query: str) -> bool:
    """Detect technical queries (code-focused)."""
    technical_keywords = {
        "function", "class", "method", "code", "implement",
        "algorithm", "syntax", "example", "snippet"
    }
    query_terms = set(query.lower().split())
    return len(query_terms & technical_keywords) > 0
```

- [ ] Boosting applied after RRF
- [ ] Section title matching implemented
- [ ] Document path matching implemented
- [ ] Technical query detection implemented
- [ ] Results re-sorted after boosting

## Verification

### Golden Dataset Testing

```python
import pytest

@pytest.mark.asyncio
async def test_hybrid_search_golden_dataset():
    """Test hybrid search against golden queries."""

    golden_queries = load_golden_queries()  # Load test cases

    results = []
    for query_data in golden_queries:
        query = query_data["query"]
        expected_chunks = query_data["expected_chunk_ids"]

        # Generate embedding
        embedding = await embed_text(query)

        # Perform search
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


def calculate_mrr(results: list[dict]) -> float:
    """Calculate Mean Reciprocal Rank."""
    reciprocal_ranks = []

    for result in results:
        if result["found"] > 0:
            # Assume first expected chunk found at rank 1 (simplified)
            reciprocal_ranks.append(1.0)
        else:
            reciprocal_ranks.append(0.0)

    return sum(reciprocal_ranks) / len(reciprocal_ranks)
```

- [ ] **Golden dataset loaded** - 98+ test queries
- [ ] **Pass rate measured** - Target: 90%+
- [ ] **MRR calculated** - Mean Reciprocal Rank
- [ ] **Hard queries tested** - Technical, ambiguous queries
- [ ] **Failures analyzed** - Inspect failing queries

### Retrieval Quality Metrics

```python
@pytest.mark.asyncio
async def test_retrieval_quality_metrics():
    """Measure retrieval quality metrics."""

    test_cases = load_golden_queries()

    precision_at_k = []
    recall_at_k = []

    for case in test_cases:
        query = case["query"]
        relevant_chunks = set(case["expected_chunk_ids"])

        # Perform search
        embedding = await embed_text(query)
        retrieved = await hybrid_search(query, embedding, top_k=10)
        retrieved_ids = {c.id for c in retrieved}

        # Precision@10: Relevant chunks in top-10 / 10
        precision = len(relevant_chunks & retrieved_ids) / 10
        precision_at_k.append(precision)

        # Recall@10: Relevant chunks in top-10 / Total relevant
        recall = len(relevant_chunks & retrieved_ids) / len(relevant_chunks)
        recall_at_k.append(recall)

    avg_precision = sum(precision_at_k) / len(precision_at_k)
    avg_recall = sum(recall_at_k) / len(recall_at_k)

    print(f"Precision@10: {avg_precision:.3f}")
    print(f"Recall@10: {avg_recall:.3f}")

    assert avg_precision >= 0.70, "Precision@10 below 70%"
    assert avg_recall >= 0.85, "Recall@10 below 85%"
```

- [ ] **Precision@10** - Target: 70%+ (relevant in top-10)
- [ ] **Recall@10** - Target: 85%+ (found most relevant)
- [ ] **MRR** - Target: 0.65+ (relevant chunks ranked high)
- [ ] **nDCG** - Normalized Discounted Cumulative Gain (optional)

### Performance Benchmarks

```python
@pytest.mark.asyncio
async def test_search_latency():
    """Measure search latency."""

    import time

    query = "How to implement binary search in Python?"
    embedding = await embed_text(query)

    # Measure vector search latency
    start = time.perf_counter()
    vector_results = await vector_search(embedding, top_k=30)
    vector_latency = (time.perf_counter() - start) * 1000

    # Measure keyword search latency
    start = time.perf_counter()
    keyword_results = await keyword_search(query, top_k=30)
    keyword_latency = (time.perf_counter() - start) * 1000

    # Measure hybrid search latency
    start = time.perf_counter()
    hybrid_results = await hybrid_search(query, embedding, top_k=10)
    hybrid_latency = (time.perf_counter() - start) * 1000

    print(f"Vector search: {vector_latency:.2f}ms")
    print(f"Keyword search: {keyword_latency:.2f}ms")
    print(f"Hybrid search: {hybrid_latency:.2f}ms")

    # Latency targets
    assert vector_latency < 100, f"Vector search latency {vector_latency:.2f}ms > 100ms"
    assert keyword_latency < 50, f"Keyword search latency {keyword_latency:.2f}ms > 50ms"
    assert hybrid_latency < 150, f"Hybrid search latency {hybrid_latency:.2f}ms > 150ms"
```

- [ ] **Vector search** - < 100ms (HNSW index)
- [ ] **Keyword search** - < 50ms (GIN index)
- [ ] **Hybrid search** - < 150ms (combined)
- [ ] **P95 latency** - 95th percentile acceptable
- [ ] **Index scans** - Verify indexes used (EXPLAIN ANALYZE)

### Index Performance Validation

```sql
-- Check if indexes are being used
EXPLAIN ANALYZE
SELECT id, embedding <=> '[0.1, 0.2, ..., 0.9]' AS distance
FROM chunks
ORDER BY distance
LIMIT 30;

-- Should show "Index Scan using idx_chunks_embedding"
-- NOT "Seq Scan" (sequential scan = no index!)
```

- [ ] **Vector index used** - EXPLAIN shows "Index Scan using idx_chunks_embedding"
- [ ] **Keyword index used** - EXPLAIN shows "Bitmap Index Scan using idx_chunks_content_tsvector"
- [ ] **No sequential scans** - Avoid full table scans
- [ ] **Index size reasonable** - Check pg_indexes view
- [ ] **Vacuum/Analyze run** - Update statistics for query planner

## Post-Implementation

### Production Monitoring
- [ ] **Search latency dashboard** - P50, P95, P99 latency
- [ ] **Retrieval quality tracking** - Pass rate, MRR over time
- [ ] **Index bloat** - Monitor index size growth
- [ ] **Query patterns** - Log common queries, identify gaps
- [ ] **Error rate** - Track search failures

### Optimization Opportunities
- [ ] **Tune HNSW parameters** - Increase m or ef_construction for accuracy
- [ ] **Increase fetch multiplier** - 3x → 5x for better RRF coverage
- [ ] **Add more boosting** - Domain-specific metadata boosts
- [ ] **Multi-query retrieval** - Generate query variations
- [ ] **Hybrid query rewriting** - Expand acronyms, synonyms

### Index Maintenance
- [ ] **Run VACUUM ANALYZE** - Weekly or after bulk inserts
- [ ] **Rebuild indexes** - If bloated (pg_repack)
- [ ] **Monitor index usage** - Drop unused indexes
- [ ] **Update statistics** - Ensure query planner has fresh stats
- [ ] **Test on production-scale data** - Validate performance at scale

## Troubleshooting

| Issue | Check |
|-------|-------|
| Slow vector search | HNSW index exists? Dimensions match? Increase m/ef_construction? |
| Slow keyword search | GIN index on tsvector? Using content_tsvector, not to_tsvector()? |
| Low pass rate | Increase fetch multiplier, add boosting, check embeddings quality |
| No keyword matches | Check tsvector generation, query language (English?), special chars |
| Wrong results | Validate RRF logic, check boosting factors, inspect rankings |
| Index not used | Run ANALYZE, check query plan (EXPLAIN), verify index conditions |

## SkillForge Integration

```python
# Example: Search for content in SkillForge
from app.shared.services.search.search_service import SearchService

search_service = SearchService()
results = await search_service.search(
    query="How to implement hybrid search?",
    top_k=10,
    filters={"content_type": ["code_block", "paragraph"]}
)

# Results include chunk content, metadata, and RRF score
for chunk, score in results:
    print(f"Score: {score:.4f} | {chunk.section_title}")
    print(chunk.content[:200])
```

- [ ] Search service integrated with API endpoints
- [ ] Results exposed via `/api/v1/search` endpoint
- [ ] Filters applied for content_type, document_id
- [ ] Results paginated (offset/limit)
- [ ] Searchable in frontend UI

## References

- **PGVector Docs**: https://github.com/pgvector/pgvector
- **SkillForge Implementation**: `backend/app/db/repositories/chunk_repository.py`
- **Search Service**: `backend/app/shared/services/search/search_service.py`
- **Constants**: `backend/app/core/constants.py`
- **Related Skill**: `the `database-schema-designer` skill`

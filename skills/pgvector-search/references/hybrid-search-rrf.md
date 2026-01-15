# Hybrid Search with Reciprocal Rank Fusion (RRF)

## The Problem

**Vector search** and **keyword search** use different scoring systems:
- Vector: Cosine similarity (0.0-1.0)
- Keyword: BM25 score (0-100+)

**You can't just add them:** `0.85 + 42.7 = 43.55` (meaningless!)

## The Solution: Reciprocal Rank Fusion

**Use rank instead of score.**

### RRF Algorithm

```python
def rrf_score(ranks: list[int], k: int = 60) -> float:
    """
    Calculate RRF score from multiple rankings.

    Args:
        ranks: List of ranks from different searches (1-indexed)
        k: Smoothing constant (default 60)

    Returns:
        Combined score
    """
    return sum(1.0 / (k + rank) for rank in ranks)

# Example:
# Document at rank 3 in vector search: 1/(60+3) = 0.0159
# Same document at rank 7 in BM25:    1/(60+7) = 0.0149
# Combined RRF score: 0.0159 + 0.0149 = 0.0308
```

### Why k=60?

- **k=60 is empirically optimal** (research paper: "Reciprocal Rank Fusion outperforms Condorcet and individual rank learning methods")
- Smaller k: Top results dominate
- Larger k: All ranks weighted more equally
- **SkillForge uses k=60 (standard)**

---

## SQL Implementation

```sql
-- backend/app/db/repositories/chunk_repository.py (SQLAlchemy)

-- 1. Vector Search (top 30)
WITH vector_results AS (
    SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY embedding <=> :query_embedding) AS vector_rank
    FROM chunks
    WHERE embedding IS NOT NULL
    LIMIT 30
),

-- 2. Keyword Search (top 30)
keyword_results AS (
    SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(content_tsvector, to_tsquery(:query)) DESC) AS keyword_rank
    FROM chunks
    WHERE content_tsvector @@ to_tsquery(:query)
    LIMIT 30
),

-- 3. RRF Fusion
rrf_scores AS (
    SELECT
        COALESCE(v.id, k.id) AS chunk_id,
        COALESCE(1.0 / (60 + v.vector_rank), 0.0) +
        COALESCE(1.0 / (60 + k.keyword_rank), 0.0) AS rrf_score
    FROM vector_results v
    FULL OUTER JOIN keyword_results k ON v.id = k.id
    ORDER BY rrf_score DESC
    LIMIT 10
)

-- 4. Fetch full chunks
SELECT c.*
FROM chunks c
JOIN rrf_scores r ON c.id = r.chunk_id
ORDER BY r.rrf_score DESC;
```

**Key Points:**
- **FULL OUTER JOIN:** Includes results from either search
- **COALESCE:** Missing ranks treated as 0 (document not in that search)
- **30 results per search:** Better coverage for RRF (3x fetch multiplier)

---

## Python Implementation (SkillForge)

```python
# backend/app/shared/services/search/search_service.py
from sqlalchemy import select, func

class SearchService:
    async def hybrid_search(
        self,
        query: str,
        query_embedding: list[float],
        top_k: int = 10
    ) -> list[Chunk]:
        """Hybrid search with RRF."""

        FETCH_MULTIPLIER = 3
        K = 60  # RRF constant

        # Vector search
        vector_subq = (
            select(
                Chunk.id,
                func.row_number().over(
                    order_by=Chunk.embedding.cosine_distance(query_embedding)
                ).label("vector_rank")
            )
            .limit(top_k * FETCH_MULTIPLIER)
            .subquery()
        )

        # Keyword search
        ts_query = func.plainto_tsquery("english", query)
        keyword_subq = (
            select(
                Chunk.id,
                func.row_number().over(
                    order_by=func.ts_rank_cd(Chunk.content_tsvector, ts_query).desc()
                ).label("keyword_rank")
            )
            .where(Chunk.content_tsvector.op("@@")(ts_query))
            .limit(top_k * FETCH_MULTIPLIER)
            .subquery()
        )

        # RRF fusion
        rrf_subq = (
            select(
                func.coalesce(vector_subq.c.id, keyword_subq.c.id).label("chunk_id"),
                (
                    func.coalesce(1.0 / (K + vector_subq.c.vector_rank), 0.0) +
                    func.coalesce(1.0 / (K + keyword_subq.c.keyword_rank), 0.0)
                ).label("rrf_score")
            )
            .select_from(
                vector_subq.outerjoin(keyword_subq, vector_subq.c.id == keyword_subq.c.id, full=True)
            )
            .order_by("rrf_score DESC")
            .limit(top_k)
            .subquery()
        )

        # Fetch chunks
        query = (
            select(Chunk)
            .join(rrf_subq, Chunk.id == rrf_subq.c.chunk_id)
            .order_by(rrf_subq.c.rrf_score.desc())
        )

        result = await self.session.execute(query)
        return result.scalars().all()
```

---

## Fetch Multiplier Optimization

**Problem:** RRF needs overlap between result sets for best performance.

**Solution:** Fetch more results (3x) before RRF.

```python
# BAD: top_k=10, fetch 10 from each search
# → Low overlap, poor RRF performance

# GOOD: top_k=10, fetch 30 from each search (3x multiplier)
# → High overlap, excellent RRF performance
```

**SkillForge Results:**
- **1x multiplier:** 87.2% pass rate
- **2x multiplier:** 89.5% pass rate (+2.3%)
- **3x multiplier:** 91.1% pass rate (+1.6%)
- **4x multiplier:** 91.3% pass rate (+0.2%, diminishing returns)

**SkillForge uses 3x (optimal).**

---

## Debugging RRF

```python
# Log individual ranks and scores
def debug_rrf(query, top_k=10):
    """Debug RRF ranking."""

    vector_results = vector_search(query, limit=30)
    keyword_results = keyword_search(query, limit=30)

    print("=== Vector Results ===")
    for rank, doc in enumerate(vector_results[:10], 1):
        print(f"Rank {rank}: {doc.id} (score: {1/(60+rank):.4f})")

    print("\n=== Keyword Results ===")
    for rank, doc in enumerate(keyword_results[:10], 1):
        print(f"Rank {rank}: {doc.id} (score: {1/(60+rank):.4f})")

    print("\n=== RRF Combined ===")
    rrf_results = hybrid_search(query, top_k=10)
    for doc in rrf_results:
        v_rank = vector_results.index(doc) + 1 if doc in vector_results else None
        k_rank = keyword_results.index(doc) + 1 if doc in keyword_results else None
        print(f"{doc.id}: v_rank={v_rank}, k_rank={k_rank}, rrf_score={doc.rrf_score:.4f}")
```

---

## Common Pitfalls

### Pitfall 1: Using Absolute Scores

```python
# WRONG - Combines incompatible scores
combined_score = vector_score + bm25_score

# CORRECT - Use ranks
rrf_score = 1/(60+vector_rank) + 1/(60+keyword_rank)
```

### Pitfall 2: Insufficient Fetch Limit

```python
# WRONG - Only 10 results per search (low overlap)
vector_results = search(limit=10)
keyword_results = search(limit=10)

# CORRECT - 30 results per search (high overlap)
FETCH_MULTIPLIER = 3
vector_results = search(limit=10 * FETCH_MULTIPLIER)
```

### Pitfall 3: Wrong Join Type

```sql
-- WRONG - INNER JOIN (only documents in BOTH searches)
FROM vector_results v
INNER JOIN keyword_results k ON v.id = k.id

-- CORRECT - FULL OUTER JOIN (documents in EITHER search)
FROM vector_results v
FULL OUTER JOIN keyword_results k ON v.id = k.id
```

---

## References

- [Original RRF Paper (2009)](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)
- [PGVector Documentation](https://github.com/pgvector/pgvector)
- SkillForge: `backend/app/db/repositories/chunk_repository.py`

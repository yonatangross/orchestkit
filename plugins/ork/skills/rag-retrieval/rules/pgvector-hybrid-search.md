---
title: PGVector Hybrid Search (SQL)
impact: HIGH
impactDescription: "Separate vector and keyword queries without RRF fusion miss cross-method matches — FULL OUTER JOIN with RRF provides unified ranking"
tags: pgvector, hybrid, rrf, sqlalchemy, full-outer-join
---

## PGVector Hybrid Search (SQL)

Hybrid vector+keyword search with RRF fusion in SQLAlchemy.

**Hybrid Search Query:**
```python
async def hybrid_search(query: str, query_embedding: list[float], top_k: int = 10) -> list[Chunk]:
    FETCH_MULTIPLIER = 3
    K = 60  # RRF smoothing constant

    # Vector search subquery
    vector_subq = (
        select(Chunk.id,
            func.row_number().over(
                order_by=Chunk.embedding.cosine_distance(query_embedding)
            ).label("vector_rank"))
        .limit(top_k * FETCH_MULTIPLIER)
        .subquery()
    )

    # Keyword search subquery
    ts_query = func.plainto_tsquery("english", query)
    keyword_subq = (
        select(Chunk.id,
            func.row_number().over(
                order_by=func.ts_rank_cd(Chunk.content_tsvector, ts_query).desc()
            ).label("keyword_rank"))
        .where(Chunk.content_tsvector.op("@@")(ts_query))
        .limit(top_k * FETCH_MULTIPLIER)
        .subquery()
    )

    # RRF fusion with FULL OUTER JOIN
    rrf_subq = (
        select(
            func.coalesce(vector_subq.c.id, keyword_subq.c.id).label("chunk_id"),
            (func.coalesce(1.0 / (K + vector_subq.c.vector_rank), 0.0) +
             func.coalesce(1.0 / (K + keyword_subq.c.keyword_rank), 0.0)
            ).label("rrf_score"))
        .select_from(vector_subq.outerjoin(keyword_subq, ..., full=True))
        .order_by("rrf_score DESC")
        .limit(top_k)
        .subquery()
    )

    return await session.execute(
        select(Chunk).join(rrf_subq, Chunk.id == rrf_subq.c.chunk_id)
    )
```

**RRF Formula:**
```python
rrf_score = 1/(k + vector_rank) + 1/(k + keyword_rank)  # k=60 (standard)
```

**Incorrect — separate queries without RRF fusion:**
```python
async def hybrid_search(query: str, embedding: list[float], top_k: int = 10):
    # Separate queries, no fusion!
    vector_results = await session.execute(
        select(Chunk).order_by(Chunk.embedding.cosine_distance(embedding)).limit(top_k)
    )
    keyword_results = await session.execute(
        select(Chunk).where(Chunk.content_tsvector.op("@@")(plainto_tsquery(query))).limit(top_k)
    )
    # Naive merge, no RRF
    return list(vector_results) + list(keyword_results)
```

**Correct — RRF fusion with FULL OUTER JOIN:**
```python
async def hybrid_search(query: str, query_embedding: list[float], top_k: int = 10):
    K = 60  # RRF smoothing constant

    # Vector search subquery
    vector_subq = select(Chunk.id, func.row_number().over(
        order_by=Chunk.embedding.cosine_distance(query_embedding)
    ).label("vector_rank")).limit(top_k * 3).subquery()

    # Keyword search subquery
    keyword_subq = select(Chunk.id, func.row_number().over(
        order_by=func.ts_rank_cd(Chunk.content_tsvector, plainto_tsquery(query)).desc()
    ).label("keyword_rank")).limit(top_k * 3).subquery()

    # RRF fusion with FULL OUTER JOIN
    rrf_subq = select(
        func.coalesce(vector_subq.c.id, keyword_subq.c.id).label("chunk_id"),
        (func.coalesce(1.0 / (K + vector_subq.c.vector_rank), 0.0) +
         func.coalesce(1.0 / (K + keyword_subq.c.keyword_rank), 0.0)).label("rrf_score")
    ).select_from(vector_subq.outerjoin(keyword_subq, ..., full=True)).order_by("rrf_score DESC").limit(top_k)

    return await session.execute(select(Chunk).join(rrf_subq, Chunk.id == rrf_subq.c.chunk_id))
```

**Key rules:**
- Use FULL OUTER JOIN to catch docs found by only one search method
- 3x fetch multiplier for better RRF coverage (30 per method for top 10 final)
- RRF smoothing constant k=60 is the standard
- Use `func.coalesce(..., 0.0)` for documents found by only one method
- `plainto_tsquery` for user queries (handles multi-word safely)

# Metadata Filtering & Score Boosting

## Overview

**Problem:** Not all search results are equally relevant. Some chunks are more valuable:
- Section titles > body paragraphs
- Code examples > prose
- Primary documentation > comments

**Solution:** Use metadata to filter and boost search results.

---

## Pre-Filtering (Before Search)

**Apply filters BEFORE vector/keyword search** (more efficient).

```python
# Filter by content type
async def search_code_only(query: str, embedding: list[float]) -> list[Chunk]:
    """Search only code blocks."""

    vector_subq = (
        select(Chunk.id, ...)
        .where(Chunk.embedding.isnot(None))
        .where(Chunk.content_type == "code_block")  # PRE-FILTER
        .limit(30)
    )

    keyword_subq = (
        select(Chunk.id, ...)
        .where(Chunk.content_tsvector.op("@@")(tsquery))
        .where(Chunk.content_type == "code_block")  # PRE-FILTER
        .limit(30)
    )

    # ... RRF fusion ...
```

**Common Filters:**
- `content_type`: code_block, paragraph, list, heading
- `difficulty`: beginner, intermediate, advanced
- `topic_tags`: ["python", "async", "database"]
- `document_type`: tutorial, reference, api_docs

---

## Post-Filtering (After Search)

**Apply filters AFTER search results retrieved** (less efficient, but more flexible).

```python
# Filter by similarity threshold
MIN_SIMILARITY = 0.75

results = await hybrid_search(query, embedding, top_k=50)
filtered = [
    r for r in results
    if (1 - r.vector_distance) >= MIN_SIMILARITY
][:10]  # Take top 10 after filtering
```

**When to use:**
- Threshold filtering (similarity, confidence)
- Complex conditional logic
- Dynamic filters based on results

---

## Score Boosting Strategies

### 1. Section Title Matching (SkillForge)

```python
def boost_section_title(chunk: Chunk, query: str, base_score: float) -> float:
    """Boost if query matches section title."""

    if not chunk.section_title:
        return base_score

    # Check if query words appear in section title
    query_words = set(query.lower().split())
    title_words = set(chunk.section_title.lower().split())

    overlap = query_words & title_words
    if overlap:
        return base_score * 1.5  # 50% boost

    return base_score

# Example:
# Query: "database indexing strategies"
# Section title: "Database Indexing Best Practices"
# Match: YES → 1.5x boost
```

**SkillForge Result:**
- **Before:** 91.1% pass rate, 0.647 MRR (Hard queries)
- **After:** 91.4% pass rate, 0.678 MRR (+4.8% MRR)

---

### 2. Document Path Matching (SkillForge)

```python
def boost_document_path(chunk: Chunk, query: str, base_score: float) -> float:
    """Boost if query matches document path."""

    if not chunk.section_path:
        return base_score

    # Example path: "docs/backend/database/indexing.md"
    path_parts = chunk.section_path.lower().split("/")
    query_words = set(query.lower().split())

    # Check if query words appear in path
    overlap = query_words & set(path_parts)
    if overlap:
        return base_score * 1.15  # 15% boost

    return base_score

# Example:
# Query: "backend API authentication"
# Path: "docs/backend/api/auth.md"
# Match: YES (backend, API) → 1.15x boost
```

**SkillForge Result:**
- **Before:** 91.4% pass rate, 0.678 MRR
- **After:** 91.6% pass rate, 0.686 MRR (+1.2% MRR)

---

### 3. Content Type Boosting

```python
def boost_by_content_type(chunk: Chunk, query: str, base_score: float) -> float:
    """Boost code blocks for technical queries."""

    # Detect technical query
    technical_terms = {"function", "class", "api", "implementation", "code", "example"}
    query_words = set(query.lower().split())

    is_technical = bool(query_words & technical_terms)

    if is_technical and chunk.content_type == "code_block":
        return base_score * 1.2  # 20% boost

    return base_score

# Example:
# Query: "how to implement async function"
# Content type: code_block
# Match: YES → 1.2x boost
```

---

### 4. Recency Boosting

```python
def boost_by_recency(chunk: Chunk, base_score: float) -> float:
    """Boost recent documents."""

    from datetime import datetime, timedelta

    age_days = (datetime.now() - chunk.created_at).days

    if age_days < 30:
        return base_score * 1.3  # < 1 month old
    elif age_days < 90:
        return base_score * 1.1  # < 3 months old
    else:
        return base_score  # No boost

# Use case: Technical documentation (prefer latest versions)
```

---

## Combined Boosting (SkillForge)

```python
# backend/app/shared/services/search/search_service.py

def apply_boosting(
    chunk: Chunk,
    query: str,
    base_rrf_score: float
) -> float:
    """Apply all boosting strategies."""

    score = base_rrf_score

    # 1. Section title boost (1.5x)
    score = boost_section_title(chunk, query, score)

    # 2. Document path boost (1.15x)
    score = boost_document_path(chunk, query, score)

    # 3. Content type boost (1.2x)
    score = boost_by_content_type(chunk, query, score)

    return score

async def hybrid_search_with_boosting(
    query: str,
    query_embedding: list[float],
    top_k: int = 10
) -> list[Chunk]:
    """Hybrid search with metadata boosting."""

    # Get base RRF results (top 30)
    chunks = await hybrid_search(query, query_embedding, top_k=30)

    # Apply boosting
    for chunk in chunks:
        chunk.boosted_score = apply_boosting(
            chunk, query, chunk.rrf_score
        )

    # Re-sort by boosted scores
    chunks.sort(key=lambda c: c.boosted_score, reverse=True)

    return chunks[:top_k]
```

**Cumulative SkillForge Results:**
- **Base RRF:** 91.1% pass rate, 0.647 MRR
- **+ Title boost:** 91.4% pass rate, 0.678 MRR (+4.8% MRR)
- **+ Path boost:** 91.6% pass rate, 0.686 MRR (+1.2% MRR)
- **+ Type boost:** 91.6% pass rate, 0.695 MRR (+1.3% MRR)
- **Total improvement:** +0.5% pass rate, +7.4% MRR

---

## Faceted Search

**Allow users to filter by metadata categories.**

```python
class SearchFilters(BaseModel):
    """User-selectable search filters."""

    content_types: list[str] | None = None  # ["code_block", "paragraph"]
    difficulty: list[str] | None = None     # ["beginner", "intermediate"]
    topics: list[str] | None = None         # ["python", "async"]
    min_confidence: float = 0.0
    max_results: int = 10

async def faceted_search(
    query: str,
    embedding: list[float],
    filters: SearchFilters
) -> list[Chunk]:
    """Search with user-provided filters."""

    # Build WHERE clause from filters
    conditions = []

    if filters.content_types:
        conditions.append(Chunk.content_type.in_(filters.content_types))

    if filters.difficulty:
        conditions.append(Chunk.difficulty.in_(filters.difficulty))

    if filters.topics:
        # Assume topics stored as JSON array
        for topic in filters.topics:
            conditions.append(Chunk.topic_tags.contains([topic]))

    # Apply to both vector and keyword search
    vector_subq = (
        select(Chunk.id, ...)
        .where(*conditions)  # Apply filters
        .limit(30)
    )

    # ... rest of hybrid search ...

    # Post-filter by confidence
    results = await hybrid_search(...)
    return [
        r for r in results
        if r.confidence >= filters.min_confidence
    ][:filters.max_results]
```

---

## Testing Boosting Strategies

```python
# backend/tests/unit/services/search/test_boosting.py
import pytest
import uuid_utils  # pip install uuid-utils (UUID v7 for Python < 3.14)

def test_section_title_boost():
    """Test section title boosting."""

    chunk = Chunk(
        id=uuid_utils.uuid7(),
        content="...",
        section_title="Database Indexing Strategies"
    )

    query = "database indexing"
    base_score = 0.5

    boosted = boost_section_title(chunk, query, base_score)

    assert boosted == 0.75  # 1.5x boost
    assert boosted > base_score

def test_no_boost_for_non_matching_title():
    """Test no boost when title doesn't match."""

    chunk = Chunk(
        id=uuid_utils.uuid7(),
        content="...",
        section_title="API Authentication"
    )

    query = "database indexing"
    base_score = 0.5

    boosted = boost_section_title(chunk, query, base_score)

    assert boosted == base_score  # No boost

@pytest.mark.asyncio
async def test_combined_boosting():
    """Test that boosts are multiplicative."""

    chunk = Chunk(
        id=uuid_utils.uuid7(),
        content="...",
        section_title="API Implementation",  # Matches "API"
        section_path="docs/backend/api/routes.md",  # Matches "API"
        content_type="code_block"  # Matches technical query
    )

    query = "API function implementation"
    base_score = 1.0

    # Should apply all 3 boosts: 1.5x * 1.15x * 1.2x = 2.07x
    boosted = apply_boosting(chunk, query, base_score)

    assert boosted == pytest.approx(2.07, rel=0.01)
```

---

## Common Pitfalls

### Pitfall 1: Over-Boosting

```python
# WRONG - Too aggressive (favors metadata over relevance)
score *= 5.0  # 5x boost is too much!

# CORRECT - Subtle boosts (10-50%)
score *= 1.2  # 20% boost maintains relevance order
```

### Pitfall 2: Boosting Before RRF

```python
# WRONG - Boosts vector/keyword scores (breaks RRF)
vector_score *= boost_factor
rrf_score = rrf(vector_score, keyword_score)

# CORRECT - Boost after RRF
rrf_score = rrf(vector_rank, keyword_rank)
final_score = rrf_score * boost_factor
```

### Pitfall 3: Missing Index on Filter Columns

```sql
-- WRONG - Full table scan on content_type
WHERE content_type = 'code_block'  -- No index!

-- CORRECT - Add index
CREATE INDEX idx_chunks_content_type ON chunks(content_type);
```

---

## References

- SkillForge: `backend/app/shared/services/search/search_service.py`
- SkillForge: `backend/app/core/constants.py` (boost factors)
- [PostgreSQL GIN Indexes](https://www.postgresql.org/docs/current/gin.html)

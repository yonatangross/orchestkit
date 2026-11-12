---
title: Combine semantic and keyword search with reciprocal rank fusion for best coverage
impact: HIGH
impactDescription: "Single retrieval method misses keyword matches or semantic similarity — hybrid with RRF provides best coverage"
tags: hybrid, bm25, vector, fusion, rrf
---

## Hybrid Search (Semantic + Keyword)

Combine vector similarity and keyword matching using Reciprocal Rank Fusion for best coverage.

**Reciprocal Rank Fusion:**
```python
def reciprocal_rank_fusion(
    semantic_results: list,
    keyword_results: list,
    k: int = 60
) -> list:
    """Combine semantic and keyword search with RRF."""
    scores = {}

    for rank, doc in enumerate(semantic_results):
        scores[doc.id] = scores.get(doc.id, 0) + 1 / (k + rank + 1)

    for rank, doc in enumerate(keyword_results):
        scores[doc.id] = scores.get(doc.id, 0) + 1 / (k + rank + 1)

    ranked_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    return [get_doc(id) for id in ranked_ids]
```

**Multi-list RRF (for query decomposition):**
```python
from collections import defaultdict

def multi_rrf(result_lists: list[list[dict]], k: int = 60) -> list[dict]:
    """Combine multiple ranked lists using RRF."""
    scores: defaultdict[str, float] = defaultdict(float)
    docs: dict[str, dict] = {}

    for results in result_lists:
        for rank, doc in enumerate(results, start=1):
            doc_id = doc["id"]
            scores[doc_id] += 1.0 / (k + rank)
            docs[doc_id] = doc

    ranked_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    return [docs[doc_id] for doc_id in ranked_ids]
```

**Incorrect — no reciprocal rank fusion, just simple averaging:**
```python
def hybrid_search(query: str, top_k: int = 10) -> list:
    semantic = vector_search(query, top_k)
    keyword = bm25_search(query, top_k)
    # Naive merge without RRF
    return semantic[:5] + keyword[:5]
```

**Correct — proper RRF combination:**
```python
def reciprocal_rank_fusion(semantic_results: list, keyword_results: list, k: int = 60) -> list:
    scores = {}
    for rank, doc in enumerate(semantic_results):
        scores[doc.id] = scores.get(doc.id, 0) + 1 / (k + rank + 1)

    for rank, doc in enumerate(keyword_results):
        scores[doc.id] = scores.get(doc.id, 0) + 1 / (k + rank + 1)

    ranked_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    return [get_doc(id) for id in ranked_ids]
```

**Key rules:**
- Default weight split: 40% BM25 / 60% vector (Anthropic research optimal)
- RRF smoothing constant k=60 is the standard — robust and parameter-free
- Retrieve 3x the final top-k for better RRF coverage (e.g., top-30 for final top-10)
- Normalize scores before combining if not using RRF

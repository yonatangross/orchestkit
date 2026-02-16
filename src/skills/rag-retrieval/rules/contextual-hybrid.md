---
title: Contextual Retrieval — Hybrid BM25+Vector
impact: HIGH
impactDescription: "Contextual embeddings alone miss exact-match queries — combining with BM25 achieves 67% reduction in retrieval failures"
tags: contextual, hybrid, bm25, vector, anthropic
---

## Contextual Retrieval — Hybrid BM25+Vector

Combine contextual embeddings with BM25 for maximum retrieval quality.

**Hybrid Retriever:**
```python
from rank_bm25 import BM25Okapi
import numpy as np

class HybridRetriever:
    def __init__(self, chunks: list[str], embeddings: np.ndarray):
        self.chunks = chunks
        self.embeddings = embeddings
        tokenized = [c.lower().split() for c in chunks]
        self.bm25 = BM25Okapi(tokenized)

    def search(
        self, query: str, query_embedding: np.ndarray,
        top_k: int = 20, bm25_weight: float = 0.4, vector_weight: float = 0.6
    ) -> list[tuple[int, float]]:
        bm25_scores = self.bm25.get_scores(query.lower().split())
        bm25_scores = (bm25_scores - bm25_scores.min()) / (bm25_scores.max() - bm25_scores.min() + 1e-6)

        vector_scores = np.dot(self.embeddings, query_embedding)
        vector_scores = (vector_scores - vector_scores.min()) / (vector_scores.max() - vector_scores.min() + 1e-6)

        combined = bm25_weight * bm25_scores + vector_weight * vector_scores
        top_indices = np.argsort(combined)[::-1][:top_k]
        return [(i, combined[i]) for i in top_indices]
```

**Results (Anthropic Research):**

| Method | Retrieval Failure Rate |
|--------|----------------------|
| Traditional embeddings | 5.7% |
| + Contextual embeddings | 3.5% |
| + Contextual + BM25 hybrid | 1.9% |
| + Contextual + BM25 + reranking | 1.3% |

**Incorrect — vector-only search without BM25:**
```python
def search(query: str, query_embedding: np.ndarray, top_k: int = 20) -> list[int]:
    # Misses exact-match queries
    vector_scores = np.dot(self.embeddings, query_embedding)
    return np.argsort(vector_scores)[::-1][:top_k]
```

**Correct — hybrid BM25 + vector with proper weighting:**
```python
def search(query: str, query_embedding: np.ndarray, top_k: int = 20) -> list[tuple[int, float]]:
    bm25_scores = self.bm25.get_scores(query.lower().split())
    bm25_norm = (bm25_scores - bm25_scores.min()) / (bm25_scores.max() - bm25_scores.min() + 1e-6)

    vector_scores = np.dot(self.embeddings, query_embedding)
    vector_norm = (vector_scores - vector_scores.min()) / (vector_scores.max() - vector_scores.min() + 1e-6)

    combined = 0.4 * bm25_norm + 0.6 * vector_norm  # Research-backed weights
    return [(i, combined[i]) for i in np.argsort(combined)[::-1][:top_k]]
```

**Key rules:**
- 67% reduction in retrieval failures with full contextual retrieval pipeline
- Default weight split: 40% BM25 / 60% vector (from Anthropic research)
- BM25 catches exact-match queries that vector search misses
- Normalize scores before weighted combination (min-max normalization)
- Adding reranking on top takes failure rate from 1.9% to 1.3%

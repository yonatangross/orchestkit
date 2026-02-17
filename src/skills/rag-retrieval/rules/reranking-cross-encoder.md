---
title: Cross-Encoder Reranking
impact: HIGH
impactDescription: "Bi-encoder embeddings miss semantic nuance — cross-encoders process query+doc together for accurate relevance scoring"
tags: reranking, cross-encoder, precision, ms-marco
---

## Cross-Encoder Reranking

Re-score retrieved documents with cross-encoder for higher precision.

**Cross-Encoder Pattern:**
```python
from sentence_transformers import CrossEncoder

class CrossEncoderReranker:
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model = CrossEncoder(model_name)

    def rerank(self, query: str, documents: list[dict], top_k: int = 10) -> list[dict]:
        pairs = [(query, doc["content"]) for doc in documents]
        scores = self.model.predict(pairs)
        scored_docs = list(zip(documents, scores))
        scored_docs.sort(key=lambda x: x[1], reverse=True)
        return [{**doc, "score": float(score)} for doc, score in scored_docs[:top_k]]
```

**Model Selection:**

| Model | Latency | Cost | Quality |
|-------|---------|------|---------|
| `cross-encoder/ms-marco-MiniLM-L-6-v2` | ~50ms | Free | Good |
| `BAAI/bge-reranker-large` | ~100ms | Free | Better |
| `cohere rerank-english-v3.0` | ~200ms | $1/1K | Best |

**Incorrect — retrieving few, no reranking:**
```python
async def search(query: str) -> list[dict]:
    # Retrieve only 10, no reranking - misses good results
    return await vector_search(query, limit=10)
```

**Correct — retrieve many, rerank to few:**
```python
async def search_with_reranking(query: str) -> list[dict]:
    # Retrieve many candidates
    candidates = await vector_search(query, limit=50)

    # Rerank with cross-encoder
    pairs = [(query, doc["content"][:400]) for doc in candidates]
    scores = cross_encoder.predict(pairs)
    scored_docs = list(zip(candidates, scores))
    scored_docs.sort(key=lambda x: x[1], reverse=True)

    # Return top 10 after reranking
    return [{**doc, "score": float(score)} for doc, score in scored_docs[:10]]
```

**Key rules:**
- Retrieve many (50-100), rerank to few (10) — "retrieve more, rerank less"
- Cross-encoder processes query+doc pair together (slow but accurate)
- Default model: `ms-marco-MiniLM-L-6-v2` (good quality, free, ~50ms)
- Truncate document content to 200-400 chars for reranking efficiency

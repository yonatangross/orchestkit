---
title: Contextual Retrieval — Complete Pipeline
impact: MEDIUM
impactDescription: "Without a complete pipeline integrating context generation, embedding, and hybrid search, individual components don't deliver full quality improvement"
tags: contextual, pipeline, indexing, parallel, production
---

## Contextual Retrieval — Complete Pipeline

End-to-end pipeline with context generation, hybrid indexing, and retrieval.

**Complete Pipeline:**
```python
from dataclasses import dataclass

@dataclass
class ContextualChunk:
    original: str
    contextualized: str
    embedding: list[float]
    doc_id: str
    chunk_index: int

class ContextualRetriever:
    def __init__(self, embed_model, llm_client):
        self.embed_model = embed_model
        self.llm = llm_client
        self.chunks: list[ContextualChunk] = []

    def add_document(self, doc_id: str, text: str, chunk_size: int = 512):
        raw_chunks = self._chunk_text(text, chunk_size)
        contextualized = self._contextualize_batch(text, raw_chunks)
        embeddings = self.embed_model.embed(contextualized)

        for i, (raw, ctx, emb) in enumerate(zip(raw_chunks, contextualized, embeddings)):
            self.chunks.append(ContextualChunk(
                original=raw, contextualized=ctx, embedding=emb,
                doc_id=doc_id, chunk_index=i
            ))
        self._rebuild_bm25()

    def search(self, query: str, top_k: int = 10) -> list[ContextualChunk]:
        query_emb = self.embed_model.embed([query])[0]
        bm25_scores = self.bm25.get_scores(query.lower().split())
        embeddings = np.array([c.embedding for c in self.chunks])
        vector_scores = np.dot(embeddings, query_emb)
        combined = 0.4 * self._normalize(bm25_scores) + 0.6 * self._normalize(vector_scores)
        top_indices = np.argsort(combined)[::-1][:top_k]
        return [self.chunks[i] for i in top_indices]
```

**Parallel Processing:**
```python
async def contextualize_parallel(document: str, chunks: list[str]) -> list[str]:
    semaphore = asyncio.Semaphore(10)  # Max 10 concurrent
    async def process_chunk(chunk: str) -> str:
        async with semaphore:
            context = await async_generate_context(document, chunk)
            return f"{context}\n\n{chunk}"
    return await asyncio.gather(*[process_chunk(c) for c in chunks])
```

**Key rules:**
- Use contextual retrieval when: documents have important metadata, chunks lose context, quality is critical
- Skip if: chunks are self-contained (Q&A pairs), low-latency indexing required, cost-sensitive with many small docs
- Parallel processing with semaphore (10 concurrent) for batch contextualization
- Prompt caching reduces cost by ~90% when processing many chunks from same document

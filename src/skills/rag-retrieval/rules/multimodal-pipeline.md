---
title: Multimodal RAG Pipeline
impact: MEDIUM
impactDescription: "Separate text and image search without deduplication returns fragmented results — unified pipeline merges cross-modal results"
tags: multimodal, pipeline, hybrid, generation, deduplication
---

## Multimodal RAG Pipeline

Build end-to-end multimodal retrieval and generation pipeline.

**Hybrid Retrieval:**
```python
class MultimodalRAG:
    def __init__(self, vector_db, vision_model, text_model):
        self.vector_db = vector_db
        self.vision_model = vision_model
        self.text_model = text_model

    async def retrieve(self, query: str, query_image: str = None, top_k: int = 10) -> list[dict]:
        results = []
        text_emb = embed_text(query)
        text_results = await self.vector_db.search(embedding=text_emb, top_k=top_k)
        results.extend(text_results)

        if query_image:
            img_emb = embed_image(query_image)
            img_results = await self.vector_db.search(embedding=img_emb, top_k=top_k)
            results.extend(img_results)

        # Dedupe by doc_id, keep highest score
        seen = {}
        for r in results:
            doc_id = r["metadata"]["doc_id"]
            if doc_id not in seen or r["score"] > seen[doc_id]["score"]:
                seen[doc_id] = r
        return sorted(seen.values(), key=lambda x: x["score"], reverse=True)[:top_k]
```

**Multimodal Generation:**
```python
async def generate_with_context(query: str, chunks: list[Chunk], model: str = "claude-opus-4-6") -> str:
    content = []
    # Add images first (attention positioning)
    for chunk in chunks:
        if chunk.chunk_type == "image" and chunk.image_path:
            b64, media_type = encode_image_base64(chunk.image_path)
            content.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}})
    # Add text context
    text_context = "\n\n".join([f"[Page {c.page}]: {c.content}" for c in chunks if c.chunk_type == "text"])
    content.append({"type": "text", "text": f"Context:\n{text_context}\n\nQuestion: {query}"})

    response = client.messages.create(model=model, max_tokens=4096, messages=[{"role": "user", "content": content}])
    return response.content[0].text
```

**Incorrect — no deduplication, fragmented results:**
```python
async def retrieve(self, query: str, top_k: int = 10) -> list[dict]:
    text_emb = embed_text(query)
    text_results = await self.vector_db.search(embedding=text_emb, top_k=top_k)

    img_emb = embed_image(query_image)
    img_results = await self.vector_db.search(embedding=img_emb, top_k=top_k)

    # No deduplication! Same doc may appear twice
    return text_results + img_results
```

**Correct — deduplicated cross-modal results:**
```python
async def retrieve(self, query: str, query_image: str = None, top_k: int = 10) -> list[dict]:
    results = []
    text_emb = embed_text(query)
    text_results = await self.vector_db.search(embedding=text_emb, top_k=top_k)
    results.extend(text_results)

    if query_image:
        img_emb = embed_image(query_image)
        img_results = await self.vector_db.search(embedding=img_emb, top_k=top_k)
        results.extend(img_results)

    # Dedupe by doc_id, keep highest score
    seen = {}
    for r in results:
        doc_id = r["metadata"]["doc_id"]
        if doc_id not in seen or r["score"] > seen[doc_id]["score"]:
            seen[doc_id] = r
    return sorted(seen.values(), key=lambda x: x["score"], reverse=True)[:top_k]
```

**Key rules:**
- Deduplicate by document ID — keep highest scoring result per document
- Place images before text in generation prompt (attention positioning)
- Always embed both image features AND text captions for maximum coverage
- Use hybrid approach: CLIP + text embeddings for best accuracy
- Missing image URL storage is a common mistake — always store paths for display

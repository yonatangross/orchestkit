---
title: Pipeline Composition
impact: MEDIUM
impactDescription: "Combining retrieval techniques without clear composition order leads to redundant processing or missed optimizations"
tags: pipeline, composition, architecture, patterns
---

## Pipeline Composition

Compose retrieval techniques in the right order for optimal results.

**Standard Pipeline:**
```
Query → [Decompose?] → [HyDE?] → [Retrieve] → [Rerank] → [Context Fit] → [Generate]
```

**Composition Pattern:**
```python
class RAGPipeline:
    """Composable RAG pipeline with optional stages."""

    def __init__(self, retriever, reranker=None, hyde_service=None, decomposer=None):
        self.retriever = retriever
        self.reranker = reranker
        self.hyde = hyde_service
        self.decomposer = decomposer

    async def query(self, question: str, top_k: int = 10) -> list[dict]:
        # Stage 1: Query enhancement (optional)
        queries = [question]
        if self.decomposer:
            concepts = await self.decomposer.decompose(question)
            if len(concepts) > 1:
                queries = concepts

        # Stage 2: Retrieve (with optional HyDE)
        all_results = []
        for q in queries:
            if self.hyde:
                hyde_result = await self.hyde.generate(q)
                results = await self.retriever.search_by_embedding(hyde_result.embedding, top_k=top_k * 3)
            else:
                results = await self.retriever.search(q, top_k=top_k * 3)
            all_results.append(results)

        # Stage 3: Fuse if multiple queries
        if len(all_results) > 1:
            merged = reciprocal_rank_fusion(all_results)
        else:
            merged = all_results[0]

        # Stage 4: Rerank (optional)
        if self.reranker:
            merged = await self.reranker.rerank(question, merged, top_k=top_k)

        return merged[:top_k]
```

**Incorrect — monolithic retrieval without composition:**
```python
async def query(question: str) -> list[dict]:
    # No optional stages, fixed pipeline
    docs = await retriever.search(question, top_k=10)
    return docs
```

**Correct — composable pipeline with optional stages:**
```python
async def query(self, question: str, top_k: int = 10) -> list[dict]:
    queries = [question]
    if self.decomposer:  # Optional decomposition
        concepts = await self.decomposer.decompose(question)
        if len(concepts) > 1:
            queries = concepts

    all_results = []
    for q in queries:
        if self.hyde:  # Optional HyDE
            hyde_result = await self.hyde.generate(q)
            results = await self.retriever.search_by_embedding(hyde_result.embedding, top_k * 3)
        else:
            results = await self.retriever.search(q, top_k * 3)
        all_results.append(results)

    merged = reciprocal_rank_fusion(all_results) if len(all_results) > 1 else all_results[0]

    if self.reranker:  # Optional reranking
        merged = await self.reranker.rerank(question, merged, top_k)

    return merged[:top_k]
```

**Key rules:**
- Compose: Decompose → HyDE → Retrieve → Rerank → Context Fit → Generate
- HyDE adds ~500ms latency; use with fallback timeout (2-3s)
- Reranking adds ~50-500ms; retrieve more (3x), rerank to final top-k
- Query decomposition only when heuristic detects multi-concept query
- Each stage is optional — start simple, add stages as needed

---
name: rag-retrieval
license: MIT
compatibility: "Claude Code 2.1.49+."
description: Retrieval-Augmented Generation patterns for grounded LLM responses. Use when building RAG pipelines, embedding documents, implementing hybrid search, contextual retrieval, HyDE, agentic RAG, multimodal RAG, query decomposition, reranking, or pgvector search.
tags: [rag, retrieval, llm, context, grounding, embeddings, hyde, reranking, pgvector, multimodal]
context: fork
agent: data-pipeline-engineer
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: high
metadata:
  category: mcp-enhancement
---

# RAG Retrieval

Comprehensive patterns for building production RAG systems. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Core RAG](#core-rag) | 4 | CRITICAL | Basic RAG, citations, hybrid search, context management |
| [Embeddings](#embeddings) | 3 | HIGH | Model selection, chunking, batch/cache optimization |
| [Contextual Retrieval](#contextual-retrieval) | 3 | HIGH | Context-prepending, hybrid BM25+vector, pipeline |
| [HyDE](#hyde) | 3 | HIGH | Vocabulary mismatch, hypothetical document generation |
| [Agentic RAG](#agentic-rag) | 4 | HIGH | Self-RAG, CRAG, knowledge graphs, adaptive routing |
| [Multimodal RAG](#multimodal-rag) | 3 | MEDIUM | Image+text retrieval, PDF chunking, cross-modal search |
| [Query Decomposition](#query-decomposition) | 3 | MEDIUM | Multi-concept queries, parallel retrieval, RRF fusion |
| [Reranking](#reranking) | 3 | MEDIUM | Cross-encoder, LLM scoring, combined signals |
| [PGVector](#pgvector) | 4 | HIGH | PostgreSQL hybrid search, HNSW indexes, schema design |

**Total: 30 rules across 9 categories**

## Core RAG

Fundamental patterns for retrieval, generation, and pipeline composition.

| Rule | File | Key Pattern |
|------|------|-------------|
| Basic RAG | `rules/core-basic-rag.md` | Retrieve + context + generate with citations |
| Hybrid Search | `rules/core-hybrid-search.md` | RRF fusion (k=60) for semantic + keyword |
| Context Management | `rules/core-context-management.md` | Token budgeting + sufficiency check |
| Pipeline Composition | `rules/core-pipeline-composition.md` | Composable Decompose → HyDE → Retrieve → Rerank |

## Embeddings

Embedding models, chunking strategies, and production optimization.

| Rule | File | Key Pattern |
|------|------|-------------|
| Models & API | `rules/embeddings-models.md` | Model selection, batch API, similarity |
| Chunking | `rules/embeddings-chunking.md` | Semantic boundary splitting, 512 token sweet spot |
| Advanced | `rules/embeddings-advanced.md` | Redis cache, Matryoshka dims, batch processing |

## Contextual Retrieval

Anthropic's context-prepending technique — 67% fewer retrieval failures.

| Rule | File | Key Pattern |
|------|------|-------------|
| Context Prepending | `rules/contextual-prepend.md` | LLM-generated context + prompt caching |
| Hybrid Search | `rules/contextual-hybrid.md` | 40% BM25 / 60% vector weight split |
| Complete Pipeline | `rules/contextual-pipeline.md` | End-to-end indexing + hybrid retrieval |

## HyDE

Hypothetical Document Embeddings for bridging vocabulary gaps.

| Rule | File | Key Pattern |
|------|------|-------------|
| Generation | `rules/hyde-generation.md` | Embed hypothetical doc, not query |
| Per-Concept | `rules/hyde-per-concept.md` | Parallel HyDE for multi-topic queries |
| Fallback | `rules/hyde-fallback.md` | 2-3s timeout → direct embedding fallback |

## Agentic RAG

Self-correcting retrieval with LLM-driven decision making.

| Rule | File | Key Pattern |
|------|------|-------------|
| Self-RAG | `rules/agentic-self-rag.md` | Binary document grading for relevance |
| Corrective RAG | `rules/agentic-corrective-rag.md` | CRAG workflow with web fallback |
| Knowledge Graph | `rules/agentic-knowledge-graph.md` | KG + vector hybrid for entity-rich domains |
| Adaptive Retrieval | `rules/agentic-adaptive-retrieval.md` | Query routing to optimal strategy |

## Multimodal RAG

Image + text retrieval with cross-modal search.

| Rule | File | Key Pattern |
|------|------|-------------|
| Embeddings | `rules/multimodal-embeddings.md` | CLIP, SigLIP 2, Voyage multimodal-3 |
| Chunking | `rules/multimodal-chunking.md` | PDF extraction preserving images |
| Pipeline | `rules/multimodal-pipeline.md` | Dedup + hybrid retrieval + generation |

## Query Decomposition

Breaking complex queries into concepts for parallel retrieval.

| Rule | File | Key Pattern |
|------|------|-------------|
| Detection | `rules/query-detection.md` | Heuristic indicators (<1ms fast path) |
| Decompose + RRF | `rules/query-decompose.md` | LLM concept extraction + parallel retrieval |
| HyDE Combo | `rules/query-hyde-combo.md` | Decompose + HyDE for maximum coverage |

## Reranking

Post-retrieval re-scoring for higher precision.

| Rule | File | Key Pattern |
|------|------|-------------|
| Cross-Encoder | `rules/reranking-cross-encoder.md` | ms-marco-MiniLM (~50ms, free) |
| LLM Reranking | `rules/reranking-llm.md` | Batch scoring + Cohere API |
| Combined | `rules/reranking-combined.md` | Multi-signal weighted scoring |

## PGVector

Production hybrid search with PostgreSQL.

| Rule | File | Key Pattern |
|------|------|-------------|
| Schema | `rules/pgvector-schema.md` | HNSW index + pre-computed tsvector |
| Hybrid Search | `rules/pgvector-hybrid-search.md` | SQLAlchemy RRF with FULL OUTER JOIN |
| Indexing | `rules/pgvector-indexing.md` | HNSW (17x faster) vs IVFFlat |
| Metadata | `rules/pgvector-metadata.md` | Filtering, boosting, Redis 8 comparison |

## Quick Start Example

```python
from openai import OpenAI

client = OpenAI()

async def rag_query(question: str, top_k: int = 5) -> dict:
    """Basic RAG with citations."""
    docs = await vector_db.search(question, limit=top_k)
    context = "\n\n".join([f"[{i+1}] {doc.text}" for i, doc in enumerate(docs)])

    response = await llm.chat([
        {"role": "system", "content": "Answer with inline citations [1], [2]. Use ONLY provided context."},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
    ])

    return {"answer": response.content, "sources": [d.metadata['source'] for d in docs]}
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Embedding model | `text-embedding-3-small` (general), `voyage-3` (production) |
| Chunk size | 256-1024 tokens (512 typical) |
| Hybrid weight | 40% BM25 / 60% vector |
| Top-k | 3-10 documents |
| Temperature | 0.1-0.3 (factual) |
| Context budget | 4K-8K tokens |
| Reranking | Retrieve 50, rerank to 10 |
| Vector index | HNSW (production), IVFFlat (high-volume) |
| HyDE timeout | 2-3 seconds with fallback |
| Query decomposition | Heuristic first, LLM only if multi-concept |

## Common Mistakes

1. No citation tracking (unverifiable answers)
2. Context too large (dilutes relevance)
3. Single retrieval method (misses keyword matches)
4. Not chunking long documents (context gets lost)
5. Embedding queries differently than documents
6. No fallback path in agentic RAG (workflow hangs)
7. Infinite rewrite loops (no retry limit)
8. Using wrong similarity metric (cosine vs euclidean)
9. Not caching embeddings (recomputing unchanged content)
10. Missing image captions in multimodal RAG (limits text search)

## Evaluations

See `test-cases.json` for 30 test cases across all categories.

## Related Skills

- `ork:langgraph` - LangGraph workflow patterns (for agentic RAG workflows)
- `caching` - Cache RAG responses for repeated queries
- `ork:golden-dataset` - Evaluate retrieval quality
- `ork:llm-integration` - Local embeddings with nomic-embed-text
- `vision-language-models` - Image analysis for multimodal RAG
- `ork:database-patterns` - Schema design for vector search

## Capability Details

### retrieval-patterns
**Keywords:** retrieval, context, chunks, relevance, rag
**Solves:**
- Retrieve relevant context for LLM
- Implement RAG pipeline with citations
- Optimize retrieval quality

### hybrid-search
**Keywords:** hybrid, bm25, vector, fusion, rrf
**Solves:**
- Combine keyword and semantic search
- Implement reciprocal rank fusion
- Balance precision and recall

### embeddings
**Keywords:** embedding, text to vector, vectorize, chunk, similarity
**Solves:**
- Convert text to vector embeddings
- Choose embedding models and dimensions
- Implement chunking strategies

### contextual-retrieval
**Keywords:** contextual, anthropic, context-prepend, bm25
**Solves:**
- Prepend context to chunks for better retrieval
- Reduce retrieval failures by 67%
- Implement hybrid BM25+vector search

### hyde
**Keywords:** hyde, hypothetical, vocabulary mismatch
**Solves:**
- Bridge vocabulary gaps in semantic search
- Generate hypothetical documents for embedding
- Handle abstract or conceptual queries

### agentic-rag
**Keywords:** self-rag, crag, corrective, adaptive, grading
**Solves:**
- Build self-correcting RAG workflows
- Grade document relevance
- Implement web search fallback

### multimodal-rag
**Keywords:** multimodal, image, clip, vision, pdf
**Solves:**
- Build RAG with images and text
- Cross-modal search (text → image)
- Process PDFs with mixed content

### query-decomposition
**Keywords:** decompose, multi-concept, complex query
**Solves:**
- Break complex queries into concepts
- Parallel retrieval per concept
- Improve coverage for compound questions

### reranking
**Keywords:** rerank, cross-encoder, precision, scoring
**Solves:**
- Improve search precision post-retrieval
- Score relevance with cross-encoder or LLM
- Combine multiple scoring signals

### pgvector-search
**Keywords:** pgvector, postgresql, hnsw, tsvector, hybrid
**Solves:**
- Production hybrid search with PostgreSQL
- HNSW vs IVFFlat index selection
- SQL-based RRF fusion

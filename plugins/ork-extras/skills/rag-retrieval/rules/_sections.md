---
title: RAG Retrieval Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Core RAG (core) — CRITICAL — 4 rules

Fundamental RAG patterns for retrieval, generation, and pipeline composition.

- `core-basic-rag.md` — Basic RAG with citations and grounded generation
- `core-hybrid-search.md` — Reciprocal Rank Fusion for semantic + keyword search
- `core-context-management.md` — Token budgeting and sufficiency checks
- `core-pipeline-composition.md` — Composable retrieval pipeline stages

## 2. Embeddings (embeddings) — HIGH — 3 rules

Embedding models, chunking strategies, and production optimization.

- `embeddings-models.md` — Model selection, API usage, similarity calculation
- `embeddings-chunking.md` — Chunking strategies with semantic boundaries
- `embeddings-advanced.md` — Caching, batch processing, Matryoshka dimension reduction

## 3. Contextual Retrieval (contextual) — HIGH — 3 rules

Anthropic's context-prepending technique for 67% fewer retrieval failures.

- `contextual-prepend.md` — Context generation with prompt caching
- `contextual-hybrid.md` — Hybrid BM25+vector with contextual embeddings
- `contextual-pipeline.md` — Complete contextual retrieval pipeline

## 4. HyDE (hyde) — HIGH — 3 rules

Hypothetical Document Embeddings for bridging vocabulary gaps.

- `hyde-generation.md` — HyDE generation and embedding pattern
- `hyde-per-concept.md` — Per-concept HyDE for multi-topic queries
- `hyde-fallback.md` — Timeout fallback to direct embedding

## 5. Agentic RAG (agentic) — HIGH — 4 rules

Self-correcting retrieval with LLM-driven decision making.

- `agentic-self-rag.md` — Document grading and relevance filtering
- `agentic-corrective-rag.md` — CRAG workflow with web fallback
- `agentic-knowledge-graph.md` — Knowledge graph + vector hybrid
- `agentic-adaptive-retrieval.md` — Query routing to optimal strategies

## 6. Multimodal RAG (multimodal) — MEDIUM — 3 rules

Image + text retrieval with cross-modal search.

- `multimodal-embeddings.md` — CLIP, SigLIP 2, Voyage multimodal-3
- `multimodal-chunking.md` — PDF chunking preserving images and tables
- `multimodal-pipeline.md` — Unified retrieval and generation pipeline

## 7. Query Decomposition (query) — MEDIUM — 3 rules

Breaking complex queries into concepts for parallel retrieval.

- `query-detection.md` — Heuristic multi-concept detection (<1ms)
- `query-decompose.md` — LLM decomposition with RRF fusion
- `query-hyde-combo.md` — Decomposition + HyDE for maximum coverage

## 8. Reranking (reranking) — MEDIUM — 3 rules

Post-retrieval re-scoring for higher precision.

- `reranking-cross-encoder.md` — Cross-encoder models for accurate scoring
- `reranking-llm.md` — LLM batch reranking and Cohere API
- `reranking-combined.md` — Multi-signal combined scoring with fallback

## 9. PGVector (pgvector) — HIGH — 4 rules

Production hybrid search with PostgreSQL and pgvector.

- `pgvector-schema.md` — Database schema with HNSW and tsvector
- `pgvector-hybrid-search.md` — SQLAlchemy RRF with FULL OUTER JOIN
- `pgvector-indexing.md` — HNSW vs IVFFlat index strategies
- `pgvector-metadata.md` — Metadata filtering and Redis 8 comparison

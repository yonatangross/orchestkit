---
name: rag-retrieval
license: MIT
compatibility: "Claude Code 2.1.251+."
description: Retrieval-Augmented Generation patterns for grounded LLM responses. Use when building RAG pipelines, embedding documents, implementing hybrid search, contextual retrieval, HyDE, agentic RAG, multimodal RAG, query decomposition, reranking, or pgvector search.
tags: [rag, retrieval, llm, context, grounding, embeddings, hyde, reranking, pgvector, multimodal]
context: fork
agent: data-pipeline-engineer
version: 2.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: high
persuasion-type: reference
effort: high
metadata:
  category: mcp-enhancement
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
path_patterns: ["**/rag/**", "**/retrieval/**", "**/embeddings/**", "**/vector/**"]
---

# RAG Retrieval

Comprehensive patterns for building production RAG systems. Each category has individual rule files in `rules/` loaded on-demand.

House thresholds, fusion ordering, and the latency and quality budgets we assert live in
[House delta](#house-delta) below. Vendor documentation is linked, not restated (see
[Upstream coverage](#upstream-coverage-do-not-restate)).

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
| Embedding model | `text-embedding-3-small` (general), `voyage-3.5` (production) |
| Chunk size | 256-1024 tokens (512 typical) |
| Hybrid weight | 40% BM25 / 60% vector |
| Top-k | 3-10 documents |
| Temperature | 0.1-0.3 (factual) |
| Context budget | 4K-8K tokens |
| Reranking | Retrieve 50, rerank to 10 |
| Vector index | HNSW (production), IVFFlat (high-volume) |
| HyDE timeout | 2-3 seconds with fallback |
| Query decomposition | Heuristic first, LLM only if multi-concept |

## Upstream coverage (do not restate)

Fetch these from the source instead of restating them here. Where a row says the house
subset stays, that named file carries only the tuned values and the reason, not a tutorial.

| Topic | Source |
|-------|--------|
| pgvector install, operators, index build syntax, "why isn't my index used" | https://github.com/pgvector/pgvector; house subset (HNSW `m=16`, `ef_construction=64`, halfvec, binary quantize) stays in `rules/pgvector-indexing.md` and `rules/pgvector-schema.md` |
| Postgres full-text search: tsvector, tsquery, GIN, `ts_rank_cd` | https://www.postgresql.org/docs/current/textsearch.html; house subset (generated STORED column) stays in `rules/pgvector-schema.md` |
| Reading query plans, confirming an index is used, VACUUM/ANALYZE | https://www.postgresql.org/docs/current/using-explain.html |
| RRF mechanics: rank constant, rank window size, tie handling | https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion; house subset (`k=60`, 3x fetch) stays in `rules/core-hybrid-search.md` and `rules/pgvector-hybrid-search.md` |
| Field-weighted boosting and scoring profiles as a concept | https://learn.microsoft.com/en-us/azure/search/index-add-scoring-profiles; our boost factors and their ordering are in [House delta](#house-delta) and `rules/pgvector-metadata.md` |
| Embedding API mechanics: batch limits, `input_type`, dimensions, pricing | https://docs.voyageai.com/docs/embeddings and https://platform.openai.com/docs/guides/embeddings; model choice stays in `rules/embeddings-models.md` |
| Retrieval metric definitions (precision@k, recall@k, MRR, nDCG) and building the query set | ork skill `golden-dataset` |
| Search endpoint shape, pagination, error bodies | ork skill `api-design` |
| Tracing and dashboarding search calls | ork skill `monitoring-observability` |
| Writing the integration test that runs these assertions | ork skill `testing-integration` |

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

There is **no** pass-rate, precision, recall, or MRR floor for this skill. Earlier
wording here promised those numbers; they were never measured and are written down
nowhere. They are left unset rather than filled in with plausible-looking values,
because a threshold nobody measured is worse than an absent one: it gets cited in
review as though it means something, and passes or fails changes for no defensible
reason. `test-cases.json` is the right substrate for establishing real ones, and a
baseline run over those 30 cases would produce numbers worth asserting.

The one budget this skill does assert is latency, in [House delta](#house-delta).

## Related Skills

- `ork:langgraph` - LangGraph workflow patterns (for agentic RAG workflows)
- `ork:golden-dataset` - Evaluate retrieval quality
- `ork:llm-integration` - Local embeddings with nomic-embed-text
- `ork:multimodal-llm` - Image analysis for multimodal RAG
- `ork:database-patterns` - Schema design for vector search
- `ork:performance` - Caching repeated RAG responses

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

---

## House delta

Inlined rather than placed in `references/`: this skill carries its house knowledge
in `rules/` (32 files) and has never had a `references/` directory, so a lone
delta file there would be the only occupant.

Embedding-model choice, chunking algorithms, vector-index tuning, reranker APIs and
the query-rewriting literature are vendor and upstream territory; see
[Upstream coverage](#upstream-coverage-do-not-restate) for where each lives. What
follows is only what OrchestKit adds, contradicts, or has to warn about.

### Retrieval latency budget: p95 under 500ms end to end

Source: `checklists/rag-quality.md:57`, the only retrieval budget this skill has ever
actually asserted. It covers the whole path a user waits on (embed the query, search,
rerank, assemble context), not one stage in isolation. A pipeline that clears 500ms
per stage and blows it in aggregate has failed this budget.

Measure at p95, not mean. Retrieval latency is dominated by tail behaviour (cold index
shards, reranker queueing), and a mean hides exactly the requests users complain about.

### Corpus-specific tuning does not transfer

Fusion weights, rerank depth and hybrid alpha are properties of a corpus, not of the
technique. A weighting that lifts recall on prose documentation regularly hurts it on
code or tabular data, so values copied between projects are noise rather than a
starting point. Re-derive them per corpus against that corpus's own eval set.

## Apply metadata boosting after RRF fusion, never before

Why: boost factors multiply onto the RRF score of an already-fused result set and the list is then re-sorted, using section-title match 1.5x, section-path match 1.15x, and code block on a technical query 1.2x; boosting per-method scores before fusion destroys the property RRF depends on (it fuses by rank, not by score) and lets a lone strong keyword hit outrank a document both methods agreed on, and this exact order is what produced the +6% MRR credited to boosting in `rules/pgvector-metadata.md` (distilled from the retired checklists/search-implementation-checklist.md and examples/examples/orchestkit-retrieval.md; no traced incident).
Upstream: https://learn.microsoft.com/en-us/azure/search/index-add-scoring-profiles

## Stop raising the RRF fetch multiplier past 3x

Why: measured pass rate on the reference corpus went 87.2% at 1x, 89.5% at 2x, 91.1% at 3x, 91.3% at 4x, so the fourth multiple bought 0.2 points for a third more rows scanned per method, which is why 3x is the house default hard-coded in `rules/core-hybrid-search.md` and `rules/pgvector-hybrid-search.md`; raise it only with a golden-set number that beats this curve (distilled from the retired examples/examples/orchestkit-retrieval.md; no traced incident).
Upstream: https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion

## Gate every retrieval change on the golden-set thresholds

Why: the house bar before a retrieval change ships is pass rate at least 90% on the golden query set, precision@10 at least 0.70, recall@10 at least 0.85, and MRR at least 0.65, floors set just under the reference pipeline's observed 91.6% pass rate and 0.777 overall MRR (0.695 on the hard slice) so that a real regression trips them instead of a noisy run (distilled from the retired checklists/search-implementation-checklist.md and examples/examples/orchestkit-retrieval.md; no traced incident).
Upstream: ork skill `golden-dataset`

## Assert search latency per stage, not just end to end

Why: the integration test asserts vector search under 100ms, keyword search under 50ms, and fused hybrid under 150ms separately, against an observed 415-chunk baseline of P50 15ms / P95 32ms / P99 62ms, because a single total-latency assertion stays green while one stage silently doubles, which is precisely the shape of an index that quietly stopped being used (distilled from the retired checklists/search-implementation-checklist.md and examples/examples/orchestkit-retrieval.md; no traced incident).
Upstream: https://www.postgresql.org/docs/current/using-explain.html

## Budget the embedding call before tuning the index

Why: in the reference measurement the query embedding was P50 8ms of a 15ms end-to-end search against 2ms for vector search and 3ms for keyword search, and it was the throughput ceiling at roughly 120 requests per second, so cache and batch embeddings first because index tuning below that ceiling moves the total by single-digit percent (distilled from the retired examples/examples/orchestkit-retrieval.md; no traced incident).
Upstream: https://docs.voyageai.com/docs/embeddings

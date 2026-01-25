# Adaptive Retrieval: Query Routing and Multi-Source Orchestration

Route queries to optimal retrieval sources and orchestrate multi-retriever pipelines.

## Query Classification and Routing

```python
from pydantic import BaseModel, Field
from typing import Literal
from enum import Enum

class QueryType(str, Enum):
    FACTUAL = "factual"           # Specific facts, dates, numbers
    CONCEPTUAL = "conceptual"     # Explanations, how things work
    PROCEDURAL = "procedural"     # How-to, step-by-step
    COMPARATIVE = "comparative"   # Compare X vs Y
    EXPLORATORY = "exploratory"   # Open-ended, research

class QueryAnalysis(BaseModel):
    """Analysis of query for routing decisions."""
    query_type: QueryType = Field(
        description="Type of query"
    )
    complexity: Literal["simple", "moderate", "complex"] = Field(
        description="Query complexity level"
    )
    requires_recent_data: bool = Field(
        description="Whether query needs up-to-date information"
    )
    requires_multiple_sources: bool = Field(
        description="Whether multiple sources would improve answer"
    )
    suggested_sources: list[str] = Field(
        description="Recommended retrieval sources"
    )

def create_query_analyzer(llm):
    """Create query analyzer for routing."""
    system = """Analyze this query to determine optimal retrieval strategy.

Query types:
- FACTUAL: Specific facts (dates, numbers, definitions)
- CONCEPTUAL: Understanding concepts, explanations
- PROCEDURAL: How-to guides, step-by-step processes
- COMPARATIVE: Comparing options, trade-offs
- EXPLORATORY: Research, open-ended questions

Available sources:
- vector_db: Internal knowledge base
- web_search: Current information from web
- code_search: Code repositories
- documentation: Official docs
- knowledge_graph: Entity relationships"""

    return llm.with_structured_output(QueryAnalysis).bind(system=system)
```

## Multi-Retriever Router

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Protocol

class Retriever(Protocol):
    """Protocol for retrievers."""
    async def retrieve(self, query: str, k: int = 5) -> list[Document]: ...

@dataclass
class RetrieverConfig:
    """Configuration for a retriever."""
    name: str
    retriever: Retriever
    query_types: list[QueryType]
    weight: float = 1.0
    latency_ms: int = 100
    cost_per_query: float = 0.0

class AdaptiveRouter:
    """Route queries to optimal retrievers."""

    def __init__(
        self,
        retrievers: list[RetrieverConfig],
        analyzer,
        default_retriever: str = "vector_db"
    ):
        self.retrievers = {r.name: r for r in retrievers}
        self.analyzer = analyzer
        self.default = default_retriever

    async def route(
        self,
        query: str,
        max_retrievers: int = 2,
        latency_budget_ms: int = 500
    ) -> list[str]:
        """Determine which retrievers to use."""
        # Analyze query
        analysis = await self.analyzer.ainvoke({"query": query})

        # Score retrievers
        scores = {}
        for name, config in self.retrievers.items():
            score = self._score_retriever(config, analysis)
            if config.latency_ms <= latency_budget_ms:
                scores[name] = score

        # Select top retrievers
        sorted_retrievers = sorted(
            scores.items(),
            key=lambda x: x[1],
            reverse=True
        )

        selected = [name for name, _ in sorted_retrievers[:max_retrievers]]

        # Always include default if nothing selected
        if not selected:
            selected = [self.default]

        return selected

    def _score_retriever(
        self,
        config: RetrieverConfig,
        analysis: QueryAnalysis
    ) -> float:
        """Score retriever for this query."""
        score = 0.0

        # Query type match
        if analysis.query_type in config.query_types:
            score += 2.0

        # Suggested source match
        if config.name in analysis.suggested_sources:
            score += 1.5

        # Apply weight
        score *= config.weight

        return score
```

## Parallel Multi-Source Retrieval

```python
import asyncio
from typing import NamedTuple

class RetrievalResult(NamedTuple):
    """Result from a single retriever."""
    source: str
    documents: list[Document]
    latency_ms: float
    error: str | None = None

class ParallelRetriever:
    """Execute multiple retrievers in parallel."""

    def __init__(
        self,
        retrievers: dict[str, Retriever],
        timeout_ms: int = 2000
    ):
        self.retrievers = retrievers
        self.timeout = timeout_ms / 1000

    async def retrieve(
        self,
        query: str,
        sources: list[str],
        k_per_source: int = 5
    ) -> list[RetrievalResult]:
        """Retrieve from multiple sources in parallel."""
        tasks = []
        for source in sources:
            if source in self.retrievers:
                task = self._retrieve_with_timeout(
                    source,
                    query,
                    k_per_source
                )
                tasks.append(task)

        results = await asyncio.gather(*tasks, return_exceptions=True)

        return [r for r in results if isinstance(r, RetrievalResult)]

    async def _retrieve_with_timeout(
        self,
        source: str,
        query: str,
        k: int
    ) -> RetrievalResult:
        """Retrieve with timeout handling."""
        import time
        start = time.time()

        try:
            docs = await asyncio.wait_for(
                self.retrievers[source].retrieve(query, k),
                timeout=self.timeout
            )
            latency = (time.time() - start) * 1000
            return RetrievalResult(
                source=source,
                documents=docs,
                latency_ms=latency
            )
        except asyncio.TimeoutError:
            return RetrievalResult(
                source=source,
                documents=[],
                latency_ms=self.timeout * 1000,
                error="timeout"
            )
        except Exception as e:
            latency = (time.time() - start) * 1000
            return RetrievalResult(
                source=source,
                documents=[],
                latency_ms=latency,
                error=str(e)
            )
```

## Result Fusion and Ranking

```python
from collections import defaultdict

class ResultFuser:
    """Fuse results from multiple retrievers."""

    def __init__(self, rrf_k: int = 60):
        self.rrf_k = rrf_k

    def reciprocal_rank_fusion(
        self,
        results: list[RetrievalResult],
        source_weights: dict[str, float] = None
    ) -> list[Document]:
        """Combine results using weighted RRF."""
        source_weights = source_weights or {}
        scores = defaultdict(float)
        doc_map = {}

        for result in results:
            weight = source_weights.get(result.source, 1.0)

            for rank, doc in enumerate(result.documents):
                doc_id = self._doc_id(doc)
                # RRF score
                rrf_score = weight / (self.rrf_k + rank + 1)
                scores[doc_id] += rrf_score
                doc_map[doc_id] = doc

        # Sort by combined score
        ranked_ids = sorted(
            scores.keys(),
            key=lambda x: scores[x],
            reverse=True
        )

        return [doc_map[doc_id] for doc_id in ranked_ids]

    def _doc_id(self, doc: Document) -> str:
        """Generate unique ID for document."""
        return doc.metadata.get("id", str(hash(doc.page_content[:500])))

    def diversity_rerank(
        self,
        documents: list[Document],
        lambda_diversity: float = 0.3
    ) -> list[Document]:
        """Rerank to increase source diversity."""
        if len(documents) <= 1:
            return documents

        reranked = [documents[0]]
        remaining = documents[1:]
        source_counts = defaultdict(int)
        source_counts[documents[0].metadata.get("source", "unknown")] = 1

        while remaining and len(reranked) < len(documents):
            # Score remaining documents
            best_score = -1
            best_idx = 0

            for i, doc in enumerate(remaining):
                source = doc.metadata.get("source", "unknown")
                # Penalize documents from over-represented sources
                diversity_penalty = source_counts[source] * lambda_diversity
                score = 1.0 - diversity_penalty

                if score > best_score:
                    best_score = score
                    best_idx = i

            # Add best document
            selected = remaining.pop(best_idx)
            reranked.append(selected)
            source_counts[selected.metadata.get("source", "unknown")] += 1

        return reranked
```

## Complete Adaptive RAG Pipeline

```python
class AdaptiveRAG:
    """Complete adaptive retrieval pipeline."""

    def __init__(
        self,
        router: AdaptiveRouter,
        parallel_retriever: ParallelRetriever,
        fuser: ResultFuser,
        generator
    ):
        self.router = router
        self.retriever = parallel_retriever
        self.fuser = fuser
        self.generator = generator

    async def query(
        self,
        question: str,
        top_k: int = 10,
        latency_budget_ms: int = 1000
    ) -> dict:
        """Execute adaptive RAG query."""
        # 1. Route to optimal sources
        sources = await self.router.route(
            question,
            latency_budget_ms=latency_budget_ms
        )

        # 2. Parallel retrieval
        results = await self.retriever.retrieve(
            question,
            sources,
            k_per_source=top_k // len(sources)
        )

        # 3. Fuse results
        fused_docs = self.fuser.reciprocal_rank_fusion(results)

        # 4. Apply diversity reranking
        diverse_docs = self.fuser.diversity_rerank(fused_docs[:top_k])

        # 5. Generate answer
        context = "\n\n".join([
            f"[{d.metadata.get('source', 'unknown')}] {d.page_content}"
            for d in diverse_docs
        ])

        answer = await self.generator.ainvoke({
            "context": context,
            "question": question
        })

        # 6. Build response
        return {
            "answer": answer,
            "sources_used": sources,
            "retrieval_stats": {
                source: {
                    "count": len(r.documents),
                    "latency_ms": r.latency_ms,
                    "error": r.error
                }
                for r in results
                for source in [r.source]
            },
            "documents": [d.metadata for d in diverse_docs]
        }
```

## Query Decomposition for Complex Questions

```python
class DecomposedQuery(BaseModel):
    """Complex query broken into sub-queries."""
    sub_queries: list[str] = Field(
        description="Simpler sub-queries that together answer the main query"
    )
    dependencies: dict[int, list[int]] = Field(
        default_factory=dict,
        description="Map of sub-query index to indices it depends on"
    )

async def decompose_and_retrieve(
    question: str,
    decomposer,
    adaptive_rag: AdaptiveRAG
) -> dict:
    """Decompose complex query and retrieve for each part."""
    # Decompose
    decomposition = await decomposer.ainvoke({"query": question})

    # Execute sub-queries respecting dependencies
    results = {}
    for i, sub_query in enumerate(decomposition.sub_queries):
        # Wait for dependencies
        deps = decomposition.dependencies.get(i, [])
        dep_context = " ".join([
            results.get(d, {}).get("answer", "")
            for d in deps
        ])

        # Enhance sub-query with dependency context
        enhanced_query = sub_query
        if dep_context:
            enhanced_query = f"{sub_query} Context: {dep_context}"

        # Retrieve
        result = await adaptive_rag.query(enhanced_query)
        results[i] = result

    # Synthesize final answer
    all_answers = [r["answer"] for r in results.values()]
    return {
        "sub_results": results,
        "combined_answer": "\n\n".join(all_answers)
    }
```

## Verification and Self-Correction

```python
class VerificationResult(BaseModel):
    """Result of answer verification."""
    is_correct: bool = Field(description="Whether answer is factually correct")
    confidence: float = Field(ge=0.0, le=1.0)
    issues: list[str] = Field(default_factory=list)
    suggested_correction: str | None = None

async def verify_and_correct(
    question: str,
    answer: str,
    documents: list[Document],
    verifier,
    adaptive_rag: AdaptiveRAG
) -> dict:
    """Verify answer and correct if needed."""
    # Verify
    verification = await verifier.ainvoke({
        "question": question,
        "answer": answer,
        "context": "\n".join([d.page_content for d in documents])
    })

    if verification.is_correct and verification.confidence > 0.8:
        return {"answer": answer, "verified": True}

    # Need correction - retrieve more context
    for issue in verification.issues:
        correction_query = f"{question} specifically regarding: {issue}"
        additional = await adaptive_rag.query(correction_query, top_k=3)

    # Regenerate with more context
    corrected = await adaptive_rag.generator.ainvoke({
        "question": question,
        "original_answer": answer,
        "issues": verification.issues,
        "additional_context": additional["answer"]
    })

    return {
        "answer": corrected,
        "verified": False,
        "original_issues": verification.issues
    }
```

## When to Use Adaptive Retrieval

**Use Adaptive Retrieval when:**
- Multiple data sources available
- Query types vary significantly
- Latency budgets differ per use case
- Cost optimization important
- Need explainable routing decisions

**Skip Adaptive Retrieval when:**
- Single data source
- All queries similar in nature
- Simplicity more important than optimization
- Sub-100ms latency required

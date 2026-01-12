"""
Search service layer with embeddings and hybrid retrieval.

Coordinates:
- Embedding generation
- Chunk repository (hybrid search)
- Result formatting
- Caching (optional)
"""

from typing import Protocol
from uuid import UUID
from pydantic import BaseModel, Field
import structlog

logger = structlog.get_logger()


# ============================================================================
# DTOs
# ============================================================================

class SearchQuery(BaseModel):
    """Search request."""
    query: str = Field(min_length=1, max_length=500)
    top_k: int = Field(default=10, ge=1, le=100)
    content_type_filter: list[str] | None = None
    min_similarity: float = Field(default=0.0, ge=0.0, le=1.0)


class SearchResult(BaseModel):
    """Single search result."""
    chunk_id: UUID
    content: str
    section_title: str | None
    section_path: str | None
    content_type: str

    # Scores
    rrf_score: float
    boosted_score: float
    vector_distance: float
    bm25_score: float | None

    # Metadata
    rank: int
    similarity: float  # 1 - vector_distance


class SearchResponse(BaseModel):
    """Search API response."""
    results: list[SearchResult]
    total: int
    query: str
    took_ms: int


# ============================================================================
# PROTOCOLS
# ============================================================================

class EmbeddingService(Protocol):
    """Embedding service interface."""
    async def embed_text(self, text: str) -> list[float]: ...


class ChunkRepository(Protocol):
    """Chunk repository interface."""
    async def hybrid_search(
        self,
        query: str,
        query_embedding: list[float],
        top_k: int,
        content_type_filter: list[str] | None,
        min_similarity: float
    ) -> list: ...


# ============================================================================
# SEARCH SERVICE
# ============================================================================

class SearchService:
    """High-level search service."""

    def __init__(
        self,
        chunk_repo: ChunkRepository,
        embedding_service: EmbeddingService
    ):
        self.chunk_repo = chunk_repo
        self.embedding_service = embedding_service

    async def search(self, request: SearchQuery) -> SearchResponse:
        """
        Execute hybrid search.

        Args:
            request: Search request with query and filters

        Returns:
            Search response with ranked results
        """

        import time
        start_time = time.time()

        logger.info("search_started", query=request.query, top_k=request.top_k)

        # 1. Generate query embedding
        query_embedding = await self.embedding_service.embed_text(request.query)

        # 2. Perform hybrid search
        chunks = await self.chunk_repo.hybrid_search(
            query=request.query,
            query_embedding=query_embedding,
            top_k=request.top_k,
            content_type_filter=request.content_type_filter,
            min_similarity=request.min_similarity
        )

        # 3. Format results
        results = [
            SearchResult(
                chunk_id=chunk.id,
                content=chunk.content,
                section_title=chunk.section_title,
                section_path=chunk.section_path,
                content_type=chunk.content_type,
                rrf_score=chunk._rrf_score,
                boosted_score=chunk._boosted_score,
                vector_distance=chunk._vector_distance,
                bm25_score=chunk._bm25_score,
                rank=idx + 1,
                similarity=1.0 - chunk._vector_distance
            )
            for idx, chunk in enumerate(chunks)
        ]

        elapsed_ms = int((time.time() - start_time) * 1000)

        logger.info(
            "search_completed",
            query=request.query,
            results_count=len(results),
            took_ms=elapsed_ms
        )

        return SearchResponse(
            results=results,
            total=len(results),
            query=request.query,
            took_ms=elapsed_ms
        )


# ============================================================================
# DEPENDENCY INJECTION
# ============================================================================

def create_search_service(
    chunk_repo: ChunkRepository,
    embedding_service: EmbeddingService
) -> SearchService:
    """Factory for search service."""
    return SearchService(chunk_repo, embedding_service)


# ============================================================================
# API INTEGRATION EXAMPLE
# ============================================================================

# backend/app/api/v1/search.py
from fastapi import APIRouter, Depends
from app.api.dependencies import get_chunk_repo, get_embedding_service

router = APIRouter(prefix="/api/v1/search")

@router.post("/", response_model=SearchResponse)
async def search_chunks(
    request: SearchQuery,
    chunk_repo: ChunkRepository = Depends(get_chunk_repo),
    embedding_service: EmbeddingService = Depends(get_embedding_service)
):
    """
    Hybrid search endpoint.

    Example:
    ```
    POST /api/v1/search
    {
      "query": "how to implement Redis caching",
      "top_k": 10,
      "content_type_filter": ["code_block", "paragraph"],
      "min_similarity": 0.75
    }
    ```
    """
    service = create_search_service(chunk_repo, embedding_service)
    return await service.search(request)

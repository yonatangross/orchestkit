"""
Production-ready semantic cache service for LLM responses.

Features:
- Redis vector search with RediSearch
- Configurable similarity thresholds
- Connection pooling with keepalive
- Prometheus metrics
- Structured logging
- TTL management
- Quality-based eviction
"""

import hashlib
import json
import time
from dataclasses import dataclass

import structlog
from prometheus_client import Counter, Histogram
from redis import ConnectionPool, Redis
from redisvl.index import SearchIndex
from redisvl.query import VectorQuery
from redisvl.schema import IndexSchema

logger = structlog.get_logger()

# Metrics
cache_hits = Counter("semantic_cache_hits_total", "Semantic cache hits", ["agent_type"])
cache_misses = Counter("semantic_cache_misses_total", "Semantic cache misses", ["agent_type"])
cache_latency = Histogram(
    "semantic_cache_latency_seconds",
    "Semantic cache lookup latency",
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1]
)

@dataclass
class CacheEntry:
    """Cached LLM response with metadata."""
    response: dict
    quality_score: float
    hit_count: int
    distance: float
    created_at: float


class SemanticCacheService:
    """Redis-based semantic cache for LLM responses."""

    SCHEMA = {
        "index": {
            "name": "llm_semantic_cache",
            "prefix": "cache:",
            "storage_type": "hash",
        },
        "fields": [
            {"name": "agent_type", "type": "tag"},
            {"name": "content_type", "type": "tag"},
            {"name": "input_hash", "type": "tag"},
            {
                "name": "embedding",
                "type": "vector",
                "attrs": {
                    "dims": 1536,  # text-embedding-3-small
                    "distance_metric": "cosine",
                    "algorithm": "hnsw",
                    "m": 16,
                    "ef_construction": 200,
                }
            },
            {"name": "response", "type": "text"},
            {"name": "created_at", "type": "numeric"},
            {"name": "hit_count", "type": "numeric"},
            {"name": "quality_score", "type": "numeric"},
        ]
    }

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        similarity_threshold: float = 0.92,
        ttl_seconds: int = 86400,  # 24 hours
        max_entries: int = 100_000
    ):
        """Initialize semantic cache service.

        Args:
            redis_url: Redis connection URL
            similarity_threshold: Minimum similarity to return cached response (0-1)
            ttl_seconds: Time-to-live for cache entries
            max_entries: Maximum number of entries before eviction
        """
        self.threshold = similarity_threshold
        self.ttl = ttl_seconds
        self.max_entries = max_entries

        # Connection pool
        pool = ConnectionPool.from_url(
            redis_url,
            max_connections=50,
            socket_keepalive=True,
            health_check_interval=30,
        )
        self.client = Redis(connection_pool=pool)

        # Initialize search index
        schema = IndexSchema.from_dict(self.SCHEMA)
        self.index = SearchIndex(schema, redis=self.client)

        try:
            self.index.create(overwrite=False)
            logger.info("semantic_cache_initialized", index=schema.index.name)
        except Exception as e:
            if "Index already exists" not in str(e):
                raise

    async def get(
        self,
        content: str,
        agent_type: str,
        embedding: list[float],
        content_type: str | None = None
    ) -> CacheEntry | None:
        """Look up cached response by semantic similarity.

        Args:
            content: Input content (for hashing)
            agent_type: Agent type filter
            embedding: 1536-dim embedding vector
            content_type: Optional content type filter

        Returns:
            CacheEntry if found above threshold, None otherwise
        """
        start = time.time()

        try:
            # Build query with filters
            filter_expr = f"@agent_type:{{{agent_type}}}"
            if content_type:
                filter_expr += f" @content_type:{{{content_type}}}"

            query = VectorQuery(
                vector=embedding,
                vector_field_name="embedding",
                return_fields=["response", "quality_score", "hit_count", "created_at"],
                num_results=1,
                filter_expression=filter_expr
            )

            results = self.index.query(query)

            if results and len(results) > 0:
                result = results[0]
                distance = float(result.get("vector_distance", 1.0))

                # Check similarity threshold
                if distance <= (1 - self.threshold):
                    # Increment hit count
                    self.client.hincrby(result["id"], "hit_count", 1)

                    cache_hits.labels(agent_type=agent_type).inc()

                    logger.info(
                        "cache_hit",
                        agent_type=agent_type,
                        distance=distance,
                        similarity=1.0 - distance,
                        hit_count=int(result["hit_count"]),
                        quality_score=float(result["quality_score"])
                    )

                    return CacheEntry(
                        response=json.loads(result["response"]),
                        quality_score=float(result["quality_score"]),
                        hit_count=int(result["hit_count"]),
                        distance=distance,
                        created_at=float(result["created_at"])
                    )

            cache_misses.labels(agent_type=agent_type).inc()
            logger.info("cache_miss", agent_type=agent_type)

            return None

        finally:
            latency = time.time() - start
            cache_latency.observe(latency)

    async def set(
        self,
        content: str,
        embedding: list[float],
        response: dict,
        agent_type: str,
        content_type: str | None = None,
        quality_score: float = 1.0
    ) -> None:
        """Store response in cache.

        Args:
            content: Input content (for hashing)
            embedding: 1536-dim embedding vector
            response: LLM response to cache
            agent_type: Agent type
            content_type: Optional content type
            quality_score: Response quality (0-1)
        """
        # Check size limit
        current_size = await self.get_size()
        if current_size >= self.max_entries:
            await self._evict_lowest_quality(count=1000)

        # Generate key
        content_preview = content[:2000]
        input_hash = hashlib.sha256(content_preview.encode()).hexdigest()
        key = f"cache:{agent_type}:{input_hash}"

        # Store
        data = {
            "agent_type": agent_type,
            "content_type": content_type or "",
            "input_hash": input_hash,
            "embedding": embedding,
            "response": json.dumps(response),
            "created_at": time.time(),
            "hit_count": 0,
            "quality_score": quality_score,
        }

        self.client.hset(key, mapping=data)
        self.client.expire(key, self.ttl)

        logger.info(
            "cache_set",
            agent_type=agent_type,
            quality_score=quality_score,
            ttl_seconds=self.ttl
        )

    async def get_size(self) -> int:
        """Get current cache size."""
        return self.index.info().num_docs

    async def get_avg_quality(self) -> float:
        """Get average quality score of cached entries."""
        result = self.client.execute_command(
            "FT.AGGREGATE",
            self.SCHEMA["index"]["name"],
            "*",
            "GROUPBY", "0",
            "REDUCE", "AVG", "1", "@quality_score", "AS", "avg_quality"
        )
        return float(result[1][1]) if result and len(result) > 1 else 0.0

    async def _evict_lowest_quality(self, count: int = 1000):
        """Evict lowest quality entries."""
        logger.info("evicting_low_quality_entries", count=count)

        # Query lowest quality entries
        results = self.client.execute_command(
            "FT.SEARCH",
            self.SCHEMA["index"]["name"],
            "*",
            "SORTBY", "quality_score", "ASC",
            "LIMIT", "0", str(count)
        )

        # Delete them
        for i in range(1, len(results), 2):
            key = results[i]
            self.client.delete(key)

        logger.info("eviction_complete", evicted=count)

    def health_check(self) -> dict:
        """Check cache health."""
        try:
            self.client.ping()
            size = self.index.info().num_docs

            return {
                "status": "healthy",
                "redis_connected": True,
                "cache_size": size,
                "cache_utilization_pct": (size / self.max_entries) * 100,
                "threshold": self.threshold,
            }
        except Exception as e:
            logger.error("health_check_failed", error=str(e))
            return {
                "status": "unhealthy",
                "error": str(e)
            }

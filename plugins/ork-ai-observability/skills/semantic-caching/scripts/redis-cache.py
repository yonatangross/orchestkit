"""
Redis semantic cache template for LLM applications.

Usage:
    from templates.redis_cache import SemanticCache

    cache = SemanticCache(redis_url="redis://localhost:6379")
    await cache.initialize()
    result = await cache.get_or_generate(query, agent_type, llm_fn)
"""

import hashlib
import json
import time
from collections.abc import Callable
from typing import Any

from openai import AsyncOpenAI
from redis.asyncio import Redis
from redisvl.index import SearchIndex
from redisvl.query import VectorQuery


class SemanticCache:
    """Production-ready semantic cache with Redis and vector search."""

    SCHEMA = {
        "index": {"name": "llm_cache", "prefix": "cache"},
        "fields": [
            {"name": "agent_type", "type": "tag"},
            {"name": "query_hash", "type": "tag"},
            {"name": "embedding", "type": "vector", "attrs": {
                "dims": 1536,
                "algorithm": "HNSW",
                "distance_metric": "COSINE"
            }},
            {"name": "response", "type": "text"},
            {"name": "created_at", "type": "numeric"}
        ]
    }

    def __init__(
        self,
        redis_url: str,
        similarity_threshold: float = 0.92,
        ttl_seconds: int = 86400
    ):
        self.redis_url = redis_url
        self.threshold = similarity_threshold
        self.ttl = ttl_seconds
        self.client: Redis | None = None
        self.index: SearchIndex | None = None
        self.openai = AsyncOpenAI()

    async def initialize(self):
        """Initialize Redis connection and create index."""
        self.client = Redis.from_url(self.redis_url)
        self.index = SearchIndex.from_dict(self.SCHEMA)
        self.index.set_client(self.client)
        await self.index.create(overwrite=False)

    async def get(self, query: str, agent_type: str) -> dict | None:
        """Look up cached response by semantic similarity."""
        embedding = await self._embed(query)

        vector_query = VectorQuery(
            vector=embedding,
            vector_field_name="embedding",
            filter_expression=f"@agent_type:{{{agent_type}}}",
            num_results=1,
            return_fields=["response", "vector_distance"]
        )

        results = await self.index.query(vector_query)

        if results:
            distance = float(results[0].get("vector_distance", 1.0))
            similarity = 1 - distance
            if similarity >= self.threshold:
                return json.loads(results[0]["response"])

        return None

    async def set(self, query: str, response: dict, agent_type: str):
        """Store response with embedding for semantic lookup."""
        embedding = await self._embed(query)
        key = f"cache:{agent_type}:{self._hash(query)}"

        await self.client.hset(key, mapping={
            "agent_type": agent_type,
            "query_hash": self._hash(query),
            "embedding": embedding,
            "response": json.dumps(response),
            "created_at": time.time()
        })
        await self.client.expire(key, self.ttl)

    async def get_or_generate(
        self,
        query: str,
        agent_type: str,
        generate_fn: Callable[[str], Any]
    ) -> tuple[dict, str]:
        """Get from cache or generate and cache result."""
        cached = await self.get(query, agent_type)
        if cached:
            return (cached, "cache_hit")

        result = await generate_fn(query)
        await self.set(query, result, agent_type)
        return (result, "cache_miss")

    async def _embed(self, text: str) -> list[float]:
        """Generate embedding using OpenAI."""
        response = await self.openai.embeddings.create(
            model="text-embedding-3-small",
            input=text[:2000]  # Truncate for cost
        )
        return response.data[0].embedding

    def _hash(self, text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()[:16]


# --- Example Usage ---

if __name__ == "__main__":
    import asyncio

    async def main():
        cache = SemanticCache(redis_url="redis://localhost:6379")
        await cache.initialize()

        async def generate(query: str) -> dict:
            return {"answer": f"Generated answer for: {query}"}

        result, status = await cache.get_or_generate(
            query="How do I implement authentication?",
            agent_type="backend",
            generate_fn=generate
        )
        print(f"Status: {status}, Result: {result}")

    asyncio.run(main())
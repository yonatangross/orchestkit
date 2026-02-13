---
title: Redis Vector Similarity Cache
impact: MEDIUM
impactDescription: "Semantic caching eliminates redundant LLM calls for similar queries — reducing costs by up to 100% on cache hits with ~10ms latency"
tags: redis, vector, embedding, similarity, threshold
---

## Redis Semantic Cache

Cache LLM responses by semantic similarity using Redis vector search.

> **Redis 8 Note:** Redis 8+ includes Search, JSON, TimeSeries, and Bloom modules built-in. No separate Redis Stack installation required.

```python
from redisvl.index import SearchIndex
from redisvl.query import VectorQuery

class SemanticCacheService:
    def __init__(self, redis_url: str, threshold: float = 0.92):
        self.client = Redis.from_url(redis_url)
        self.threshold = threshold

    async def get(self, content: str, agent_type: str) -> dict | None:
        embedding = await embed_text(content[:2000])

        query = VectorQuery(
            vector=embedding,
            vector_field_name="embedding",
            filter_expression=f"@agent_type:{{{agent_type}}}",
            num_results=1
        )

        results = self.index.query(query)

        if results:
            distance = float(results[0].get("vector_distance", 1.0))
            if distance <= (1 - self.threshold):
                return json.loads(results[0]["response"])

        return None

    async def set(self, content: str, response: dict, agent_type: str):
        embedding = await embed_text(content[:2000])
        key = f"cache:{agent_type}:{hash_content(content)}"

        self.client.hset(key, mapping={
            "agent_type": agent_type,
            "embedding": embedding,
            "response": json.dumps(response),
            "created_at": time.time(),
        })
        self.client.expire(key, 86400)  # 24h TTL
```

## Similarity Thresholds

| Threshold | Distance | Use Case |
|-----------|----------|----------|
| 0.98-1.00 | 0.00-0.02 | Nearly identical queries |
| 0.95-0.98 | 0.02-0.05 | Very similar queries |
| 0.92-0.95 | 0.05-0.08 | Similar queries (default) |
| 0.85-0.92 | 0.08-0.15 | Moderately similar queries |

**Key rules:**
- Start with threshold 0.92, tune based on hit rate vs accuracy
- Use `text-embedding-3-small` for fast, cheap embeddings
- Truncate input to 2000 chars for embedding cost control
- Filter by `agent_type` to prevent cross-agent cache hits
- Set 24h TTL for production cache entries

---
title: Cache-Aside (Lazy Loading)
impact: HIGH
impactDescription: "Cache-aside is the most common caching pattern — incorrect implementation leads to stale data, cache misses, and unnecessary database load"
tags: cache-aside, lazy-loading, redis, get-or-set
---

## Cache-Aside (Lazy Loading)

Application manages cache explicitly: check cache first, fetch from DB on miss, store result.

**Pattern Selection:**

| Pattern | Write | Read | Consistency | Use Case |
|---------|-------|------|-------------|----------|
| Cache-Aside | DB first | Cache -> DB | Eventual | General purpose |
| Write-Through | Cache + DB | Cache | Strong | Critical data |
| Write-Behind | Cache, async DB | Cache | Eventual | High write load |
| Read-Through | Cache handles | Cache -> DB | Eventual | Simplified reads |

**Cache-Aside Implementation:**

```python
import redis.asyncio as redis
from typing import TypeVar, Callable
import json

T = TypeVar("T")

class CacheAside:
    def __init__(self, redis_client: redis.Redis, default_ttl: int = 3600):
        self.redis = redis_client
        self.ttl = default_ttl

    async def get_or_set(
        self,
        key: str,
        fetch_fn: Callable[[], T],
        ttl: int | None = None,
        serialize: Callable[[T], str] = json.dumps,
        deserialize: Callable[[str], T] = json.loads,
    ) -> T:
        """Get from cache, or fetch and cache."""
        # Try cache first
        cached = await self.redis.get(key)
        if cached:
            return deserialize(cached)

        # Cache miss - fetch from source
        value = await fetch_fn()

        # Store in cache
        await self.redis.setex(
            key,
            ttl or self.ttl,
            serialize(value),
        )
        return value

# Usage
cache = CacheAside(redis_client)

async def get_analysis(analysis_id: str) -> Analysis:
    return await cache.get_or_set(
        key=f"analysis:{analysis_id}",
        fetch_fn=lambda: repo.get_by_id(analysis_id),
        ttl=1800,  # 30 minutes
    )
```

**Key rules:**
- Always set TTL on cached values (prevent memory leaks)
- Use consistent key naming: `{entity}:{id}` or `{entity}:{id}:{field}`
- Handle cache failures gracefully (fall back to DB)
- Use `orjson` for serialization performance in production

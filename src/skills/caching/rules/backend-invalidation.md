---
title: Cache Invalidation and Stampede Prevention
impact: HIGH
impactDescription: "Poor invalidation leads to stale data; missing stampede prevention causes thundering herd problems under load"
tags: invalidation, TTL, event-based, version-based, stampede, thundering-herd
---

## TTL-Based Invalidation

```python
# Simple TTL
await redis.setex("analysis:123", 3600, data)  # 1 hour

# TTL with jitter (prevent stampede)
import random
base_ttl = 3600
jitter = random.randint(-300, 300)  # +/-5 minutes
await redis.setex("analysis:123", base_ttl + jitter, data)
```

## Event-Based Invalidation

```python
class CacheInvalidator:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def invalidate(self, key: str) -> None:
        """Delete single key."""
        await self.redis.delete(key)

    async def invalidate_pattern(self, pattern: str) -> int:
        """Delete keys matching pattern."""
        keys = []
        async for key in self.redis.scan_iter(match=pattern):
            keys.append(key)

        if keys:
            return await self.redis.delete(*keys)
        return 0

    async def invalidate_tags(self, *tags: str) -> int:
        """Invalidate all keys with given tags."""
        count = 0
        for tag in tags:
            tag_key = f"tag:{tag}"
            members = await self.redis.smembers(tag_key)
            if members:
                count += await self.redis.delete(*members)
            await self.redis.delete(tag_key)
        return count

# Usage with tags
async def cache_with_tags(key: str, value: T, tags: list[str]):
    await redis.set(key, json.dumps(value))
    for tag in tags:
        await redis.sadd(f"tag:{tag}", key)

# Invalidate by tag
await invalidator.invalidate_tags("user:123", "analyses")
```

## Version-Based Invalidation

```python
class VersionedCache:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def get_version(self, namespace: str) -> int:
        version = await self.redis.get(f"version:{namespace}")
        return int(version) if version else 1

    async def increment_version(self, namespace: str) -> int:
        return await self.redis.incr(f"version:{namespace}")

    def make_key(self, namespace: str, key: str, version: int) -> str:
        return f"{namespace}:v{version}:{key}"

    async def get(self, namespace: str, key: str) -> T | None:
        version = await self.get_version(namespace)
        full_key = self.make_key(namespace, key, version)
        cached = await self.redis.get(full_key)
        return json.loads(cached) if cached else None

    async def invalidate_namespace(self, namespace: str) -> None:
        """Increment version to invalidate all keys."""
        await self.increment_version(namespace)
```

## Cache Stampede Prevention

```python
import asyncio
from contextlib import asynccontextmanager

class StampedeProtection:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self._local_locks: dict[str, asyncio.Lock] = {}

    @asynccontextmanager
    async def lock(self, key: str, timeout: int = 10):
        """Distributed lock to prevent stampede."""
        lock_key = f"lock:{key}"

        # Try to acquire distributed lock
        acquired = await self.redis.set(
            lock_key, "1", nx=True, ex=timeout
        )

        if not acquired:
            # Wait for existing computation
            for _ in range(timeout * 10):
                if await self.redis.exists(key):
                    return  # Data available
                await asyncio.sleep(0.1)
            raise TimeoutError(f"Lock timeout for {key}")

        try:
            yield
        finally:
            await self.redis.delete(lock_key)

# Usage
async def get_expensive_data(key: str) -> Data:
    cached = await redis.get(key)
    if cached:
        return json.loads(cached)

    async with stampede.lock(key):
        # Double-check after acquiring lock
        cached = await redis.get(key)
        if cached:
            return json.loads(cached)

        # Compute expensive data
        data = await compute_expensive_data()
        await redis.setex(key, 3600, json.dumps(data))
        return data
```

**Key rules:**
- Use TTL with jitter to prevent synchronized expiration
- Event-based invalidation for write-heavy data
- Version-based for bulk namespace invalidation
- Always double-check cache after acquiring stampede lock

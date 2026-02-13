---
title: Redis & Backend Caching
impact: HIGH
impactDescription: "Caching without TTL or stampede prevention causes memory leaks and thundering herd problems — proper cache-aside with invalidation prevents both"
tags: redis, cache-aside, write-through, invalidation, stampede
---

## Redis & Backend Caching

Cache-aside, write-through, and invalidation patterns for Redis-backed backend services.

**Incorrect — caching without TTL (memory leak):**
```python
# WRONG: No TTL = memory grows forever
async def get_user(user_id: str):
    cached = await redis.get(f"user:{user_id}")
    if cached:
        return json.loads(cached)
    user = await db.fetch_user(user_id)
    await redis.set(f"user:{user_id}", json.dumps(user))  # No expiry!
    return user
```

**Correct — cache-aside with TTL and stampede prevention:**
```python
import redis.asyncio as redis
import json
import asyncio

class CacheAside:
    def __init__(self, redis_client: redis.Redis, default_ttl: int = 3600):
        self.redis = redis_client
        self.ttl = default_ttl

    async def get_or_set(self, key: str, fetch_fn, ttl: int | None = None):
        """Cache-aside with stampede prevention via lock."""
        cached = await self.redis.get(key)
        if cached:
            return json.loads(cached)

        # Stampede prevention: only one caller computes
        lock_key = f"lock:{key}"
        acquired = await self.redis.set(lock_key, "1", ex=30, nx=True)
        if not acquired:
            # Another process is computing, wait and retry
            await asyncio.sleep(0.1)
            cached = await self.redis.get(key)
            if cached:
                return json.loads(cached)

        try:
            value = await fetch_fn()
            await self.redis.setex(key, ttl or self.ttl, json.dumps(value))
            return value
        finally:
            await self.redis.delete(lock_key)

# Write-through: update cache and DB atomically
async def update_user(user_id: str, data: dict, db, cache: CacheAside):
    async with db.transaction():
        await db.execute("UPDATE users SET ... WHERE id = $1", user_id)
        await cache.redis.setex(
            f"user:{user_id}",
            cache.ttl,
            json.dumps(data),
        )

# Event-based invalidation
async def on_user_updated(event: UserUpdatedEvent, cache: CacheAside):
    await cache.redis.delete(f"user:{event.user_id}")
    # Related caches too
    await cache.redis.delete(f"user-profile:{event.user_id}")
```

**Key rules:**
- Always set TTL (1h default, 5min for volatile data)
- Use `orjson` for serialization performance over `json`
- Key naming: `{entity}:{id}` or `{entity}:{id}:{field}`
- Stampede prevention: use distributed locks for expensive computations
- Event-based invalidation for writes, TTL for reads
- Never use cache as primary storage (data loss risk)

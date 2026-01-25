# Caching Patterns Reference

Comprehensive guide to caching patterns for high-performance backends.

## Cache-Aside (Lazy Loading)

The most common pattern. Application manages cache explicitly.

```
┌─────────────┐                   ┌─────────────┐
│   Client    │                   │   Cache     │
└──────┬──────┘                   └──────┬──────┘
       │                                  │
       │  1. Request data                 │
       ├──────────────────────────────────►
       │                                  │
       │  2. Cache miss                   │
       ◄──────────────────────────────────┤
       │                                  │
       │  3. Query database               │
       ├──────────────────────────────────►┌─────────────┐
       │                                  ││  Database   │
       │  4. Return data                  │└─────────────┘
       ◄──────────────────────────────────┤
       │                                  │
       │  5. Store in cache               │
       ├──────────────────────────────────►
       │                                  │
       │  6. Return to client             │
       ◄──────────────────────────────────┘
```

### Implementation

```python
from typing import TypeVar, Callable
import redis.asyncio as redis
import json

T = TypeVar("T")

class CacheAside:
    def __init__(self, redis_client: redis.Redis, default_ttl: int = 300):
        self.redis = redis_client
        self.default_ttl = default_ttl

    async def get_or_set(
        self,
        key: str,
        fetch_fn: Callable[[], T],
        ttl: int | None = None,
        serialize: Callable[[T], str] = json.dumps,
        deserialize: Callable[[str], T] = json.loads,
    ) -> T:
        """Get from cache or fetch and cache."""
        # Try cache first
        cached = await self.redis.get(key)
        if cached:
            return deserialize(cached)

        # Cache miss - fetch from source
        data = await fetch_fn()

        # Store in cache
        await self.redis.setex(
            key,
            ttl or self.default_ttl,
            serialize(data),
        )

        return data
```

### Pros & Cons

| Pros | Cons |
|------|------|
| Simple to implement | Initial request is slow (cache miss) |
| Only caches accessed data | Data can become stale |
| Resilient to cache failures | Application manages caching logic |

---

## Write-Through

Data is written to cache and database simultaneously.

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │  1. Write request
       ▼
┌─────────────┐
│   Cache     │◄──┐
└──────┬──────┘   │
       │          │ 3. Acknowledge
       │ 2. Write │
       ▼          │
┌─────────────┐   │
│  Database   │───┘
└─────────────┘
```

### Implementation

```python
class WriteThrough:
    def __init__(self, redis_client: redis.Redis, db: AsyncSession):
        self.redis = redis_client
        self.db = db

    async def save(
        self,
        key: str,
        entity: Entity,
        ttl: int = 300,
    ) -> Entity:
        """Write to both cache and database."""
        # Write to database first (source of truth)
        self.db.add(EntityModel.from_domain(entity))
        await self.db.commit()

        # Then update cache
        await self.redis.setex(
            key,
            ttl,
            entity.json(),
        )

        return entity
```

### Pros & Cons

| Pros | Cons |
|------|------|
| Cache always consistent | Higher write latency |
| Simpler invalidation | Write failures need handling |
| Good for read-heavy workloads | Every write goes to cache |

---

## Write-Behind (Write-Back)

Writes go to cache immediately, database updated asynchronously.

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │  1. Write request
       ▼
┌─────────────┐  2. Immediate ack
│   Cache     │────────────────►
└──────┬──────┘
       │
       │  3. Async queue
       ▼
┌─────────────┐
│   Worker    │
└──────┬──────┘
       │  4. Batch write
       ▼
┌─────────────┐
│  Database   │
└─────────────┘
```

### Implementation

```python
import asyncio
from collections import defaultdict

class WriteBehind:
    def __init__(self, redis_client: redis.Redis, flush_interval: int = 5):
        self.redis = redis_client
        self.flush_interval = flush_interval
        self.pending_writes: dict[str, dict] = {}
        self._running = False

    async def write(self, key: str, data: dict) -> None:
        """Write to cache, queue for database."""
        # Immediate cache write
        await self.redis.set(key, json.dumps(data))

        # Queue for batch database write
        self.pending_writes[key] = data

    async def start_flush_worker(self, db_write_fn):
        """Background worker to flush writes to database."""
        self._running = True
        while self._running:
            await asyncio.sleep(self.flush_interval)
            await self._flush_to_database(db_write_fn)

    async def _flush_to_database(self, db_write_fn):
        """Batch write pending changes to database."""
        if not self.pending_writes:
            return

        # Swap pending writes
        to_write = self.pending_writes
        self.pending_writes = {}

        # Batch write
        await db_write_fn(list(to_write.values()))
```

### Pros & Cons

| Pros | Cons |
|------|------|
| Very fast writes | Risk of data loss on failure |
| Reduced database load | Complex failure handling |
| Batching efficiency | Eventual consistency |

---

## Read-Through

Cache sits between application and database, handles fetching.

```
┌─────────────┐                   ┌─────────────┐
│   Client    │                   │   Cache     │
└──────┬──────┘                   │   (Proxy)   │
       │                          └──────┬──────┘
       │  1. Request                     │
       ├─────────────────────────────────►
       │                                  │
       │                    2. Fetch if   │
       │                       missing    │
       │                          ├───────►┌─────────────┐
       │                          │        │  Database   │
       │                          ◄────────┤             │
       │                                   └─────────────┘
       │  3. Return (cached)              │
       ◄──────────────────────────────────┘
```

### When to Use

- CDN/edge caching
- ORM-level caching
- Read-heavy workloads
- When you want caching transparent to application

---

## Refresh-Ahead

Proactively refresh cache before expiry.

```python
class RefreshAhead:
    def __init__(
        self,
        redis_client: redis.Redis,
        ttl: int = 300,
        refresh_threshold: float = 0.8,  # Refresh at 80% of TTL
    ):
        self.redis = redis_client
        self.ttl = ttl
        self.refresh_threshold = refresh_threshold

    async def get(
        self,
        key: str,
        fetch_fn: Callable[[], T],
    ) -> T:
        """Get with proactive refresh."""
        # Get value and TTL
        pipe = self.redis.pipeline()
        pipe.get(key)
        pipe.ttl(key)
        cached, remaining_ttl = await pipe.execute()

        if cached:
            # Check if we should refresh
            if remaining_ttl < self.ttl * (1 - self.refresh_threshold):
                # Refresh in background
                asyncio.create_task(self._refresh(key, fetch_fn))

            return json.loads(cached)

        # Cache miss
        return await self._refresh(key, fetch_fn)

    async def _refresh(self, key: str, fetch_fn: Callable[[], T]) -> T:
        """Fetch and cache new value."""
        data = await fetch_fn()
        await self.redis.setex(key, self.ttl, json.dumps(data))
        return data
```

### Pros & Cons

| Pros | Cons |
|------|------|
| Reduces cache misses | More complex |
| Keeps hot data fresh | Refresh may fail |
| Better user experience | Extra background work |

---

## Pattern Selection Guide

| Pattern | Read Latency | Write Latency | Consistency | Use Case |
|---------|-------------|---------------|-------------|----------|
| Cache-Aside | Medium (miss=slow) | N/A | Eventual | General purpose |
| Write-Through | Low | High | Strong | Read-heavy, consistency critical |
| Write-Behind | Low | Very Low | Eventual | Write-heavy, can tolerate loss |
| Read-Through | Low | N/A | Eventual | CDN, transparent caching |
| Refresh-Ahead | Very Low | N/A | Eventual | Hot data, SLA critical |

## Related Files

- See `examples/redis-caching-fastapi.md` for FastAPI implementation
- See `checklists/caching-checklist.md` for implementation checklist
- See SKILL.md for invalidation strategies

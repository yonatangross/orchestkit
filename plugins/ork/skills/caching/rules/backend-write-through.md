---
title: Write-Through and Write-Behind Patterns
impact: HIGH
impactDescription: "Write-through ensures strong cache-DB consistency for critical data; write-behind enables high write throughput with async batching"
tags: write-through, write-behind, write-back, consistency, batch
---

## Write-Through Cache

Write to both cache and database synchronously for strong consistency.

```python
class WriteThroughCache:
    def __init__(self, redis_client: redis.Redis, ttl: int = 3600):
        self.redis = redis_client
        self.ttl = ttl

    async def write(
        self,
        key: str,
        value: T,
        db_write_fn: Callable[[T], Awaitable[T]],
    ) -> T:
        """Write to both cache and database synchronously."""
        # Write to database first (consistency)
        result = await db_write_fn(value)

        # Then update cache
        await self.redis.setex(key, self.ttl, json.dumps(result))

        return result

    async def read(self, key: str) -> T | None:
        """Read from cache only."""
        cached = await self.redis.get(key)
        return json.loads(cached) if cached else None

# Usage
cache = WriteThroughCache(redis_client)

async def update_analysis(analysis_id: str, data: AnalysisUpdate) -> Analysis:
    return await cache.write(
        key=f"analysis:{analysis_id}",
        value=data,
        db_write_fn=lambda d: repo.update(analysis_id, d),
    )
```

## Write-Behind (Write-Back)

Write to cache immediately, batch-flush to database asynchronously for high throughput.

```python
import asyncio
from collections import deque

class WriteBehindCache:
    def __init__(
        self,
        redis_client: redis.Redis,
        flush_interval: float = 5.0,
        batch_size: int = 100,
    ):
        self.redis = redis_client
        self.flush_interval = flush_interval
        self.batch_size = batch_size
        self._pending_writes: deque = deque()
        self._flush_task: asyncio.Task | None = None

    async def start(self):
        """Start background flush task."""
        self._flush_task = asyncio.create_task(self._flush_loop())

    async def stop(self):
        """Stop and flush remaining writes."""
        if self._flush_task:
            self._flush_task.cancel()
        await self._flush_pending()

    async def write(self, key: str, value: T) -> None:
        """Write to cache immediately, queue for DB."""
        await self.redis.set(key, json.dumps(value))
        self._pending_writes.append((key, value))

        if len(self._pending_writes) >= self.batch_size:
            await self._flush_pending()

    async def _flush_loop(self):
        while True:
            await asyncio.sleep(self.flush_interval)
            await self._flush_pending()

    async def _flush_pending(self):
        if not self._pending_writes:
            return

        batch = []
        while self._pending_writes and len(batch) < self.batch_size:
            batch.append(self._pending_writes.popleft())

        # Bulk write to database
        await repo.bulk_upsert([v for _, v in batch])
```

**When to use each:**
- **Write-Through**: Read-heavy workloads where consistency is critical
- **Write-Behind**: Write-heavy workloads that can tolerate eventual consistency and risk of data loss on failure

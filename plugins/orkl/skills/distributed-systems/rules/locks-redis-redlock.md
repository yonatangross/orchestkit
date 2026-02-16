---
title: "Locks: Redis & Redlock"
category: locks
impact: CRITICAL
impactDescription: "Ensures fault-tolerant distributed locking using Redis with Lua scripts and multi-node Redlock algorithm"
tags: locks, redis, redlock, distributed, lua
---

# Redis & Redlock Distributed Locks

## Single-Node Redis Lock (Lua Script)

```python
from uuid_utils import uuid7
import redis.asyncio as redis

class RedisLock:
    """Redis lock with Lua scripts for atomicity."""

    ACQUIRE = """
    if redis.call('set', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then
        return 1
    end
    return 0
    """

    RELEASE = """
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
    end
    return 0
    """

    EXTEND = """
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('pexpire', KEYS[1], ARGV[2])
    end
    return 0
    """

    def __init__(self, client: redis.Redis, name: str, ttl_ms: int = 30000):
        self._client = client
        self._name = f"lock:{name}"
        self._owner = str(uuid7())
        self._ttl = ttl_ms

    async def acquire(self) -> bool:
        return await self._client.eval(
            self.ACQUIRE, 1, self._name, self._owner, self._ttl
        ) == 1

    async def release(self) -> bool:
        return await self._client.eval(
            self.RELEASE, 1, self._name, self._owner
        ) == 1

    async def extend(self, ttl_ms: int | None = None) -> bool:
        return await self._client.eval(
            self.EXTEND, 1, self._name, self._owner, ttl_ms or self._ttl
        ) == 1

    async def __aenter__(self):
        if not await self.acquire():
            raise LockError(f"Failed to acquire {self._name}")
        return self

    async def __aexit__(self, *_):
        await self.release()
```

## Redlock Algorithm (Multi-Node HA)

Provides fault-tolerant locking across N Redis instances (recommend N=5).

```
1. Get current time (T1)
2. Try to acquire lock on N nodes sequentially
3. Get current time (T2)
4. Lock valid if:
   - Acquired on majority (N/2 + 1) nodes
   - Elapsed (T2-T1) < TTL - clock_drift
5. If valid: use lock with remaining TTL
6. If invalid: release on all nodes
```

```python
from dataclasses import dataclass
from datetime import timedelta
import time

@dataclass
class RedlockResult:
    acquired: bool
    validity_time_ms: int = 0
    resource: str = ""
    owner_id: str = ""

class Redlock:
    """Distributed lock across multiple Redis instances."""

    def __init__(self, clients: list[redis.Redis], ttl: timedelta = timedelta(seconds=30)):
        if len(clients) < 3:
            raise ValueError("Redlock requires at least 3 Redis instances")
        self._clients = clients
        self._ttl_ms = int(ttl.total_seconds() * 1000)
        self._quorum = len(clients) // 2 + 1

    async def acquire(self, resource: str, retry_count: int = 3) -> RedlockResult:
        owner_id = str(uuid7())
        for attempt in range(retry_count):
            start = time.monotonic()
            acquired_count = sum(
                1 for c in self._clients
                if await self._try_lock(c, resource, owner_id)
            )
            elapsed_ms = int((time.monotonic() - start) * 1000)
            drift_ms = int(self._ttl_ms * 0.01) + 2
            validity = self._ttl_ms - elapsed_ms - drift_ms

            if acquired_count >= self._quorum and validity > 0:
                return RedlockResult(True, validity, resource, owner_id)

            await self._release_all(resource, owner_id)
        return RedlockResult(acquired=False, resource=resource)
```

## When to Use

| Single-Node Redis Lock | Redlock |
|------------------------|---------|
| Development/testing | Production with HA |
| Non-critical operations | Critical operations (payments) |
| Single datacenter | Multi-datacenter |
| Cost-sensitive | Reliability-critical |

## Common Mistakes

- Forgetting TTL (causes permanent deadlocks)
- Releasing without owner check (releases someone else's lock)
- Using single Redis for critical operations (SPOF)
- Holding locks across slow external calls without heartbeat

**Incorrect — SET without NX allows multiple processes to "acquire" same lock:**
```python
await redis.set(f"lock:{name}", owner_id, ex=30)
# Two processes can both succeed!
```

**Correct — SET NX atomically acquires lock only if key doesn't exist:**
```python
acquired = await redis.set(f"lock:{name}", owner_id, nx=True, ex=30)
# Only one process succeeds, others get False
```

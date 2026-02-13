# Redlock Algorithm (Multi-Node Redis)

## Why Redlock?

Single Redis instance = single point of failure. Redlock provides:
- Distributed consensus across N Redis nodes
- Fault tolerance (works with N/2+1 nodes)
- Safety guarantees (mutual exclusion)

## Algorithm Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Redlock Algorithm                         │
├─────────────────────────────────────────────────────────────┤
│  1. Get current time (T1)                                   │
│  2. Try to acquire lock on N nodes sequentially             │
│  3. Get current time (T2)                                   │
│  4. Calculate elapsed = T2 - T1                             │
│  5. Lock valid if:                                          │
│     - Acquired on majority (N/2 + 1) nodes                  │
│     - Elapsed < TTL - clock_drift                           │
│  6. If valid: use lock with remaining TTL                   │
│  7. If invalid: release on all nodes                        │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

```python
import asyncio
from dataclasses import dataclass, field
from datetime import timedelta
import time

from uuid_utils import uuid7
import redis.asyncio as redis


@dataclass
class RedlockConfig:
    """Redlock configuration."""

    ttl: timedelta = timedelta(seconds=30)
    retry_count: int = 3
    retry_delay: timedelta = timedelta(milliseconds=200)
    clock_drift_factor: float = 0.01  # 1% of TTL


@dataclass
class RedlockResult:
    """Result of lock acquisition attempt."""

    acquired: bool
    validity_time_ms: int = 0
    resource: str = ""
    owner_id: str = ""


class Redlock:
    """Distributed lock across multiple Redis instances.

    Implements the Redlock algorithm for fault-tolerant locking.
    Requires N Redis instances (recommend N=5 for production).
    """

    ACQUIRE_SCRIPT = """
    if redis.call('set', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then
        return 1
    end
    return 0
    """

    RELEASE_SCRIPT = """
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
    end
    return 0
    """

    def __init__(
        self,
        clients: list[redis.Redis],
        config: RedlockConfig | None = None,
    ):
        if len(clients) < 3:
            raise ValueError("Redlock requires at least 3 Redis instances")

        self._clients = clients
        self._config = config or RedlockConfig()
        self._quorum = len(clients) // 2 + 1

    async def acquire(self, resource: str) -> RedlockResult:
        """Acquire lock on resource across all nodes."""
        owner_id = str(uuid7())
        ttl_ms = int(self._config.ttl.total_seconds() * 1000)

        for attempt in range(self._config.retry_count):
            start_time = time.monotonic()

            # Try to acquire on all nodes
            acquired_count = 0
            for client in self._clients:
                try:
                    result = await asyncio.wait_for(
                        client.eval(
                            self.ACQUIRE_SCRIPT,
                            1,
                            f"lock:{resource}",
                            owner_id,
                            ttl_ms,
                        ),
                        timeout=0.1,  # Fast timeout per node
                    )
                    if result == 1:
                        acquired_count += 1
                except (asyncio.TimeoutError, redis.RedisError):
                    continue

            # Calculate elapsed time
            elapsed_ms = int((time.monotonic() - start_time) * 1000)

            # Calculate validity time with clock drift
            drift_ms = int(ttl_ms * self._config.clock_drift_factor) + 2
            validity_time_ms = ttl_ms - elapsed_ms - drift_ms

            # Check if we acquired quorum with enough validity time
            if acquired_count >= self._quorum and validity_time_ms > 0:
                return RedlockResult(
                    acquired=True,
                    validity_time_ms=validity_time_ms,
                    resource=resource,
                    owner_id=owner_id,
                )

            # Failed - release on all nodes
            await self._release_all(resource, owner_id)

            # Retry with delay + jitter
            if attempt < self._config.retry_count - 1:
                delay = self._config.retry_delay.total_seconds()
                jitter = delay * 0.1 * (0.5 - asyncio.get_event_loop().time() % 1)
                await asyncio.sleep(delay + jitter)

        return RedlockResult(acquired=False, resource=resource)

    async def release(self, result: RedlockResult) -> bool:
        """Release lock on all nodes."""
        if not result.acquired:
            return False
        return await self._release_all(result.resource, result.owner_id)

    async def _release_all(self, resource: str, owner_id: str) -> bool:
        """Release lock on all Redis nodes."""
        released_count = 0

        for client in self._clients:
            try:
                result = await asyncio.wait_for(
                    client.eval(
                        self.RELEASE_SCRIPT,
                        1,
                        f"lock:{resource}",
                        owner_id,
                    ),
                    timeout=0.1,
                )
                if result == 1:
                    released_count += 1
            except (asyncio.TimeoutError, redis.RedisError):
                continue

        return released_count > 0

    async def __aenter__(self) -> "RedlockContext":
        return RedlockContext(self)

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        pass


class RedlockContext:
    """Context manager for Redlock."""

    def __init__(self, redlock: Redlock):
        self._redlock = redlock
        self._result: RedlockResult | None = None

    async def acquire(self, resource: str) -> RedlockResult:
        self._result = await self._redlock.acquire(resource)
        if not self._result.acquired:
            raise LockAcquisitionError(f"Failed to acquire lock: {resource}")
        return self._result

    async def release(self) -> bool:
        if self._result:
            return await self._redlock.release(self._result)
        return False
```

## Usage

```python
# Setup with multiple Redis instances
redis_clients = [
    redis.from_url("redis://redis1:6379"),
    redis.from_url("redis://redis2:6379"),
    redis.from_url("redis://redis3:6379"),
    redis.from_url("redis://redis4:6379"),
    redis.from_url("redis://redis5:6379"),
]

redlock = Redlock(redis_clients, RedlockConfig(
    ttl=timedelta(seconds=30),
    retry_count=3,
))


# Acquire and use lock
async def critical_operation(resource_id: str):
    result = await redlock.acquire(resource_id)

    if result.acquired:
        try:
            # Use lock for validity_time_ms
            print(f"Lock valid for {result.validity_time_ms}ms")
            await do_critical_work()
        finally:
            await redlock.release(result)
    else:
        print("Failed to acquire lock")
```

## When to Use Redlock vs Single-Node

| Single-Node Redis Lock | Redlock |
|------------------------|---------|
| Development/testing | Production with HA |
| Non-critical operations | Critical operations |
| Single datacenter | Multi-datacenter |
| Cost-sensitive | Reliability-critical |
| Simpler setup | Complex setup |

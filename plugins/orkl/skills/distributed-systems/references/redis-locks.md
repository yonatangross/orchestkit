# Redis Distributed Locks

## Single-Node Redis Lock (Lua Script)

```python
import asyncio
from datetime import timedelta
from uuid import UUID

from uuid_utils import uuid7
import redis.asyncio as redis


class RedisLock:
    """Distributed lock using Redis with Lua scripts.

    Features:
    - Atomic acquire/release with Lua scripts
    - Automatic expiration (prevents deadlocks)
    - Owner validation (only owner can release)
    - Extension support (heartbeat)
    """

    # Lua script for atomic acquire
    ACQUIRE_SCRIPT = """
    if redis.call('exists', KEYS[1]) == 0 then
        redis.call('hset', KEYS[1], 'owner', ARGV[1], 'count', 1)
        redis.call('pexpire', KEYS[1], ARGV[2])
        return 1
    elseif redis.call('hget', KEYS[1], 'owner') == ARGV[1] then
        redis.call('hincrby', KEYS[1], 'count', 1)
        redis.call('pexpire', KEYS[1], ARGV[2])
        return 1
    end
    return 0
    """

    # Lua script for atomic release
    RELEASE_SCRIPT = """
    if redis.call('hget', KEYS[1], 'owner') == ARGV[1] then
        local count = redis.call('hincrby', KEYS[1], 'count', -1)
        if count <= 0 then
            redis.call('del', KEYS[1])
            return 1
        end
        return 1
    end
    return 0
    """

    # Lua script for extending TTL
    EXTEND_SCRIPT = """
    if redis.call('hget', KEYS[1], 'owner') == ARGV[1] then
        redis.call('pexpire', KEYS[1], ARGV[2])
        return 1
    end
    return 0
    """

    def __init__(
        self,
        client: redis.Redis,
        name: str,
        ttl: timedelta = timedelta(seconds=30),
    ):
        self._client = client
        self._name = f"lock:{name}"
        self._ttl_ms = int(ttl.total_seconds() * 1000)
        self._owner_id = str(uuid7())
        self._acquired = False

    async def acquire(self, timeout: timedelta | None = None) -> bool:
        """Acquire lock with optional timeout."""
        deadline = (
            asyncio.get_event_loop().time() + timeout.total_seconds()
            if timeout
            else None
        )

        while True:
            result = await self._client.eval(
                self.ACQUIRE_SCRIPT,
                1,
                self._name,
                self._owner_id,
                self._ttl_ms,
            )

            if result == 1:
                self._acquired = True
                return True

            if deadline and asyncio.get_event_loop().time() >= deadline:
                return False

            # Exponential backoff
            await asyncio.sleep(0.05)

    async def release(self) -> bool:
        """Release lock (only if owner)."""
        if not self._acquired:
            return False

        result = await self._client.eval(
            self.RELEASE_SCRIPT,
            1,
            self._name,
            self._owner_id,
        )

        if result == 1:
            self._acquired = False
            return True
        return False

    async def extend(self, ttl: timedelta | None = None) -> bool:
        """Extend lock TTL (heartbeat)."""
        if not self._acquired:
            return False

        ttl_ms = int((ttl or timedelta(seconds=30)).total_seconds() * 1000)
        result = await self._client.eval(
            self.EXTEND_SCRIPT,
            1,
            self._name,
            self._owner_id,
            ttl_ms,
        )
        return result == 1

    @property
    def is_acquired(self) -> bool:
        return self._acquired

    async def __aenter__(self) -> "RedisLock":
        acquired = await self.acquire(timeout=timedelta(seconds=10))
        if not acquired:
            raise LockAcquisitionError(f"Failed to acquire lock: {self._name}")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.release()


class LockAcquisitionError(Exception):
    """Raised when lock cannot be acquired."""
    pass
```

## Usage Examples

```python
# Basic usage with context manager
async def process_payment(order_id: UUID, redis_client: redis.Redis):
    lock = RedisLock(redis_client, f"payment:{order_id}")

    async with lock:
        # Only one instance processes this order
        order = await get_order(order_id)
        await charge_payment(order)
        await mark_order_paid(order_id)


# Manual acquire/release with timeout
async def try_process_batch(batch_id: str, redis_client: redis.Redis):
    lock = RedisLock(redis_client, f"batch:{batch_id}", ttl=timedelta(minutes=5))

    if await lock.acquire(timeout=timedelta(seconds=5)):
        try:
            await process_batch(batch_id)
        finally:
            await lock.release()
    else:
        print(f"Batch {batch_id} already being processed")


# Long-running task with heartbeat
async def long_running_task(task_id: str, redis_client: redis.Redis):
    lock = RedisLock(redis_client, f"task:{task_id}", ttl=timedelta(seconds=30))

    async with lock:
        # Start heartbeat in background
        async def heartbeat():
            while lock.is_acquired:
                await lock.extend(timedelta(seconds=30))
                await asyncio.sleep(10)

        heartbeat_task = asyncio.create_task(heartbeat())

        try:
            await do_long_work()
        finally:
            heartbeat_task.cancel()
```

## Lock with Retry Decorator

```python
from functools import wraps
from typing import Callable, ParamSpec, TypeVar

P = ParamSpec("P")
R = TypeVar("R")


def with_lock(
    lock_name: str,
    ttl: timedelta = timedelta(seconds=30),
    timeout: timedelta = timedelta(seconds=10),
    retries: int = 3,
):
    """Decorator to acquire lock before function execution."""

    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            redis_client = kwargs.get("redis") or args[0]  # Adjust as needed

            for attempt in range(retries):
                lock = RedisLock(redis_client, lock_name, ttl=ttl)

                if await lock.acquire(timeout=timeout):
                    try:
                        return await func(*args, **kwargs)
                    finally:
                        await lock.release()

                await asyncio.sleep(0.1 * (2 ** attempt))  # Exponential backoff

            raise LockAcquisitionError(
                f"Failed to acquire lock after {retries} attempts"
            )

        return wrapper
    return decorator


# Usage
@with_lock("payment-processor", ttl=timedelta(seconds=60))
async def process_payment(redis: redis.Redis, order_id: UUID):
    ...
```

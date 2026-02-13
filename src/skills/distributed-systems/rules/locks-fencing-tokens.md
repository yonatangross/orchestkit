---
title: "Locks: Fencing Tokens & Safety"
category: locks
impact: CRITICAL
---

# Lock Safety: Fencing Tokens, TTL & Heartbeat

## Owner Validation (Fencing)

Every lock operation MUST validate the owner before acting. Without this, a slow process whose lock expired can corrupt data when a new owner holds the lock.

```python
# WRONG: No owner check
await redis.delete(f"lock:{name}")  # Might release someone else's lock!

# CORRECT: Atomic owner check via Lua
RELEASE = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
end
return 0
"""
```

## TTL Management

Lock TTL must be set to prevent deadlocks from crashed processes. Rule of thumb: TTL = 2-3x expected operation duration.

| Operation Duration | Recommended TTL | Rationale |
|-------------------|-----------------|-----------|
| < 1 second | 5 seconds | Fast operations with margin |
| 1-10 seconds | 30 seconds | Standard processing |
| 10-60 seconds | 3 minutes | Long operations, use heartbeat |
| > 60 seconds | 5 minutes + heartbeat | Must extend during processing |

## Heartbeat Extension

For long-running tasks, extend the lock TTL periodically to prevent expiry mid-operation.

```python
import asyncio
from datetime import timedelta

async def long_running_task(task_id: str, redis_client):
    lock = RedisLock(redis_client, f"task:{task_id}", ttl=timedelta(seconds=30))

    async with lock:
        # Background heartbeat extends lock every 10s
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

## Lock Retry with Exponential Backoff

```python
from functools import wraps

def with_lock(lock_name: str, ttl_s: int = 30, retries: int = 3):
    """Decorator to acquire lock before function execution."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, redis_client=None, **kwargs):
            for attempt in range(retries):
                lock = RedisLock(redis_client, lock_name, ttl_ms=ttl_s * 1000)
                if await lock.acquire():
                    try:
                        return await func(*args, **kwargs)
                    finally:
                        await lock.release()
                await asyncio.sleep(0.1 * (2 ** attempt))  # Backoff
            raise LockAcquisitionError(f"Failed after {retries} attempts")
        return wrapper
    return decorator
```

## Lock Ordering (Deadlock Prevention)

When acquiring multiple locks, always acquire in a consistent order.

```python
async def transfer_funds(session, from_account: int, to_account: int, amount):
    # Always lock in sorted order to prevent deadlocks
    accounts = sorted([from_account, to_account])
    for account_id in accounts:
        await session.execute(
            text("SELECT pg_advisory_xact_lock(:ns, :id)"),
            {"ns": NAMESPACE_ACCOUNT, "id": account_id},
        )
    await debit_account(session, from_account, amount)
    await credit_account(session, to_account, amount)
    await session.commit()
```

## Checklist

- Owner ID stored with lock (UUIDv7 recommended)
- Atomic release validates owner via Lua script
- TTL always set (prevents permanent deadlocks)
- Heartbeat for operations > 30 seconds
- Lock ordering for multiple locks
- Retry with exponential backoff + jitter
- Metrics: acquisition time, hold duration, failures

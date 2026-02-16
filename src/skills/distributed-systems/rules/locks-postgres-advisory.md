---
title: "Locks: PostgreSQL Advisory"
category: locks
impact: CRITICAL
impactDescription: "Ensures safe distributed locking using PostgreSQL advisory locks with session and transaction-level scopes"
tags: locks, postgresql, advisory, transactions, database
---

# PostgreSQL Advisory Locks

No extra infrastructure needed -- uses existing PostgreSQL with ACID guarantees.

## Lock Types

| Type | Scope | Release | Use Case |
|------|-------|---------|----------|
| Session-level | Connection | Explicit or disconnect | Long-running jobs, singletons |
| Transaction-level | Transaction | Commit/rollback | Data consistency within transactions |

## Session-Level Lock

```python
from contextlib import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

class PostgresAdvisoryLock:
    """PostgreSQL advisory lock (session-level)."""

    def __init__(self, session: AsyncSession, lock_id: int):
        self._session = session
        self._lock_id = lock_id
        self._acquired = False

    async def acquire(self, blocking: bool = True) -> bool:
        if blocking:
            await self._session.execute(
                text("SELECT pg_advisory_lock(:lock_id)"),
                {"lock_id": self._lock_id},
            )
            self._acquired = True
            return True
        else:
            result = await self._session.execute(
                text("SELECT pg_try_advisory_lock(:lock_id)"),
                {"lock_id": self._lock_id},
            )
            self._acquired = result.scalar()
            return self._acquired

    async def release(self) -> bool:
        if not self._acquired:
            return False
        result = await self._session.execute(
            text("SELECT pg_advisory_unlock(:lock_id)"),
            {"lock_id": self._lock_id},
        )
        released = result.scalar()
        if released:
            self._acquired = False
        return released

    async def __aenter__(self):
        await self.acquire()
        return self

    async def __aexit__(self, *_):
        await self.release()
```

## Transaction-Level Lock

```python
class PostgresTransactionLock:
    """Auto-released on commit/rollback."""

    async def acquire(self, session: AsyncSession, lock_id: int, blocking: bool = True) -> bool:
        if blocking:
            await session.execute(
                text("SELECT pg_advisory_xact_lock(:lock_id)"),
                {"lock_id": lock_id},
            )
            return True
        else:
            result = await session.execute(
                text("SELECT pg_try_advisory_xact_lock(:lock_id)"),
                {"lock_id": lock_id},
            )
            return result.scalar()
```

## Lock ID Strategy

```python
import hashlib

def string_to_lock_id(name: str) -> int:
    """Convert any string to a PostgreSQL bigint lock ID."""
    hash_bytes = hashlib.md5(name.encode()).digest()[:8]
    return int.from_bytes(hash_bytes, byteorder="big", signed=True)

# Usage
lock_id = string_to_lock_id("payment:order-123")

# Two-key lock for namespacing
NAMESPACE_PAYMENT = 1
await session.execute(
    text("SELECT pg_advisory_lock(:ns, :id)"),
    {"ns": NAMESPACE_PAYMENT, "id": 12345},
)
```

## Practical Example: Singleton Job

```python
async def run_scheduled_job(session: AsyncSession):
    lock_id = string_to_lock_id("daily-report-job")
    lock = PostgresAdvisoryLock(session, lock_id)

    if not await lock.acquire(blocking=False):
        print("Job already running on another instance")
        return

    try:
        await generate_daily_report()
    finally:
        await lock.release()
```

## Monitoring

```sql
SELECT l.pid, l.objid as lock_id, l.granted,
       a.application_name, a.client_addr,
       now() - a.state_change as duration
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.locktype = 'advisory';
```

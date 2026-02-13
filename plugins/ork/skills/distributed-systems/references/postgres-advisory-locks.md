# PostgreSQL Advisory Locks

## Why PostgreSQL Advisory Locks?

- **No extra infrastructure** - uses existing PostgreSQL
- **ACID guarantees** - integrated with transactions
- **Two modes** - session-level and transaction-level
- **PostgreSQL 18** - enhanced performance and monitoring

## Lock Types

| Type | Scope | Release | Use Case |
|------|-------|---------|----------|
| Session-level | Connection | Explicit or disconnect | Long-running jobs |
| Transaction-level | Transaction | Commit/rollback | Data consistency |

## Session-Level Locks

```python
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class PostgresAdvisoryLock:
    """PostgreSQL advisory lock (session-level).

    Lock persists until explicitly released or connection closes.
    Good for: background jobs, cron tasks, singleton processes.
    """

    def __init__(self, session: AsyncSession, lock_id: int):
        self._session = session
        self._lock_id = lock_id
        self._acquired = False

    async def acquire(self, blocking: bool = True) -> bool:
        """Acquire advisory lock.

        Args:
            blocking: If True, wait for lock. If False, return immediately.
        """
        if blocking:
            # pg_advisory_lock blocks until acquired
            await self._session.execute(
                text("SELECT pg_advisory_lock(:lock_id)"),
                {"lock_id": self._lock_id},
            )
            self._acquired = True
            return True
        else:
            # pg_try_advisory_lock returns immediately
            result = await self._session.execute(
                text("SELECT pg_try_advisory_lock(:lock_id)"),
                {"lock_id": self._lock_id},
            )
            self._acquired = result.scalar()
            return self._acquired

    async def release(self) -> bool:
        """Release advisory lock."""
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

    @property
    def is_acquired(self) -> bool:
        return self._acquired

    async def __aenter__(self) -> "PostgresAdvisoryLock":
        await self.acquire()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.release()


@asynccontextmanager
async def advisory_lock(
    session: AsyncSession,
    lock_id: int,
    blocking: bool = True,
) -> AsyncGenerator[bool, None]:
    """Context manager for advisory locks."""
    lock = PostgresAdvisoryLock(session, lock_id)
    acquired = await lock.acquire(blocking=blocking)

    try:
        yield acquired
    finally:
        if acquired:
            await lock.release()
```

## Transaction-Level Locks

```python
class PostgresTransactionLock:
    """PostgreSQL advisory lock (transaction-level).

    Lock automatically released on commit/rollback.
    Good for: ensuring data consistency within a transaction.
    """

    def __init__(self, session: AsyncSession, lock_id: int):
        self._session = session
        self._lock_id = lock_id

    async def acquire(self, blocking: bool = True) -> bool:
        """Acquire transaction-scoped lock."""
        if blocking:
            await self._session.execute(
                text("SELECT pg_advisory_xact_lock(:lock_id)"),
                {"lock_id": self._lock_id},
            )
            return True
        else:
            result = await self._session.execute(
                text("SELECT pg_try_advisory_xact_lock(:lock_id)"),
                {"lock_id": self._lock_id},
            )
            return result.scalar()

    # No release method - automatically released on transaction end
```

## Lock ID Strategies

```python
import hashlib


def string_to_lock_id(name: str) -> int:
    """Convert string to PostgreSQL lock ID (bigint).

    PostgreSQL advisory locks use bigint IDs.
    This converts any string to a consistent ID.
    """
    # Use MD5 hash, take first 8 bytes as signed int64
    hash_bytes = hashlib.md5(name.encode()).digest()[:8]
    return int.from_bytes(hash_bytes, byteorder="big", signed=True)


def composite_lock_id(namespace: int, resource_id: int) -> tuple[int, int]:
    """Create two-key lock ID.

    PostgreSQL supports advisory locks with two int4 keys.
    Useful for namespacing locks.
    """
    return (namespace, resource_id)


# Usage
NAMESPACE_PAYMENT = 1
NAMESPACE_INVENTORY = 2

# Single key lock
lock_id = string_to_lock_id("payment:order-123")
await session.execute(
    text("SELECT pg_advisory_lock(:id)"),
    {"id": lock_id},
)

# Two-key lock
await session.execute(
    text("SELECT pg_advisory_lock(:ns, :id)"),
    {"ns": NAMESPACE_PAYMENT, "id": 12345},
)
```

## Practical Examples

### Singleton Job

```python
async def run_scheduled_job(session: AsyncSession):
    """Ensure only one instance runs this job."""
    lock_id = string_to_lock_id("daily-report-job")

    async with advisory_lock(session, lock_id, blocking=False) as acquired:
        if not acquired:
            print("Job already running on another instance")
            return

        print("Running daily report...")
        await generate_daily_report()
        print("Daily report complete")
```

### Transactional Update

```python
async def transfer_funds(
    session: AsyncSession,
    from_account: int,
    to_account: int,
    amount: Decimal,
):
    """Transfer funds with advisory lock for consistency."""
    # Lock both accounts (always in same order to prevent deadlock)
    accounts = sorted([from_account, to_account])

    # Transaction-level locks
    for account_id in accounts:
        await session.execute(
            text("SELECT pg_advisory_xact_lock(:ns, :id)"),
            {"ns": NAMESPACE_ACCOUNT, "id": account_id},
        )

    # Perform transfer (locks auto-release on commit)
    await debit_account(session, from_account, amount)
    await credit_account(session, to_account, amount)

    await session.commit()
```

### PostgreSQL 18 Lock Monitoring

```sql
-- View current advisory locks
SELECT
    pid,
    locktype,
    classid,
    objid,
    mode,
    granted
FROM pg_locks
WHERE locktype = 'advisory';

-- View locks with session info (PostgreSQL 18)
SELECT
    l.pid,
    l.objid as lock_id,
    l.granted,
    a.application_name,
    a.client_addr,
    a.state,
    now() - a.state_change as duration
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.locktype = 'advisory';
```

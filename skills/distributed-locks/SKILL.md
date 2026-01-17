---
name: distributed-locks
description: Distributed locking patterns with Redis and PostgreSQL for coordination across instances. Use when implementing exclusive access, preventing race conditions, or coordinating distributed resources.
context: fork
agent: backend-system-architect
version: 1.0.0
tags: [distributed-locks, redis, postgresql, coordination, concurrency, python, 2026]
author: SkillForge
user-invocable: false
---

# Distributed Locking Patterns

Coordinate exclusive access to resources across distributed instances.

## When to Use

- Preventing duplicate processing of events/jobs
- Coordinating access to shared resources
- Implementing leader election
- Rate limiting by resource
- Ensuring exactly-once semantics

## Lock Types Overview

```
+-------------------------------------------------------------------+
|                    Distributed Lock Types                          |
+-------------------------------------------------------------------+
|                                                                   |
|   MUTEX (Exclusive)           READ-WRITE LOCK                     |
|   +-------------------+       +-------------------+               |
|   |   Single holder   |       |  Multiple readers |               |
|   |   at a time       |       |  OR single writer |               |
|   +-------------------+       +-------------------+               |
|                                                                   |
|   SEMAPHORE                   LEADER ELECTION                     |
|   +-------------------+       +-------------------+               |
|   |   N concurrent    |       |  One leader,      |               |
|   |   holders         |       |  many followers   |               |
|   +-------------------+       +-------------------+               |
|                                                                   |
|   Use Cases:                                                      |
|   - Mutex: Order processing, payment handling                     |
|   - Read-Write: Config updates, cache refresh                     |
|   - Semaphore: Connection pools, rate limiting                    |
|   - Leader: Cron jobs, singleton services                         |
|                                                                   |
+-------------------------------------------------------------------+
```

## Redis Distributed Locks

### Basic Redis Lock

```python
import redis.asyncio as redis
from contextlib import asynccontextmanager
from uuid import uuid4
import asyncio

class RedisLock:
    """
    Distributed lock using Redis SET NX with automatic expiry.

    Features:
    - Automatic TTL prevents deadlocks
    - Unique token prevents accidental unlock by other processes
    - Async/await support
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        name: str,
        ttl_seconds: int = 30,
        retry_interval: float = 0.1,
        max_retries: int = 100,
    ):
        self.redis = redis_client
        self.name = f"lock:{name}"
        self.ttl = ttl_seconds
        self.retry_interval = retry_interval
        self.max_retries = max_retries
        self._token: str | None = None

    async def acquire(self, blocking: bool = True) -> bool:
        """
        Acquire the lock.

        Args:
            blocking: If True, wait until lock is available

        Returns:
            True if lock acquired, False otherwise
        """
        self._token = str(uuid4())

        for attempt in range(self.max_retries if blocking else 1):
            acquired = await self.redis.set(
                self.name,
                self._token,
                nx=True,  # Only if not exists
                ex=self.ttl,  # Auto-expire
            )

            if acquired:
                return True

            if not blocking:
                return False

            await asyncio.sleep(self.retry_interval)

        return False

    async def release(self) -> bool:
        """
        Release the lock.

        Uses Lua script for atomic check-and-delete.
        Only releases if we own the lock (matching token).
        """
        if not self._token:
            return False

        # Lua script: atomic check-and-delete
        script = """
        if redis.call("GET", KEYS[1]) == ARGV[1] then
            return redis.call("DEL", KEYS[1])
        else
            return 0
        end
        """
        result = await self.redis.eval(script, 1, self.name, self._token)
        self._token = None
        return result == 1

    async def extend(self, additional_seconds: int) -> bool:
        """Extend lock TTL if we still own it."""
        if not self._token:
            return False

        script = """
        if redis.call("GET", KEYS[1]) == ARGV[1] then
            return redis.call("EXPIRE", KEYS[1], ARGV[2])
        else
            return 0
        end
        """
        result = await self.redis.eval(
            script, 1, self.name, self._token, additional_seconds
        )
        return result == 1

    @asynccontextmanager
    async def __call__(self, blocking: bool = True):
        """Context manager for automatic acquire/release."""
        acquired = await self.acquire(blocking=blocking)
        if not acquired:
            raise LockNotAcquiredError(f"Could not acquire lock: {self.name}")
        try:
            yield
        finally:
            await self.release()


# Usage
async def process_order(order_id: str):
    lock = RedisLock(redis_client, f"order:{order_id}", ttl_seconds=60)

    async with lock():
        # Only one instance processes this order
        order = await get_order(order_id)
        await process(order)
```

### Redlock (Multi-Node Redis)

```python
class Redlock:
    """
    Distributed lock across multiple Redis instances.

    Implements the Redlock algorithm for fault-tolerant locking.
    Requires majority of nodes to agree.
    """

    def __init__(
        self,
        redis_clients: list[redis.Redis],
        name: str,
        ttl_ms: int = 10000,
        retry_count: int = 3,
        retry_delay_ms: int = 200,
    ):
        self.clients = redis_clients
        self.quorum = len(redis_clients) // 2 + 1
        self.name = f"redlock:{name}"
        self.ttl_ms = ttl_ms
        self.retry_count = retry_count
        self.retry_delay = retry_delay_ms / 1000
        self._token: str | None = None

    async def acquire(self) -> bool:
        """Acquire lock on majority of Redis nodes."""
        for attempt in range(self.retry_count):
            self._token = str(uuid4())
            start_time = time.monotonic()

            # Try to acquire on all nodes
            successful = 0
            for client in self.clients:
                try:
                    result = await client.set(
                        self.name,
                        self._token,
                        nx=True,
                        px=self.ttl_ms,
                    )
                    if result:
                        successful += 1
                except redis.RedisError:
                    continue

            # Calculate remaining validity
            elapsed_ms = (time.monotonic() - start_time) * 1000
            validity = self.ttl_ms - elapsed_ms - (self.ttl_ms * 0.01)

            # Check quorum and validity
            if successful >= self.quorum and validity > 0:
                return True

            # Release partial locks
            await self._release_all()

            # Wait before retry
            if attempt < self.retry_count - 1:
                await asyncio.sleep(self.retry_delay * random.uniform(0.5, 1.5))

        return False

    async def release(self) -> None:
        """Release lock on all nodes."""
        await self._release_all()
        self._token = None

    async def _release_all(self) -> None:
        """Release lock on all Redis nodes."""
        script = """
        if redis.call("GET", KEYS[1]) == ARGV[1] then
            return redis.call("DEL", KEYS[1])
        end
        return 0
        """
        for client in self.clients:
            try:
                await client.eval(script, 1, self.name, self._token)
            except redis.RedisError:
                continue
```

## PostgreSQL Advisory Locks

### Session-Level Advisory Locks

```python
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import hashlib

class PostgresAdvisoryLock:
    """
    PostgreSQL advisory locks for distributed coordination.

    Advantages over Redis:
    - No additional infrastructure
    - Automatic release on connection close
    - Transaction-aware (can use transaction-level locks)
    """

    def __init__(self, session: AsyncSession, name: str):
        self.session = session
        # Convert name to bigint for advisory lock
        self.lock_id = int(hashlib.sha256(name.encode()).hexdigest()[:15], 16)

    async def acquire(self, blocking: bool = True) -> bool:
        """
        Acquire session-level advisory lock.

        Lock is held until explicitly released or session ends.
        """
        if blocking:
            # pg_advisory_lock blocks until acquired
            await self.session.execute(
                text("SELECT pg_advisory_lock(:lock_id)"),
                {"lock_id": self.lock_id},
            )
            return True
        else:
            # pg_try_advisory_lock returns immediately
            result = await self.session.execute(
                text("SELECT pg_try_advisory_lock(:lock_id)"),
                {"lock_id": self.lock_id},
            )
            return result.scalar()

    async def release(self) -> bool:
        """Release session-level advisory lock."""
        result = await self.session.execute(
            text("SELECT pg_advisory_unlock(:lock_id)"),
            {"lock_id": self.lock_id},
        )
        return result.scalar()

    @asynccontextmanager
    async def __call__(self, blocking: bool = True):
        acquired = await self.acquire(blocking=blocking)
        if not acquired:
            raise LockNotAcquiredError(f"Could not acquire lock: {self.lock_id}")
        try:
            yield
        finally:
            await self.release()


# Usage
async def process_unique_job(job_id: str, session: AsyncSession):
    lock = PostgresAdvisoryLock(session, f"job:{job_id}")

    async with lock():
        # Exclusive access to this job
        await execute_job(job_id)
```

### Transaction-Level Advisory Locks

```python
class PostgresTransactionLock:
    """
    Transaction-level advisory lock.

    Automatically released when transaction commits or rolls back.
    Ideal for operations that should be atomic with database changes.
    """

    def __init__(self, session: AsyncSession, name: str):
        self.session = session
        self.lock_id = int(hashlib.sha256(name.encode()).hexdigest()[:15], 16)

    async def acquire(self, blocking: bool = True) -> bool:
        """
        Acquire transaction-level lock.

        Lock released automatically at transaction end.
        """
        if blocking:
            await self.session.execute(
                text("SELECT pg_advisory_xact_lock(:lock_id)"),
                {"lock_id": self.lock_id},
            )
            return True
        else:
            result = await self.session.execute(
                text("SELECT pg_try_advisory_xact_lock(:lock_id)"),
                {"lock_id": self.lock_id},
            )
            return result.scalar()

    # No release method - automatic at transaction end


# Usage
async def transfer_funds(from_id: str, to_id: str, amount: Decimal):
    async with session.begin():
        # Lock both accounts to prevent concurrent transfers
        lock1 = PostgresTransactionLock(session, f"account:{from_id}")
        lock2 = PostgresTransactionLock(session, f"account:{to_id}")

        await lock1.acquire()
        await lock2.acquire()

        # Transfer is atomic with locks
        await debit_account(from_id, amount)
        await credit_account(to_id, amount)
        # Locks released when transaction commits
```

## Lock Patterns

### Distributed Semaphore

```python
class RedisSemaphore:
    """
    Distributed semaphore allowing N concurrent holders.

    Use for:
    - Connection pooling
    - Rate limiting
    - Bounded parallelism
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        name: str,
        max_permits: int,
        ttl_seconds: int = 30,
    ):
        self.redis = redis_client
        self.name = f"semaphore:{name}"
        self.max_permits = max_permits
        self.ttl = ttl_seconds
        self._permit_id: str | None = None

    async def acquire(self, timeout: float = None) -> bool:
        """Acquire a permit from the semaphore."""
        self._permit_id = str(uuid4())
        deadline = time.monotonic() + (timeout or float("inf"))

        while time.monotonic() < deadline:
            # Remove expired permits
            await self.redis.zremrangebyscore(
                self.name, "-inf", time.time()
            )

            # Try to add our permit
            async with self.redis.pipeline() as pipe:
                try:
                    await pipe.watch(self.name)

                    count = await self.redis.zcard(self.name)
                    if count < self.max_permits:
                        pipe.multi()
                        pipe.zadd(
                            self.name,
                            {self._permit_id: time.time() + self.ttl},
                        )
                        await pipe.execute()
                        return True
                    else:
                        await pipe.unwatch()
                except redis.WatchError:
                    continue

            await asyncio.sleep(0.1)

        return False

    async def release(self) -> None:
        """Release the permit."""
        if self._permit_id:
            await self.redis.zrem(self.name, self._permit_id)
            self._permit_id = None


# Usage: Limit concurrent API calls
semaphore = RedisSemaphore(redis, "api:external-service", max_permits=10)

async def call_external_api():
    async with semaphore():
        # At most 10 concurrent calls
        return await http_client.get("https://external-api.com/data")
```

### Leader Election

```python
class RedisLeaderElection:
    """
    Leader election using Redis.

    Use for:
    - Singleton services (cron, scheduler)
    - Primary/replica coordination
    - Distributed singleton patterns
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        election_name: str,
        node_id: str,
        ttl_seconds: int = 10,
    ):
        self.redis = redis_client
        self.key = f"leader:{election_name}"
        self.node_id = node_id
        self.ttl = ttl_seconds
        self._is_leader = False
        self._heartbeat_task: asyncio.Task | None = None

    async def start(self) -> None:
        """Start participating in leader election."""
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def stop(self) -> None:
        """Stop participating and resign leadership."""
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
        await self._resign()

    @property
    def is_leader(self) -> bool:
        return self._is_leader

    async def _heartbeat_loop(self) -> None:
        """Continuously try to become/stay leader."""
        while True:
            try:
                if self._is_leader:
                    # Extend our leadership
                    extended = await self._extend_leadership()
                    if not extended:
                        self._is_leader = False
                        await self._on_lost_leadership()
                else:
                    # Try to become leader
                    acquired = await self._try_become_leader()
                    if acquired:
                        self._is_leader = True
                        await self._on_became_leader()

                await asyncio.sleep(self.ttl / 3)  # Heartbeat at 1/3 TTL

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Leader election error: {e}")
                self._is_leader = False

    async def _try_become_leader(self) -> bool:
        """Attempt to claim leadership."""
        return await self.redis.set(
            self.key,
            self.node_id,
            nx=True,
            ex=self.ttl,
        )

    async def _extend_leadership(self) -> bool:
        """Extend leadership if we still hold it."""
        script = """
        if redis.call("GET", KEYS[1]) == ARGV[1] then
            return redis.call("EXPIRE", KEYS[1], ARGV[2])
        end
        return 0
        """
        result = await self.redis.eval(
            script, 1, self.key, self.node_id, self.ttl
        )
        return result == 1

    async def _resign(self) -> None:
        """Voluntarily give up leadership."""
        script = """
        if redis.call("GET", KEYS[1]) == ARGV[1] then
            return redis.call("DEL", KEYS[1])
        end
        return 0
        """
        await self.redis.eval(script, 1, self.key, self.node_id)
        self._is_leader = False

    async def _on_became_leader(self) -> None:
        """Called when this node becomes leader."""
        logger.info(f"Node {self.node_id} became leader")

    async def _on_lost_leadership(self) -> None:
        """Called when this node loses leadership."""
        logger.info(f"Node {self.node_id} lost leadership")


# Usage
election = RedisLeaderElection(
    redis_client,
    "scheduler",
    node_id=os.getenv("POD_NAME", str(uuid4())),
)

await election.start()

# In your service
async def maybe_run_scheduled_job():
    if election.is_leader:
        await run_scheduled_job()
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Lock backend | Redis for speed, PostgreSQL for simplicity |
| TTL | 10-60 seconds (balance safety vs deadlock) |
| Retry strategy | Exponential backoff with jitter |
| Multi-node | Redlock for critical operations |
| Cleanup | Automatic via TTL, never rely on explicit release |

## Anti-Patterns (FORBIDDEN)

```python
# NEVER use locks without TTL (deadlock risk)
await redis.set("lock:resource", "1")  # WRONG - no expiry

# NEVER release without verifying ownership
await redis.delete("lock:resource")  # WRONG - might delete another's lock

# NEVER use time-based logic without monotonic clock
import time
start = time.time()  # WRONG - clock can jump
# Use time.monotonic() instead

# NEVER hold locks across async boundaries without extending
async with lock():
    result = await very_slow_operation()  # WRONG - lock may expire

# NEVER use distributed locks for everything
async with lock("user:123"):
    user.name = "New Name"  # WRONG - database row lock is sufficient

# NEVER assume lock is still held after await
async with lock():
    await step_one()  # Lock valid
    await asyncio.sleep(100)  # Lock expired!
    await step_two()  # WRONG - no longer have lock
```

## Related Skills

- `idempotency-patterns` - Exactly-once processing
- `caching-strategies` - Redis patterns
- `resilience-patterns` - Handling lock failures
- `connection-pooling` - Redis connection management

## Capability Details

### redis-locks
**Keywords:** redis lock, SET NX, distributed lock, exclusive access
**Solves:**
- How do I implement distributed locks with Redis?
- Prevent concurrent processing
- Atomic lock acquisition and release

### advisory-locks
**Keywords:** advisory lock, PostgreSQL, pg_advisory_lock, transaction lock
**Solves:**
- How do I use PostgreSQL advisory locks?
- Database-level coordination
- Transaction-scoped locking

### redlock
**Keywords:** redlock, multi-node, fault-tolerant, quorum
**Solves:**
- How do I implement fault-tolerant distributed locks?
- Lock across multiple Redis instances
- Handle Redis node failures

### semaphore
**Keywords:** semaphore, bounded concurrency, rate limit, permits
**Solves:**
- How do I limit concurrent access to N?
- Implement distributed semaphore
- Rate limit by resource

### leader-election
**Keywords:** leader election, singleton, primary, coordinator
**Solves:**
- How do I elect a leader among distributed nodes?
- Run singleton services
- Coordinate cron jobs

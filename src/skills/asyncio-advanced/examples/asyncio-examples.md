# Asyncio Advanced Examples

## Example 1: Concurrent API Fetching with TaskGroup

```python
import asyncio
import aiohttp
from dataclasses import dataclass

@dataclass
class UserData:
    profile: dict
    orders: list
    preferences: dict

async def fetch_user_dashboard(user_id: str) -> UserData:
    """Fetch all user data concurrently with proper error handling."""
    async with aiohttp.ClientSession() as session:
        async with asyncio.TaskGroup() as tg:
            profile_task = tg.create_task(
                fetch_json(session, f"/api/users/{user_id}")
            )
            orders_task = tg.create_task(
                fetch_json(session, f"/api/users/{user_id}/orders")
            )
            prefs_task = tg.create_task(
                fetch_json(session, f"/api/users/{user_id}/preferences")
            )

        return UserData(
            profile=profile_task.result(),
            orders=orders_task.result(),
            preferences=prefs_task.result(),
        )

async def fetch_json(session: aiohttp.ClientSession, path: str) -> dict:
    async with session.get(f"https://api.example.com{path}") as resp:
        return await resp.json()
```

## Example 2: Rate-Limited Bulk Processing

```python
import asyncio
from typing import TypeVar, Callable, Awaitable

T = TypeVar("T")
R = TypeVar("R")

class BulkProcessor:
    """Process items with concurrency and rate limiting."""

    def __init__(self, max_concurrent: int = 10, timeout: float = 30.0):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.timeout = timeout

    async def process_all(
        self,
        items: list[T],
        processor: Callable[[T], Awaitable[R]],
    ) -> tuple[list[R], list[tuple[T, Exception]]]:
        """Process all items, returning successes and failures."""
        successes: list[R] = []
        failures: list[tuple[T, Exception]] = []

        async def process_one(item: T) -> tuple[T, R | Exception]:
            async with self.semaphore:
                try:
                    async with asyncio.timeout(self.timeout):
                        result = await processor(item)
                        return (item, result)
                except Exception as e:
                    return (item, e)

        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(process_one(item)) for item in items]

        for task in tasks:
            item, result = task.result()
            if isinstance(result, Exception):
                failures.append((item, result))
            else:
                successes.append(result)

        return successes, failures

# Usage
processor = BulkProcessor(max_concurrent=5, timeout=10.0)
successes, failures = await processor.process_all(
    items=urls,
    processor=fetch_and_parse,
)
print(f"Processed {len(successes)}, failed {len(failures)}")
```

## Example 3: Graceful Shutdown with Cleanup

```python
import asyncio
import signal
from contextlib import asynccontextmanager

class AsyncService:
    def __init__(self):
        self._shutdown_event = asyncio.Event()
        self._tasks: set[asyncio.Task] = set()

    async def start(self):
        """Start service with graceful shutdown handling."""
        loop = asyncio.get_running_loop()

        # Handle signals
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(
                sig,
                lambda: asyncio.create_task(self.shutdown())
            )

        try:
            async with asyncio.TaskGroup() as tg:
                tg.create_task(self.worker_loop())
                tg.create_task(self.health_check_loop())
                tg.create_task(self._wait_for_shutdown())
        except* asyncio.CancelledError:
            pass  # Expected on shutdown

    async def _wait_for_shutdown(self):
        await self._shutdown_event.wait()
        raise asyncio.CancelledError()

    async def shutdown(self):
        """Graceful shutdown - complete current work."""
        print("Shutting down...")
        self._shutdown_event.set()

    async def worker_loop(self):
        while not self._shutdown_event.is_set():
            try:
                async with asyncio.timeout(5.0):
                    await self.process_next_job()
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                print("Worker cancelled, finishing current job...")
                raise

    async def health_check_loop(self):
        while not self._shutdown_event.is_set():
            await asyncio.sleep(30)
            await self.health_check()
```

## Example 4: Exception Group Handling

```python
import asyncio

async def fetch_from_multiple_sources(query: str) -> list[dict]:
    """Try multiple sources, collect partial results on failures."""
    sources = ["source_a", "source_b", "source_c"]
    results = []
    errors = []

    try:
        async with asyncio.TaskGroup() as tg:
            tasks = {
                source: tg.create_task(fetch_from_source(source, query))
                for source in sources
            }
    except* ConnectionError as eg:
        # Some sources failed with connection errors
        errors.extend(eg.exceptions)
        # Collect successful results
        for source, task in tasks.items():
            if task.done() and not task.exception():
                results.append(task.result())
    except* TimeoutError as eg:
        errors.extend(eg.exceptions)
        for source, task in tasks.items():
            if task.done() and not task.exception():
                results.append(task.result())
    else:
        # All succeeded
        results = [t.result() for t in tasks.values()]

    if errors:
        print(f"Partial results: {len(results)} succeeded, {len(errors)} failed")

    return results
```

## Example 5: Async Context Manager with Resource Pool

```python
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator

class ConnectionPool:
    """Async connection pool with proper lifecycle management."""

    def __init__(self, max_size: int = 10):
        self._semaphore = asyncio.Semaphore(max_size)
        self._connections: asyncio.Queue = asyncio.Queue(maxsize=max_size)
        self._initialized = False

    async def initialize(self, dsn: str):
        """Pre-create connections."""
        for _ in range(self._semaphore._value):
            conn = await create_connection(dsn)
            await self._connections.put(conn)
        self._initialized = True

    @asynccontextmanager
    async def acquire(self) -> AsyncIterator[Connection]:
        """Get a connection from the pool."""
        async with self._semaphore:
            conn = await self._connections.get()
            try:
                yield conn
            finally:
                # Return connection to pool
                if conn.is_healthy():
                    await self._connections.put(conn)
                else:
                    # Replace unhealthy connection
                    new_conn = await create_connection(self._dsn)
                    await self._connections.put(new_conn)

    async def close(self):
        """Close all connections."""
        while not self._connections.empty():
            conn = await self._connections.get()
            await conn.close()

# Usage
pool = ConnectionPool(max_size=20)
await pool.initialize("postgres://...")

async with pool.acquire() as conn:
    result = await conn.execute("SELECT * FROM users")
```

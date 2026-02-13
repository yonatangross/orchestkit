# Semaphore Patterns for Concurrency Limiting

## Basic Rate Limiting

```python
import asyncio
import aiohttp

class RateLimitedClient:
    """HTTP client with concurrency and rate limiting."""

    def __init__(
        self,
        max_concurrent: int = 10,
        requests_per_second: float = 100,
    ):
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._rate_limiter = AsyncRateLimiter(requests_per_second)
        self._session: aiohttp.ClientSession | None = None

    async def __aenter__(self):
        self._session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, *args):
        if self._session:
            await self._session.close()

    async def get(self, url: str) -> dict:
        async with self._semaphore:
            await self._rate_limiter.acquire()
            async with self._session.get(url) as resp:
                return await resp.json()


class AsyncRateLimiter:
    """Token bucket rate limiter."""

    def __init__(self, rate: float):
        self._rate = rate
        self._tokens = rate
        self._last_update = asyncio.get_event_loop().time()
        self._lock = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            now = asyncio.get_event_loop().time()
            self._tokens = min(
                self._rate,
                self._tokens + (now - self._last_update) * self._rate
            )
            self._last_update = now

            if self._tokens < 1:
                wait_time = (1 - self._tokens) / self._rate
                await asyncio.sleep(wait_time)
                self._tokens = 0
            else:
                self._tokens -= 1
```

## Database Connection Limiting

```python
class DatabasePool:
    """Async database pool with connection limiting."""

    def __init__(self, dsn: str, max_connections: int = 20):
        self._dsn = dsn
        self._semaphore = asyncio.Semaphore(max_connections)
        self._pool = None

    async def execute(self, query: str, *args) -> list:
        async with self._semaphore:
            async with self._pool.acquire() as conn:
                return await conn.fetch(query, *args)

    async def execute_many(self, queries: list[tuple[str, tuple]]) -> list:
        """Execute multiple queries with connection limiting."""
        async with asyncio.TaskGroup() as tg:
            tasks = [
                tg.create_task(self.execute(q, *args))
                for q, args in queries
            ]
        return [t.result() for t in tasks]
```

## Bounded Work Queue

```python
class BoundedWorkQueue:
    """Process items with bounded concurrency."""

    def __init__(self, max_workers: int = 10):
        self._semaphore = asyncio.Semaphore(max_workers)
        self._results: list = []

    async def process_all(
        self,
        items: list,
        processor: Callable[[Any], Awaitable[Any]],
    ) -> list:
        async def bounded_process(item):
            async with self._semaphore:
                return await processor(item)

        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(bounded_process(item)) for item in items]

        return [t.result() for t in tasks]
```

## Common Pitfalls

```python
# WRONG: Creating semaphore inside coroutine
async def bad_fetch(url: str):
    sem = asyncio.Semaphore(10)  # New semaphore each call!
    async with sem:
        return await fetch(url)

# CORRECT: Share semaphore across calls
SEM = asyncio.Semaphore(10)

async def good_fetch(url: str):
    async with SEM:
        return await fetch(url)

# WRONG: Semaphore without timeout
async with sem:
    await potentially_slow_operation()  # Can block other tasks indefinitely

# CORRECT: Semaphore with timeout
async with asyncio.timeout(30):
    async with sem:
        await potentially_slow_operation()
```

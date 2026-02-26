---
title: Use semaphores and sync bridges to prevent resource exhaustion and event loop blocking
category: asyncio
impact: HIGH
impactDescription: Semaphores and sync bridges prevent resource exhaustion and event loop blocking
tags: [asyncio, semaphore, rate-limit, to-thread, sync-bridge]
---

# Structured Concurrency Patterns

## Semaphore for Concurrency Limiting

```python
class RateLimitedClient:
    """HTTP client with concurrency limiting."""

    def __init__(self, max_concurrent: int = 10):
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._session: aiohttp.ClientSession | None = None

    async def fetch(self, url: str) -> dict:
        async with self._semaphore:  # Limit concurrent requests
            async with self._session.get(url) as response:
                return await response.json()

    async def fetch_many(self, urls: list[str]) -> list[dict]:
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(self.fetch(url)) for url in urls]
        return [t.result() for t in tasks]
```

## Sync-to-Async Bridge

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

# For CPU-bound or blocking sync code
async def run_blocking_operation(data: bytes) -> dict:
    """Run blocking sync code in thread pool."""
    return await asyncio.to_thread(cpu_intensive_parse, data)

# For sync code that needs async context
def sync_caller():
    """Call async code from sync context (not in existing loop)."""
    return asyncio.run(async_main())

# For sync code within existing async context
async def wrapper_for_sync_lib():
    """Bridge sync library to async - use with care."""
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor() as pool:
        result = await loop.run_in_executor(pool, sync_blocking_call)
    return result
```

## Key Principles

- Use `asyncio.Semaphore` to prevent connection pool exhaustion
- Use `asyncio.to_thread()` for clean sync-to-async bridging
- Never call `asyncio.run()` inside an existing event loop
- Never block the event loop with `time.sleep()` or `requests.get()`

**Incorrect — Unlimited concurrent requests exhaust connection pools and memory:**
```python
async def fetch_all(urls: list[str]):
    tasks = [fetch_url(url) for url in urls]  # 10,000 concurrent!
    return await asyncio.gather(*tasks)
```

**Correct — Semaphore limits concurrency to prevent resource exhaustion:**
```python
async def fetch_all(urls: list[str], max_concurrent: int = 10):
    sem = asyncio.Semaphore(max_concurrent)
    async def limited_fetch(url):
        async with sem:
            return await fetch_url(url)
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(limited_fetch(url)) for url in urls]
    return [t.result() for t in tasks]
```

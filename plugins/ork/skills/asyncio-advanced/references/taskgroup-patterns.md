# TaskGroup Patterns

## Basic TaskGroup Usage

```python
import asyncio
from typing import TypeVar

T = TypeVar("T")

async def fetch_all_concurrent(tasks: list[Coroutine[Any, Any, T]]) -> list[T]:
    """Run all tasks concurrently, fail-fast on any exception."""
    async with asyncio.TaskGroup() as tg:
        created = [tg.create_task(task) for task in tasks]
    return [t.result() for t in created]
```

## TaskGroup with Partial Failure Handling

```python
async def fetch_with_partial_failures(urls: list[str]) -> tuple[list[dict], list[str]]:
    """Collect successes and failures separately."""
    successes = []
    failures = []

    try:
        async with asyncio.TaskGroup() as tg:
            tasks = [(url, tg.create_task(fetch(url))) for url in urls]
    except* Exception as eg:
        # TaskGroup failed - collect individual results
        for url, task in tasks:
            if task.done():
                try:
                    successes.append(task.result())
                except Exception:
                    failures.append(url)
            else:
                failures.append(url)
    else:
        successes = [t.result() for _, t in tasks]

    return successes, failures
```

## TaskGroup with Timeout per Task

```python
async def fetch_with_individual_timeouts(
    items: list[dict],
    timeout_per_item: float = 5.0,
) -> list[dict | None]:
    """Each task has its own timeout."""
    async def fetch_with_timeout(item: dict) -> dict | None:
        try:
            async with asyncio.timeout(timeout_per_item):
                return await process_item(item)
        except asyncio.TimeoutError:
            return None

    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch_with_timeout(item)) for item in items]

    return [t.result() for t in tasks]
```

## TaskGroup vs gather Comparison

| Feature | TaskGroup | gather |
|---------|-----------|--------|
| Cancellation | Automatic on first failure | Manual with return_exceptions |
| Exception handling | ExceptionGroup | List or raises first |
| Structured concurrency | Yes | No |
| Task cleanup | Guaranteed | Manual |
| Python version | 3.11+ | 3.4+ |

## When to Still Use gather

```python
# Only for Python 3.10 compatibility or return_exceptions pattern
results = await asyncio.gather(
    *tasks,
    return_exceptions=True  # Collect all, don't fail fast
)

# Filter successes and failures
successes = [r for r in results if not isinstance(r, Exception)]
failures = [r for r in results if isinstance(r, Exception)]
```

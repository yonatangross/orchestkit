---
title: Apply TaskGroup for structured concurrency with automatic cancellation on failure
category: asyncio
impact: HIGH
impactDescription: TaskGroup provides structured concurrency with automatic cancellation on failure
tags: [asyncio, taskgroup, timeout, structured-concurrency, exception-group]
---

# TaskGroup & Timeout Patterns

## TaskGroup (Replaces gather)

```python
import asyncio

async def fetch_user_data(user_id: str) -> dict:
    """Fetch user data concurrently - all tasks complete or all cancelled."""
    async with asyncio.TaskGroup() as tg:
        user_task = tg.create_task(fetch_user(user_id))
        orders_task = tg.create_task(fetch_orders(user_id))
        preferences_task = tg.create_task(fetch_preferences(user_id))

    # All tasks guaranteed complete here
    return {
        "user": user_task.result(),
        "orders": orders_task.result(),
        "preferences": preferences_task.result(),
    }
```

## TaskGroup with Timeout

```python
async def fetch_with_timeout(urls: list[str], timeout_sec: float = 30) -> list[dict]:
    """Fetch all URLs with overall timeout - structured concurrency."""
    results = []

    async with asyncio.timeout(timeout_sec):
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(fetch_url(url)) for url in urls]

    return [t.result() for t in tasks]
```

## Exception Group Handling

```python
async def process_batch(items: list[dict]) -> tuple[list[dict], list[Exception]]:
    """Process batch, collecting both successes and failures."""
    results = []
    errors = []

    try:
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(process_item(item)) for item in items]
    except* ValueError as eg:
        errors.extend(eg.exceptions)
    except* Exception as eg:
        errors.extend(eg.exceptions)
    else:
        results = [t.result() for t in tasks]

    return results, errors
```

## Key Principles

- Use **TaskGroup** not `gather()` for all new code
- Use **`asyncio.timeout()`** context manager for deadlines
- Handle **ExceptionGroup** with `except*` for multiple failures
- TaskGroup auto-cancels remaining tasks when one fails

**Incorrect — gather() doesn't cancel remaining tasks when one fails:**
```python
results = await asyncio.gather(
    fetch_user(user_id),
    fetch_orders(user_id),
    fetch_preferences(user_id),
)  # If one fails, others keep running (resource leak)
```

**Correct — TaskGroup auto-cancels all tasks when any fails (structured concurrency):**
```python
async with asyncio.TaskGroup() as tg:
    user_task = tg.create_task(fetch_user(user_id))
    orders_task = tg.create_task(fetch_orders(user_id))
    prefs_task = tg.create_task(fetch_preferences(user_id))
# If any fails, all are cancelled automatically
```

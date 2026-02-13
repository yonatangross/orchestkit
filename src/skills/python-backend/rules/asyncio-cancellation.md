---
title: "Asyncio: Cancellation Handling"
category: asyncio
impact: HIGH
impactDescription: Proper cancellation handling is critical for TaskGroup and timeout correctness
tags: [asyncio, cancellation, cancelled-error, cleanup, resource-management]
---

# Cancellation Handling

## Proper Cancellation Pattern

```python
async def cancellable_operation(resource_id: str) -> dict:
    """Properly handle cancellation - NEVER swallow CancelledError."""
    resource = await acquire_resource(resource_id)
    try:
        return await process_resource(resource)
    except asyncio.CancelledError:
        # Clean up but RE-RAISE - this is critical!
        await cleanup_resource(resource)
        raise  # ALWAYS re-raise CancelledError
    finally:
        await release_resource(resource)
```

## Anti-Patterns

```python
# NEVER swallow CancelledError - breaks structured concurrency
except asyncio.CancelledError:
    return None  # BREAKS TaskGroup and timeout!

# NEVER use create_task() without TaskGroup - tasks leak
asyncio.create_task(background_work())  # Fire and forget = leaked task

# NEVER yield inside async context managers (PEP 789)
async with asyncio.timeout(10):
    yield item  # DANGEROUS - cancellation bugs!
```

## Key Principles

- **Always re-raise** `CancelledError` after cleanup
- Breaking this rule breaks TaskGroup and timeout behavior
- Use `try/finally` for guaranteed resource cleanup
- Never use bare `create_task()` outside a TaskGroup

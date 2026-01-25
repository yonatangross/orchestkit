# Activity Best Practices

## Heartbeating

Required for activities > 60 seconds.

```python
from temporalio import activity
import asyncio

@activity.defn
async def process_large_file(file_path: str) -> ProcessResult:
    """Long-running activity with heartbeating."""
    total_lines = count_lines(file_path)
    processed = 0

    async with aiofiles.open(file_path) as f:
        async for line in f:
            await process_line(line)
            processed += 1

            # Heartbeat every 100 lines with progress
            if processed % 100 == 0:
                activity.heartbeat(f"{processed}/{total_lines}")

    return ProcessResult(processed=processed)
```

**Heartbeat details:**
- `heartbeat_timeout` in workflow triggers retry if heartbeat stops
- Pass checkpoint data for resume on retry
- `activity.info().heartbeat_details` retrieves last heartbeat

## Timeout Configuration

```python
# In workflow
await workflow.execute_activity(
    my_activity,
    args,
    # Max time for single attempt (most common)
    start_to_close_timeout=timedelta(seconds=30),
    # Max time from schedule to completion (includes queue wait)
    schedule_to_close_timeout=timedelta(minutes=5),
    # Max time from schedule to worker pickup
    schedule_to_start_timeout=timedelta(seconds=60),
    # Heartbeat must be received within this interval
    heartbeat_timeout=timedelta(seconds=10),
)
```

**Timeout selection:**
- `start_to_close`: Default choice, per-attempt timeout
- `schedule_to_close`: End-to-end SLA guarantee
- `heartbeat_timeout`: For long activities, 1/3 of expected duration

## Retry Policies

```python
from temporalio.common import RetryPolicy

# Conservative retry (payments, critical ops)
conservative_retry = RetryPolicy(
    maximum_attempts=3,
    initial_interval=timedelta(seconds=1),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(seconds=30),
    non_retryable_error_types=["PaymentDeclined", "InvalidInput"],
)

# Aggressive retry (idempotent reads)
aggressive_retry = RetryPolicy(
    maximum_attempts=10,
    initial_interval=timedelta(milliseconds=100),
    backoff_coefficient=1.5,
    maximum_interval=timedelta(seconds=10),
)
```

## Idempotency

Activities may retry - ensure idempotent operations.

```python
@activity.defn
async def create_order(order: OrderInput) -> str:
    """Idempotent order creation using client-provided ID."""
    # Use upsert, not insert
    await db.execute(
        """
        INSERT INTO orders (id, data, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (id) DO NOTHING
        RETURNING id
        """,
        order.id,  # Client-provided idempotency key
        order.data,
    )
    return order.id
```

## Non-Retryable Errors

```python
from temporalio.exceptions import ApplicationError

@activity.defn
async def validate_input(data: dict) -> bool:
    if not data.get("required_field"):
        raise ApplicationError(
            "Missing required_field",
            non_retryable=True,  # Don't retry validation errors
            type="ValidationError",
        )
    return True
```

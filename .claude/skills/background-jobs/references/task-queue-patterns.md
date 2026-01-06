# Task Queue Patterns

Comprehensive guide to background job patterns for Python backends.

## Queue Architecture

```
┌─────────────┐                   ┌─────────────┐
│  FastAPI    │                   │   Redis     │
│  (Producer) │──── Enqueue ─────►│   Queue     │
└─────────────┘                   └──────┬──────┘
                                         │
                                         │ Dequeue
                                         ▼
                                  ┌─────────────┐
                                  │   Worker    │
                                  │  (Consumer) │
                                  └─────────────┘
```

## Task Types

### 1. Fire and Forget

Task runs asynchronously, caller doesn't wait for result.

```python
# Good for: Emails, notifications, logging, analytics
@task
async def send_welcome_email(user_id: str):
    user = await get_user(user_id)
    await send_email(user.email, "Welcome!")

# Usage
await send_welcome_email.enqueue(user_id="123")
```

### 2. Delayed Tasks

Task runs after a specified delay.

```python
# Good for: Reminders, scheduled notifications, cooldowns
@task
async def send_reminder(user_id: str):
    await send_push_notification(user_id, "Don't forget!")

# Usage - run in 1 hour
await send_reminder.enqueue(
    user_id="123",
    _delay=timedelta(hours=1),
)
```

### 3. Scheduled/Periodic Tasks

Tasks that run on a schedule (cron-like).

```python
# Good for: Reports, cleanup, syncing, aggregations
@task(schedule="0 0 * * *")  # Daily at midnight
async def generate_daily_report():
    await compute_metrics()
    await send_report_email()
```

### 4. Task Chains (Workflows)

Sequential tasks where output feeds into next task.

```python
# Task 1 → Task 2 → Task 3
from celery import chain

workflow = chain(
    download_file.s(url),
    process_file.s(),
    upload_results.s(),
)
result = workflow.apply_async()
```

### 5. Task Groups (Fan-out)

Parallel execution of multiple tasks.

```python
# All tasks run in parallel
from celery import group

batch = group([
    process_item.s(item_id)
    for item_id in item_ids
])
results = batch.apply_async()
```

### 6. Chord (Fan-out + Callback)

Parallel tasks followed by a callback when all complete.

```python
# Parallel tasks → Single callback
from celery import chord

workflow = chord(
    [analyze_chunk.s(chunk) for chunk in chunks],
    aggregate_results.s(),
)
result = workflow.apply_async()
```

## Reliability Patterns

### Retry with Backoff

```python
@task(
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=600,
)
async def unreliable_task():
    try:
        await call_external_api()
    except TransientError as e:
        raise self.retry(exc=e)
```

### Dead Letter Queue

```python
# Move failed tasks to DLQ for manual review
@task(
    max_retries=3,
    on_failure=move_to_dlq,
)
async def important_task():
    ...

async def move_to_dlq(task_id: str, error: Exception):
    await redis.lpush("dlq:important_task", json.dumps({
        "task_id": task_id,
        "error": str(error),
        "timestamp": datetime.utcnow().isoformat(),
    }))
```

### Idempotency

```python
@task
async def process_payment(payment_id: str):
    # Check if already processed
    if await redis.get(f"processed:payment:{payment_id}"):
        return {"status": "already_processed"}

    # Process payment
    result = await stripe.process(payment_id)

    # Mark as processed
    await redis.setex(
        f"processed:payment:{payment_id}",
        86400,  # 24 hours
        "1",
    )

    return result
```

### Task Locking

```python
@task
async def singleton_task():
    lock_key = "lock:singleton_task"

    # Try to acquire lock
    if not await redis.set(lock_key, "1", nx=True, ex=300):
        return {"status": "already_running"}

    try:
        await do_work()
    finally:
        await redis.delete(lock_key)
```

## Concurrency Control

### Rate Limiting Tasks

```python
from arq import cron

@task(max_concurrent=10)  # Max 10 concurrent instances
async def rate_limited_task():
    await call_api()  # API has rate limit
```

### Priority Queues

```python
# High priority queue
@task(queue="high")
async def urgent_notification():
    ...

# Low priority queue
@task(queue="low")
async def batch_report():
    ...

# Worker configuration
QUEUES = ["high", "default", "low"]  # Priority order
```

## Monitoring

### Task States

```
PENDING → STARTED → SUCCESS
                  → FAILURE
                  → RETRY → STARTED → ...
```

### Metrics to Track

| Metric | Description |
|--------|-------------|
| Queue depth | Number of pending tasks |
| Processing time | p50, p95, p99 latency |
| Success rate | % of tasks succeeding |
| Retry rate | % of tasks requiring retry |
| Worker utilization | Active workers / Total workers |

### Health Checks

```python
async def check_queue_health():
    queue_depth = await redis.llen("arq:queue")
    oldest_task_age = await get_oldest_task_age()

    return {
        "queue_depth": queue_depth,
        "queue_healthy": queue_depth < 10000,
        "oldest_task_age": oldest_task_age,
        "processing_healthy": oldest_task_age < 300,
    }
```

## Comparison: ARQ vs Celery

| Feature | ARQ | Celery |
|---------|-----|--------|
| Language | Python 3.8+ | Python 3.8+ |
| Async | Native async/await | Gevent/Eventlet |
| Broker | Redis only | Redis, RabbitMQ, SQS |
| Setup complexity | Simple | More config |
| Features | Basic | Full-featured |
| Monitoring | Basic | Flower, events |
| Use case | FastAPI, simple jobs | Complex workflows |

## When to Use Each

**Use ARQ when:**
- Building with FastAPI/async
- Simple background tasks
- Redis is already in stack
- Want minimal dependencies

**Use Celery when:**
- Complex workflows (chains, chords)
- Need RabbitMQ
- Enterprise features needed
- Multiple language workers

## Related Files

- See `examples/arq-fastapi.md` for ARQ integration
- See `examples/celery-workflows.md` for Celery patterns
- See `checklists/background-jobs-checklist.md` for implementation checklist

# Priority Queue Configuration

Redis priority queue setup for Celery 5.x with proper broker configuration.

## Redis Priority Queue (Celery 5.x)

```python
# celery_config.py
from kombu import Queue, Exchange

# Define exchanges
default_exchange = Exchange("default", type="direct")
priority_exchange = Exchange("priority", type="direct")

# Queue definitions with priority support
celery_app.conf.task_queues = (
    Queue(
        "critical",
        exchange=priority_exchange,
        routing_key="critical",
        queue_arguments={"x-max-priority": 10},  # Enable priority
    ),
    Queue(
        "high",
        exchange=priority_exchange,
        routing_key="high",
        queue_arguments={"x-max-priority": 10},
    ),
    Queue(
        "default",
        exchange=default_exchange,
        routing_key="default",
        queue_arguments={"x-max-priority": 10},
    ),
    Queue(
        "low",
        exchange=default_exchange,
        routing_key="low",
        queue_arguments={"x-max-priority": 10},
    ),
    Queue(
        "bulk",
        exchange=default_exchange,
        routing_key="bulk",
        # No priority for bulk - FIFO is fine
    ),
)

# Redis-specific priority configuration
celery_app.conf.broker_transport_options = {
    "priority_steps": list(range(10)),  # 0-9 priority levels
    "sep": ":",
    "queue_order_strategy": "priority",  # Required for Redis priority
}

celery_app.conf.task_default_queue = "default"
celery_app.conf.task_default_priority = 5  # Middle priority
```

## Dynamic Priority Assignment

```python
from enum import IntEnum

class TaskPriority(IntEnum):
    """Priority levels (higher = more urgent)."""
    BULK = 0
    LOW = 2
    NORMAL = 5
    HIGH = 7
    CRITICAL = 9

def submit_with_priority(
    task,
    args: tuple = (),
    kwargs: dict = None,
    user_tier: str = "standard",
    is_urgent: bool = False,
) -> AsyncResult:
    """Submit task with dynamic priority based on context."""
    kwargs = kwargs or {}

    # Determine priority
    if is_urgent:
        priority = TaskPriority.CRITICAL
        queue = "critical"
    elif user_tier == "premium":
        priority = TaskPriority.HIGH
        queue = "high"
    elif user_tier == "enterprise":
        priority = TaskPriority.CRITICAL
        queue = "critical"
    else:
        priority = TaskPriority.NORMAL
        queue = "default"

    return task.apply_async(
        args=args,
        kwargs=kwargs,
        queue=queue,
        priority=priority,
    )

# Usage
result = submit_with_priority(
    process_order,
    args=(order_id,),
    user_tier=user.tier,
    is_urgent=order.is_express,
)
```

## Queue-Specific Worker Configuration

```bash
# workers.sh - Start workers with appropriate concurrency

# Critical queue: Low latency, high concurrency
celery -A app worker \
    --queues=critical \
    --concurrency=8 \
    --prefetch-multiplier=1 \  # Process one at a time for fairness
    --hostname=critical@%h \
    --loglevel=INFO

# High priority: Balanced
celery -A app worker \
    --queues=high \
    --concurrency=4 \
    --prefetch-multiplier=2 \
    --hostname=high@%h

# Default: Standard processing
celery -A app worker \
    --queues=default \
    --concurrency=4 \
    --prefetch-multiplier=4 \
    --hostname=default@%h

# Low/Bulk: High throughput, can batch
celery -A app worker \
    --queues=low,bulk \
    --concurrency=2 \
    --prefetch-multiplier=8 \
    --hostname=bulk@%h
```

## Priority with Task Routing

```python
# Combine routing with priority
class PriorityRouter:
    """Route tasks to queues with priority hints."""

    ROUTES = {
        "tasks.payment.*": {"queue": "critical", "priority": 9},
        "tasks.notification.*": {"queue": "high", "priority": 7},
        "tasks.analytics.*": {"queue": "low", "priority": 2},
        "tasks.report.*": {"queue": "bulk", "priority": 0},
    }

    def route_for_task(self, task, args=None, kwargs=None):
        for pattern, route in self.ROUTES.items():
            if fnmatch.fnmatch(task, pattern):
                return route
        return {"queue": "default", "priority": 5}

celery_app.conf.task_routes = [PriorityRouter()]
```

## Monitoring Queue Depths

```python
import redis

def get_queue_stats(redis_url: str) -> dict:
    """Get queue depths for monitoring/autoscaling."""
    r = redis.from_url(redis_url)

    queues = ["critical", "high", "default", "low", "bulk"]
    stats = {}

    for queue in queues:
        # Celery uses list for queue storage
        depth = r.llen(queue)
        stats[queue] = {
            "depth": depth,
            "alert": depth > 1000,  # Alert threshold
        }

    return stats

# Use with autoscaling
def should_scale_workers(queue: str, threshold: int = 500) -> bool:
    stats = get_queue_stats(REDIS_URL)
    return stats.get(queue, {}).get("depth", 0) > threshold
```

## Key Configuration Summary

| Setting | Purpose | Recommended Value |
|---------|---------|-------------------|
| `x-max-priority` | Enable queue priority | 10 |
| `priority_steps` | Priority levels | `range(10)` |
| `queue_order_strategy` | Redis priority mode | `"priority"` |
| `prefetch_multiplier` | Tasks per worker fetch | 1 (critical), 4-8 (bulk) |

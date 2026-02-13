# Task Routing & Priority Queues

Multi-queue configuration, priority levels, and dynamic routing for Celery 5.x.

## Queue Definition

```python
# celery_config.py
from kombu import Queue, Exchange

default_exchange = Exchange("default", type="direct")
priority_exchange = Exchange("priority", type="direct")

celery_app.conf.task_queues = (
    Queue(
        "critical",
        exchange=priority_exchange,
        routing_key="critical",
        queue_arguments={"x-max-priority": 10},
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
    ),
    Queue(
        "bulk",
        exchange=default_exchange,
        routing_key="bulk",
        # No priority for bulk — FIFO is fine
    ),
)

celery_app.conf.task_default_queue = "default"
celery_app.conf.task_default_priority = 5

# Redis priority support (required)
celery_app.conf.broker_transport_options = {
    "priority_steps": list(range(10)),  # 0-9 priority levels
    "sep": ":",
    "queue_order_strategy": "priority",
}
```

## Static Task Routing

```python
# Route by task name pattern
celery_app.conf.task_routes = {
    "tasks.payment.*": {"queue": "critical"},
    "tasks.notification.*": {"queue": "high"},
    "tasks.analytics.*": {"queue": "low"},
    "tasks.report.*": {"queue": "bulk"},
    "tasks.*": {"queue": "default"},
}

# Route by task decorator
@celery_app.task(queue="critical", priority=9)
def process_payment(payment_id: str):
    """Always runs on critical queue."""
    pass

# Route at call time
process_order.apply_async(args=[order_id], queue="high", priority=8)
```

## Dynamic Router Class

```python
import fnmatch
from enum import IntEnum

class TaskPriority(IntEnum):
    BULK = 0
    LOW = 2
    NORMAL = 5
    HIGH = 7
    CRITICAL = 9

class TaskRouter:
    """Route tasks based on name, args, and kwargs."""

    ROUTES = {
        "tasks.payment.*": {"queue": "critical", "priority": TaskPriority.CRITICAL},
        "tasks.notification.*": {"queue": "high", "priority": TaskPriority.HIGH},
        "tasks.analytics.*": {"queue": "low", "priority": TaskPriority.LOW},
        "tasks.report.*": {"queue": "bulk", "priority": TaskPriority.BULK},
    }

    def route_for_task(self, task, args=None, kwargs=None):
        # Check kwargs for urgency override
        if kwargs and kwargs.get("urgent"):
            return {"queue": "critical", "priority": TaskPriority.CRITICAL}

        # Match by task name pattern
        for pattern, route in self.ROUTES.items():
            if fnmatch.fnmatch(task, pattern):
                return route

        return {"queue": "default", "priority": TaskPriority.NORMAL}

celery_app.conf.task_routes = [TaskRouter()]
```

## User-Tier Priority

```python
def submit_with_priority(
    task,
    args: tuple = (),
    kwargs: dict = None,
    user_tier: str = "standard",
    is_urgent: bool = False,
) -> AsyncResult:
    """Submit task with priority based on user tier."""
    kwargs = kwargs or {}

    if is_urgent:
        priority, queue = TaskPriority.CRITICAL, "critical"
    elif user_tier == "enterprise":
        priority, queue = TaskPriority.CRITICAL, "critical"
    elif user_tier == "premium":
        priority, queue = TaskPriority.HIGH, "high"
    else:
        priority, queue = TaskPriority.NORMAL, "default"

    return task.apply_async(
        args=args,
        kwargs=kwargs,
        queue=queue,
        priority=priority,
    )
```

## Per-Queue Worker Configuration

```bash
# Critical: low latency, high concurrency, one-at-a-time prefetch
celery -A app worker -Q critical -c 8 --prefetch-multiplier=1 --hostname=critical@%h

# High priority: balanced
celery -A app worker -Q high -c 4 --prefetch-multiplier=2 --hostname=high@%h

# Default: standard processing
celery -A app worker -Q default -c 4 --prefetch-multiplier=4 --hostname=default@%h

# Low/Bulk: high throughput, batch prefetch
celery -A app worker -Q low,bulk -c 2 --prefetch-multiplier=8 --hostname=bulk@%h
```

## Queue Depth Monitoring

```python
import redis

def get_queue_stats(redis_url: str) -> dict:
    """Get queue depths for monitoring and autoscaling."""
    r = redis.from_url(redis_url)
    queues = ["critical", "high", "default", "low", "bulk"]

    stats = {}
    for queue in queues:
        depth = r.llen(queue)
        stats[queue] = {
            "depth": depth,
            "alert": depth > 1000,
        }
    return stats

def should_scale_workers(queue: str, threshold: int = 500) -> bool:
    """Check if queue depth warrants worker scaling."""
    stats = get_queue_stats(REDIS_URL)
    return stats.get(queue, {}).get("depth", 0) > threshold
```

## Configuration Summary

| Setting | Purpose | Recommended |
|---------|---------|-------------|
| `x-max-priority` | Enable queue priority | 10 |
| `priority_steps` | Redis priority levels | `range(10)` |
| `queue_order_strategy` | Redis priority mode | `"priority"` |
| `prefetch_multiplier` | Tasks per worker fetch | 1 (critical), 4-8 (bulk) |
| Queue count | Separation granularity | 3-5 queues |

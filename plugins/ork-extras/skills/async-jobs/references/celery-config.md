# Celery Configuration

Production Celery app setup with secure defaults, broker configuration, and worker tuning.

## Application Setup

```python
# backend/app/workers/celery_app.py
from celery import Celery

celery_app = Celery(
    "myapp",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/1",
)

celery_app.conf.update(
    # Serialization — JSON only (never pickle)
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Timezone
    timezone="UTC",
    enable_utc=True,

    # Task tracking
    task_track_started=True,

    # Time limits (seconds)
    task_time_limit=600,       # 10 min hard kill
    task_soft_time_limit=540,  # 9 min soft limit (raises SoftTimeLimitExceeded)

    # Worker behavior
    worker_prefetch_multiplier=1,  # Fair task distribution
    worker_max_tasks_per_child=1000,  # Restart worker after N tasks (leak protection)

    # Reliability
    task_acks_late=True,            # Ack after completion (not before)
    task_reject_on_worker_lost=True,  # Re-queue if worker dies mid-task

    # Result backend
    result_expires=86400,  # 24 hours
    result_backend_transport_options={
        "global_keyprefix": "celery_result:",
    },
)
```

## Broker Configuration

```python
# Redis broker options
celery_app.conf.broker_transport_options = {
    "visibility_timeout": 43200,  # 12 hours (must exceed longest task)
    "retry_policy": {
        "timeout": 5.0,
    },
    "max_retries": 3,
}

# Connection pool
celery_app.conf.broker_pool_limit = 10
celery_app.conf.broker_connection_retry_on_startup = True
```

## Worker Tuning

```bash
# Production worker startup
celery -A app worker \
    --loglevel=INFO \
    --concurrency=4 \
    --prefetch-multiplier=1 \
    --max-tasks-per-child=1000 \
    --without-heartbeat \
    --without-gossip \
    --without-mingle \
    -Ofair
```

### Concurrency Guidelines

| Workload Type | Concurrency | Prefetch | Notes |
|---------------|-------------|----------|-------|
| CPU-bound | N cores | 1 | Process pool |
| I/O-bound | 2-4x cores | 1-4 | Gevent/eventlet or prefork |
| Mixed | N cores | 1 | Process pool, fair scheduling |
| Bulk/batch | N cores | 4-8 | Higher prefetch for throughput |

## Docker Compose

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  celery-worker:
    build: .
    command: celery -A app worker --loglevel=INFO --concurrency=4
    depends_on:
      - redis
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/1

  celery-beat:
    build: .
    command: celery -A app beat --loglevel=INFO
    depends_on:
      - redis
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/0

volumes:
  redis-data:
```

## Configuration Anti-Patterns

```python
# NEVER use pickle serializer (security risk)
celery_app.conf.task_serializer = "pickle"  # FORBIDDEN

# NEVER disable late ack in production
celery_app.conf.task_acks_late = False  # Tasks lost on crash

# NEVER set visibility_timeout shorter than longest task
celery_app.conf.broker_transport_options = {
    "visibility_timeout": 60,  # Task re-dispatched if still running!
}

# NEVER skip time limits
# Without limits, a hung task blocks the worker slot forever
```

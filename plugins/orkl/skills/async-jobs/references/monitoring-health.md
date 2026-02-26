# Monitoring & Health Checks

Production monitoring with Flower, Celery signals, health checks, and Prometheus metrics.

## Flower Dashboard

```bash
# Install and run Flower
pip install flower

# Basic setup
celery -A app flower --port=5555 --basic_auth=admin:password

# With persistent storage
celery -A app flower --persistent=True --db=flower.db

# With Prometheus metrics endpoint
celery -A app flower --port=5555 --broker_api=redis://redis:6379/0
```

## Celery Signal Metrics

```python
from celery import signals
from prometheus_client import Counter, Histogram, Gauge
import time

# Counters
tasks_started = Counter(
    "celery_tasks_started_total",
    "Tasks started",
    ["task_name"],
)

tasks_completed = Counter(
    "celery_tasks_completed_total",
    "Tasks completed",
    ["task_name", "state"],
)

tasks_failed = Counter(
    "celery_tasks_failed_total",
    "Tasks failed",
    ["task_name", "exception_type"],
)

# Histogram
task_duration = Histogram(
    "celery_task_duration_seconds",
    "Task execution duration",
    ["task_name"],
    buckets=[0.1, 0.5, 1, 5, 10, 30, 60, 300, 600],
)

# Gauge
active_tasks = Gauge(
    "celery_active_tasks",
    "Currently executing tasks",
    ["task_name"],
)

# Wire up signals
@signals.task_prerun.connect
def on_task_start(sender, task_id, task, args, kwargs, **_):
    tasks_started.labels(task_name=task.name).inc()
    active_tasks.labels(task_name=task.name).inc()
    # Store start time in task request
    task.request._start_time = time.time()

@signals.task_postrun.connect
def on_task_complete(sender, task_id, task, args, kwargs, retval, state, **_):
    tasks_completed.labels(task_name=task.name, state=state).inc()
    active_tasks.labels(task_name=task.name).dec()

    # Record duration
    start_time = getattr(task.request, "_start_time", None)
    if start_time:
        duration = time.time() - start_time
        task_duration.labels(task_name=task.name).observe(duration)

@signals.task_failure.connect
def on_task_failure(sender, task_id, exception, args, kwargs, traceback, einfo, **_):
    tasks_failed.labels(
        task_name=sender.name,
        exception_type=type(exception).__name__,
    ).inc()

    # Alert on critical task failures
    if sender.name.startswith("tasks.payment"):
        alerting.send_alert(
            f"Payment task {sender.name} failed: {exception}",
            severity="critical",
        )

@signals.task_retry.connect
def on_task_retry(sender, reason, **kwargs):
    tasks_completed.labels(task_name=sender.name, state="RETRY").inc()
```

## Health Check Endpoint

```python
from celery import current_app

def celery_health_check() -> dict:
    """Comprehensive Celery health check."""
    try:
        # Check broker connection
        conn = current_app.connection()
        conn.ensure_connection(max_retries=3)

        # Check workers responding
        inspector = current_app.control.inspect()
        active_workers = inspector.active()

        if not active_workers:
            return {"status": "unhealthy", "reason": "No active workers"}

        # Check queue depths
        import redis
        r = redis.from_url(REDIS_URL)
        queue_depths = {}
        for queue in ["critical", "high", "default", "low"]:
            queue_depths[queue] = r.llen(queue)

        return {
            "status": "healthy",
            "workers": list(active_workers.keys()),
            "active_tasks": sum(len(tasks) for tasks in active_workers.values()),
            "queue_depths": queue_depths,
        }
    except Exception as e:
        return {"status": "unhealthy", "reason": str(e)}

# FastAPI health endpoint
@router.get("/health/celery")
async def celery_health():
    result = celery_health_check()
    status_code = 200 if result["status"] == "healthy" else 503
    return JSONResponse(content=result, status_code=status_code)
```

## Worker Inspection

```python
from celery import current_app

def inspect_workers() -> dict:
    """Get detailed worker status."""
    inspector = current_app.control.inspect()

    return {
        "active": inspector.active(),        # Currently executing
        "reserved": inspector.reserved(),    # Prefetched, waiting
        "scheduled": inspector.scheduled(),  # ETA/countdown tasks
        "registered": inspector.registered_tasks(),  # Available task types
        "stats": inspector.stats(),          # Worker statistics
    }
```

## Queue Depth Monitoring

```python
import redis
from prometheus_client import Gauge

queue_depth_gauge = Gauge(
    "celery_queue_depth",
    "Number of pending tasks in queue",
    ["queue_name"],
)

def update_queue_metrics(redis_url: str):
    """Update queue depth metrics (call periodically)."""
    r = redis.from_url(redis_url)

    for queue in ["critical", "high", "default", "low", "bulk"]:
        depth = r.llen(queue)
        queue_depth_gauge.labels(queue_name=queue).set(depth)

# Schedule this as a periodic task
@celery_app.task
def collect_queue_metrics():
    update_queue_metrics(REDIS_URL)

celery_app.conf.beat_schedule["collect-metrics"] = {
    "task": "tasks.collect_queue_metrics",
    "schedule": 30.0,  # Every 30 seconds
}
```

## Alerting Rules

```python
# Alert configuration
ALERT_RULES = {
    "queue_depth_critical": {
        "queue": "critical",
        "threshold": 100,
        "severity": "critical",
        "message": "Critical queue depth exceeds {depth}",
    },
    "queue_depth_default": {
        "queue": "default",
        "threshold": 5000,
        "severity": "warning",
        "message": "Default queue backing up: {depth} pending",
    },
    "worker_down": {
        "min_workers": 1,
        "severity": "critical",
        "message": "No active Celery workers",
    },
}

def check_alerts(health: dict):
    """Evaluate alert rules against current health."""
    alerts = []
    for rule_name, rule in ALERT_RULES.items():
        if "queue" in rule:
            depth = health.get("queue_depths", {}).get(rule["queue"], 0)
            if depth > rule["threshold"]:
                alerts.append({
                    "rule": rule_name,
                    "severity": rule["severity"],
                    "message": rule["message"].format(depth=depth),
                })
        elif "min_workers" in rule:
            worker_count = len(health.get("workers", []))
            if worker_count < rule["min_workers"]:
                alerts.append({
                    "rule": rule_name,
                    "severity": rule["severity"],
                    "message": rule["message"],
                })
    return alerts
```

## Key Metrics Summary

| Metric | Type | Description |
|--------|------|-------------|
| Queue depth | Gauge | Pending tasks per queue |
| Task duration | Histogram | p50/p95/p99 execution time |
| Tasks started | Counter | Total tasks dispatched |
| Tasks completed | Counter | Total tasks finished (by state) |
| Tasks failed | Counter | Total failures (by exception type) |
| Active tasks | Gauge | Currently executing tasks |
| Worker count | Gauge | Number of active workers |

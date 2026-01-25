# Celery Beat Scheduling

Periodic task configuration for Celery 5.x with advanced scheduling patterns.

## Basic Schedule Configuration

```python
# celery_config.py
from celery.schedules import crontab, solar

celery_app.conf.beat_schedule = {
    # Run every 5 minutes
    "process-pending-orders": {
        "task": "tasks.process_pending_orders",
        "schedule": 300.0,  # seconds
    },

    # Run at specific times with crontab
    "daily-report": {
        "task": "tasks.generate_daily_report",
        "schedule": crontab(hour=6, minute=0),  # 6:00 AM daily
    },

    # Weekly task
    "weekly-cleanup": {
        "task": "tasks.cleanup_old_records",
        "schedule": crontab(hour=2, minute=0, day_of_week="sunday"),
    },

    # Monthly task
    "monthly-billing": {
        "task": "tasks.process_monthly_billing",
        "schedule": crontab(hour=0, minute=0, day_of_month=1),
    },

    # With arguments
    "sync-inventory": {
        "task": "tasks.sync_inventory",
        "schedule": crontab(minute="*/15"),  # Every 15 minutes
        "args": ("warehouse-1",),
        "kwargs": {"full_sync": False},
    },
}

celery_app.conf.timezone = "UTC"
```

## Crontab Patterns

```python
from celery.schedules import crontab

SCHEDULES = {
    # Every minute
    "every_minute": crontab(),

    # Every hour at :00
    "hourly": crontab(minute=0),

    # Every day at midnight
    "daily_midnight": crontab(hour=0, minute=0),

    # Weekdays at 9 AM
    "weekday_morning": crontab(hour=9, minute=0, day_of_week="mon-fri"),

    # Every 15 minutes during business hours
    "business_hours": crontab(
        minute="*/15",
        hour="9-17",
        day_of_week="mon-fri",
    ),

    # First Monday of each month
    "first_monday": crontab(
        hour=0,
        minute=0,
        day_of_week="monday",
        day_of_month="1-7",
    ),

    # Quarterly (Jan 1, Apr 1, Jul 1, Oct 1)
    "quarterly": crontab(
        hour=0,
        minute=0,
        day_of_month=1,
        month_of_year="1,4,7,10",
    ),
}
```

## Database-Backed Schedules

```python
# Using django-celery-beat or celery-sqlalchemy-scheduler

# Install: pip install django-celery-beat

# settings.py
INSTALLED_APPS = [
    ...
    "django_celery_beat",
]

# celery_config.py
celery_app.conf.beat_scheduler = "django_celery_beat.schedulers:DatabaseScheduler"

# Create schedules programmatically
from django_celery_beat.models import PeriodicTask, IntervalSchedule, CrontabSchedule

def create_user_report_schedule(user_id: str, hour: int):
    """Create user-specific scheduled report."""
    schedule, _ = CrontabSchedule.objects.get_or_create(
        hour=hour,
        minute=0,
        timezone="UTC",
    )

    PeriodicTask.objects.update_or_create(
        name=f"user-report-{user_id}",
        defaults={
            "task": "tasks.generate_user_report",
            "crontab": schedule,
            "args": json.dumps([user_id]),
            "enabled": True,
        },
    )

def disable_schedule(name: str):
    """Disable a scheduled task."""
    PeriodicTask.objects.filter(name=name).update(enabled=False)
```

## Solar Schedules (Sunrise/Sunset)

```python
from celery.schedules import solar

celery_app.conf.beat_schedule = {
    # Run at sunrise
    "morning-lights-off": {
        "task": "tasks.control_lights",
        "schedule": solar("sunrise", -37.8136, 144.9631),  # Melbourne
        "args": ("off",),
    },

    # Run at sunset
    "evening-lights-on": {
        "task": "tasks.control_lights",
        "schedule": solar("sunset", -37.8136, 144.9631),
        "args": ("on",),
    },
}
```

## Advanced: Dynamic Interval Tasks

```python
from celery import shared_task
from datetime import timedelta

class DynamicScheduleTask:
    """Task that adjusts its own schedule based on results."""

    @shared_task(bind=True)
    def adaptive_poll(self, resource_id: str):
        """Poll with adaptive interval based on activity."""
        result = check_resource(resource_id)

        if result.has_changes:
            # Activity detected: poll more frequently
            self.apply_async(
                args=(resource_id,),
                countdown=30,  # 30 seconds
            )
        else:
            # No activity: back off
            current_delay = self.request.kwargs.get("delay", 30)
            next_delay = min(current_delay * 2, 300)  # Max 5 minutes
            self.apply_async(
                args=(resource_id,),
                kwargs={"delay": next_delay},
                countdown=next_delay,
            )

        return result

# Start the adaptive loop
def start_polling(resource_id: str):
    DynamicScheduleTask.adaptive_poll.delay(resource_id)
```

## Locking Schedules (Prevent Overlap)

```python
import redis
from contextlib import contextmanager

redis_client = redis.from_url(REDIS_URL)

@contextmanager
def schedule_lock(task_name: str, timeout: int = 3600):
    """Prevent overlapping scheduled task runs."""
    lock_key = f"schedule_lock:{task_name}"
    lock = redis_client.lock(lock_key, timeout=timeout)

    acquired = lock.acquire(blocking=False)
    if not acquired:
        raise ScheduleLockError(f"Task {task_name} already running")

    try:
        yield
    finally:
        lock.release()

@celery_app.task(bind=True)
def long_running_scheduled_task(self):
    """Scheduled task that should not overlap."""
    with schedule_lock(self.name, timeout=7200):  # 2 hour max
        perform_long_operation()

# Alternative: Using task options
@celery_app.task(
    bind=True,
    acks_late=True,
    reject_on_worker_lost=True,
)
def exclusive_scheduled_task(self):
    """Alternative using task-level locking."""
    lock_id = f"{self.name}-lock"

    if not redis_client.set(lock_id, "1", nx=True, ex=3600):
        return {"status": "skipped", "reason": "already running"}

    try:
        return perform_operation()
    finally:
        redis_client.delete(lock_id)
```

## Beat Monitoring

```python
from celery import signals
from prometheus_client import Counter, Histogram

beat_sent = Counter(
    "celery_beat_tasks_sent_total",
    "Scheduled tasks sent by beat",
    ["task_name"],
)

beat_latency = Histogram(
    "celery_beat_latency_seconds",
    "Latency between scheduled time and actual send",
    ["task_name"],
)

@signals.beat_sent.connect
def on_beat_sent(sender, task_id, task, args, kwargs, **_):
    """Track beat task dispatches."""
    beat_sent.labels(task_name=task.name).inc()
```

## Running Beat

```bash
# Standalone beat process
celery -A app beat --loglevel=INFO

# With embedded beat in worker (development only)
celery -A app worker --beat --loglevel=INFO

# With database scheduler
celery -A app beat --scheduler django_celery_beat.schedulers:DatabaseScheduler

# With PID file for process management
celery -A app beat --pidfile=/var/run/celery/beat.pid
```

## Best Practices

| Practice | Reason |
|----------|--------|
| Use UTC timezone | Avoid DST issues |
| Add schedule locks | Prevent overlap for long tasks |
| Use database scheduler | Dynamic schedule management |
| Monitor beat health | Detect missed schedules |
| Separate beat process | Better reliability than embedded |

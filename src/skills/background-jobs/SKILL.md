---
name: background-jobs
description: Async task processing with Celery, ARQ, and Redis for Python backends. Use when implementing background tasks, job queues, workers, scheduled jobs, or periodic task processing.
context: fork
agent: data-pipeline-engineer
version: 1.0.0
tags: [background-jobs, celery, arq, redis, async, python, 2026]
author: OrchestKit
user-invocable: false
---

# Background Job Patterns

Offload long-running tasks with async job queues.

## Overview

- Long-running tasks (report generation, data processing)
- Email/notification sending
- Scheduled/periodic tasks
- Webhook processing
- Data export/import pipelines
- Non-LLM async operations (use LangGraph for LLM workflows)

## Tool Selection

| Tool | Language | Best For | Complexity |
|------|----------|----------|------------|
| ARQ | Python (async) | FastAPI, simple jobs | Low |
| Celery | Python | Complex workflows, enterprise | High |
| RQ | Python | Simple Redis queues | Low |
| Dramatiq | Python | Reliable messaging | Medium |

## ARQ (Async Redis Queue)

### Setup

```python
# backend/app/workers/arq_worker.py
from arq import create_pool
from arq.connections import RedisSettings

async def startup(ctx: dict):
    """Initialize worker resources."""
    ctx["db"] = await create_db_pool()
    ctx["http"] = httpx.AsyncClient()

async def shutdown(ctx: dict):
    """Cleanup worker resources."""
    await ctx["db"].close()
    await ctx["http"].aclose()

class WorkerSettings:
    redis_settings = RedisSettings(host="redis", port=6379)
    functions = [
        send_email,
        generate_report,
        process_webhook,
    ]
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 10
    job_timeout = 300  # 5 minutes
```

### Task Definition

```python
from arq import func

async def send_email(
    ctx: dict,
    to: str,
    subject: str,
    body: str,
) -> dict:
    """Send email task."""
    http = ctx["http"]
    response = await http.post(
        "https://api.sendgrid.com/v3/mail/send",
        json={"to": to, "subject": subject, "html": body},
        headers={"Authorization": f"Bearer {SENDGRID_KEY}"},
    )
    return {"status": response.status_code, "to": to}

async def generate_report(
    ctx: dict,
    report_id: str,
    format: str = "pdf",
) -> dict:
    """Generate report asynchronously."""
    db = ctx["db"]
    data = await db.fetch_report_data(report_id)
    pdf_bytes = await render_pdf(data)
    await db.save_report_file(report_id, pdf_bytes)
    return {"report_id": report_id, "size": len(pdf_bytes)}
```

### Enqueue from FastAPI

```python
from arq import create_pool
from arq.connections import RedisSettings

# Dependency
async def get_arq_pool():
    return await create_pool(RedisSettings(host="redis"))

@router.post("/api/v1/reports")
async def create_report(
    data: ReportRequest,
    arq: ArqRedis = Depends(get_arq_pool),
):
    report = await service.create_report(data)

    # Enqueue background job
    job = await arq.enqueue_job(
        "generate_report",
        report.id,
        format=data.format,
    )

    return {"report_id": report.id, "job_id": job.job_id}

@router.get("/api/v1/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    arq: ArqRedis = Depends(get_arq_pool),
):
    job = Job(job_id, arq)
    status = await job.status()
    result = await job.result() if status == JobStatus.complete else None
    return {"job_id": job_id, "status": status, "result": result}
```

## Celery (Enterprise)

### Setup

```python
# backend/app/workers/celery_app.py
from celery import Celery

celery_app = Celery(
    "orchestkit",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/1",
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    task_track_started=True,
    task_time_limit=600,  # 10 minutes hard limit
    task_soft_time_limit=540,  # 9 minutes soft limit
    worker_prefetch_multiplier=1,  # Fair distribution
    task_acks_late=True,  # Acknowledge after completion
    task_reject_on_worker_lost=True,
)
```

### Task Definition

```python
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(ConnectionError, TimeoutError),
)
def send_email(self, to: str, subject: str, body: str) -> dict:
    """Send email with automatic retry."""
    try:
        response = requests.post(
            "https://api.sendgrid.com/v3/mail/send",
            json={"to": to, "subject": subject, "html": body},
            headers={"Authorization": f"Bearer {SENDGRID_KEY}"},
            timeout=30,
        )
        response.raise_for_status()
        return {"status": "sent", "to": to}
    except Exception as exc:
        logger.error(f"Email failed: {exc}")
        raise self.retry(exc=exc)

@shared_task(bind=True)
def generate_report(self, report_id: str) -> dict:
    """Long-running report generation."""
    self.update_state(state="PROGRESS", meta={"step": "fetching"})
    data = fetch_report_data(report_id)

    self.update_state(state="PROGRESS", meta={"step": "rendering"})
    pdf = render_pdf(data)

    self.update_state(state="PROGRESS", meta={"step": "saving"})
    save_report(report_id, pdf)

    return {"report_id": report_id, "size": len(pdf)}
```

### Chains and Groups

```python
from celery import chain, group, chord

# Sequential execution
workflow = chain(
    extract_data.s(source_id),
    transform_data.s(),
    load_data.s(destination_id),
)
result = workflow.apply_async()

# Parallel execution
parallel = group(
    process_chunk.s(chunk) for chunk in chunks
)
result = parallel.apply_async()

# Parallel with callback
chord_workflow = chord(
    [process_chunk.s(chunk) for chunk in chunks],
    aggregate_results.s(),
)
result = chord_workflow.apply_async()
```

### Periodic Tasks (Celery Beat)

```python
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    "cleanup-expired-sessions": {
        "task": "app.workers.tasks.cleanup_sessions",
        "schedule": crontab(minute=0, hour="*/6"),  # Every 6 hours
    },
    "generate-daily-report": {
        "task": "app.workers.tasks.daily_report",
        "schedule": crontab(minute=0, hour=2),  # 2 AM daily
    },
    "sync-external-data": {
        "task": "app.workers.tasks.sync_data",
        "schedule": 300.0,  # Every 5 minutes
    },
}
```

## FastAPI Integration

```python
from fastapi import BackgroundTasks

@router.post("/api/v1/users")
async def create_user(
    data: UserCreate,
    background_tasks: BackgroundTasks,
):
    user = await service.create_user(data)

    # Simple background task (in-process)
    background_tasks.add_task(send_welcome_email, user.email)

    return user

# For distributed tasks, use ARQ/Celery
@router.post("/api/v1/exports")
async def create_export(
    data: ExportRequest,
    arq: ArqRedis = Depends(get_arq_pool),
):
    job = await arq.enqueue_job("export_data", data.dict())
    return {"job_id": job.job_id}
```

## Job Status Tracking

```python
from enum import Enum

class JobStatus(Enum):
    PENDING = "pending"
    STARTED = "started"
    PROGRESS = "progress"
    SUCCESS = "success"
    FAILURE = "failure"
    REVOKED = "revoked"

@router.get("/api/v1/jobs/{job_id}")
async def get_job(job_id: str):
    # Celery
    result = AsyncResult(job_id, app=celery_app)
    return {
        "job_id": job_id,
        "status": result.status,
        "result": result.result if result.ready() else None,
        "progress": result.info if result.status == "PROGRESS" else None,
    }
```

## Anti-Patterns (FORBIDDEN)

```python
# NEVER run long tasks synchronously
@router.post("/api/v1/reports")
async def create_report(data: ReportRequest):
    pdf = await generate_pdf(data)  # Blocks for minutes!
    return pdf

# NEVER lose jobs on failure
@shared_task
def risky_task():
    do_work()  # No retry, no error handling

# NEVER store large results in Redis
@shared_task
def process_file(file_id: str) -> bytes:
    return large_file_bytes  # Store in S3/DB instead!

# NEVER use BackgroundTasks for distributed work
background_tasks.add_task(long_running_job)  # Lost if server restarts
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Simple async | ARQ (native async) |
| Complex workflows | Celery (chains, chords) |
| In-process quick | FastAPI BackgroundTasks |
| LLM workflows | LangGraph (not Celery) |
| Result storage | Redis for status, S3/DB for data |
| Retry strategy | Exponential backoff with jitter |

## Related Skills

- `langgraph-checkpoints` - LLM workflow persistence
- `resilience-patterns` - Retry and fallback
- `observability-monitoring` - Job metrics

## Capability Details

### arq-tasks
**Keywords:** arq, async queue, redis queue, background task
**Solves:**
- How to run async background tasks in FastAPI?
- Simple Redis job queue

### celery-tasks
**Keywords:** celery, task queue, distributed tasks, worker
**Solves:**
- Enterprise task queue
- Complex job workflows

### celery-workflows
**Keywords:** chain, group, chord, celery workflow
**Solves:**
- Sequential task execution
- Parallel task processing

### periodic-tasks
**Keywords:** periodic, scheduled, cron, celery beat
**Solves:**
- Run tasks on schedule
- Cron-like job scheduling

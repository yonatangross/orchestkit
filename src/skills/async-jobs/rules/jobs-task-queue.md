---
title: "Jobs: Task Queue Setup"
category: jobs
impact: HIGH
impactDescription: Task queue setup is the foundation for reliable background processing
tags: [arq, celery, task-queue, redis, fastapi, worker]
---

# Task Queue Setup

## ARQ (Async Redis Queue)

```python
from arq import create_pool
from arq.connections import RedisSettings

async def startup(ctx: dict):
    ctx["db"] = await create_db_pool()
    ctx["http"] = httpx.AsyncClient()

async def shutdown(ctx: dict):
    await ctx["db"].close()
    await ctx["http"].aclose()

class WorkerSettings:
    redis_settings = RedisSettings(host="redis", port=6379)
    functions = [send_email, generate_report, process_webhook]
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 10
    job_timeout = 300
```

## ARQ Task Definition

```python
async def send_email(ctx: dict, to: str, subject: str, body: str) -> dict:
    http = ctx["http"]
    response = await http.post("https://api.sendgrid.com/v3/mail/send",
        json={"to": to, "subject": subject, "html": body},
        headers={"Authorization": f"Bearer {SENDGRID_KEY}"})
    return {"status": response.status_code, "to": to}
```

## Celery Setup

```python
from celery import Celery

celery_app = Celery("orchestkit",
    broker="redis://redis:6379/0", backend="redis://redis:6379/1")

celery_app.conf.update(
    task_serializer="json",
    task_track_started=True,
    task_time_limit=600,
    task_soft_time_limit=540,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)
```

## Celery Task with Retry

```python
@shared_task(bind=True, max_retries=3, default_retry_delay=60,
    autoretry_for=(ConnectionError, TimeoutError))
def send_email(self, to: str, subject: str, body: str) -> dict:
    try:
        response = requests.post(url, json=data, timeout=30)
        response.raise_for_status()
        return {"status": "sent", "to": to}
    except Exception as exc:
        raise self.retry(exc=exc)
```

**Incorrect — No retry strategy:**
```python
# Fails permanently on first error
@shared_task
def send_email(to: str, subject: str):
    response = requests.post(url, json=data)  # Network error = lost job
    return response.json()
```

**Correct — Retry with exponential backoff:**
```python
# Retries with backoff
@shared_task(bind=True, max_retries=3, default_retry_delay=60,
    autoretry_for=(ConnectionError, TimeoutError))
def send_email(self, to: str, subject: str):
    try:
        response = requests.post(url, json=data, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
```

## Tool Selection

| Tool | Best For | Complexity |
|------|----------|------------|
| ARQ | FastAPI, async jobs | Low |
| Celery | Complex workflows | High |
| RQ | Simple Redis queues | Low |
| FastAPI BackgroundTasks | Quick in-process | None |

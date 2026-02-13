---
title: "Jobs: Scheduling & Background Tasks"
category: jobs
impact: HIGH
impactDescription: Proper scheduling ensures reliable periodic execution without overlap or drift
tags: [celery-beat, scheduling, crontab, periodic, background-tasks, fastapi]
---

# Scheduling & Background Tasks

## Celery Beat (Periodic Tasks)

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

## FastAPI BackgroundTasks (In-Process)

```python
from fastapi import BackgroundTasks

@router.post("/api/v1/users")
async def create_user(data: UserCreate, background_tasks: BackgroundTasks):
    user = await service.create_user(data)
    background_tasks.add_task(send_welcome_email, user.email)
    return user
```

## FastAPI + Distributed Queue

```python
@router.post("/api/v1/exports")
async def create_export(data: ExportRequest, arq: ArqRedis = Depends(get_arq_pool)):
    job = await arq.enqueue_job("export_data", data.dict())
    return {"job_id": job.job_id}
```

## Key Decisions

| Scenario | Use |
|----------|-----|
| Quick, non-critical | FastAPI BackgroundTasks |
| Periodic/scheduled | Celery Beat |
| Distributed, durable | ARQ or Celery |
| LLM workflows | LangGraph (not Celery) |

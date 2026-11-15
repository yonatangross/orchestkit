---
title: Track background job status and execution metrics for operational visibility
category: jobs
impact: HIGH
impactDescription: Job status tracking provides visibility into background task execution
tags: [job-status, progress, tracking, arq, celery, endpoints]
---

# Job Status Tracking

## Job Status Enum

```python
from enum import Enum

class JobStatus(Enum):
    PENDING = "pending"
    STARTED = "started"
    PROGRESS = "progress"
    SUCCESS = "success"
    FAILURE = "failure"
    REVOKED = "revoked"
```

## ARQ Status Endpoint

```python
@router.get("/api/v1/jobs/{job_id}")
async def get_job_status(job_id: str, arq: ArqRedis = Depends(get_arq_pool)):
    job = Job(job_id, arq)
    status = await job.status()
    result = await job.result() if status == JobStatus.complete else None
    return {"job_id": job_id, "status": status, "result": result}
```

## Celery Progress Updates

```python
@shared_task(bind=True)
def generate_report(self, report_id: str) -> dict:
    self.update_state(state="PROGRESS", meta={"step": "fetching"})
    data = fetch_report_data(report_id)

    self.update_state(state="PROGRESS", meta={"step": "rendering"})
    pdf = render_pdf(data)

    return {"report_id": report_id, "size": len(pdf)}
```

**Incorrect — No progress updates:**
```python
@shared_task
def generate_report(report_id: str):
    # Long-running task with no feedback
    data = fetch_report_data(report_id)
    pdf = render_pdf(data)
    return {"report_id": report_id}
```

**Correct — Progress updates:**
```python
@shared_task(bind=True)
def generate_report(self, report_id: str):
    self.update_state(state="PROGRESS", meta={"step": "fetching", "percent": 25})
    data = fetch_report_data(report_id)

    self.update_state(state="PROGRESS", meta={"step": "rendering", "percent": 75})
    pdf = render_pdf(data)
    return {"report_id": report_id}
```

## Celery Status Endpoint

```python
@router.get("/api/v1/jobs/{job_id}")
async def get_job(job_id: str):
    result = AsyncResult(job_id, app=celery_app)
    return {
        "job_id": job_id,
        "status": result.status,
        "result": result.result if result.ready() else None,
        "progress": result.info if result.status == "PROGRESS" else None,
    }
```

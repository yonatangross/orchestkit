# Quick Start Examples

## Celery Task with Retry

```python
from celery import shared_task

@shared_task(
    bind=True,
    max_retries=3,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
)
def process_order(self, order_id: str) -> dict:
    result = do_processing(order_id)
    return {"order_id": order_id, "status": "completed"}
```

## ARQ Task with FastAPI

```python
from arq import create_pool
from arq.connections import RedisSettings

async def generate_report(ctx: dict, report_id: str) -> dict:
    data = await ctx["db"].fetch_report_data(report_id)
    pdf = await render_pdf(data)
    return {"report_id": report_id, "size": len(pdf)}

@router.post("/api/v1/reports")
async def create_report(data: ReportRequest, arq: ArqRedis = Depends(get_arq_pool)):
    job = await arq.enqueue_job("generate_report", data.report_id)
    return {"job_id": job.job_id}
```

## Tool Selection Guide

| Tool | Best For | Complexity |
|------|----------|------------|
| ARQ | FastAPI, simple async jobs | Low |
| Celery | Complex workflows, enterprise | High |
| RQ | Simple Redis queues | Low |
| Dramatiq | Reliable messaging | Medium |
| FastAPI BackgroundTasks | In-process quick tasks | Minimal |

### Decision Criteria

- **ARQ**: Native async/await, lightweight, ideal for FastAPI apps with simple background tasks
- **Celery**: Full-featured canvas workflows (chains, chords, groups), production monitoring with Flower
- **RQ**: Simple Redis-based queue, minimal setup, no async support
- **Dramatiq**: Reliable messaging with automatic retries, simpler than Celery
- **FastAPI BackgroundTasks**: In-process only, no persistence, use for fire-and-forget tasks under 30s

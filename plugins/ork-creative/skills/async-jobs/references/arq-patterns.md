# ARQ Patterns

Lightweight async Redis Queue patterns for FastAPI and simple background tasks.

## Worker Setup

```python
# backend/app/workers/arq_worker.py
from arq import create_pool
from arq.connections import RedisSettings

async def startup(ctx: dict):
    """Initialize worker resources on startup."""
    ctx["db"] = await create_db_pool()
    ctx["http"] = httpx.AsyncClient()

async def shutdown(ctx: dict):
    """Cleanup worker resources on shutdown."""
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

## Task Definition

```python
from arq import func

async def send_email(
    ctx: dict,
    to: str,
    subject: str,
    body: str,
) -> dict:
    """Send email task using shared HTTP client."""
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
    """Generate report asynchronously using shared DB pool."""
    db = ctx["db"]
    data = await db.fetch_report_data(report_id)
    pdf_bytes = await render_pdf(data)
    await db.save_report_file(report_id, pdf_bytes)
    return {"report_id": report_id, "size": len(pdf_bytes)}
```

## FastAPI Integration

### Enqueue Jobs

```python
from arq import create_pool
from arq.connections import RedisSettings, ArqRedis

# Dependency
async def get_arq_pool() -> ArqRedis:
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
```

### Job Status Endpoint

```python
from arq.jobs import Job, JobStatus

@router.get("/api/v1/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    arq: ArqRedis = Depends(get_arq_pool),
):
    job = Job(job_id, arq)
    status = await job.status()
    result = await job.result() if status == JobStatus.complete else None

    return {
        "job_id": job_id,
        "status": status.value,
        "result": result,
    }
```

### Delayed Tasks

```python
from datetime import timedelta

# Run in 1 hour
job = await arq.enqueue_job(
    "send_reminder",
    user_id="123",
    _defer_by=timedelta(hours=1),
)

# Run at specific time
from datetime import datetime, timezone

job = await arq.enqueue_job(
    "send_notification",
    user_id="123",
    _defer_until=datetime(2024, 12, 25, 9, 0, tzinfo=timezone.utc),
)
```

## FastAPI Lifespan Integration

```python
from contextlib import asynccontextmanager
from arq import create_pool
from arq.connections import RedisSettings

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize ARQ pool at startup, close at shutdown."""
    app.state.arq_pool = await create_pool(RedisSettings(host="redis"))
    yield
    await app.state.arq_pool.close()

app = FastAPI(lifespan=lifespan)

# Access pool in routes
async def get_arq(request: Request) -> ArqRedis:
    return request.app.state.arq_pool
```

## FastAPI BackgroundTasks (In-Process)

```python
from fastapi import BackgroundTasks

@router.post("/api/v1/users")
async def create_user(
    data: UserCreate,
    background_tasks: BackgroundTasks,
):
    user = await service.create_user(data)

    # Simple in-process background task
    # WARNING: Lost if server restarts — only for non-critical work
    background_tasks.add_task(send_welcome_email, user.email)

    return user
```

## ARQ vs Celery vs BackgroundTasks

| Feature | ARQ | Celery | BackgroundTasks |
|---------|-----|--------|-----------------|
| Async native | Yes | No (gevent/eventlet) | Yes |
| Broker | Redis only | Redis, RabbitMQ, SQS | None (in-process) |
| Workflows | No | Chain, group, chord | No |
| Monitoring | Basic | Flower, events | None |
| Persistence | Redis | Redis, RabbitMQ | None |
| Complexity | Low | High | Minimal |

## When to Use ARQ

- Building with FastAPI and native async/await
- Simple background tasks (email, notifications, reports)
- Redis is already in the stack
- Want minimal dependencies and configuration
- Tasks are independent (no complex workflows)

## When NOT to Use ARQ

- Need complex workflows (chains, chords) -- use Celery
- Need RabbitMQ or SQS -- use Celery
- Need LLM workflows -- use LangGraph
- Need guaranteed delivery with dead letter queues -- use Celery
- Need per-task rate limiting -- use Celery

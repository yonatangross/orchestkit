# ARQ with FastAPI

Complete guide to integrating ARQ (async Redis queue) with FastAPI.

## Setup

### Installation

```bash
pip install arq redis
```

### Project Structure

```
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   └── config.py
│   ├── tasks/
│   │   ├── __init__.py
│   │   ├── worker.py        # Worker settings
│   │   ├── email_tasks.py   # Email tasks
│   │   └── analysis_tasks.py # Analysis tasks
│   └── api/
│       └── routes/
```

## Worker Configuration

```python
# app/tasks/worker.py
from arq import cron
from arq.connections import RedisSettings
from app.core.config import settings

# Task imports
from app.tasks.email_tasks import send_email, send_bulk_emails
from app.tasks.analysis_tasks import process_analysis, cleanup_old_analyses


async def startup(ctx: dict):
    """Worker startup - initialize connections."""
    import redis.asyncio as redis
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

    ctx["redis"] = redis.from_url(settings.redis_url)
    ctx["db_engine"] = create_async_engine(settings.database_url)


async def shutdown(ctx: dict):
    """Worker shutdown - cleanup connections."""
    await ctx["redis"].close()
    await ctx["db_engine"].dispose()


class WorkerSettings:
    """ARQ worker settings."""

    redis_settings = RedisSettings.from_dsn(settings.redis_url)

    # Functions available to worker
    functions = [
        send_email,
        send_bulk_emails,
        process_analysis,
        cleanup_old_analyses,
    ]

    # Cron jobs
    cron_jobs = [
        cron(cleanup_old_analyses, hour=3, minute=0),  # Daily at 3 AM
    ]

    # Lifecycle
    on_startup = startup
    on_shutdown = shutdown

    # Concurrency
    max_jobs = 10
    job_timeout = 300  # 5 minutes

    # Retry settings
    max_tries = 3
    retry_delay = 60
```

## Task Definitions

### Email Tasks

```python
# app/tasks/email_tasks.py
from arq import Retry
from typing import Any
import structlog

logger = structlog.get_logger()


async def send_email(
    ctx: dict,
    to: str,
    subject: str,
    body: str,
    template: str | None = None,
) -> dict[str, Any]:
    """
    Send a single email.

    Args:
        ctx: Worker context with connections
        to: Recipient email
        subject: Email subject
        body: Email body or template variables
        template: Optional template name
    """
    logger.info("sending_email", to=to, subject=subject)

    try:
        # Use email service
        from app.services.email import EmailService

        email_service = EmailService()

        if template:
            await email_service.send_template(to, template, body)
        else:
            await email_service.send(to, subject, body)

        return {"status": "sent", "to": to}

    except ConnectionError as e:
        # Retry on transient errors
        logger.warning("email_send_failed_retrying", error=str(e))
        raise Retry(defer=60)  # Retry in 60 seconds


async def send_bulk_emails(
    ctx: dict,
    recipients: list[str],
    subject: str,
    body: str,
) -> dict[str, Any]:
    """Send emails to multiple recipients."""
    results = {"sent": 0, "failed": 0, "errors": []}

    for recipient in recipients:
        try:
            await send_email(ctx, recipient, subject, body)
            results["sent"] += 1
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({"email": recipient, "error": str(e)})

    return results
```

### Analysis Tasks

```python
# app/tasks/analysis_tasks.py
from arq import Retry
from datetime import datetime, timedelta
import structlog

logger = structlog.get_logger()


async def process_analysis(
    ctx: dict,
    analysis_id: str,
) -> dict:
    """
    Process an analysis in the background.

    This is a long-running task that:
    1. Fetches content from URL
    2. Generates embeddings
    3. Calls LLM for analysis
    4. Saves results
    """
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.services.analysis_service import AnalysisService
    from app.infrastructure.repositories import PostgresAnalysisRepository

    logger.info("processing_analysis", analysis_id=analysis_id)

    async with AsyncSession(ctx["db_engine"]) as session:
        repo = PostgresAnalysisRepository(session)
        service = AnalysisService(repo, ctx["redis"])

        try:
            # Update status to processing
            await service.update_status(analysis_id, "processing")

            # Process analysis
            result = await service.process(analysis_id)

            # Update status to completed
            await service.update_status(analysis_id, "completed")

            await session.commit()

            return {
                "status": "completed",
                "analysis_id": analysis_id,
                "artifacts_count": len(result.artifacts),
            }

        except Exception as e:
            logger.exception("analysis_processing_failed", analysis_id=analysis_id)
            await service.update_status(analysis_id, "failed", error=str(e))
            await session.commit()
            raise


async def cleanup_old_analyses(ctx: dict) -> dict:
    """
    Periodic task to cleanup old analyses.

    Runs daily via cron.
    """
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import delete
    from app.infrastructure.models import AnalysisModel

    logger.info("cleanup_old_analyses_started")

    cutoff = datetime.utcnow() - timedelta(days=30)

    async with AsyncSession(ctx["db_engine"]) as session:
        result = await session.execute(
            delete(AnalysisModel).where(AnalysisModel.created_at < cutoff)
        )
        await session.commit()

        deleted_count = result.rowcount
        logger.info("cleanup_old_analyses_completed", deleted=deleted_count)

        return {"deleted": deleted_count}
```

## FastAPI Integration

### Enqueue from Routes

```python
# app/api/v1/routes/analyses.py
from fastapi import APIRouter, Depends, BackgroundTasks
from arq import ArqRedis
from app.tasks.analysis_tasks import process_analysis

router = APIRouter()


async def get_task_queue(request: Request) -> ArqRedis:
    """Get ARQ task queue from app state."""
    return request.app.state.arq


@router.post("/analyses", status_code=201)
async def create_analysis(
    request: AnalyzeRequest,
    queue: ArqRedis = Depends(get_task_queue),
    service: AnalysisService = Depends(get_analysis_service),
) -> AnalyzeCreateResponse:
    """Create analysis and enqueue processing."""
    # Create analysis record
    analysis = await service.create(request.url)

    # Enqueue background processing
    job = await queue.enqueue_job(
        "process_analysis",
        analysis_id=str(analysis.id),
    )

    return AnalyzeCreateResponse(
        analysis_id=str(analysis.id),
        job_id=job.job_id,
        status="pending",
    )


@router.post("/analyses/{analysis_id}/reprocess")
async def reprocess_analysis(
    analysis_id: str,
    queue: ArqRedis = Depends(get_task_queue),
) -> dict:
    """Reprocess a failed analysis."""
    job = await queue.enqueue_job(
        "process_analysis",
        analysis_id=analysis_id,
    )
    return {"job_id": job.job_id, "status": "queued"}
```

### App Setup

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from arq import create_pool
from arq.connections import RedisSettings

from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan with ARQ pool."""
    # Create ARQ connection pool
    app.state.arq = await create_pool(
        RedisSettings.from_dsn(settings.redis_url)
    )

    yield

    # Cleanup
    await app.state.arq.close()


app = FastAPI(lifespan=lifespan)
```

## Running Workers

### Development

```bash
# Single worker
arq app.tasks.worker.WorkerSettings

# Multiple workers (different terminal for each)
arq app.tasks.worker.WorkerSettings --watch  # Auto-reload
```

### Production (Docker)

```dockerfile
# Dockerfile.worker
FROM python:3.13-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .

CMD ["arq", "app.tasks.worker.WorkerSettings"]
```

```yaml
# docker-compose.yml
services:
  api:
    build: .
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000

  worker:
    build:
      dockerfile: Dockerfile.worker
    command: arq app.tasks.worker.WorkerSettings
    deploy:
      replicas: 3
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
```

## Job Status Tracking

```python
# app/api/v1/routes/jobs.py
from fastapi import APIRouter, Depends
from arq import ArqRedis
from arq.jobs import Job

router = APIRouter()


@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    queue: ArqRedis = Depends(get_task_queue),
) -> dict:
    """Get status of a background job."""
    job = Job(job_id, queue)
    status = await job.status()
    info = await job.info()

    return {
        "job_id": job_id,
        "status": status.value,
        "function": info.function if info else None,
        "enqueue_time": info.enqueue_time.isoformat() if info else None,
        "start_time": info.start_time.isoformat() if info and info.start_time else None,
        "finish_time": info.finish_time.isoformat() if info and info.finish_time else None,
        "result": info.result if info and status.value == "complete" else None,
    }


@router.delete("/jobs/{job_id}")
async def cancel_job(
    job_id: str,
    queue: ArqRedis = Depends(get_task_queue),
) -> dict:
    """Cancel a pending job."""
    job = Job(job_id, queue)
    await job.abort()
    return {"status": "cancelled"}
```

## Testing

```python
# tests/test_tasks.py
import pytest
from unittest.mock import AsyncMock, patch
from app.tasks.email_tasks import send_email


@pytest.fixture
def worker_ctx():
    """Mock worker context."""
    return {
        "redis": AsyncMock(),
        "db_engine": AsyncMock(),
    }


@pytest.mark.asyncio
async def test_send_email(worker_ctx):
    with patch("app.services.email.EmailService") as MockEmailService:
        mock_service = MockEmailService.return_value
        mock_service.send = AsyncMock()

        result = await send_email(
            worker_ctx,
            to="test@example.com",
            subject="Test",
            body="Hello",
        )

        assert result["status"] == "sent"
        mock_service.send.assert_called_once_with(
            "test@example.com", "Test", "Hello"
        )
```

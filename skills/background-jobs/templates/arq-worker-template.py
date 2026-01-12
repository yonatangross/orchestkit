"""
ARQ Worker Template

Production-ready ARQ worker configuration with:
- Lifecycle management
- Retry handling
- Logging
- Health checks
"""

from typing import Any, Callable
from datetime import datetime, timedelta
import asyncio
import structlog

from arq import cron, Retry
from arq.connections import RedisSettings
import redis.asyncio as redis


logger = structlog.get_logger()


# ============================================================================
# Configuration
# ============================================================================

class Settings:
    """Application settings."""

    redis_url: str = "redis://localhost:6379"
    database_url: str = "postgresql+asyncpg://user:pass@localhost/db"

    # Worker settings
    max_jobs: int = 10
    job_timeout: int = 300  # 5 minutes
    max_tries: int = 3
    retry_delay: int = 60  # 1 minute


settings = Settings()


# ============================================================================
# Lifecycle Hooks
# ============================================================================

async def startup(ctx: dict) -> None:
    """
    Worker startup.

    Initialize shared resources:
    - Database connection pool
    - Redis client
    - Service clients
    """
    logger.info("worker_starting")

    # Redis for caching
    ctx["redis"] = redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
    )

    # Database engine
    from sqlalchemy.ext.asyncio import create_async_engine

    ctx["db_engine"] = create_async_engine(
        settings.database_url,
        pool_size=5,
        max_overflow=10,
    )

    # Verify connections
    await ctx["redis"].ping()
    async with ctx["db_engine"].connect() as conn:
        await conn.execute("SELECT 1")

    logger.info("worker_started")


async def shutdown(ctx: dict) -> None:
    """
    Worker shutdown.

    Cleanup resources gracefully.
    """
    logger.info("worker_stopping")

    await ctx["redis"].close()
    await ctx["db_engine"].dispose()

    logger.info("worker_stopped")


# ============================================================================
# Task Decorators
# ============================================================================

def task_wrapper(
    max_retries: int = 3,
    retry_on: tuple[type[Exception], ...] = (ConnectionError, TimeoutError),
):
    """
    Decorator for consistent task handling.

    Features:
    - Automatic logging
    - Retry on transient errors
    - Duration tracking
    """

    def decorator(func: Callable):
        async def wrapper(ctx: dict, *args, **kwargs) -> Any:
            task_name = func.__name__
            start_time = datetime.utcnow()

            logger.info(
                "task_started",
                task=task_name,
                args=args,
                kwargs=kwargs,
            )

            try:
                result = await func(ctx, *args, **kwargs)

                duration = (datetime.utcnow() - start_time).total_seconds()
                logger.info(
                    "task_completed",
                    task=task_name,
                    duration=duration,
                    result=result,
                )

                return result

            except retry_on as e:
                duration = (datetime.utcnow() - start_time).total_seconds()
                logger.warning(
                    "task_retrying",
                    task=task_name,
                    duration=duration,
                    error=str(e),
                )
                raise Retry(defer=settings.retry_delay)

            except Exception as e:
                duration = (datetime.utcnow() - start_time).total_seconds()
                logger.exception(
                    "task_failed",
                    task=task_name,
                    duration=duration,
                    error=str(e),
                )
                raise

        wrapper.__name__ = func.__name__
        return wrapper

    return decorator


# ============================================================================
# Task Definitions
# ============================================================================

@task_wrapper()
async def send_email(
    ctx: dict,
    to: str,
    subject: str,
    body: str,
    template: str | None = None,
) -> dict:
    """Send an email."""
    # Simulate email sending
    await asyncio.sleep(0.1)

    return {
        "status": "sent",
        "to": to,
        "subject": subject,
    }


@task_wrapper()
async def process_analysis(
    ctx: dict,
    analysis_id: str,
) -> dict:
    """Process an analysis in the background."""
    from sqlalchemy.ext.asyncio import AsyncSession

    async with AsyncSession(ctx["db_engine"]) as session:
        # Your processing logic here
        # 1. Fetch analysis
        # 2. Process content
        # 3. Update status
        await asyncio.sleep(1)  # Simulate work

        return {
            "status": "completed",
            "analysis_id": analysis_id,
        }


@task_wrapper()
async def send_notification(
    ctx: dict,
    user_id: str,
    message: str,
    channel: str = "push",
) -> dict:
    """Send a notification to a user."""
    await asyncio.sleep(0.1)

    return {
        "status": "sent",
        "user_id": user_id,
        "channel": channel,
    }


# ============================================================================
# Scheduled Tasks
# ============================================================================

@task_wrapper()
async def cleanup_old_data(ctx: dict) -> dict:
    """
    Periodic cleanup task.

    Removes data older than 30 days.
    """
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import text

    cutoff = datetime.utcnow() - timedelta(days=30)

    async with AsyncSession(ctx["db_engine"]) as session:
        result = await session.execute(
            text("DELETE FROM temp_data WHERE created_at < :cutoff"),
            {"cutoff": cutoff},
        )
        await session.commit()

        return {"deleted": result.rowcount}


@task_wrapper()
async def generate_daily_report(ctx: dict) -> dict:
    """Generate daily analytics report."""
    # Your report generation logic
    await asyncio.sleep(2)

    return {"status": "generated", "date": datetime.utcnow().date().isoformat()}


@task_wrapper()
async def sync_external_data(ctx: dict) -> dict:
    """Sync data from external API."""
    await asyncio.sleep(1)

    return {"status": "synced", "records": 100}


# ============================================================================
# Health Check
# ============================================================================

async def health_check(ctx: dict) -> dict:
    """
    Health check task.

    Returns worker health status.
    """
    try:
        # Check Redis
        await ctx["redis"].ping()
        redis_status = "healthy"
    except Exception as e:
        redis_status = f"unhealthy: {e}"

    try:
        # Check Database
        async with ctx["db_engine"].connect() as conn:
            await conn.execute("SELECT 1")
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {e}"

    return {
        "redis": redis_status,
        "database": db_status,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ============================================================================
# Worker Settings
# ============================================================================

class WorkerSettings:
    """ARQ worker configuration."""

    # Redis connection
    redis_settings = RedisSettings.from_dsn(settings.redis_url)

    # Available functions
    functions = [
        send_email,
        process_analysis,
        send_notification,
        cleanup_old_data,
        generate_daily_report,
        sync_external_data,
        health_check,
    ]

    # Scheduled tasks
    cron_jobs = [
        # Daily cleanup at 3 AM
        cron(cleanup_old_data, hour=3, minute=0),
        # Daily report at 6 AM
        cron(generate_daily_report, hour=6, minute=0),
        # Sync every hour
        cron(sync_external_data, minute=0),
    ]

    # Lifecycle
    on_startup = startup
    on_shutdown = shutdown

    # Concurrency
    max_jobs = settings.max_jobs
    job_timeout = settings.job_timeout

    # Retry settings
    max_tries = settings.max_tries

    # Queue health check
    health_check_interval = 60
    health_check_key = "arq:health"


# ============================================================================
# Run Worker
# ============================================================================

if __name__ == "__main__":
    """
    Run worker directly for development.

    Production: arq app.tasks.worker.WorkerSettings
    """
    import arq.cli

    arq.cli.main()

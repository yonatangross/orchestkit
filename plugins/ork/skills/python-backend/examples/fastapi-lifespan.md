# FastAPI Lifespan Management

Complete examples for managing application lifecycle in FastAPI.

## Basic Lifespan

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.

    Code before yield runs on startup.
    Code after yield runs on shutdown.
    """
    # STARTUP
    print("Application starting...")
    app.state.started_at = datetime.now(timezone.utc)

    yield  # Application runs here

    # SHUTDOWN
    print("Application shutting down...")


app = FastAPI(lifespan=lifespan)
```

## Full Production Lifespan

```python
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import structlog

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
import redis.asyncio as redis

from app.core.config import settings

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Production lifespan with full resource management.

    Initializes:
    - Database connection pool
    - Redis connection
    - Background task queue
    - LLM clients
    """
    logger.info("application_starting", version=settings.app_version)

    # =====================================================================
    # STARTUP
    # =====================================================================

    # 1. Database Engine
    logger.info("initializing_database")
    app.state.db_engine = create_async_engine(
        settings.database_url,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_pre_ping=True,  # Verify connections
        echo=settings.debug,
    )

    # Verify database connection
    async with app.state.db_engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    logger.info("database_connected")

    # 2. Redis
    logger.info("initializing_redis")
    app.state.redis = redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )
    await app.state.redis.ping()
    logger.info("redis_connected")

    # 3. Task Queue (ARQ)
    logger.info("initializing_task_queue")
    from arq import create_pool
    from arq.connections import RedisSettings

    app.state.task_queue = await create_pool(
        RedisSettings.from_dsn(settings.redis_url)
    )
    logger.info("task_queue_connected")

    # 4. LLM Clients
    logger.info("initializing_llm_clients")
    from app.services.llm import LLMService

    app.state.llm = LLMService(
        openai_key=settings.openai_api_key,
        anthropic_key=settings.anthropic_api_key,
    )
    logger.info("llm_clients_initialized")

    # 5. Embeddings Service
    logger.info("initializing_embeddings")
    from app.services.embeddings import EmbeddingsService

    app.state.embeddings = EmbeddingsService(
        model=settings.embedding_model,
    )
    # Warmup embedding model
    await app.state.embeddings.embed("warmup")
    logger.info("embeddings_initialized")

    # Record startup time
    app.state.started_at = datetime.now(timezone.utc)
    logger.info("application_started")

    # =====================================================================
    # APPLICATION RUNS HERE
    # =====================================================================
    yield

    # =====================================================================
    # SHUTDOWN
    # =====================================================================
    logger.info("application_stopping")

    # Close in reverse order
    logger.info("closing_embeddings")
    await app.state.embeddings.close()

    logger.info("closing_llm_clients")
    await app.state.llm.close()

    logger.info("closing_task_queue")
    await app.state.task_queue.close()

    logger.info("closing_redis")
    await app.state.redis.close()

    logger.info("closing_database")
    await app.state.db_engine.dispose()

    logger.info("application_stopped")


# Create app with lifespan
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)
```

## Accessing App State in Routes

```python
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


async def get_db(request: Request) -> AsyncSession:
    """Dependency to get database session."""
    async with AsyncSession(
        request.app.state.db_engine,
        expire_on_commit=False,
    ) as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_redis(request: Request):
    """Dependency to get Redis client."""
    return request.app.state.redis


async def get_task_queue(request: Request):
    """Dependency to get task queue."""
    return request.app.state.task_queue


@router.get("/analyses/{id}")
async def get_analysis(
    id: str,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    # Try cache first
    cached = await redis.get(f"analysis:{id}")
    if cached:
        return json.loads(cached)

    # Query database
    analysis = await db.get(AnalysisModel, id)
    return analysis


@router.post("/analyses")
async def create_analysis(
    request: CreateAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    queue=Depends(get_task_queue),
):
    # Create record
    analysis = AnalysisModel(**request.dict())
    db.add(analysis)
    await db.commit()

    # Enqueue background processing
    await queue.enqueue_job("process_analysis", analysis_id=str(analysis.id))

    return analysis
```

## Health Check Using App State

```python
@router.get("/health")
async def health_check(request: Request):
    """Check health of all dependencies."""
    checks = {}

    # Database
    try:
        async with request.app.state.db_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "healthy"
    except Exception as e:
        checks["database"] = f"unhealthy: {e}"

    # Redis
    try:
        await request.app.state.redis.ping()
        checks["redis"] = "healthy"
    except Exception as e:
        checks["redis"] = f"unhealthy: {e}"

    # LLM
    try:
        if request.app.state.llm.is_available():
            checks["llm"] = "healthy"
        else:
            checks["llm"] = "unhealthy: no providers available"
    except Exception as e:
        checks["llm"] = f"unhealthy: {e}"

    # Overall status
    all_healthy = all(v == "healthy" for v in checks.values())
    status = "healthy" if all_healthy else "degraded"

    return {
        "status": status,
        "checks": checks,
        "uptime_seconds": (datetime.now(timezone.utc) - request.app.state.started_at).total_seconds(),
    }
```

## Graceful Shutdown

```python
import signal
import asyncio
from contextlib import asynccontextmanager

# Track active connections
active_connections: set = set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup signal handlers for graceful shutdown
    def handle_shutdown(signum, frame):
        logger.info("shutdown_signal_received", signal=signum)
        asyncio.create_task(graceful_shutdown())

    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)

    # Startup
    app.state.shutting_down = False
    yield

    # Shutdown
    logger.info("waiting_for_active_connections", count=len(active_connections))
    # Wait for active requests (up to 30 seconds)
    for _ in range(30):
        if not active_connections:
            break
        await asyncio.sleep(1)

    logger.info("shutdown_complete")


async def graceful_shutdown():
    """Initiate graceful shutdown."""
    app.state.shutting_down = True
    logger.info("graceful_shutdown_initiated")


# Middleware to track active connections
@app.middleware("http")
async def track_connections(request: Request, call_next):
    if app.state.shutting_down:
        return JSONResponse(
            status_code=503,
            content={"detail": "Server is shutting down"},
        )

    connection_id = id(request)
    active_connections.add(connection_id)
    try:
        return await call_next(request)
    finally:
        active_connections.discard(connection_id)
```

## Testing with Lifespan

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.main import app


@pytest.fixture
async def client():
    """Test client with mocked dependencies."""
    # Override app state for testing
    app.state.db_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=True,
    )
    app.state.redis = FakeRedis()
    app.state.task_queue = FakeTaskQueue()

    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
async def db_session(client):
    """Get database session for tests."""
    async with AsyncSession(app.state.db_engine) as session:
        yield session
```

## Environment-Specific Lifespan

```python
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan with environment-specific behavior."""

    if settings.environment == "test":
        # Minimal setup for tests
        app.state.db_engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        app.state.redis = FakeRedis()
        yield
        return

    if settings.environment == "development":
        # Development setup
        app.state.db_engine = create_async_engine(
            settings.database_url,
            echo=True,  # SQL logging
        )
        app.state.redis = redis.from_url(settings.redis_url)
        yield
        await app.state.redis.close()
        await app.state.db_engine.dispose()
        return

    # Production setup (full initialization)
    # ... full production initialization code ...
    yield
    # ... full cleanup code ...
```

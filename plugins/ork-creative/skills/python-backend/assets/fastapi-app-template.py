"""
FastAPI Production Application Template

Production-ready FastAPI application with:
- Lifespan management
- Middleware stack
- Dependency injection
- Error handling
- Health checks
"""

import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from functools import lru_cache

import redis.asyncio as redis
import structlog
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from starlette.middleware.base import BaseHTTPMiddleware

# ============================================================================
# Configuration
# ============================================================================

class Settings(BaseSettings):
    """Application settings from environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    app_name: str = "FastAPI App"
    app_version: str = "1.0.0"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://user:pass@localhost/db"
    db_pool_size: int = Field(default=5, ge=1, le=20)
    db_max_overflow: int = Field(default=10, ge=0, le=50)

    # Redis
    redis_url: str = "redis://localhost:6379"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()


# ============================================================================
# Logging
# ============================================================================

structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
)

logger = structlog.get_logger()


# ============================================================================
# Middleware
# ============================================================================

class RequestIDMiddleware(BaseHTTPMiddleware):
    """Add unique request ID to each request."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        return response


class TimingMiddleware(BaseHTTPMiddleware):
    """Track request processing time."""

    async def dispatch(self, request: Request, call_next):
        import time

        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start

        response.headers["X-Response-Time"] = f"{duration:.4f}s"
        request.state.duration = duration

        return response


class LoggingMiddleware(BaseHTTPMiddleware):
    """Structured logging for all requests."""

    async def dispatch(self, request: Request, call_next):
        log = logger.bind(
            request_id=getattr(request.state, "request_id", None),
            method=request.method,
            path=request.url.path,
        )

        try:
            response = await call_next(request)

            log.info(
                "request_completed",
                status_code=response.status_code,
                duration=getattr(request.state, "duration", None),
            )

            return response

        except Exception as exc:
            log.exception("request_failed", error=str(exc))
            raise


# ============================================================================
# Lifespan
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan with resource management."""
    settings = get_settings()
    logger.info("application_starting", version=settings.app_version)

    # STARTUP

    # Database
    app.state.db_engine = create_async_engine(
        settings.database_url,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_pre_ping=True,
    )
    async with app.state.db_engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    logger.info("database_connected")

    # Redis
    app.state.redis = redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
    )
    await app.state.redis.ping()
    logger.info("redis_connected")

    # Startup time
    app.state.started_at = datetime.now(timezone.utc)
    logger.info("application_started")

    yield

    # SHUTDOWN
    logger.info("application_stopping")

    await app.state.redis.close()
    await app.state.db_engine.dispose()

    logger.info("application_stopped")


# ============================================================================
# Application
# ============================================================================

app = FastAPI(
    title=get_settings().app_name,
    version=get_settings().app_version,
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
)


# ============================================================================
# Middleware Registration (reverse order)
# ============================================================================

# Innermost (runs last)
app.add_middleware(LoggingMiddleware)
app.add_middleware(TimingMiddleware)
app.add_middleware(RequestIDMiddleware)

# Outermost (runs first)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time"],
)


# ============================================================================
# Dependencies
# ============================================================================

async def get_db(request: Request) -> AsyncGenerator[AsyncSession]:
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


async def get_redis(request: Request) -> redis.Redis:
    """Dependency to get Redis client."""
    return request.app.state.redis


# ============================================================================
# Exception Handlers
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with RFC 9457 format."""
    return ORJSONResponse(
        status_code=exc.status_code,
        content={
            "type": f"https://api.example.com/problems/{exc.status_code}",
            "title": exc.detail,
            "status": exc.status_code,
            "instance": request.url.path,
            "trace_id": getattr(request.state, "request_id", None),
        },
        media_type="application/problem+json",
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.exception(
        "unhandled_exception",
        request_id=getattr(request.state, "request_id", None),
        error=str(exc),
    )

    return ORJSONResponse(
        status_code=500,
        content={
            "type": "https://api.example.com/problems/internal-error",
            "title": "Internal Server Error",
            "status": 500,
            "detail": "An unexpected error occurred",
            "instance": request.url.path,
            "trace_id": getattr(request.state, "request_id", None),
        },
        media_type="application/problem+json",
    )


# ============================================================================
# Routes
# ============================================================================

@app.get("/health")
async def health_check(request: Request):
    """Health check endpoint."""
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

    all_healthy = all(v == "healthy" for v in checks.values())
    status_code = 200 if all_healthy else 503

    return ORJSONResponse(
        status_code=status_code,
        content={
            "status": "healthy" if all_healthy else "unhealthy",
            "checks": checks,
            "uptime_seconds": (
                datetime.now(timezone.utc) - request.app.state.started_at
            ).total_seconds(),
        },
    )


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": get_settings().app_name,
        "version": get_settings().app_version,
        "docs": "/docs",
    }


# ============================================================================
# Example Resource Routes
# ============================================================================

from pydantic import BaseModel  # noqa: E402


class ItemCreate(BaseModel):
    name: str
    description: str | None = None


class ItemResponse(BaseModel):
    id: str
    name: str
    description: str | None
    created_at: datetime


@app.post("/items", response_model=ItemResponse, status_code=201)
async def create_item(
    item: ItemCreate,
    db: AsyncSession = Depends(get_db),
    cache: redis.Redis = Depends(get_redis),
):
    """Create a new item."""
    # Example implementation
    new_item = ItemResponse(
        id=str(uuid.uuid4()),
        name=item.name,
        description=item.description,
        created_at=datetime.now(timezone.utc),
    )

    # Cache the item
    await cache.setex(
        f"item:{new_item.id}",
        300,
        new_item.model_dump_json(),
    )

    return new_item


@app.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    cache: redis.Redis = Depends(get_redis),
):
    """Get an item by ID."""
    # Try cache first
    cached = await cache.get(f"item:{item_id}")
    if cached:
        return ItemResponse.model_validate_json(cached)

    # Would query database here
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Item {item_id} not found",
    )


# ============================================================================
# Run
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=get_settings().debug,
    )

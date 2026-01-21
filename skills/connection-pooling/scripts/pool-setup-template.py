"""
Connection Pool Setup Template

Production-ready connection pool configuration for FastAPI + SQLAlchemy.
Customize the CONFIG section for your environment.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from pydantic_settings import BaseSettings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# =============================================================================
# CONFIG - Customize for your environment
# =============================================================================


class DatabaseSettings(BaseSettings):
    """Database configuration from environment."""

    # Connection URL
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/db"

    # Pool sizing (adjust based on workload)
    POOL_SIZE: int = 20  # Steady-state connections
    MAX_OVERFLOW: int = 10  # Burst capacity

    # Connection health
    POOL_PRE_PING: bool = True  # Validate before use
    POOL_RECYCLE: int = 1800  # Recreate after 30 minutes

    # Timeouts (seconds)
    POOL_TIMEOUT: int = 30  # Wait for connection
    COMMAND_TIMEOUT: int = 60  # Query timeout
    STATEMENT_TIMEOUT: int = 60000  # PostgreSQL statement_timeout (ms)
    LOCK_TIMEOUT: int = 10000  # PostgreSQL lock_timeout (ms)

    # Monitoring
    ECHO_SQL: bool = False  # Log SQL queries

    class Config:
        env_prefix = "DB_"


settings = DatabaseSettings()


# =============================================================================
# ENGINE SETUP
# =============================================================================


def create_engine() -> AsyncEngine:
    """Create SQLAlchemy async engine with production settings."""
    return create_async_engine(
        settings.DATABASE_URL,
        # Pool sizing
        pool_size=settings.POOL_SIZE,
        max_overflow=settings.MAX_OVERFLOW,
        # Connection health
        pool_pre_ping=settings.POOL_PRE_PING,
        pool_recycle=settings.POOL_RECYCLE,
        # Timeouts
        pool_timeout=settings.POOL_TIMEOUT,
        connect_args={
            "command_timeout": settings.COMMAND_TIMEOUT,
            "server_settings": {
                "statement_timeout": str(settings.STATEMENT_TIMEOUT),
                "lock_timeout": str(settings.LOCK_TIMEOUT),
            },
        },
        # Debugging
        echo=settings.ECHO_SQL,
    )


# Create engine and session maker
engine = create_engine()

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


# =============================================================================
# POOL MONITORING (Optional - uncomment if using Prometheus)
# =============================================================================

# from prometheus_client import Gauge, Histogram
#
# pool_size_gauge = Gauge("db_pool_size", "Current pool size")
# pool_checked_out = Gauge("db_pool_checked_out", "Connections in use")
# pool_checkout_time = Histogram(
#     "db_pool_checkout_seconds",
#     "Time to acquire connection",
#     buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
# )
#
#
# def setup_pool_metrics(eng: AsyncEngine):
#     """Register pool event listeners for metrics."""
#     import time
#
#     @event.listens_for(eng.sync_engine, "checkout")
#     def on_checkout(dbapi_conn, connection_record, connection_proxy):
#         connection_record.info["checkout_time"] = time.monotonic()
#
#     @event.listens_for(eng.sync_engine, "checkin")
#     def on_checkin(dbapi_conn, connection_record):
#         if "checkout_time" in connection_record.info:
#             duration = time.monotonic() - connection_record.info["checkout_time"]
#             pool_checkout_time.observe(duration)
#
#
# setup_pool_metrics(engine)


# =============================================================================
# LIFESPAN MANAGEMENT
# =============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage database pool lifecycle."""
    # Startup: verify connectivity
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))

    yield

    # Shutdown: close all connections
    await engine.dispose()


# =============================================================================
# DEPENDENCY INJECTION
# =============================================================================


async def get_db() -> AsyncGenerator[AsyncSession]:
    """
    FastAPI dependency for database sessions.

    Usage:
        @app.get("/users/{id}")
        async def get_user(id: int, db: AsyncSession = Depends(get_db)):
            ...
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# =============================================================================
# HEALTH CHECK
# =============================================================================


async def check_db_health() -> dict:
    """
    Check database connectivity and pool status.

    Returns:
        dict with status, pool stats, and any errors
    """
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            result.fetchone()

        pool = engine.pool
        return {
            "status": "healthy",
            "pool": {
                "size": pool.size(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow(),
                "checked_in": pool.checkedin(),
            },
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
        }


# =============================================================================
# FASTAPI APP SETUP
# =============================================================================


def create_app() -> FastAPI:
    """Create FastAPI app with database pool."""
    app = FastAPI(
        title="API with Connection Pool",
        lifespan=lifespan,
    )

    @app.get("/health/db")
    async def health_db():
        """Database health check endpoint."""
        result = await check_db_health()
        status_code = 200 if result["status"] == "healthy" else 503
        return result, status_code

    return app


# Create app
app = create_app()


# =============================================================================
# EXAMPLE ROUTES
# =============================================================================


@app.get("/example")
async def example_route(db: AsyncSession = Depends(get_db)):
    """Example route using database session."""
    result = await db.execute(text("SELECT current_timestamp"))
    row = result.fetchone()
    if row is None:
        return {"timestamp": None}
    return {"timestamp": row[0].isoformat()}

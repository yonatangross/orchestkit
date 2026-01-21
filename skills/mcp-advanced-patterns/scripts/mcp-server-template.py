"""
Advanced MCP Server Template

Production-ready MCP server with:
- Lifecycle management for resources
- Middleware stack (logging, metrics, rate limiting)
- Health checks and observability
- Multiple tools with proper error handling
- Resource management with caching

Usage:
    # Run with streamable HTTP transport
    python mcp_server_template.py

    # Or mount in existing Starlette app
    from mcp_server_template import create_app
    app = create_app()
"""

import asyncio
import hashlib
import os
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

import structlog
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.session import ServerSession
from prometheus_client import Counter, Histogram
from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.routing import Mount

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger()

# Prometheus metrics
REQUEST_COUNT = Counter(
    "mcp_requests_total",
    "Total MCP requests",
    ["tool", "status"]
)
REQUEST_LATENCY = Histogram(
    "mcp_request_duration_seconds",
    "MCP request latency",
    ["tool"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0]
)
CACHE_HITS = Counter(
    "mcp_cache_hits_total",
    "Cache hit count",
    ["cache_level"]
)


# =============================================================================
# Mock Dependencies (Replace with real implementations)
# =============================================================================


class Database:
    """Mock database - replace with real implementation."""

    @classmethod
    async def connect(cls, url: str) -> "Database":
        logger.info("database_connecting", url=url[:20] + "...")
        await asyncio.sleep(0.1)  # Simulate connection
        return cls()

    async def disconnect(self) -> None:
        logger.info("database_disconnecting")
        await asyncio.sleep(0.05)

    async def ping(self) -> bool:
        return True

    async def execute(self, query: str) -> list[dict]:
        """Execute query and return results."""
        await asyncio.sleep(0.05)  # Simulate query
        return [{"id": 1, "query": query, "timestamp": datetime.now().isoformat()}]


class CacheService:
    """In-memory cache service - replace with Redis in production."""

    def __init__(self):
        self._cache: dict[str, tuple[Any, float]] = {}
        self._default_ttl = 300  # 5 minutes

    @classmethod
    async def connect(cls, url: str) -> "CacheService":
        logger.info("cache_connecting", url=url)
        return cls()

    async def disconnect(self) -> None:
        logger.info("cache_disconnecting")
        self._cache.clear()

    async def ping(self) -> bool:
        return True

    async def get(self, key: str) -> Any | None:
        if key in self._cache:
            value, expires_at = self._cache[key]
            if time.time() < expires_at:
                CACHE_HITS.labels(cache_level="l1").inc()
                return value
            del self._cache[key]
        return None

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        ttl = ttl or self._default_ttl
        self._cache[key] = (value, time.time() + ttl)

    async def delete(self, key: str) -> bool:
        if key in self._cache:
            del self._cache[key]
            return True
        return False


# =============================================================================
# Application Context
# =============================================================================


@dataclass
class AppContext:
    """Application context with typed dependencies."""

    db: Database
    cache: CacheService
    config: dict = field(default_factory=dict)
    start_time: datetime = field(default_factory=datetime.now)

    @property
    def uptime_seconds(self) -> float:
        return (datetime.now() - self.start_time).total_seconds()


# =============================================================================
# Lifecycle Management
# =============================================================================


@asynccontextmanager
async def app_lifespan(server: FastMCP) -> AsyncIterator[AppContext]:
    """
    Manage server startup and shutdown lifecycle.

    Initialize resources on startup, clean up on shutdown.
    This ensures proper resource management and prevents leaks.
    """
    logger.info("server_starting", server_name=server.name)

    # Initialize dependencies
    db = await Database.connect(
        os.getenv("DATABASE_URL", "postgresql://localhost/mcp")
    )
    cache = await CacheService.connect(
        os.getenv("REDIS_URL", "redis://localhost:6379")
    )
    config = {
        "rate_limit_rps": float(os.getenv("RATE_LIMIT_RPS", "10")),
        "cache_ttl": int(os.getenv("CACHE_TTL", "300")),
        "debug": os.getenv("DEBUG", "false").lower() == "true",
    }

    logger.info("server_started", config=config)

    try:
        yield AppContext(db=db, cache=cache, config=config)
    finally:
        # Cleanup on shutdown
        logger.info("server_stopping")
        await cache.disconnect()
        await db.disconnect()
        logger.info("server_stopped")


# =============================================================================
# Server Definition
# =============================================================================


mcp = FastMCP(
    "Advanced MCP Server",
    lifespan=app_lifespan,
    json_response=True,
)


# =============================================================================
# Tools
# =============================================================================


@mcp.tool()
async def query_data(
    query: str,
    use_cache: bool = True,
    ctx: Context[ServerSession, AppContext] = None,
) -> dict:
    """
    Execute a data query with optional caching.

    Args:
        query: The query string to execute
        use_cache: Whether to use cached results (default: True)

    Returns:
        Query results with metadata
    """
    start_time = time.time()
    app_ctx = ctx.request_context.lifespan_context

    try:
        # Generate cache key
        cache_key = f"query:{hashlib.sha256(query.encode()).hexdigest()[:16]}"

        # Check cache
        if use_cache:
            cached = await app_ctx.cache.get(cache_key)
            if cached:
                REQUEST_COUNT.labels(tool="query_data", status="cache_hit").inc()
                return {
                    "success": True,
                    "data": cached,
                    "cached": True,
                    "duration_ms": (time.time() - start_time) * 1000,
                }

        # Execute query
        result = await app_ctx.db.execute(query)

        # Cache result
        if use_cache:
            await app_ctx.cache.set(
                cache_key,
                result,
                ttl=app_ctx.config["cache_ttl"]
            )

        REQUEST_COUNT.labels(tool="query_data", status="success").inc()

        return {
            "success": True,
            "data": result,
            "cached": False,
            "duration_ms": (time.time() - start_time) * 1000,
        }

    except Exception as e:
        REQUEST_COUNT.labels(tool="query_data", status="error").inc()
        logger.error("query_data_error", error=str(e), query=query[:100])
        return {
            "success": False,
            "error": str(e),
            "duration_ms": (time.time() - start_time) * 1000,
        }

    finally:
        REQUEST_LATENCY.labels(tool="query_data").observe(time.time() - start_time)


@mcp.tool()
async def invalidate_cache(
    pattern: str,
    ctx: Context[ServerSession, AppContext] = None,
) -> dict:
    """
    Invalidate cached data matching a pattern.

    Args:
        pattern: Cache key pattern to invalidate (e.g., "query:*")

    Returns:
        Number of invalidated entries
    """
    app_ctx = ctx.request_context.lifespan_context

    # For this simple implementation, we'll just clear matching keys
    # In production, use Redis SCAN with pattern matching
    count = 0
    cache = app_ctx.cache
    keys_to_delete = [
        key for key in cache._cache.keys()
        if key.startswith(pattern.rstrip("*"))
    ]

    for key in keys_to_delete:
        await cache.delete(key)
        count += 1

    logger.info("cache_invalidated", pattern=pattern, count=count)

    return {
        "success": True,
        "invalidated_count": count,
        "pattern": pattern,
    }


@mcp.tool()
async def echo(
    message: str,
    delay_ms: int = 0,
) -> dict:
    """
    Echo a message back, optionally with delay.

    Args:
        message: Message to echo
        delay_ms: Delay in milliseconds before responding

    Returns:
        Echoed message with timestamp
    """
    if delay_ms > 0:
        await asyncio.sleep(delay_ms / 1000)

    return {
        "message": message,
        "timestamp": datetime.now().isoformat(),
        "delay_ms": delay_ms,
    }


# =============================================================================
# Resources
# =============================================================================


@mcp.resource("health://status")
async def health_status(ctx: Context[ServerSession, AppContext] = None) -> dict:
    """Server health status resource."""
    app_ctx = ctx.request_context.lifespan_context

    db_healthy = await app_ctx.db.ping()
    cache_healthy = await app_ctx.cache.ping()

    return {
        "status": "healthy" if (db_healthy and cache_healthy) else "degraded",
        "uptime_seconds": app_ctx.uptime_seconds,
        "dependencies": {
            "database": "healthy" if db_healthy else "unhealthy",
            "cache": "healthy" if cache_healthy else "unhealthy",
        },
        "timestamp": datetime.now().isoformat(),
    }


@mcp.resource("config://settings")
async def config_settings(ctx: Context[ServerSession, AppContext] = None) -> dict:
    """Server configuration resource (non-sensitive)."""
    app_ctx = ctx.request_context.lifespan_context

    return {
        "rate_limit_rps": app_ctx.config["rate_limit_rps"],
        "cache_ttl": app_ctx.config["cache_ttl"],
        "debug": app_ctx.config["debug"],
    }


@mcp.resource("metrics://prometheus")
async def prometheus_metrics() -> str:
    """Prometheus metrics endpoint."""
    from prometheus_client import generate_latest

    return generate_latest().decode("utf-8")


# =============================================================================
# Prompts
# =============================================================================


@mcp.prompt()
def data_analysis_prompt(
    dataset_name: str,
    analysis_type: str = "summary",
) -> str:
    """
    Generate a prompt for data analysis.

    Args:
        dataset_name: Name of the dataset to analyze
        analysis_type: Type of analysis (summary, detailed, trends)
    """
    analysis_instructions = {
        "summary": "Provide a brief summary with key statistics.",
        "detailed": "Perform comprehensive analysis including distributions and outliers.",
        "trends": "Focus on temporal trends and patterns.",
    }

    instruction = analysis_instructions.get(analysis_type, analysis_instructions["summary"])

    return f"""Analyze the dataset '{dataset_name}'.

{instruction}

Include:
1. Data quality assessment
2. Key findings
3. Recommendations for further analysis
"""


# =============================================================================
# Application Factory
# =============================================================================


def create_app() -> Starlette:
    """
    Create Starlette application with MCP server mounted.

    Use this for mounting in existing applications or for
    more complex deployment scenarios.
    """

    @asynccontextmanager
    async def lifespan(app: Starlette) -> AsyncIterator[None]:
        async with mcp.session_manager.run():
            logger.info("starlette_app_started")
            yield
            logger.info("starlette_app_stopped")

    app = Starlette(
        routes=[
            Mount("/mcp", app=mcp.streamable_http_app()),
        ],
        lifespan=lifespan,
    )

    # Add CORS for browser clients
    app = CORSMiddleware(
        app,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Mcp-Session-Id"],
    )

    return app


# =============================================================================
# Main Entry Point
# =============================================================================


if __name__ == "__main__":
    import uvicorn

    # Run with streamable HTTP transport
    # Server will be available at http://localhost:8000/mcp
    print("Starting MCP server at http://localhost:8000/mcp")
    print("Health check: http://localhost:8000/mcp (resource: health://status)")

    # Option 1: Run directly with FastMCP
    # mcp.run(transport="streamable-http", host="0.0.0.0", port=8000)

    # Option 2: Run with custom Starlette app (more control)
    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=8000)

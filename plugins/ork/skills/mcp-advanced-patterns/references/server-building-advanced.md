# Advanced MCP Server Building

Patterns for building production-grade MCP servers with middleware, custom transports, and observability.

## Middleware Architecture

```python
from dataclasses import dataclass
from typing import Any, Callable, Awaitable
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import time
import structlog

logger = structlog.get_logger()


@dataclass
class MCPRequest:
    """MCP request wrapper for middleware."""
    method: str
    params: dict[str, Any]
    metadata: dict[str, Any]
    timestamp: float = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()


@dataclass
class MCPResponse:
    """MCP response wrapper for middleware."""
    result: Any
    error: str | None = None
    metadata: dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


# Middleware type
Middleware = Callable[
    [MCPRequest, Callable[[MCPRequest], Awaitable[MCPResponse]]],
    Awaitable[MCPResponse]
]


class MiddlewareStack:
    """Composable middleware stack for MCP servers."""

    def __init__(self):
        self._middlewares: list[Middleware] = []

    def use(self, middleware: Middleware) -> "MiddlewareStack":
        """Add middleware to stack."""
        self._middlewares.append(middleware)
        return self

    async def execute(
        self,
        request: MCPRequest,
        handler: Callable[[MCPRequest], Awaitable[MCPResponse]]
    ) -> MCPResponse:
        """Execute request through middleware stack."""

        async def build_chain(index: int) -> Callable:
            if index >= len(self._middlewares):
                return handler

            middleware = self._middlewares[index]

            async def next_handler(req: MCPRequest) -> MCPResponse:
                next_middleware = await build_chain(index + 1)
                return await middleware(req, next_middleware)

            return next_handler

        chain = await build_chain(0)
        return await chain(request)
```

## Common Middleware Implementations

```python
# Logging middleware
async def logging_middleware(
    request: MCPRequest,
    next_handler: Callable[[MCPRequest], Awaitable[MCPResponse]]
) -> MCPResponse:
    """Log all requests and responses."""
    start = time.time()

    logger.info(
        "mcp_request",
        method=request.method,
        params_keys=list(request.params.keys())
    )

    try:
        response = await next_handler(request)
        duration = time.time() - start

        logger.info(
            "mcp_response",
            method=request.method,
            duration_ms=duration * 1000,
            success=response.error is None
        )

        return response

    except Exception as e:
        duration = time.time() - start
        logger.error(
            "mcp_error",
            method=request.method,
            duration_ms=duration * 1000,
            error=str(e)
        )
        raise


# Rate limiting middleware
class RateLimitMiddleware:
    """Token bucket rate limiter middleware."""

    def __init__(
        self,
        requests_per_second: float = 10.0,
        burst_size: int = 20
    ):
        self.rate = requests_per_second
        self.burst = burst_size
        self._tokens = burst_size
        self._last_update = time.time()
        self._lock = asyncio.Lock()

    async def __call__(
        self,
        request: MCPRequest,
        next_handler: Callable[[MCPRequest], Awaitable[MCPResponse]]
    ) -> MCPResponse:
        async with self._lock:
            now = time.time()
            elapsed = now - self._last_update
            self._tokens = min(
                self.burst,
                self._tokens + elapsed * self.rate
            )
            self._last_update = now

            if self._tokens < 1:
                return MCPResponse(
                    result=None,
                    error="Rate limit exceeded",
                    metadata={"retry_after_seconds": (1 - self._tokens) / self.rate}
                )

            self._tokens -= 1

        return await next_handler(request)


# Authentication middleware
async def auth_middleware(
    request: MCPRequest,
    next_handler: Callable[[MCPRequest], Awaitable[MCPResponse]]
) -> MCPResponse:
    """Validate authentication token."""
    token = request.metadata.get("auth_token")

    if not token:
        return MCPResponse(
            result=None,
            error="Authentication required"
        )

    # Validate token (implement your auth logic)
    user = await validate_token(token)
    if not user:
        return MCPResponse(
            result=None,
            error="Invalid authentication token"
        )

    # Add user to request metadata
    request.metadata["user"] = user
    return await next_handler(request)


# Metrics middleware
class MetricsMiddleware:
    """Prometheus metrics middleware."""

    def __init__(self):
        from prometheus_client import Counter, Histogram

        self.request_count = Counter(
            "mcp_requests_total",
            "Total MCP requests",
            ["method", "status"]
        )
        self.request_duration = Histogram(
            "mcp_request_duration_seconds",
            "MCP request duration",
            ["method"],
            buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0]
        )

    async def __call__(
        self,
        request: MCPRequest,
        next_handler: Callable[[MCPRequest], Awaitable[MCPResponse]]
    ) -> MCPResponse:
        start = time.time()

        try:
            response = await next_handler(request)
            status = "success" if response.error is None else "error"
            self.request_count.labels(
                method=request.method,
                status=status
            ).inc()
            return response

        except Exception:
            self.request_count.labels(
                method=request.method,
                status="exception"
            ).inc()
            raise

        finally:
            duration = time.time() - start
            self.request_duration.labels(
                method=request.method
            ).observe(duration)
```

## Custom Transport Implementation

```python
from abc import ABC, abstractmethod
from typing import AsyncIterator
import asyncio
import json


class MCPTransport(ABC):
    """Abstract base class for MCP transports."""

    @abstractmethod
    async def connect(self) -> None:
        """Establish connection."""
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """Close connection."""
        pass

    @abstractmethod
    async def send(self, message: dict) -> None:
        """Send message."""
        pass

    @abstractmethod
    async def receive(self) -> AsyncIterator[dict]:
        """Receive messages."""
        pass


class WebSocketTransport(MCPTransport):
    """WebSocket transport for MCP."""

    def __init__(self, url: str):
        self.url = url
        self._ws = None

    async def connect(self) -> None:
        import websockets
        self._ws = await websockets.connect(self.url)

    async def disconnect(self) -> None:
        if self._ws:
            await self._ws.close()

    async def send(self, message: dict) -> None:
        await self._ws.send(json.dumps(message))

    async def receive(self) -> AsyncIterator[dict]:
        async for message in self._ws:
            yield json.loads(message)


class SSETransport(MCPTransport):
    """Server-Sent Events transport for MCP (server-side)."""

    def __init__(self):
        self._queue: asyncio.Queue = asyncio.Queue()
        self._clients: list[asyncio.Queue] = []

    async def connect(self) -> None:
        pass  # Clients connect via HTTP

    async def disconnect(self) -> None:
        for client_queue in self._clients:
            await client_queue.put(None)  # Signal disconnect

    async def send(self, message: dict) -> None:
        """Broadcast to all connected clients."""
        data = f"data: {json.dumps(message)}\n\n"
        for client_queue in self._clients:
            await client_queue.put(data)

    async def receive(self) -> AsyncIterator[dict]:
        while True:
            message = await self._queue.get()
            if message is None:
                break
            yield message

    def add_client(self) -> asyncio.Queue:
        """Add new SSE client."""
        client_queue = asyncio.Queue()
        self._clients.append(client_queue)
        return client_queue

    def remove_client(self, client_queue: asyncio.Queue) -> None:
        """Remove SSE client."""
        self._clients.remove(client_queue)
```

## Production Server Assembly

```python
from mcp.server.fastmcp import FastMCP, Context
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from dataclasses import dataclass
import asyncio


@dataclass
class ServerDependencies:
    """Production server dependencies."""
    db: Database
    cache: CacheService
    metrics: MetricsMiddleware
    rate_limiter: RateLimitMiddleware


@asynccontextmanager
async def production_lifespan(server: FastMCP) -> AsyncIterator[ServerDependencies]:
    """Production lifecycle with all dependencies."""
    # Initialize
    db = await Database.connect(os.getenv("DATABASE_URL"))
    cache = await CacheService.connect(os.getenv("REDIS_URL"))
    metrics = MetricsMiddleware()
    rate_limiter = RateLimitMiddleware(
        requests_per_second=float(os.getenv("RATE_LIMIT_RPS", "10")),
        burst_size=int(os.getenv("RATE_LIMIT_BURST", "20"))
    )

    # Health check background task
    health_task = asyncio.create_task(run_health_checks(db, cache))

    try:
        yield ServerDependencies(
            db=db,
            cache=cache,
            metrics=metrics,
            rate_limiter=rate_limiter
        )
    finally:
        # Cleanup
        health_task.cancel()
        await cache.disconnect()
        await db.disconnect()


# Build middleware stack
middleware = MiddlewareStack()
middleware.use(logging_middleware)
middleware.use(MetricsMiddleware())
middleware.use(RateLimitMiddleware())


# Create server
mcp = FastMCP(
    "Production MCP Server",
    lifespan=production_lifespan,
    json_response=True
)


@mcp.tool()
async def query_data(
    query: str,
    ctx: Context
) -> dict:
    """Execute data query with caching."""
    deps = ctx.request_context.lifespan_context

    # Check cache
    cache_key = f"query:{hash(query)}"
    cached = await deps.cache.get(cache_key)
    if cached:
        return {"result": cached, "cached": True}

    # Execute query
    result = await deps.db.execute(query)

    # Cache result
    await deps.cache.set(cache_key, result, ttl=300)

    return {"result": result, "cached": False}


# Health endpoint
@mcp.resource("health://status")
async def health_status(ctx: Context) -> dict:
    """Server health status."""
    deps = ctx.request_context.lifespan_context

    return {
        "status": "healthy",
        "db_connected": await deps.db.ping(),
        "cache_connected": await deps.cache.ping(),
    }
```

## Deployment Checklist

| Aspect | Requirement |
|--------|-------------|
| Lifecycle | Use lifespan for resource management |
| Logging | Structured logging with correlation IDs |
| Metrics | Prometheus metrics for requests, latency |
| Rate limiting | Token bucket with configurable limits |
| Health checks | /health endpoint with dependency checks |
| Graceful shutdown | Connection draining on SIGTERM |
| Error handling | Consistent error response format |

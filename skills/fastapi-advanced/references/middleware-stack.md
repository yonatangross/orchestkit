# FastAPI Middleware Stack

Complete guide to middleware ordering and implementation in FastAPI.

## Middleware Execution Order

```
REQUEST                                              RESPONSE
   │                                                    ▲
   ▼                                                    │
┌──────────────────────────────────────────────────────────────┐
│  1. CORS Middleware (outermost)                              │
│     - Handles preflight requests                             │
│     - Adds CORS headers to response                          │
└──────────────────────────────────────────────────────────────┘
   │                                                    ▲
   ▼                                                    │
┌──────────────────────────────────────────────────────────────┐
│  2. Request ID Middleware                                    │
│     - Generates/extracts request ID                          │
│     - Adds to response headers                               │
└──────────────────────────────────────────────────────────────┘
   │                                                    ▲
   ▼                                                    │
┌──────────────────────────────────────────────────────────────┐
│  3. Timing Middleware                                        │
│     - Records start time                                     │
│     - Calculates duration                                    │
│     - Adds X-Response-Time header                            │
└──────────────────────────────────────────────────────────────┘
   │                                                    ▲
   ▼                                                    │
┌──────────────────────────────────────────────────────────────┐
│  4. Logging Middleware                                       │
│     - Logs request details                                   │
│     - Logs response status                                   │
│     - Uses request ID for correlation                        │
└──────────────────────────────────────────────────────────────┘
   │                                                    ▲
   ▼                                                    │
┌──────────────────────────────────────────────────────────────┐
│  5. Authentication Middleware (optional)                     │
│     - Validates JWT/API key                                  │
│     - Sets request.state.user                                │
└──────────────────────────────────────────────────────────────┘
   │                                                    ▲
   ▼                                                    │
┌──────────────────────────────────────────────────────────────┐
│  6. Rate Limit Middleware                                    │
│     - Checks rate limits                                     │
│     - Returns 429 if exceeded                                │
│     - Adds rate limit headers                                │
└──────────────────────────────────────────────────────────────┘
   │                                                    ▲
   ▼                                                    │
┌──────────────────────────────────────────────────────────────┐
│                    ROUTE HANDLER                             │
│               (Your endpoint code)                           │
└──────────────────────────────────────────────────────────────┘
```

**Note**: Middleware added LAST executes FIRST (wraps outer).

## Middleware Registration Order

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 6. Rate Limit (added last, runs closest to route)
app.add_middleware(RateLimitMiddleware)

# 5. Authentication (optional)
app.add_middleware(AuthMiddleware)

# 4. Logging
app.add_middleware(LoggingMiddleware)

# 3. Timing
app.add_middleware(TimingMiddleware)

# 2. Request ID
app.add_middleware(RequestIDMiddleware)

# 1. CORS (added first, runs first/last)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Core Middleware Implementations

### Request ID Middleware

```python
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class RequestIDMiddleware(BaseHTTPMiddleware):
    """Add unique request ID to each request."""

    async def dispatch(self, request: Request, call_next):
        # Get from header or generate new
        request_id = request.headers.get(
            "X-Request-ID",
            str(uuid.uuid4()),
        )

        # Store in request state
        request.state.request_id = request_id

        # Call next middleware/route
        response = await call_next(request)

        # Add to response headers
        response.headers["X-Request-ID"] = request_id

        return response
```

### Timing Middleware

```python
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class TimingMiddleware(BaseHTTPMiddleware):
    """Track request processing time."""

    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()

        response = await call_next(request)

        duration = time.perf_counter() - start_time
        response.headers["X-Response-Time"] = f"{duration:.4f}s"

        # Store for logging middleware
        request.state.duration = duration

        return response
```

### Logging Middleware

```python
import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = structlog.get_logger()

class LoggingMiddleware(BaseHTTPMiddleware):
    """Structured logging for all requests."""

    async def dispatch(self, request: Request, call_next):
        # Bind request context
        log = logger.bind(
            request_id=getattr(request.state, "request_id", None),
            method=request.method,
            path=request.url.path,
            client_ip=request.client.host if request.client else None,
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
```

### CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    # Production: specify exact origins
    allow_origins=[
        "https://app.example.com",
        "https://admin.example.com",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
    expose_headers=[
        "X-Request-ID",
        "X-Response-Time",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
    ],
    max_age=600,  # Preflight cache 10 minutes
)
```

## Advanced Patterns

### Conditional Middleware

```python
class ConditionalMiddleware(BaseHTTPMiddleware):
    """Middleware that only applies to certain paths."""

    def __init__(self, app, paths: list[str] = None, exclude_paths: list[str] = None):
        super().__init__(app)
        self.paths = paths or []
        self.exclude_paths = exclude_paths or []

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip excluded paths
        if any(path.startswith(p) for p in self.exclude_paths):
            return await call_next(request)

        # Only apply to specific paths if defined
        if self.paths and not any(path.startswith(p) for p in self.paths):
            return await call_next(request)

        # Apply middleware logic
        return await self._apply_middleware(request, call_next)

    async def _apply_middleware(self, request: Request, call_next):
        # Your middleware logic here
        return await call_next(request)
```

### Error Handling Middleware

```python
from fastapi.responses import JSONResponse

class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Catch unhandled exceptions and return proper responses."""

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)

        except Exception as exc:
            logger.exception(
                "unhandled_exception",
                request_id=getattr(request.state, "request_id", None),
                path=request.url.path,
            )

            return JSONResponse(
                status_code=500,
                content={
                    "type": "https://api.example.com/problems/internal-error",
                    "title": "Internal Server Error",
                    "status": 500,
                    "detail": "An unexpected error occurred",
                    "request_id": getattr(request.state, "request_id", None),
                },
                media_type="application/problem+json",
            )
```

### Request Body Caching

```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class BodyCacheMiddleware(BaseHTTPMiddleware):
    """Cache request body for multiple reads."""

    async def dispatch(self, request: Request, call_next):
        # Only cache for methods with body
        if request.method in ("POST", "PUT", "PATCH"):
            body = await request.body()
            request.state.body = body

            # Create new receive that returns cached body
            async def receive():
                return {"type": "http.request", "body": body}

            request._receive = receive

        return await call_next(request)
```

## Performance Considerations

### Async vs Sync Middleware

```python
# GOOD: Async middleware (non-blocking)
class AsyncMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        await asyncio.sleep(0)  # Async operation
        return await call_next(request)

# BAD: Sync operations in async middleware
class BadMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        time.sleep(1)  # BLOCKS EVENT LOOP!
        return await call_next(request)
```

### Middleware vs Dependencies

| Middleware | Dependencies |
|------------|--------------|
| Runs on ALL requests | Runs on specific routes |
| No access to path params | Access to path params |
| Before route matching | After route matching |
| For cross-cutting concerns | For route-specific logic |

**Use Middleware for:**
- Request ID generation
- Logging
- CORS
- Timing

**Use Dependencies for:**
- Authentication
- Rate limiting per endpoint
- Request validation
- Database sessions

## Testing Middleware

```python
# tests/test_middleware.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_request_id_generated(client: AsyncClient):
    response = await client.get("/health")

    assert "X-Request-ID" in response.headers
    # Should be valid UUID
    import uuid
    uuid.UUID(response.headers["X-Request-ID"])

@pytest.mark.asyncio
async def test_request_id_preserved(client: AsyncClient):
    custom_id = "my-custom-id-123"
    response = await client.get(
        "/health",
        headers={"X-Request-ID": custom_id},
    )

    assert response.headers["X-Request-ID"] == custom_id

@pytest.mark.asyncio
async def test_timing_header_present(client: AsyncClient):
    response = await client.get("/health")

    assert "X-Response-Time" in response.headers
    # Should be a valid duration
    duration = float(response.headers["X-Response-Time"].rstrip("s"))
    assert duration > 0
```

## Related Files

- See `examples/fastapi-middleware.md` for complete examples
- See `scripts/middleware-stack.py` for copy-paste template
- See SKILL.md for lifespan and dependencies

---
title: Order FastAPI middleware correctly since it affects every request in the application
category: fastapi
impact: HIGH
impactDescription: Middleware ordering and implementation affect every request in the application
tags: [fastapi, middleware, request-id, timing, cors, logging, starlette]
---

# FastAPI Middleware Patterns

## Request ID Middleware

```python
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
```

## Timing Middleware

```python
import time
from starlette.middleware.base import BaseHTTPMiddleware

class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        response.headers["X-Response-Time"] = f"{duration:.3f}s"
        return response
```

## Structured Logging Middleware

```python
import structlog
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        log = logger.bind(
            request_id=getattr(request.state, "request_id", None),
            method=request.method,
            path=request.url.path,
        )
        try:
            response = await call_next(request)
            log.info("request_completed", status_code=response.status_code)
            return response
        except Exception as exc:
            log.exception("request_failed", error=str(exc))
            raise
```

## CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time"],
)
```

## Middleware Order

Add middleware in this order (last added runs first):

1. CORS (outermost)
2. RequestID
3. Timing
4. Logging (innermost)

**Incorrect — Wrong middleware order causes missing request IDs in logs:**
```python
app.add_middleware(LoggingMiddleware)  # Runs first, no request_id yet
app.add_middleware(RequestIDMiddleware)  # Runs second, sets request_id
# Result: Logs missing request_id
```

**Correct — Correct order ensures request_id available for logging:**
```python
app.add_middleware(LoggingMiddleware)  # Runs last, has request_id
app.add_middleware(RequestIDMiddleware)  # Runs first, sets request_id
# Last added = outermost = runs first
```

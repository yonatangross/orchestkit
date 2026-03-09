# FastAPI App Boilerplate

## Middleware Classes

```python
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
```

## Exception Handlers

```python
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
```

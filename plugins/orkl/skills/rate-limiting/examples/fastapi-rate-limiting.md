# FastAPI Rate Limiting Examples

Complete examples for implementing rate limiting in FastAPI with Redis.

## SlowAPI Setup (Recommended for Simple Cases)

### Installation
```bash
pip install slowapi redis
```

### Basic Configuration

```python
# app/core/rate_limit.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from redis import Redis

# Use Redis backend for distributed rate limiting
redis_client = Redis.from_url("redis://localhost:6379", decode_responses=True)

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="redis://localhost:6379",
    default_limits=["100/minute"],
)


def setup_rate_limiting(app):
    """Configure rate limiting for the FastAPI app."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
```

### Route-Level Limiting

```python
# app/api/v1/routes/analyses.py
from fastapi import APIRouter, Request, Depends
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

@router.post("/analyses")
@limiter.limit("10/minute")  # Override default
async def create_analysis(request: Request):
    """Create analysis - stricter limit due to resource cost."""
    return {"message": "Analysis created"}

@router.get("/analyses")
@limiter.limit("100/minute")
async def list_analyses(request: Request):
    """List analyses - more permissive."""
    return {"analyses": []}

@router.get("/analyses/{id}")
@limiter.limit("200/minute")
async def get_analysis(request: Request, id: str):
    """Get single analysis - most permissive."""
    return {"id": id}
```

### User-Based Rate Limiting

```python
# app/core/rate_limit.py
from fastapi import Request
from app.api.deps import get_current_user

def get_user_identifier(request: Request) -> str:
    """Get rate limit key from authenticated user or IP."""
    # Try to get user from request state (set by auth middleware)
    user = getattr(request.state, "user", None)
    if user:
        return f"user:{user.id}"

    # Fallback to IP for unauthenticated requests
    return f"ip:{get_remote_address(request)}"

limiter = Limiter(key_func=get_user_identifier)
```

### Tiered Rate Limits

```python
# app/api/v1/routes/protected.py
from fastapi import APIRouter, Request, Depends
from slowapi import Limiter

router = APIRouter()

def get_tier_limit(request: Request) -> str:
    """Dynamic limit based on user tier."""
    user = getattr(request.state, "user", None)
    if not user:
        return "10/minute"  # Anonymous

    tier_limits = {
        "free": "100/minute",
        "pro": "1000/minute",
        "enterprise": "10000/minute",
    }
    return tier_limits.get(user.tier, "100/minute")

@router.post("/generate")
@limiter.limit(get_tier_limit)
async def generate_content(request: Request):
    """Rate limit based on user subscription tier."""
    return {"content": "Generated"}
```

## Custom Redis Token Bucket

For more control, implement custom rate limiting:

```python
# app/core/rate_limit.py
import time
from typing import NamedTuple
import redis.asyncio as redis
from fastapi import Request, HTTPException, status

class RateLimitResult(NamedTuple):
    allowed: bool
    remaining: int
    reset_at: float
    retry_after: int

class RedisRateLimiter:
    """Custom rate limiter with token bucket algorithm."""

    SCRIPT = """
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])

    local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(bucket[1]) or capacity
    local last_refill = tonumber(bucket[2]) or now

    local elapsed = (now - last_refill) / 1000
    tokens = math.min(capacity, tokens + elapsed * refill_rate)

    if tokens >= 1 then
        tokens = tokens - 1
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) + 1)
        return {1, math.floor(tokens), 0}
    else
        local retry_after = math.ceil((1 - tokens) / refill_rate)
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
        return {0, 0, retry_after}
    end
    """

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        capacity: int = 100,
        refill_rate: float = 10,
    ):
        self.redis = redis.from_url(redis_url)
        self.capacity = capacity
        self.refill_rate = refill_rate
        self._script = None

    async def _get_script(self):
        if self._script is None:
            self._script = self.redis.register_script(self.SCRIPT)
        return self._script

    async def check(self, key: str) -> RateLimitResult:
        """Check rate limit for a key."""
        script = await self._get_script()
        now_ms = int(time.time() * 1000)

        result = await script(
            keys=[f"ratelimit:{key}"],
            args=[self.capacity, self.refill_rate, now_ms],
        )

        reset_at = time.time() + (self.capacity / self.refill_rate)

        return RateLimitResult(
            allowed=bool(result[0]),
            remaining=int(result[1]),
            reset_at=reset_at,
            retry_after=int(result[2]),
        )


# FastAPI Dependency
async def rate_limit_dependency(
    request: Request,
    limiter: RedisRateLimiter = Depends(get_rate_limiter),
):
    """Dependency that enforces rate limiting."""
    # Get identifier
    user = getattr(request.state, "user", None)
    key = f"user:{user.id}" if user else f"ip:{request.client.host}"

    result = await limiter.check(key)

    # Set rate limit headers
    request.state.rate_limit = result

    if not result.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
            headers={
                "Retry-After": str(result.retry_after),
                "X-RateLimit-Limit": str(limiter.capacity),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(result.reset_at)),
            },
        )


# Middleware to add rate limit headers to all responses
@app.middleware("http")
async def add_rate_limit_headers(request: Request, call_next):
    response = await call_next(request)

    rate_limit = getattr(request.state, "rate_limit", None)
    if rate_limit:
        response.headers["X-RateLimit-Limit"] = str(100)
        response.headers["X-RateLimit-Remaining"] = str(rate_limit.remaining)
        response.headers["X-RateLimit-Reset"] = str(int(rate_limit.reset_at))

    return response
```

### Usage in Routes

```python
@router.post("/expensive-operation")
async def expensive_operation(
    request: Request,
    _: None = Depends(rate_limit_dependency),
):
    """This endpoint is rate limited."""
    return {"result": "success"}
```

## Rate Limit by Endpoint Cost

```python
# app/core/rate_limit.py
from functools import wraps
from typing import Callable

class CostBasedLimiter:
    """Rate limiter where different operations cost different tokens."""

    def __init__(self, redis_url: str, capacity: int = 1000):
        self.limiter = RedisRateLimiter(redis_url, capacity=capacity)

    def limit(self, cost: int = 1):
        """Decorator that consumes 'cost' tokens per request."""
        def decorator(func: Callable):
            @wraps(func)
            async def wrapper(request: Request, *args, **kwargs):
                key = get_user_identifier(request)

                # Check if we have enough tokens
                for _ in range(cost):
                    result = await self.limiter.check(key)
                    if not result.allowed:
                        raise HTTPException(
                            status_code=429,
                            detail=f"Rate limit exceeded (operation costs {cost} tokens)",
                        )

                return await func(request, *args, **kwargs)
            return wrapper
        return decorator


cost_limiter = CostBasedLimiter("redis://localhost:6379")

@router.get("/simple")
@cost_limiter.limit(cost=1)  # Cheap operation
async def simple_query(request: Request):
    return {"data": "simple"}

@router.post("/generate")
@cost_limiter.limit(cost=10)  # Expensive operation
async def generate_content(request: Request):
    return {"data": "generated"}

@router.post("/bulk-process")
@cost_limiter.limit(cost=50)  # Very expensive
async def bulk_process(request: Request):
    return {"data": "processed"}
```

## Testing Rate Limits

```python
# tests/test_rate_limiting.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_rate_limit_enforced():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Make requests up to limit
        for _ in range(10):
            response = await client.post("/analyses")
            assert response.status_code == 200

        # Next request should be rate limited
        response = await client.post("/analyses")
        assert response.status_code == 429
        assert "Retry-After" in response.headers

@pytest.mark.asyncio
async def test_rate_limit_headers():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/analyses")

        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers
```

## Related Files

- See `references/token-bucket-algorithm.md` for algorithm details
- See `checklists/rate-limiting-checklist.md` for implementation checklist
- See SKILL.md for sliding window and fixed window algorithms

---
name: rate-limiting
description: API rate limiting with token bucket, sliding window, and Redis distributed patterns. Use when implementing rate limits, throttling requests, handling 429 Too Many Requests, protecting against API abuse, or configuring SlowAPI with Redis.
context: fork
agent: backend-system-architect
version: 1.0.0
tags: [rate-limiting, redis, token-bucket, fastapi, security, 2026]
author: OrchestKit
user-invocable: false
---

# Rate Limiting Patterns

Protect APIs with distributed rate limiting using Redis and modern algorithms.

## Overview

- Protecting public APIs from abuse
- Implementing tiered rate limits (free/pro/enterprise)
- Scaling rate limiting across multiple instances
- Preventing brute force attacks on auth endpoints
- Managing third-party API consumption

## Algorithm Selection

| Algorithm | Use Case | Burst Handling |
|-----------|----------|----------------|
| Token Bucket | General API, allows bursts | Excellent |
| Sliding Window | Precise, no burst spikes | Good |
| Leaky Bucket | Steady rate, queue excess | None |
| Fixed Window | Simple, some edge issues | Moderate |

## SlowAPI + Redis (FastAPI)

### Basic Setup

```python
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="redis://localhost:6379",
    strategy="moving-window",  # sliding window
)

app = FastAPI()
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
```

### Endpoint Limits

```python
from slowapi import Limiter

@router.post("/api/v1/auth/login")
@limiter.limit("10/minute")  # Strict for auth
async def login(request: Request, credentials: LoginRequest):
    ...

@router.get("/api/v1/analyses")
@limiter.limit("100/minute")  # Normal for reads
async def list_analyses(request: Request):
    ...

@router.post("/api/v1/analyses")
@limiter.limit("20/minute")  # Moderate for writes
async def create_analysis(request: Request, data: AnalysisCreate):
    ...
```

### User-Based Limits

```python
def get_user_identifier(request: Request) -> str:
    """Rate limit by user ID if authenticated, else IP."""
    if hasattr(request.state, "user"):
        return f"user:{request.state.user.id}"
    return f"ip:{get_remote_address(request)}"

limiter = Limiter(key_func=get_user_identifier)
```

## Token Bucket with Redis (Custom)

```python
import redis.asyncio as redis
from datetime import datetime, timezone

class TokenBucketLimiter:
    def __init__(
        self,
        redis_client: redis.Redis,
        capacity: int = 100,
        refill_rate: float = 10.0,  # tokens per second
    ):
        self.redis = redis_client
        self.capacity = capacity
        self.refill_rate = refill_rate

    async def is_allowed(self, key: str, tokens: int = 1) -> bool:
        """Check if request is allowed, consume tokens atomically."""
        lua_script = """
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local tokens_requested = tonumber(ARGV[3])
        local now = tonumber(ARGV[4])

        local bucket = redis.call('HMGET', key, 'tokens', 'last_update')
        local current_tokens = tonumber(bucket[1]) or capacity
        local last_update = tonumber(bucket[2]) or now

        -- Calculate refill
        local elapsed = now - last_update
        local refill = elapsed * refill_rate
        current_tokens = math.min(capacity, current_tokens + refill)

        -- Check and consume
        if current_tokens >= tokens_requested then
            current_tokens = current_tokens - tokens_requested
            redis.call('HMSET', key, 'tokens', current_tokens, 'last_update', now)
            redis.call('EXPIRE', key, 3600)
            return 1
        else
            return 0
        end
        """
        now = datetime.now(timezone.utc).timestamp()
        result = await self.redis.eval(
            lua_script, 1, key,
            self.capacity, self.refill_rate, tokens, now
        )
        return result == 1
```

## Sliding Window Counter

```python
class SlidingWindowLimiter:
    def __init__(self, redis_client: redis.Redis, window_seconds: int = 60):
        self.redis = redis_client
        self.window = window_seconds

    async def is_allowed(self, key: str, limit: int) -> tuple[bool, int]:
        """Returns (allowed, remaining)."""
        now = datetime.now(timezone.utc).timestamp()
        window_start = now - self.window

        pipe = self.redis.pipeline()
        # Remove old entries
        pipe.zremrangebyscore(key, 0, window_start)
        # Count current window
        pipe.zcard(key)
        # Add this request
        pipe.zadd(key, {str(now): now})
        # Set expiry
        pipe.expire(key, self.window * 2)

        results = await pipe.execute()
        current_count = results[1]

        if current_count < limit:
            return True, limit - current_count - 1
        return False, 0
```

## Tiered Rate Limits

```python
from enum import Enum

class UserTier(Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"

TIER_LIMITS = {
    UserTier.FREE: {"requests": 100, "window": 3600},       # 100/hour
    UserTier.PRO: {"requests": 1000, "window": 3600},       # 1000/hour
    UserTier.ENTERPRISE: {"requests": 10000, "window": 3600}, # 10000/hour
}

async def get_rate_limit(user: User) -> str:
    limits = TIER_LIMITS[user.tier]
    return f"{limits['requests']}/{limits['window']}seconds"

@router.get("/api/v1/data")
@limiter.limit(get_rate_limit)
async def get_data(request: Request, user: User = Depends(get_current_user)):
    ...
```

## Response Headers (RFC 6585)

```python
from fastapi import Response

async def add_rate_limit_headers(
    response: Response,
    limit: int,
    remaining: int,
    reset_at: datetime,
):
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    response.headers["X-RateLimit-Reset"] = str(int(reset_at.timestamp()))
    response.headers["Retry-After"] = str(int((reset_at - datetime.now(timezone.utc)).seconds))
```

## Error Response (429)

```python
from fastapi import HTTPException
from fastapi.responses import JSONResponse

def rate_limit_exceeded_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=429,
        content={
            "type": "https://api.example.com/errors/rate-limit-exceeded",
            "title": "Too Many Requests",
            "status": 429,
            "detail": "Rate limit exceeded. Please retry after the reset time.",
            "instance": str(request.url),
        },
        headers={
            "Retry-After": "60",
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "0",
        }
    )
```

## Anti-Patterns (FORBIDDEN)

```python
# NEVER use in-memory counters in distributed systems
request_counts = {}  # Lost on restart, not shared across instances

# NEVER skip rate limiting on internal APIs (defense in depth)
@router.get("/internal/admin")
async def admin_endpoint():  # No rate limit = vulnerable
    ...

# NEVER use fixed window without considering edge spikes
# A user can hit 100 at 0:59 and 100 at 1:01 = 200 in 2 seconds
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Storage | Redis (distributed, atomic) |
| Algorithm | Token bucket for most APIs |
| Key | User ID if auth, else IP + fingerprint |
| Auth endpoints | 10/min (strict) |
| Read endpoints | 100-1000/min (based on tier) |
| Write endpoints | 20-100/min (moderate) |

## Related Skills

- `auth-patterns` - Authentication integration
- `resilience-patterns` - Circuit breakers
- `observability-monitoring` - Rate limit metrics

## Capability Details

### token-bucket
**Keywords:** token bucket, rate limit, burst, capacity
**Solves:**
- How do I implement token bucket rate limiting?
- Allow bursts while limiting rate

### sliding-window
**Keywords:** sliding window, moving window, rate limit
**Solves:**
- How to implement precise rate limiting?
- Avoid fixed window edge cases

### slowapi-redis
**Keywords:** slowapi, fastapi rate limit, redis limiter
**Solves:**
- How to add rate limiting to FastAPI?
- Distributed rate limiting

### tiered-limits
**Keywords:** tiered, user tier, free pro enterprise
**Solves:**
- Different rate limits per subscription tier
- User-based rate limiting

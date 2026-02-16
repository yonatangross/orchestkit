---
title: "Rate Limiting: Distributed & Tiered"
category: ratelimit
impact: HIGH
impactDescription: "Ensures API protection through distributed rate limiting with SlowAPI, Redis, and tiered user limits"
tags: ratelimit, distributed, slowapi, redis, tiers
---

# Distributed Rate Limiting with SlowAPI and Tiered Limits

## SlowAPI + Redis (FastAPI)

```python
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="redis://localhost:6379",
    strategy="moving-window",
)

app = FastAPI()
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# Endpoint limits
@router.post("/api/v1/auth/login")
@limiter.limit("10/minute")       # Strict for auth
async def login(request: Request): ...

@router.get("/api/v1/analyses")
@limiter.limit("100/minute")      # Normal for reads
async def list_analyses(request: Request): ...

@router.post("/api/v1/analyses")
@limiter.limit("20/minute")       # Moderate for writes
async def create_analysis(request: Request): ...
```

## User-Based Key Function

```python
def get_user_identifier(request: Request) -> str:
    """Rate limit by user ID if authenticated, else IP."""
    if hasattr(request.state, "user"):
        return f"user:{request.state.user.id}"
    return f"ip:{get_remote_address(request)}"

limiter = Limiter(key_func=get_user_identifier)
```

## Tiered Rate Limits

```python
from enum import Enum

class UserTier(Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"

TIER_LIMITS = {
    UserTier.FREE: {"requests": 100, "window": 3600},
    UserTier.PRO: {"requests": 1000, "window": 3600},
    UserTier.ENTERPRISE: {"requests": 10000, "window": 3600},
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
async def add_rate_limit_headers(response: Response, limit: int,
                                  remaining: int, reset_at: datetime):
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    response.headers["X-RateLimit-Reset"] = str(int(reset_at.timestamp()))
    response.headers["Retry-After"] = str(
        int((reset_at - datetime.now(timezone.utc)).seconds)
    )
```

## 429 Error Response

```python
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
        headers={"Retry-After": "60", "X-RateLimit-Remaining": "0"},
    )
```

## Algorithm Selection

| Algorithm | Use Case | Burst Handling |
|-----------|----------|----------------|
| Token Bucket | General API, allows bursts | Excellent |
| Sliding Window | Precise, no burst spikes | Good |
| Leaky Bucket | Steady rate, queue excess | None |
| Fixed Window | Simple, some edge issues | Moderate |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Storage | Redis (distributed, atomic) |
| Algorithm | Token bucket for most APIs |
| Key | User ID if auth, else IP + fingerprint |
| Auth endpoints | 10/min (strict) |
| Read endpoints | 100-1000/min (based on tier) |
| Write endpoints | 20-100/min (moderate) |

## Common Mistakes

```python
# NEVER use in-memory counters in distributed systems
request_counts = {}  # Lost on restart, not shared!

# NEVER skip rate limiting on internal APIs
@router.get("/internal/admin")
async def admin_endpoint():  # No rate limit = vulnerable
    ...

# NEVER use fixed window without considering edge spikes
```

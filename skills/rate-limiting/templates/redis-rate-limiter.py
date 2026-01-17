"""
Redis Rate Limiter Template

Production-ready rate limiter with:
- Token bucket algorithm
- Sliding window counter
- Distributed support via Redis
- Comprehensive headers
"""

import time
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum

import redis.asyncio as redis
from fastapi import HTTPException, Request, status

# ============================================================================
# Rate Limit Result
# ============================================================================

@dataclass
class RateLimitResult:
    """Result of a rate limit check."""

    allowed: bool
    limit: int
    remaining: int
    reset_at: float  # Unix timestamp
    retry_after: int  # Seconds (0 if allowed)

    def to_headers(self) -> dict[str, str]:
        """Convert to response headers."""
        headers = {
            "X-RateLimit-Limit": str(self.limit),
            "X-RateLimit-Remaining": str(self.remaining),
            "X-RateLimit-Reset": str(int(self.reset_at)),
        }
        if self.retry_after > 0:
            headers["Retry-After"] = str(self.retry_after)
        return headers


# ============================================================================
# Rate Limit Configuration
# ============================================================================

class RateLimitTier(Enum):
    """User tier for rate limiting."""

    ANONYMOUS = "anonymous"
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


TIER_LIMITS = {
    RateLimitTier.ANONYMOUS: {"capacity": 10, "refill_rate": 0.5},
    RateLimitTier.FREE: {"capacity": 100, "refill_rate": 5},
    RateLimitTier.PRO: {"capacity": 1000, "refill_rate": 50},
    RateLimitTier.ENTERPRISE: {"capacity": 10000, "refill_rate": 500},
}


# ============================================================================
# Token Bucket Rate Limiter
# ============================================================================

class TokenBucketLimiter:
    """
    Token bucket rate limiter with Redis backend.

    Features:
    - Atomic operations via Lua script
    - Tiered limits
    - Distributed across multiple servers
    """

    SCRIPT = """
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local cost = tonumber(ARGV[4])

    -- Get current bucket state
    local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(bucket[1]) or capacity
    local last_refill = tonumber(bucket[2]) or now

    -- Calculate tokens to add based on time elapsed
    local elapsed = (now - last_refill) / 1000
    local refill = elapsed * refill_rate
    tokens = math.min(capacity, tokens + refill)

    -- Check if we can consume tokens
    local allowed = 0
    local remaining = math.floor(tokens)
    local retry_after = 0

    if tokens >= cost then
        allowed = 1
        remaining = math.floor(tokens - cost)
        tokens = tokens - cost
    else
        local needed = cost - tokens
        retry_after = math.ceil(needed / refill_rate)
    end

    -- Update bucket state
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) * 2)

    return {allowed, remaining, retry_after, capacity}
    """

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.from_url(redis_url)
        self._script = None

    async def _get_script(self):
        """Lazily register the Lua script."""
        if self._script is None:
            self._script = self.redis.register_script(self.SCRIPT)
        return self._script

    async def check(
        self,
        key: str,
        tier: RateLimitTier = RateLimitTier.ANONYMOUS,
        cost: int = 1,
    ) -> RateLimitResult:
        """
        Check rate limit for a key.

        Args:
            key: Unique identifier (user_id, ip, api_key)
            tier: User tier for limit lookup
            cost: Number of tokens to consume

        Returns:
            RateLimitResult with allowed status and headers
        """
        config = TIER_LIMITS[tier]
        capacity = config["capacity"]
        refill_rate = config["refill_rate"]

        script = await self._get_script()
        now_ms = int(time.time() * 1000)

        result = await script(
            keys=[f"ratelimit:token:{key}"],
            args=[capacity, refill_rate, now_ms, cost],
        )

        reset_at = time.time() + (capacity / refill_rate)

        return RateLimitResult(
            allowed=bool(result[0]),
            limit=int(result[3]),
            remaining=int(result[1]),
            reset_at=reset_at,
            retry_after=int(result[2]),
        )

    async def close(self):
        """Close Redis connection."""
        await self.redis.close()


# ============================================================================
# Sliding Window Counter
# ============================================================================

class SlidingWindowLimiter:
    """
    Sliding window counter rate limiter.

    More accurate than fixed window, prevents boundary spikes.
    """

    SCRIPT = """
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])

    -- Remove old entries
    redis.call('ZREMRANGEBYSCORE', key, 0, now - window * 1000)

    -- Count current entries
    local count = redis.call('ZCARD', key)

    if count < limit then
        -- Add current request
        redis.call('ZADD', key, now, now .. ':' .. math.random())
        redis.call('EXPIRE', key, window)
        return {1, limit - count - 1, 0, limit}
    else
        -- Get oldest entry to calculate retry time
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local retry_after = 0
        if oldest[2] then
            retry_after = math.ceil((tonumber(oldest[2]) + window * 1000 - now) / 1000)
        end
        return {0, 0, retry_after, limit}
    end
    """

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        limit: int = 100,
        window_seconds: int = 60,
    ):
        self.redis = redis.from_url(redis_url)
        self.limit = limit
        self.window = window_seconds
        self._script = None

    async def _get_script(self):
        if self._script is None:
            self._script = self.redis.register_script(self.SCRIPT)
        return self._script

    async def check(self, key: str) -> RateLimitResult:
        """Check rate limit using sliding window."""
        script = await self._get_script()
        now_ms = int(time.time() * 1000)

        result = await script(
            keys=[f"ratelimit:sliding:{key}"],
            args=[self.limit, self.window, now_ms],
        )

        return RateLimitResult(
            allowed=bool(result[0]),
            limit=int(result[3]),
            remaining=int(result[1]),
            reset_at=time.time() + self.window,
            retry_after=int(result[2]),
        )


# ============================================================================
# FastAPI Integration
# ============================================================================

def create_rate_limit_dependency(
    limiter: TokenBucketLimiter,
    get_key: Callable[[Request], str] | None = None,
    get_tier: Callable[[Request], RateLimitTier] | None = None,
    cost: int = 1,
):
    """
    Create a FastAPI dependency for rate limiting.

    Usage:
        limiter = TokenBucketLimiter("redis://localhost:6379")

        @app.get("/protected")
        async def protected(
            _: None = Depends(create_rate_limit_dependency(limiter))
        ):
            return {"message": "success"}
    """

    async def rate_limit_dependency(request: Request):
        # Get key (default: IP address)
        if get_key:
            key = get_key(request)
        else:
            key = request.client.host if request.client else "unknown"

        # Get tier (default: anonymous)
        if get_tier:
            tier = get_tier(request)
        else:
            tier = RateLimitTier.ANONYMOUS

        # Check rate limit
        result = await limiter.check(key, tier, cost)

        # Store for middleware to add headers
        request.state.rate_limit = result

        if not result.allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "type": "https://api.example.com/problems/rate-limit-exceeded",
                    "title": "Rate Limit Exceeded",
                    "status": 429,
                    "detail": f"Rate limit exceeded. Retry in {result.retry_after} seconds.",
                    "retry_after": result.retry_after,
                },
                headers=result.to_headers(),
            )

    return rate_limit_dependency


# ============================================================================
# Rate Limit Middleware
# ============================================================================

from starlette.middleware.base import BaseHTTPMiddleware  # noqa: E402


class RateLimitHeadersMiddleware(BaseHTTPMiddleware):
    """Add rate limit headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Add headers if rate limit was checked
        rate_limit = getattr(request.state, "rate_limit", None)
        if rate_limit:
            for key, value in rate_limit.to_headers().items():
                response.headers[key] = value

        return response


# ============================================================================
# Usage Example
# ============================================================================

if __name__ == "__main__":
    import asyncio

    async def main():
        limiter = TokenBucketLimiter("redis://localhost:6379")

        # Simulate requests
        for i in range(15):
            result = await limiter.check(
                key="user:123",
                tier=RateLimitTier.FREE,
            )
            print(f"Request {i+1}: allowed={result.allowed}, remaining={result.remaining}")
            if not result.allowed:
                print(f"  Retry after: {result.retry_after}s")
                break

        await limiter.close()

    asyncio.run(main())

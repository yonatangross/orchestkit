# Token Bucket Algorithm

In-depth guide to the token bucket rate limiting algorithm with Redis implementation.

## How Token Bucket Works

```
┌─────────────────────────────────────────────────────────────┐
│                    TOKEN BUCKET                              │
│                                                              │
│   ┌──────────────────────────────────────────────────┐      │
│   │  Tokens: ●●●●●●●○○○  (7/10 tokens available)     │      │
│   │  Capacity: 10 tokens                              │      │
│   │  Refill Rate: 5 tokens/second                     │      │
│   └──────────────────────────────────────────────────┘      │
│                         │                                    │
│   REQUEST ──────────────┼──────────────────────► ALLOWED    │
│                         │                                    │
│   (Each request consumes 1 token)                           │
│   (Bucket refills at constant rate)                         │
│                                                              │
│   Timeline:                                                  │
│   t=0s: 10 tokens │ 10 requests → 0 tokens                  │
│   t=1s: +5 tokens │ 5 tokens available                      │
│   t=2s: +5 tokens │ 10 tokens (capped at capacity)          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Algorithm Properties

| Property | Description |
|----------|-------------|
| **Burst Capacity** | Allows short bursts up to bucket size |
| **Smooth Limiting** | Tokens refill continuously |
| **No Memory** | Doesn't track request history |
| **Distributed** | Works with Redis for multi-server |

## Redis Lua Script (Atomic)

```lua
-- token_bucket.lua
-- KEYS[1] = bucket key
-- ARGV[1] = bucket capacity
-- ARGV[2] = refill rate (tokens per second)
-- ARGV[3] = current timestamp (milliseconds)
-- ARGV[4] = tokens to consume

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

-- Get current bucket state
local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

-- Calculate tokens to add based on time elapsed
local elapsed = (now - last_refill) / 1000  -- Convert to seconds
local refill = math.floor(elapsed * refill_rate)
tokens = math.min(capacity, tokens + refill)

-- Check if we can consume tokens
local allowed = 0
local remaining = tokens
local retry_after = 0

if tokens >= requested then
    allowed = 1
    remaining = tokens - requested
else
    -- Calculate when enough tokens will be available
    local needed = requested - tokens
    retry_after = math.ceil(needed / refill_rate)
end

-- Update bucket state
redis.call('HMSET', key,
    'tokens', remaining,
    'last_refill', now
)
redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) + 1)

return {allowed, remaining, retry_after}
```

## Python Implementation

```python
import time
from typing import NamedTuple

import redis.asyncio as redis


class RateLimitResult(NamedTuple):
    allowed: bool
    remaining: int
    retry_after: int  # seconds


class TokenBucket:
    """Token bucket rate limiter with Redis backend."""

    # Load Lua script once
    SCRIPT = """
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local requested = tonumber(ARGV[4])

    local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(bucket[1]) or capacity
    local last_refill = tonumber(bucket[2]) or now

    local elapsed = (now - last_refill) / 1000
    local refill = math.floor(elapsed * refill_rate)
    tokens = math.min(capacity, tokens + refill)

    local allowed = 0
    local remaining = tokens
    local retry_after = 0

    if tokens >= requested then
        allowed = 1
        remaining = tokens - requested
    else
        local needed = requested - tokens
        retry_after = math.ceil(needed / refill_rate)
    end

    redis.call('HMSET', key, 'tokens', remaining, 'last_refill', now)
    redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) + 1)

    return {allowed, remaining, retry_after}
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        capacity: int = 100,
        refill_rate: float = 10,  # tokens per second
    ):
        self.redis = redis_client
        self.capacity = capacity
        self.refill_rate = refill_rate
        self._script = self.redis.register_script(self.SCRIPT)

    async def consume(
        self,
        key: str,
        tokens: int = 1,
    ) -> RateLimitResult:
        """
        Try to consume tokens from the bucket.

        Args:
            key: Unique identifier (user_id, ip_address, etc.)
            tokens: Number of tokens to consume

        Returns:
            RateLimitResult with allowed status and metadata
        """
        bucket_key = f"ratelimit:token_bucket:{key}"
        now_ms = int(time.time() * 1000)

        result = await self._script(
            keys=[bucket_key],
            args=[self.capacity, self.refill_rate, now_ms, tokens],
        )

        return RateLimitResult(
            allowed=bool(result[0]),
            remaining=int(result[1]),
            retry_after=int(result[2]),
        )


# Usage with FastAPI
async def get_rate_limiter() -> TokenBucket:
    redis_client = redis.from_url("redis://localhost:6379")
    return TokenBucket(redis_client, capacity=100, refill_rate=10)
```

## Comparison: Token Bucket vs Sliding Window

| Aspect | Token Bucket | Sliding Window |
|--------|-------------|----------------|
| **Burst Handling** | Allows up to capacity | Spreads evenly |
| **Memory** | O(1) per key | O(n) request timestamps |
| **Precision** | Approximate | Exact |
| **Use Case** | API rate limiting | Strict quotas |
| **Redis Operations** | 1 HMSET | 1 ZADD + 1 ZREMRANGEBYSCORE |

## When to Use Token Bucket

**Good for:**
- API rate limiting (allows natural bursts)
- User actions (login attempts, form submissions)
- Resource protection (database connections)

**Not ideal for:**
- Strict per-second quotas
- Billing-based limits (use sliding window)
- Fair queuing (use leaky bucket)

## Related Files

- See `examples/fastapi-rate-limiting.md` for FastAPI integration
- See `checklists/rate-limiting-checklist.md` for implementation checklist
- See SKILL.md for sliding window implementation

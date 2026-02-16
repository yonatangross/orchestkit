---
title: "Rate Limiting: Sliding Window"
category: ratelimit
impact: HIGH
impactDescription: "Ensures precise rate limiting without boundary spikes by tracking individual request timestamps in Redis sorted sets"
tags: ratelimit, sliding-window, redis, precision, quota
---

# Sliding Window Rate Limiting

Precise rate limiting that avoids fixed window boundary spikes.

## Problem with Fixed Windows

A user can hit 100 at 0:59 and 100 at 1:01 = 200 requests in 2 seconds with a "100/minute" limit.

Sliding window solves this by tracking individual request timestamps.

## Redis Implementation

```python
import redis.asyncio as redis
from datetime import datetime, timezone

class SlidingWindowLimiter:
    def __init__(self, redis_client: redis.Redis, window_seconds: int = 60):
        self.redis = redis_client
        self.window = window_seconds

    async def is_allowed(self, key: str, limit: int) -> tuple[bool, int]:
        """Returns (allowed, remaining)."""
        now = datetime.now(timezone.utc).timestamp()
        window_start = now - self.window
        bucket_key = f"ratelimit:sliding:{key}"

        pipe = self.redis.pipeline()
        pipe.zremrangebyscore(bucket_key, 0, window_start)  # Remove old
        pipe.zcard(bucket_key)                               # Count current
        pipe.zadd(bucket_key, {str(now): now})               # Add this request
        pipe.expire(bucket_key, self.window * 2)             # Set expiry

        results = await pipe.execute()
        current_count = results[1]

        if current_count < limit:
            return True, limit - current_count - 1
        return False, 0
```

## Atomic Lua Script (Better for Production)

```lua
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Remove old entries
redis.call('ZREMRANGEBYSCORE', key, 0, now - window * 1000)

-- Count current entries
local count = redis.call('ZCARD', key)

if count < limit then
    redis.call('ZADD', key, now, now .. ':' .. math.random())
    redis.call('EXPIRE', key, window)
    return {1, limit - count - 1, 0}
else
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retry_after = 0
    if oldest[2] then
        retry_after = math.ceil((tonumber(oldest[2]) + window * 1000 - now) / 1000)
    end
    return {0, 0, retry_after}
end
```

## When to Use

| Sliding Window | Token Bucket |
|---------------|-------------|
| Strict quotas (billing) | General API limits |
| No burst tolerance | Burst-friendly |
| Higher memory (O(n) timestamps) | O(1) memory |
| Exact counting | Approximate counting |

## Best Practices

1. Use Redis sorted sets with timestamps as scores
2. Clean expired entries on every check (ZREMRANGEBYSCORE)
3. Set EXPIRE on the key to auto-cleanup inactive users
4. Use pipeline or Lua script for atomicity
5. Consider memory: each request stores a member in the sorted set

**Incorrect — Fixed window allows 200 requests in 2 seconds with "100/min" limit:**
```python
# Fixed window resets at minute boundaries
window_start = int(time.time() / 60) * 60
if get_count(f"{user}:{window_start}") < 100:
    allow()
# User can send 100 at 0:59 and 100 at 1:01 = 200 in 2 seconds!
```

**Correct — Sliding window tracks individual timestamps for precise limiting:**
```python
now = time.time()
window_start = now - 60  # Last 60 seconds
await redis.zremrangebyscore(key, 0, window_start)  # Remove old
count = await redis.zcard(key)  # Count current
if count < 100:
    await redis.zadd(key, {str(now): now})  # Add request
# Exactly 100 requests per rolling 60-second window
```

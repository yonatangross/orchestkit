---
title: Implement token bucket rate limiting with atomic Redis operations and burst capacity
category: ratelimit
impact: HIGH
impactDescription: "Ensures API rate limiting with burst capacity using atomic Redis token bucket implementation with refill logic"
tags: ratelimit, token-bucket, redis, burst, refill
---

# Token Bucket Rate Limiting

Allows bursts up to bucket capacity while maintaining a steady average rate.

## How It Works

```
Bucket: capacity=10, refill_rate=5/sec

t=0s: 10 tokens | 10 requests -> 0 tokens (burst allowed)
t=1s: +5 tokens | 5 tokens available
t=2s: +5 tokens | 10 tokens (capped at capacity)
```

## Redis Implementation (Atomic Lua Script)

```python
import redis.asyncio as redis
from datetime import datetime, timezone

class TokenBucketLimiter:
    SCRIPT = """
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local tokens_requested = tonumber(ARGV[3])
    local now = tonumber(ARGV[4])

    local bucket = redis.call('HMGET', key, 'tokens', 'last_update')
    local current_tokens = tonumber(bucket[1]) or capacity
    local last_update = tonumber(bucket[2]) or now

    -- Calculate refill
    local elapsed = (now - last_update) / 1000
    current_tokens = math.min(capacity, current_tokens + elapsed * refill_rate)

    -- Check and consume
    local allowed = 0
    local remaining = math.floor(current_tokens)
    local retry_after = 0

    if current_tokens >= tokens_requested then
        allowed = 1
        remaining = math.floor(current_tokens - tokens_requested)
        current_tokens = current_tokens - tokens_requested
    else
        local needed = tokens_requested - current_tokens
        retry_after = math.ceil(needed / refill_rate)
    end

    redis.call('HMSET', key, 'tokens', current_tokens, 'last_update', now)
    redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) * 2)
    return {allowed, remaining, retry_after}
    """

    def __init__(self, redis_client: redis.Redis,
                 capacity: int = 100, refill_rate: float = 10.0):
        self.redis = redis_client
        self.capacity = capacity
        self.refill_rate = refill_rate

    async def is_allowed(self, key: str, tokens: int = 1) -> bool:
        now = datetime.now(timezone.utc).timestamp() * 1000
        result = await self.redis.eval(
            self.SCRIPT, 1, f"ratelimit:token:{key}",
            self.capacity, self.refill_rate, tokens, now,
        )
        return result[0] == 1
```

## Properties

| Property | Description |
|----------|-------------|
| **Burst Capacity** | Allows short bursts up to bucket size |
| **Smooth Limiting** | Tokens refill continuously |
| **O(1) Memory** | Only stores tokens + timestamp per key |
| **Distributed** | Atomic via Redis Lua script |

## When to Use

**Good for:** API rate limiting (natural bursts), user actions (login), resource protection

**Not ideal for:** Strict per-second quotas (use sliding window), billing limits, fair queuing (use leaky bucket)

## vs Sliding Window

| Aspect | Token Bucket | Sliding Window |
|--------|-------------|----------------|
| Burst Handling | Allows up to capacity | Spreads evenly |
| Memory | O(1) per key | O(n) timestamps |
| Precision | Approximate | Exact |
| Redis Operations | 1 HMSET | 1 ZADD + 1 ZREMRANGEBYSCORE |

**Incorrect — Check-then-act pattern has race condition in token refill:**
```typescript
const bucket = await redis.get(`bucket:${user}`);
const tokens = JSON.parse(bucket).tokens + elapsed * refillRate;
if (tokens >= 1) {
  // Race! Another request can pass this check too
  await redis.set(`bucket:${user}`, JSON.stringify({tokens: tokens - 1}));
}
```

**Correct — Atomic Lua script ensures thread-safe token bucket operations:**
```typescript
const result = await redis.eval(TOKEN_BUCKET_SCRIPT,
  keys: [`bucket:${user}`],
  args: [capacity, refillRate, tokensRequested, Date.now()]
);
// Single atomic operation, no race conditions
```

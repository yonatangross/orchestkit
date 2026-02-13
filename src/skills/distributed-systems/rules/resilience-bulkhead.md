---
title: "Resilience: Bulkhead Isolation"
category: resilience
impact: CRITICAL
---

# Bulkhead Pattern

Isolates failures by partitioning resources into independent pools. One failing component does not bring down the entire system.

## Tier-Based Configuration

| Tier | Workers | Queue | Timeout | Use Case |
|------|---------|-------|---------|----------|
| 1 (Critical) | 5 | 10 | 180-300s | Synthesis, quality gate, user-facing |
| 2 (Standard) | 8 | 12 | 120s | Analysis agents, data processing |
| 3 (Optional) | 4 | 6 | 60s | Enrichment, caching, analytics |

## Implementation

```python
from asyncio import Semaphore, wait_for, TimeoutError
from enum import Enum

class Tier(Enum):
    CRITICAL = 1
    STANDARD = 2
    OPTIONAL = 3

class Bulkhead:
    def __init__(self, tier: Tier, max_concurrent: int, queue_size: int, timeout: float):
        self.tier = tier
        self.semaphore = Semaphore(max_concurrent)
        self.queue_size = queue_size
        self.timeout = timeout
        self.waiting = 0
        self.active = 0

    async def execute(self, fn):
        if self.waiting >= self.queue_size:
            raise BulkheadFullError(f"Tier {self.tier.name} queue full")

        self.waiting += 1
        try:
            await wait_for(self.semaphore.acquire(), timeout=self.timeout)
            self.waiting -= 1
            self.active += 1
            try:
                return await wait_for(fn(), timeout=self.timeout)
            finally:
                self.active -= 1
                self.semaphore.release()
        except TimeoutError:
            self.waiting -= 1
            raise BulkheadTimeoutError(f"Tier {self.tier.name} timeout")
```

## Rejection Policies

```python
class RejectionPolicy(Enum):
    ABORT = "abort"        # Return error immediately
    CALLER_RUNS = "caller" # Execute in caller's context (blocking)
    DISCARD = "discard"    # Silently drop (for optional ops)
    QUEUE = "queue"        # Wait in bounded queue

TIER_POLICIES = {
    Tier.CRITICAL: RejectionPolicy.QUEUE,      # Wait for slot
    Tier.STANDARD: RejectionPolicy.CALLER_RUNS, # Degrade caller
    Tier.OPTIONAL: RejectionPolicy.DISCARD,     # Skip if busy
}
```

## Graceful Degradation by Tier

```python
async def run_analysis(content: str):
    results = {}

    # Tier 1: Must succeed
    results["core"] = await tier1_bulkhead.execute(
        lambda: analyze_core(content)
    )

    # Tier 2: Best effort
    try:
        results["enriched"] = await tier2_bulkhead.execute(
            lambda: enrich_analysis(content)
        )
    except BulkheadFullError:
        results["enriched"] = None  # Skip enrichment

    # Tier 3: Optional (silent failure)
    try:
        await tier3_bulkhead.execute(lambda: warm_cache(results))
    except (BulkheadFullError, BulkheadTimeoutError):
        pass

    return results
```

## Best Practices

1. **Size based on downstream capacity** -- if API allows 60 RPM, don't set 100 concurrent
2. **Monitor queue depth** -- alert when consistently > 80% full
3. **Combine with circuit breaker** -- slow calls trigger circuit, clearing bulkhead slots
4. **Use per-dependency bulkheads** -- not per-endpoint (too granular)
5. **Return 503 with Retry-After** -- when rejecting, don't return 500

## Common Mistakes

- Too many bulkheads (per-endpoint instead of per-dependency)
- Ignoring rejection handling (BulkheadFullError becomes 500)
- No correlation with circuit breaker (slots stay blocked on slow service)

# Bulkhead Pattern

## Overview

The bulkhead pattern isolates failures by partitioning system resources into independent pools. Named after ship bulkheads that prevent flooding from spreading, it ensures one failing component doesn't bring down the entire system.

## Types of Bulkheads

### 1. Thread Pool Isolation
Dedicated thread pools per service/operation.

```
┌────────────────────────────────────────────────────────────┐
│                    Thread Pool Bulkhead                     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   Service A Pool (5 threads)    Service B Pool (3 threads) │
│   ┌─┬─┬─┬─┬─┐                  ┌─┬─┬─┐                    │
│   │█│█│█│░│░│                  │█│░│░│                    │
│   └─┴─┴─┴─┴─┘                  └─┴─┴─┘                    │
│                                                             │
│   If Service A hangs, only 5 threads blocked               │
│   Service B continues with its own 3 threads               │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 2. Semaphore Isolation
Limits concurrent executions without dedicated threads.

```
┌────────────────────────────────────────────────────────────┐
│                   Semaphore Bulkhead                        │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   Semaphore: permits=5, current=3                          │
│                                                             │
│   Request 1: acquire() → ✓ (permits=2)                     │
│   Request 2: acquire() → ✓ (permits=1)                     │
│   Request 3: acquire() → ✓ (permits=0)                     │
│   Request 4: acquire() → BLOCKED (queue) or REJECTED       │
│                                                             │
│   Request 1: release() → ✓ (permits=1)                     │
│   Request 4: acquire() → ✓ (permits=0)                     │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 3. Tier-Based Bulkheads (Recommended for Multi-Agent)
Group operations by criticality.

```
┌────────────────────────────────────────────────────────────┐
│                    Tier-Based Bulkheads                     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   TIER 1: CRITICAL (50% resources)                         │
│   ├── Synthesis node                                        │
│   ├── Quality gate                                          │
│   └── User-facing responses                                 │
│                                                             │
│   TIER 2: STANDARD (35% resources)                         │
│   ├── Content analysis agents                               │
│   ├── Data processing                                       │
│   └── API integrations                                      │
│                                                             │
│   TIER 3: OPTIONAL (15% resources)                         │
│   ├── Enrichment                                            │
│   ├── Caching warmup                                        │
│   └── Analytics                                             │
│                                                             │
│   When Tier 3 exhausted → operations queued/dropped         │
│   Tier 1 & 2 continue unaffected                           │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

## Configuration for OrchestKit

### Agent Tier Assignment

| Tier | Agents | Max Concurrent | Queue Size | Timeout |
|------|--------|----------------|------------|---------|
| 1 (Critical) | synthesis, quality_gate, supervisor | 5 | 10 | 300s |
| 2 (Standard) | tech_comparator, implementation_planner, security_auditor, learning_synthesizer | 3 | 5 | 120s |
| 3 (Optional) | enrichment, cache_warming, metrics | 2 | 3 | 60s |

### Rejection Policies

```python
class RejectionPolicy(Enum):
    ABORT = "abort"           # Return error immediately
    CALLER_RUNS = "caller"    # Execute in caller's context (blocking)
    DISCARD = "discard"       # Silently drop (for optional ops)
    QUEUE = "queue"           # Wait in bounded queue

# Per-tier policies
TIER_POLICIES = {
    1: RejectionPolicy.QUEUE,      # Critical: wait for slot
    2: RejectionPolicy.CALLER_RUNS, # Standard: degrade caller
    3: RejectionPolicy.DISCARD,     # Optional: skip if busy
}
```

## Implementation Pattern (Python asyncio)

```python
from asyncio import Semaphore, wait_for, TimeoutError
from collections import defaultdict
from enum import Enum
from typing import TypeVar, Callable, Awaitable

T = TypeVar("T")

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

    async def execute(self, fn: Callable[[], Awaitable[T]]) -> T:
        # Check queue
        if self.waiting >= self.queue_size:
            raise BulkheadFullError(f"Tier {self.tier.name} queue full")

        self.waiting += 1
        try:
            # Acquire with timeout
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

## Best Practices (2026)

### 1. Size Based on Downstream Capacity
```python
# BAD: Arbitrary numbers
bulkhead = Bulkhead(max_concurrent=100)

# GOOD: Based on downstream limits
# If OpenAI allows 60 RPM, don't have 100 concurrent
bulkhead = Bulkhead(max_concurrent=10)  # 10 concurrent * 6s avg = 60 RPM
```

### 2. Monitor Queue Depth
```python
async def execute_with_metrics(self, fn):
    # Metric: queue depth
    metrics.gauge("bulkhead.queue_depth", self.waiting, tags={"tier": self.tier.name})

    # Metric: active requests
    metrics.gauge("bulkhead.active", self.active, tags={"tier": self.tier.name})

    # Alert when queue consistently > 80% full
    if self.waiting > self.queue_size * 0.8:
        logger.warning(f"Bulkhead queue high", tier=self.tier.name, depth=self.waiting)

    return await self.execute(fn)
```

### 3. Graceful Degradation by Tier
```python
async def run_analysis(content: str) -> Analysis:
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

    # Tier 3: Optional
    try:
        await tier3_bulkhead.execute(
            lambda: warm_cache(results)
        )
    except (BulkheadFullError, BulkheadTimeoutError):
        pass  # Don't even log

    return Analysis(**results)
```

### 4. Dynamic Tier Adjustment
```python
class AdaptiveBulkhead:
    """Adjusts tier capacity based on system load."""

    def adjust_for_load(self, cpu_percent: float, memory_percent: float):
        if cpu_percent > 80 or memory_percent > 85:
            # Reduce optional tier
            self.tiers[Tier.OPTIONAL].max_concurrent = 1
            self.tiers[Tier.STANDARD].max_concurrent = 2
        elif cpu_percent < 50 and memory_percent < 60:
            # Restore capacity
            self.tiers[Tier.OPTIONAL].max_concurrent = 2
            self.tiers[Tier.STANDARD].max_concurrent = 3
```

## Anti-Patterns

### 1. Too Many Bulkheads
```python
# BAD: Bulkhead per endpoint
bulkheads = {
    "/api/v1/users": Bulkhead(5),
    "/api/v1/users/{id}": Bulkhead(5),
    "/api/v1/users/{id}/profile": Bulkhead(5),
    # ... 50 more
}
# Result: Complexity nightmare, no real isolation

# GOOD: Bulkhead per tier/dependency
bulkheads = {
    "database_read": Bulkhead(10),
    "database_write": Bulkhead(3),
    "external_api": Bulkhead(5),
}
```

### 2. Ignoring Rejection Handling
```python
# BAD: Exception bubbles up as 500
@app.post("/analyze")
async def analyze(content: str):
    return await bulkhead.execute(lambda: do_analysis(content))
    # BulkheadFullError → 500 Internal Server Error

# GOOD: Proper error handling
@app.post("/analyze")
async def analyze(content: str):
    try:
        return await bulkhead.execute(lambda: do_analysis(content))
    except BulkheadFullError:
        raise HTTPException(
            status_code=503,
            detail="Service busy, please retry",
            headers={"Retry-After": "30"}
        )
```

### 3. No Correlation with Circuit Breaker
```python
# BAD: Bulkhead fills up, circuit never opens
# All slots blocked on slow service

# GOOD: Combine patterns
@circuit_breaker(failure_threshold=5)
@bulkhead(tier=Tier.STANDARD)
async def call_external_service():
    ...
# Slow calls → timeouts → circuit opens → bulkhead cleared
```

## Monitoring Dashboard

```
┌────────────────────────────────────────────────────────────┐
│                  Bulkhead Status Dashboard                  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   TIER 1: CRITICAL         [████████░░] 8/10 active        │
│   Queue: 2/10              [██░░░░░░░░] 2/10 queued        │
│   Rejected (1h): 0         Timeouts (1h): 1                │
│                                                             │
│   TIER 2: STANDARD         [██████████] 3/3 active ⚠️      │
│   Queue: 5/5 FULL          [██████████] 5/5 queued ⚠️      │
│   Rejected (1h): 23        Timeouts (1h): 5                │
│                                                             │
│   TIER 3: OPTIONAL         [█░░░░░░░░░] 1/2 active         │
│   Queue: 0/3               [░░░░░░░░░░] 0/3 queued         │
│   Rejected (1h): 156       Timeouts (1h): 0                │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

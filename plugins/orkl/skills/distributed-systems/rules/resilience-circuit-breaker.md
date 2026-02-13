---
title: "Resilience: Circuit Breaker"
category: resilience
impact: CRITICAL
---

# Circuit Breaker Pattern

Prevents cascade failures by "tripping" when a downstream service exceeds failure thresholds.

## State Machine

```
              failures >= threshold
    CLOSED --------------------------------> OPEN
       ^                                      |
       |                                      |
       | probe succeeds              timeout  |
       |                              expires |
       |         +-------------+              |
       +---------+  HALF_OPEN  |<-------------+
                 +-------------+
                       |
                       | probe fails
                       v
                     OPEN
```

- **CLOSED**: All requests pass through, failures counted in sliding window
- **OPEN**: All requests rejected immediately, return fallback
- **HALF_OPEN**: Limited probe requests test recovery

## Configuration

| Parameter | Recommended | Description |
|-----------|-------------|-------------|
| `failure_threshold` | 5 | Failures before opening |
| `success_threshold` | 2 | Successes in half-open to close |
| `recovery_timeout` | 30s | Time before half-open transition |
| `sliding_window_size` | 10 | Requests to consider for failure rate |
| `slow_call_threshold` | 5-30s | Calls slower than this count as failures |

## Implementation

```python
from collections import deque
from enum import Enum
from time import time

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

class CircuitBreaker:
    def __init__(self, name: str, failure_threshold: int = 5,
                 recovery_timeout: float = 30.0):
        self.name = name
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time = None
        self._threshold = failure_threshold
        self._recovery_timeout = recovery_timeout

    async def call(self, fn, *args, **kwargs):
        if self._state == CircuitState.OPEN:
            if self._should_attempt_recovery():
                self._state = CircuitState.HALF_OPEN
            else:
                raise CircuitOpenError(self.name)

        try:
            result = await fn(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        if self._state == CircuitState.HALF_OPEN:
            self._success_count += 1
            if self._success_count >= 2:
                self._state = CircuitState.CLOSED
                self._failure_count = 0

    def _on_failure(self):
        self._last_failure_time = time()
        if self._state == CircuitState.HALF_OPEN:
            self._state = CircuitState.OPEN
        else:
            self._failure_count += 1
            if self._failure_count >= self._threshold:
                self._state = CircuitState.OPEN
```

## Best Practices

1. **Use sliding windows, not fixed counters** -- one success should not reset everything
2. **Per-service breakers** -- never use a single global breaker
3. **Always provide fallbacks** -- cached data, default response, or partial results
4. **Separate health from circuit state** -- `/health` always returns 200
5. **Include observability** -- every state change = metric + log + alert on OPEN

## Pattern Composition

```python
# Retry INSIDE circuit breaker
@circuit_breaker(failure_threshold=5)
@retry(max_attempts=3, backoff=exponential)
async def call_service():
    ...

# Bulkhead + Circuit breaker
@circuit_breaker(service="analysis")
@bulkhead(tier=Tier.STANDARD, max_concurrent=3)
async def analyze():
    ...
```

## Presets by Service Type

| Service | Threshold | Recovery | Slow Call |
|---------|-----------|----------|-----------|
| LLM API | 3 | 60s | 30s |
| External API | 5 | 30s | 10s |
| Database | 2-3 | 15s | 5s |

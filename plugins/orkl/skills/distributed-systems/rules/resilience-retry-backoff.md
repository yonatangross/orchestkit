---
title: "Resilience: Retry & Backoff"
category: resilience
impact: CRITICAL
impactDescription: "Ensures safe retries using exponential backoff with jitter to prevent thundering herd and classify retryable errors"
tags: resilience, retry, backoff, jitter, errors
---

# Retry with Exponential Backoff

## Backoff Formula

```
delay = min(base * 2^attempt, max_delay)
jitter = random(0, delay)   # Full jitter (recommended)
sleep(jitter)
```

| Attempt | Base Delay | With Full Jitter |
|---------|-----------|------------------|
| 1 | 1s | 0.0s - 1.0s |
| 2 | 2s | 0.0s - 2.0s |
| 3 | 4s | 0.0s - 4.0s |
| 4 | 8s | 0.0s - 8.0s |

Full jitter prevents thundering herd when many clients retry simultaneously.

## Error Classification

```python
RETRYABLE_ERRORS = {
    # HTTP Status Codes
    408, 429, 500, 502, 503, 504,
    # Python Exceptions
    ConnectionError, TimeoutError, ConnectionResetError,
    # LLM API Errors
    "rate_limit_exceeded", "model_overloaded", "server_error",
}

NON_RETRYABLE_ERRORS = {
    400, 401, 403, 404, 422,
    "invalid_api_key", "content_policy_violation",
    "invalid_request_error", "model_not_found",
}
```

## Retry Decorator

```python
import asyncio
import random
from functools import wraps

def retry(max_attempts=3, base_delay=1.0, max_delay=60.0, jitter=True):
    """Async retry with exponential backoff."""
    def decorator(fn):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            for attempt in range(1, max_attempts + 1):
                try:
                    return await fn(*args, **kwargs)
                except Exception as e:
                    if not is_retryable(e) or attempt == max_attempts:
                        raise
                    delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
                    if jitter:
                        delay = random.uniform(0, delay)
                    await asyncio.sleep(delay)
        return wrapper
    return decorator
```

## Retry with Content Truncation (LLM)

```python
async def retry_with_truncation(fn, content: str, max_attempts: int = 3):
    """Retry LLM call, truncating on context_length_exceeded."""
    for attempt in range(1, max_attempts + 1):
        try:
            return await fn(content)
        except ContextLengthExceededError:
            if attempt == max_attempts:
                raise
            content = content[:int(len(content) * 0.75)]
```

## Retry Budget

Prevents retry storms by limiting total retries per time window.

```python
class RetryBudget:
    def __init__(self, budget_per_second: float = 10.0):
        self.budget = budget_per_second
        self.last_update = time.time()

    def can_retry(self) -> bool:
        self._replenish()
        return self.budget >= 1.0

    def use_retry(self):
        if self.budget >= 1.0:
            self.budget -= 1.0
```

## Presets

| Use Case | Max Attempts | Base Delay | Max Delay |
|----------|-------------|-----------|-----------|
| User-facing API | 2 | 0.5s | 2s |
| Background job | 5 | 2.0s | 60s |
| LLM API call | 3 | 1.0s | 60s |
| Rate-limited API | 3 | 2.0s | 120s |

## Critical Rules

1. **Always use jitter** -- prevents thundering herd
2. **Classify errors** -- never retry 401/403/404
3. **Bound retries** -- max 3-5 attempts, never infinite
4. **Retry inside circuit breaker** -- circuit only sees final result
5. **Use Retry-After header** -- respect server's backoff request
6. **Log all retries** -- include trace ID for correlation

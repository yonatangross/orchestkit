# Retry Strategies

## Overview

Retry strategies handle transient failures by automatically re-attempting operations. The key is knowing **when** to retry, **how long** to wait, and **when to give up**.

## Core Concepts

### Exponential Backoff with Jitter

```
┌────────────────────────────────────────────────────────────┐
│              Exponential Backoff + Full Jitter             │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   Attempt  Base Delay   With Jitter (random 0-base)        │
│   ───────  ──────────   ─────────────────────────          │
│      1        1s              0.0s - 1.0s                  │
│      2        2s              0.0s - 2.0s                  │
│      3        4s              0.0s - 4.0s                  │
│      4        8s              0.0s - 8.0s                  │
│      5       16s              0.0s - 16.0s                 │
│                                                             │
│   Formula: sleep = random(0, min(cap, base * 2^attempt))   │
│                                                             │
│   Full jitter prevents thundering herd when many clients   │
│   retry simultaneously after an outage.                    │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### Jitter Strategies

| Strategy | Formula | Use Case |
|----------|---------|----------|
| No jitter | `base * 2^attempt` | Testing only |
| Full jitter | `random(0, base * 2^attempt)` | Most common, best distribution |
| Equal jitter | `(base * 2^attempt)/2 + random(0, (base * 2^attempt)/2)` | When min delay needed |
| Decorrelated | `random(base, prev_delay * 3)` | Aggressive retry scenarios |

## Error Classification

### Retryable Errors

```python
RETRYABLE_ERRORS = {
    # HTTP Status Codes
    408: "Request Timeout",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",

    # Python Exceptions
    ConnectionError,
    TimeoutError,
    ConnectionResetError,
    BrokenPipeError,

    # LLM API Errors
    "rate_limit_exceeded",
    "model_overloaded",
    "server_error",
    "timeout",
    "context_length_exceeded",  # Retry with truncation
}

def is_retryable(error: Exception) -> bool:
    # HTTP errors
    if hasattr(error, "status_code"):
        return error.status_code in RETRYABLE_ERRORS

    # Exception types
    if type(error) in RETRYABLE_ERRORS:
        return True

    # LLM API error codes
    if hasattr(error, "code"):
        return error.code in RETRYABLE_ERRORS

    return False
```

### Non-Retryable Errors

```python
NON_RETRYABLE_ERRORS = {
    # HTTP Status Codes
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    422: "Unprocessable Entity",

    # LLM API Errors
    "invalid_api_key",
    "invalid_request_error",
    "content_policy_violation",
    "model_not_found",
    "insufficient_quota",
}
```

## Implementation Patterns

### Basic Retry Decorator

```python
import asyncio
import random
from functools import wraps
from typing import TypeVar, Callable, Awaitable, Set, Type

T = TypeVar("T")

def retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    retryable_exceptions: Set[Type[Exception]] = None,
):
    """Async retry decorator with exponential backoff."""

    retryable = retryable_exceptions or {Exception}

    def decorator(fn: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        @wraps(fn)
        async def wrapper(*args, **kwargs) -> T:
            last_exception = None

            for attempt in range(1, max_attempts + 1):
                try:
                    return await fn(*args, **kwargs)
                except tuple(retryable) as e:
                    last_exception = e

                    if attempt == max_attempts:
                        raise

                    # Calculate delay
                    delay = min(base_delay * (exponential_base ** (attempt - 1)), max_delay)

                    # Apply jitter
                    if jitter:
                        delay = random.uniform(0, delay)

                    logger.warning(
                        f"Retry {attempt}/{max_attempts} after {delay:.2f}s",
                        error=str(e),
                        function=fn.__name__,
                    )

                    await asyncio.sleep(delay)

            raise last_exception

        return wrapper
    return decorator
```

### Retry with Modification

```python
async def retry_with_truncation(
    fn: Callable[[str], Awaitable[T]],
    content: str,
    max_attempts: int = 3,
) -> T:
    """Retry LLM call, truncating content on context_length_exceeded."""

    for attempt in range(1, max_attempts + 1):
        try:
            return await fn(content)
        except ContextLengthExceededError:
            if attempt == max_attempts:
                raise

            # Truncate content by 25% each retry
            truncate_to = int(len(content) * 0.75)
            content = content[:truncate_to]

            logger.warning(
                f"Truncating content to {truncate_to} chars",
                attempt=attempt,
            )
```

### Retry Budget

```python
class RetryBudget:
    """Limits total retries across all calls to prevent retry storms."""

    def __init__(
        self,
        budget_per_second: float = 10.0,
        min_retries_per_second: float = 1.0,
    ):
        self.budget = budget_per_second
        self.min_budget = min_retries_per_second
        self.last_update = time.time()

    def can_retry(self) -> bool:
        self._replenish()
        return self.budget >= 1.0

    def use_retry(self):
        if self.budget >= 1.0:
            self.budget -= 1.0

    def _replenish(self):
        now = time.time()
        elapsed = now - self.last_update
        self.budget = min(
            self.budget + elapsed * self.min_budget,
            10.0  # Max budget
        )
        self.last_update = now
```

## Best Practices (2026)

### 1. Set Appropriate Limits
```python
# BAD: Too many retries
@retry(max_attempts=10, base_delay=0.1)  # 10 retries in ~3s = hammering

# GOOD: Reasonable limits
@retry(max_attempts=3, base_delay=1.0, max_delay=30.0)
```

### 2. Always Use Jitter
```python
# BAD: No jitter (thundering herd)
delay = base * 2 ** attempt  # All clients retry at same time

# GOOD: Full jitter
delay = random.uniform(0, base * 2 ** attempt)  # Spread retries
```

### 3. Different Strategies per Operation
```python
# Fast-fail for user-facing
@retry(max_attempts=2, base_delay=0.5, max_delay=2.0)
async def get_user_data():
    ...

# More patient for background jobs
@retry(max_attempts=5, base_delay=2.0, max_delay=60.0)
async def sync_data():
    ...
```

### 4. Log All Retries
```python
async def retry_with_logging(fn, *args, **kwargs):
    for attempt in range(1, max_attempts + 1):
        try:
            return await fn(*args, **kwargs)
        except RetryableError as e:
            logger.warning(
                "Retry attempt",
                attempt=attempt,
                max_attempts=max_attempts,
                error_type=type(e).__name__,
                error_message=str(e),
                function=fn.__name__,
                # Include trace ID for correlation
                trace_id=get_current_trace_id(),
            )
            await asyncio.sleep(calculate_delay(attempt))
```

### 5. Combine with Circuit Breaker
```python
# Retry INSIDE circuit breaker
# Circuit only counts final failures after retries exhausted

@circuit_breaker(failure_threshold=5)
@retry(max_attempts=3)
async def call_external_api():
    ...

# NOT the other way around:
# @retry  # Would retry when circuit is open!
# @circuit_breaker
```

## Anti-Patterns

### 1. Retrying Non-Retryable Errors
```python
# BAD: Retry everything
@retry(max_attempts=5, retryable_exceptions={Exception})
async def call_api():
    ...  # Will retry 401 Unauthorized 5 times!

# GOOD: Specific exceptions
@retry(
    max_attempts=3,
    retryable_exceptions={
        ConnectionError,
        TimeoutError,
        RateLimitError,
    }
)
```

### 2. No Backoff
```python
# BAD: Fixed delay
for attempt in range(5):
    try:
        return await call()
    except Exception:
        await asyncio.sleep(1)  # Same delay every time

# GOOD: Exponential backoff
for attempt in range(5):
    try:
        return await call()
    except Exception:
        await asyncio.sleep(2 ** attempt)  # 1, 2, 4, 8, 16
```

### 3. Infinite Retries
```python
# BAD: Never gives up
while True:
    try:
        return await call()
    except Exception:
        await asyncio.sleep(1)

# GOOD: Bounded retries
for attempt in range(max_attempts):
    ...
raise MaxRetriesExceeded()
```

## LLM-Specific Retry Strategies

### Rate Limit Handling
```python
async def call_llm_with_rate_limit_handling(prompt: str) -> str:
    for attempt in range(3):
        try:
            return await llm.complete(prompt)
        except RateLimitError as e:
            # Use retry-after header if provided
            retry_after = e.headers.get("retry-after", 60)
            logger.warning(f"Rate limited, waiting {retry_after}s")
            await asyncio.sleep(int(retry_after))

    raise MaxRetriesExceeded("Rate limit persists after retries")
```

### Context Length Handling
```python
async def call_with_context_management(prompt: str, max_tokens: int = 4096) -> str:
    for attempt in range(3):
        try:
            return await llm.complete(prompt, max_tokens=max_tokens)
        except ContextLengthExceededError:
            # Reduce by 25% each attempt
            prompt = truncate_prompt(prompt, ratio=0.75 ** attempt)
            logger.warning(f"Truncated prompt to {len(prompt)} chars")

    raise ContextLengthExceededError("Cannot fit in context after truncation")
```

## Monitoring

```promql
# Retry rate
rate(retries_total[5m])

# Retry success rate (retries that eventually succeed)
sum(rate(retry_success_total[5m])) / sum(rate(retries_total[5m]))

# Average attempts before success
histogram_quantile(0.95, retry_attempts_bucket)

# Retry budget utilization
retry_budget_used / retry_budget_total
```

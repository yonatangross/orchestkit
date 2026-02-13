# Error Classification

## Overview

Proper error classification is the foundation of resilience. Different errors require different handling strategies: retry, fallback, fail fast, or alert.

## Error Classification Matrix

```
┌────────────────────────────────────────────────────────────────────┐
│                       Error Classification Matrix                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                    TRANSIENT                 PERMANENT              │
│              ┌─────────────────────┬─────────────────────┐         │
│              │                     │                     │         │
│   EXTERNAL   │  • Rate limits      │  • Invalid API key  │         │
│   (API/Net)  │  • Timeouts         │  • 403 Forbidden    │         │
│              │  • 502/503/504      │  • 404 Not Found    │         │
│              │  • Connection reset │  • 400 Bad Request  │         │
│              │                     │                     │         │
│              │  ACTION: Retry      │  ACTION: Fail Fast  │         │
│              │  with backoff       │  Log & Alert        │         │
│              │                     │                     │         │
│              ├─────────────────────┼─────────────────────┤         │
│              │                     │                     │         │
│   INTERNAL   │  • DB connection    │  • Schema error     │         │
│   (System)   │  • Memory pressure  │  • Logic bug        │         │
│              │  • Lock contention  │  • Missing config   │         │
│              │  • Resource exhaust │  • Invalid state    │         │
│              │                     │                     │         │
│              │  ACTION: Retry      │  ACTION: Fail Fast  │         │
│              │  Circuit breaker    │  Fix code, restart  │         │
│              │                     │                     │         │
│              └─────────────────────┴─────────────────────┘         │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

## HTTP Status Code Classification

### Retryable (Transient)

| Code | Name | Strategy |
|------|------|----------|
| 408 | Request Timeout | Retry immediately |
| 429 | Too Many Requests | Retry with Retry-After header |
| 500 | Internal Server Error | Retry with backoff |
| 502 | Bad Gateway | Retry with backoff |
| 503 | Service Unavailable | Retry with Retry-After |
| 504 | Gateway Timeout | Retry with backoff |

### Non-Retryable (Permanent)

| Code | Name | Strategy |
|------|------|----------|
| 400 | Bad Request | Log, fix input, fail |
| 401 | Unauthorized | Refresh token or fail |
| 403 | Forbidden | Fail, alert |
| 404 | Not Found | Fail (resource doesn't exist) |
| 405 | Method Not Allowed | Fail, fix code |
| 409 | Conflict | May retry with merge logic |
| 422 | Unprocessable Entity | Fail, fix input |

## LLM API Error Classification

### OpenAI Errors

```python
OPENAI_RETRYABLE = {
    "rate_limit_exceeded",     # Retry with backoff
    "server_error",            # Retry with backoff
    "timeout",                 # Retry immediately
    "overloaded",              # Retry with longer backoff
}

OPENAI_NON_RETRYABLE = {
    "invalid_api_key",         # Fix config
    "invalid_request_error",   # Fix request
    "context_length_exceeded", # Reduce input (special handling)
    "content_policy_violation",# Change content
    "insufficient_quota",      # Add credits
    "model_not_found",         # Fix model name
}
```

### Anthropic Errors

```python
ANTHROPIC_RETRYABLE = {
    "overloaded_error",        # Retry with backoff
    "api_error",               # Retry with backoff
    "rate_limit_error",        # Retry with Retry-After
}

ANTHROPIC_NON_RETRYABLE = {
    "authentication_error",    # Fix API key
    "permission_error",        # Check permissions
    "invalid_request_error",   # Fix request format
    "not_found_error",         # Fix resource reference
}
```

## Exception Classification Helper

```python
from enum import Enum
from typing import Union, Type
import httpx

class ErrorCategory(Enum):
    RETRYABLE = "retryable"           # Transient, retry with backoff
    NON_RETRYABLE = "non_retryable"   # Permanent, fail fast
    CIRCUIT_TRIP = "circuit_trip"     # Count toward circuit breaker
    ALERTABLE = "alertable"           # Should trigger alert
    DEGRADABLE = "degradable"         # Can fall back to alternative

class ErrorClassifier:
    """Classify errors for resilience handling."""

    RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}
    NON_RETRYABLE_STATUS_CODES = {400, 401, 403, 404, 405, 422}
    ALERTABLE_STATUS_CODES = {401, 403, 500}

    RETRYABLE_EXCEPTIONS = {
        ConnectionError,
        TimeoutError,
        ConnectionResetError,
        ConnectionRefusedError,
        BrokenPipeError,
        httpx.ConnectError,
        httpx.ConnectTimeout,
        httpx.ReadTimeout,
    }

    def classify(self, error: Exception) -> set[ErrorCategory]:
        """Return set of applicable error categories."""
        categories = set()

        # HTTP errors
        if hasattr(error, "status_code"):
            code = error.status_code
            if code in self.RETRYABLE_STATUS_CODES:
                categories.add(ErrorCategory.RETRYABLE)
            if code in self.NON_RETRYABLE_STATUS_CODES:
                categories.add(ErrorCategory.NON_RETRYABLE)
            if code in self.ALERTABLE_STATUS_CODES:
                categories.add(ErrorCategory.ALERTABLE)
            if code >= 500:
                categories.add(ErrorCategory.CIRCUIT_TRIP)

        # Exception types
        if type(error) in self.RETRYABLE_EXCEPTIONS:
            categories.add(ErrorCategory.RETRYABLE)
            categories.add(ErrorCategory.CIRCUIT_TRIP)

        # LLM-specific errors
        if hasattr(error, "code"):
            categories.update(self._classify_llm_error(error.code))

        # Default: non-retryable if nothing matched
        if not categories:
            categories.add(ErrorCategory.NON_RETRYABLE)
            categories.add(ErrorCategory.ALERTABLE)

        return categories

    def _classify_llm_error(self, error_code: str) -> set[ErrorCategory]:
        """Classify LLM API error codes."""
        categories = set()

        retryable_codes = {
            "rate_limit_exceeded", "server_error", "timeout",
            "overloaded", "overloaded_error", "api_error",
        }

        if error_code in retryable_codes:
            categories.add(ErrorCategory.RETRYABLE)
            categories.add(ErrorCategory.CIRCUIT_TRIP)
        else:
            categories.add(ErrorCategory.NON_RETRYABLE)

        if error_code in {"context_length_exceeded"}:
            categories.add(ErrorCategory.DEGRADABLE)

        return categories

    def should_retry(self, error: Exception) -> bool:
        """Quick check if error should be retried."""
        return ErrorCategory.RETRYABLE in self.classify(error)

    def should_trip_circuit(self, error: Exception) -> bool:
        """Check if error should count toward circuit breaker."""
        return ErrorCategory.CIRCUIT_TRIP in self.classify(error)

    def should_alert(self, error: Exception) -> bool:
        """Check if error should trigger an alert."""
        return ErrorCategory.ALERTABLE in self.classify(error)
```

## Usage in Resilience Patterns

### With Retry

```python
classifier = ErrorClassifier()

async def call_with_smart_retry(fn, *args, **kwargs):
    for attempt in range(max_attempts):
        try:
            return await fn(*args, **kwargs)
        except Exception as e:
            categories = classifier.classify(e)

            if ErrorCategory.NON_RETRYABLE in categories:
                logger.error(f"Non-retryable error: {e}")
                raise

            if ErrorCategory.ALERTABLE in categories:
                await alert_service.send(
                    severity="warning",
                    message=f"Retryable error in {fn.__name__}",
                    error=str(e),
                )

            if attempt < max_attempts - 1:
                await asyncio.sleep(backoff(attempt))

    raise MaxRetriesExceeded()
```

### With Circuit Breaker

```python
class SmartCircuitBreaker:
    def __init__(self, classifier: ErrorClassifier):
        self.classifier = classifier
        self.failure_count = 0

    async def call(self, fn, *args, **kwargs):
        try:
            result = await fn(*args, **kwargs)
            self.failure_count = 0
            return result
        except Exception as e:
            if self.classifier.should_trip_circuit(e):
                self.failure_count += 1
                if self.failure_count >= self.threshold:
                    self.open_circuit()
            raise
```

### With Fallback

```python
async def call_with_fallback(primary_fn, fallback_fn, *args):
    try:
        return await primary_fn(*args)
    except Exception as e:
        categories = classifier.classify(e)

        if ErrorCategory.DEGRADABLE in categories:
            logger.info(f"Degrading to fallback: {e}")
            return await fallback_fn(*args)

        raise
```

## Error Context Enrichment

```python
class EnrichedError(Exception):
    """Exception with classification and context."""

    def __init__(
        self,
        original: Exception,
        classifier: ErrorClassifier,
        context: dict = None,
    ):
        self.original = original
        self.categories = classifier.classify(original)
        self.context = context or {}
        self.timestamp = datetime.now(UTC)
        self.trace_id = get_current_trace_id()

        super().__init__(str(original))

    @property
    def is_retryable(self) -> bool:
        return ErrorCategory.RETRYABLE in self.categories

    @property
    def should_alert(self) -> bool:
        return ErrorCategory.ALERTABLE in self.categories

    def to_dict(self) -> dict:
        return {
            "error": str(self.original),
            "type": type(self.original).__name__,
            "categories": [c.value for c in self.categories],
            "context": self.context,
            "timestamp": self.timestamp.isoformat(),
            "trace_id": self.trace_id,
        }
```

## Best Practices

1. **Default to non-retryable**: Unknown errors should fail fast
2. **Log all classifications**: Helps tune classification rules
3. **Include context**: Error classification without context is useless
4. **Review regularly**: New error types emerge, update rules
5. **Test classification**: Unit test your classification logic

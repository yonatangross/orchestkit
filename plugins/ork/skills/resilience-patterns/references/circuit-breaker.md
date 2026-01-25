# Circuit Breaker Pattern

## Overview

The circuit breaker pattern prevents cascade failures by "tripping" when a downstream service exceeds failure thresholds. Named after electrical circuit breakers, it protects your system from repeated failures.

## States

### CLOSED (Normal Operation)
- All requests pass through
- Failures are counted within a sliding window
- Success resets failure count (or decrements in sliding window)
- Transitions to OPEN when failures >= threshold

### OPEN (Failing Fast)
- All requests immediately rejected
- Returns fallback response or error
- No calls made to downstream service
- After `recovery_timeout`, transitions to HALF_OPEN

### HALF_OPEN (Recovery Probe)
- Limited requests allowed (probe requests)
- If probe succeeds → CLOSED
- If probe fails → OPEN (reset recovery timer)

## State Machine

```
              failures >= threshold
    CLOSED ──────────────────────────────▶ OPEN
       ▲                                      │
       │                                      │
       │ probe succeeds              timeout  │
       │                              expires │
       │         ┌─────────────┐             │
       └─────────│  HALF_OPEN  │◀────────────┘
                 └─────────────┘
                       │
                       │ probe fails
                       ▼
                     OPEN
```

## Configuration Parameters

| Parameter | Recommended | Description |
|-----------|-------------|-------------|
| `failure_threshold` | 5 | Failures before opening |
| `success_threshold` | 2 | Successes in half-open to close |
| `recovery_timeout` | 30s | Time before half-open transition |
| `sliding_window_size` | 10 | Requests to consider for failure rate |
| `sliding_window_type` | count-based | count-based or time-based (60s) |
| `slow_call_threshold` | 5s | Calls slower than this count as failures |
| `slow_call_rate` | 50% | Percentage of slow calls to trip |

## Best Practices (2026)

### 1. Use Sliding Windows, Not Fixed Counters
```python
# BAD: Fixed counter resets on success
if failures >= 5:
    open_circuit()
if success:
    failures = 0  # One success resets everything!

# GOOD: Sliding window with time decay
window = deque(maxlen=10)
window.append(("fail", time.time()))
failure_rate = sum(1 for r, _ in window if r == "fail") / len(window)
if failure_rate >= 0.5:
    open_circuit()
```

### 2. Separate Health Checks from Circuit State
```python
# Health endpoint should NOT check circuit state
@app.get("/health")
async def health():
    return {"status": "healthy"}  # Always returns 200

# Readiness endpoint CAN check circuit state
@app.get("/ready")
async def ready():
    if circuit.is_open:
        return {"status": "degraded", "reason": "circuit_open"}, 503
    return {"status": "ready"}
```

### 3. Include Observability
```python
def on_state_change(from_state: str, to_state: str, service: str):
    # Metric
    metrics.increment(f"circuit_breaker.{service}.state_change",
                      tags={"from": from_state, "to": to_state})

    # Log
    logger.warning(f"Circuit breaker state change",
                   service=service, from_state=from_state, to_state=to_state)

    # Alert (only on OPEN)
    if to_state == "OPEN":
        alert_service.send(
            severity="warning",
            message=f"Circuit breaker opened for {service}",
            runbook="https://docs.internal/runbooks/circuit-breaker"
        )
```

### 4. Provide Meaningful Fallbacks
```python
async def get_analysis_with_fallback(content: str) -> Analysis:
    try:
        return await circuit_breaker.call(analyze_content, content)
    except CircuitOpenError:
        # Fallback 1: Cached result
        cached = await cache.get(f"analysis:{hash(content)}")
        if cached:
            return Analysis.from_cache(cached, is_stale=True)

        # Fallback 2: Simplified analysis
        return Analysis(
            status="degraded",
            message="Full analysis unavailable, showing basic info",
            basic_info=extract_basic_info(content)
        )
```

### 5. Per-Service Breakers
```python
# BAD: Single breaker for all services
global_breaker = CircuitBreaker()

# GOOD: Per-service breakers
breakers = {
    "openai": CircuitBreaker(failure_threshold=3, recovery_timeout=60),
    "anthropic": CircuitBreaker(failure_threshold=5, recovery_timeout=30),
    "youtube_api": CircuitBreaker(failure_threshold=10, recovery_timeout=120),
}
```

## Anti-Patterns

### 1. Opening Too Quickly
```python
# BAD: Opens on first failure
CircuitBreaker(failure_threshold=1)  # One blip = outage

# GOOD: Tolerates transient failures
CircuitBreaker(failure_threshold=5, sliding_window_size=10)
```

### 2. Recovery Timeout Too Short
```python
# BAD: Hammers failing service
CircuitBreaker(recovery_timeout=5)  # Tries every 5 seconds

# GOOD: Gives service time to recover
CircuitBreaker(recovery_timeout=30)  # 30 seconds minimum
```

### 3. No Fallback
```python
# BAD: Just throws error
async def call():
    if circuit.is_open:
        raise CircuitOpenError()  # User sees error page

# GOOD: Graceful degradation
async def call():
    if circuit.is_open:
        return await fallback_handler()  # User sees partial data
```

## Integration with Other Patterns

### Circuit Breaker + Retry
```python
# Retry INSIDE circuit breaker
@circuit_breaker
@retry(max_attempts=3, backoff=exponential)
async def call_service():
    ...

# Circuit only sees final result after retries exhausted
```

### Circuit Breaker + Bulkhead
```python
# Bulkhead limits concurrency, circuit limits failures
@circuit_breaker(service="analysis")
@bulkhead(tier=2, max_concurrent=3)
async def analyze():
    ...
```

### Circuit Breaker + Timeout
```python
# Timeout INSIDE circuit breaker
@circuit_breaker
@timeout(seconds=30)
async def call_service():
    ...

# Timeout counts as failure toward circuit threshold
```

## Monitoring Queries

### Prometheus
```promql
# Circuit state changes per minute
rate(circuit_breaker_state_changes_total[5m])

# Percentage of time in OPEN state
avg_over_time(circuit_breaker_state{state="open"}[1h])

# Requests rejected due to open circuit
rate(circuit_breaker_rejected_total[5m])
```

### Langfuse (LLM-specific)
```python
# Tag traces with circuit state
trace.update(metadata={
    "circuit_state": circuit.state,
    "circuit_failure_count": circuit.failure_count,
})
```

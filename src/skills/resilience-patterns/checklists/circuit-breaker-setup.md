# Circuit Breaker Setup Guide

Step-by-step guide for adding circuit breakers to a service.

## Step 1: Identify Services

List all external dependencies that need circuit breakers:

```
┌─────────────────────────────────────────────────────────────┐
│ Service Inventory                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ External APIs:                                               │
│ □ OpenAI API (LLM)                                          │
│ □ Anthropic API (LLM)                                       │
│ □ YouTube Data API                                          │
│ □ GitHub API                                                │
│ □ arXiv API                                                 │
│                                                              │
│ Internal Services:                                           │
│ □ Embedding service                                         │
│ □ Database (PostgreSQL)                                     │
│ □ Redis cache                                               │
│ □ Semantic search                                           │
│                                                              │
│ For each, answer:                                            │
│ 1. What's the expected failure rate?                        │
│ 2. How long does recovery typically take?                   │
│ 3. What's the fallback behavior?                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Step 2: Configure Thresholds

### Failure Threshold

| Service Type | Recommended | Reasoning |
|--------------|-------------|-----------|
| LLM API | 3 | APIs can be unstable, fail fast |
| External API | 5 | More tolerant of transient issues |
| Database | 2-3 | DB issues usually need immediate attention |
| Internal service | 3-5 | Depends on service criticality |

### Recovery Timeout

| Service Type | Recommended | Reasoning |
|--------------|-------------|-----------|
| LLM API | 60s | Rate limits typically reset in minutes |
| External API | 30-120s | Depends on SLA |
| Database | 15-30s | Should recover quickly |
| Internal service | 15-60s | Depends on restart time |

### Slow Call Threshold

| Service Type | Recommended | Reasoning |
|--------------|-------------|-----------|
| LLM API | 30s | LLM calls can be slow |
| External API | 10s | Most APIs should be fast |
| Database | 5s | DB queries should be optimized |
| Internal service | 5-10s | Depends on operation |

## Step 3: Implement Circuit Breaker

### Basic Implementation

```python
from resilience import CircuitBreaker, CircuitBreakerFactory

# Option 1: Use factory for common patterns
openai_breaker = CircuitBreakerFactory.for_llm_api("openai")
db_breaker = CircuitBreakerFactory.for_database("postgres")

# Option 2: Custom configuration
custom_breaker = CircuitBreaker(
    name="my-service",
    failure_threshold=5,
    success_threshold=2,
    recovery_timeout=30.0,
    slow_call_threshold=10.0,
)
```

### Wrap Service Calls

```python
# Method 1: Decorator
@openai_breaker
async def call_openai(prompt: str) -> str:
    return await openai_client.complete(prompt)

# Method 2: Explicit call
async def call_openai(prompt: str) -> str:
    return await openai_breaker.call(
        openai_client.complete,
        prompt,
    )
```

## Step 4: Add Fallback Handling

```python
from resilience import CircuitOpenError

async def analyze_with_fallback(content: str) -> Analysis:
    try:
        return await circuit_breaker.call(primary_analysis, content)

    except CircuitOpenError as e:
        logger.warning(
            f"Circuit open for {e.name}, using fallback",
            time_until_recovery=e.time_until_recovery,
        )

        # Fallback 1: Try cache
        cached = await cache.get(f"analysis:{hash(content)}")
        if cached:
            return Analysis.from_cache(cached, is_stale=True)

        # Fallback 2: Degraded response
        return Analysis(
            status="degraded",
            message="Full analysis temporarily unavailable",
            basic_info=extract_basic_info(content),
        )
```

## Step 5: Add Observability

### Logging

```python
def setup_circuit_logging(breaker: CircuitBreaker):
    def on_state_change(old: str, new: str, name: str):
        logger.warning(
            "circuit_state_change",
            circuit=name,
            old_state=old,
            new_state=new,
        )

        if new == "open":
            # Send alert
            alerting.send(
                severity="warning",
                message=f"Circuit {name} opened",
                runbook="https://docs/runbooks/circuit-breaker",
            )

    breaker._on_state_change = on_state_change
```

### Metrics

```python
from prometheus_client import Gauge, Counter

circuit_state = Gauge(
    "circuit_breaker_state",
    "Circuit breaker state (0=closed, 1=open, 2=half_open)",
    ["service"],
)

circuit_rejections = Counter(
    "circuit_breaker_rejections_total",
    "Total requests rejected by circuit breaker",
    ["service"],
)

def update_metrics(breaker: CircuitBreaker):
    state_map = {"closed": 0, "open": 1, "half_open": 2}
    circuit_state.labels(service=breaker.name).set(
        state_map[breaker.state.value]
    )
```

### Health Endpoint

```python
@app.get("/health/circuits")
async def circuit_health():
    return {
        name: {
            "state": cb.state.value,
            "failure_count": cb._failure_count,
            "time_until_recovery": (
                cb._time_until_recovery()
                if cb.state == CircuitState.OPEN
                else None
            ),
        }
        for name, cb in circuit_breakers.items()
    }
```

## Step 6: Test Circuit Behavior

### Unit Tests

```python
@pytest.mark.asyncio
async def test_circuit_opens_on_failures():
    breaker = CircuitBreaker(name="test", failure_threshold=3)

    async def failing_call():
        raise ConnectionError("Failed")

    # Fail 3 times
    for _ in range(3):
        with pytest.raises(ConnectionError):
            await breaker.call(failing_call)

    # Should be open now
    assert breaker.state == CircuitState.OPEN

    # Next call rejected
    with pytest.raises(CircuitOpenError):
        await breaker.call(failing_call)


@pytest.mark.asyncio
async def test_circuit_recovers():
    breaker = CircuitBreaker(
        name="test",
        failure_threshold=1,
        recovery_timeout=0.1,  # Fast for testing
    )

    async def failing_then_succeeding():
        if breaker._failure_count > 0:
            return "success"
        raise ConnectionError("First call fails")

    # Open circuit
    with pytest.raises(ConnectionError):
        await breaker.call(failing_then_succeeding)

    # Wait for recovery
    await asyncio.sleep(0.2)

    # Should succeed now
    result = await breaker.call(failing_then_succeeding)
    assert result == "success"
    assert breaker.state == CircuitState.CLOSED
```

### Integration Tests

```python
@pytest.mark.asyncio
async def test_circuit_isolates_failures():
    """Verify circuit prevents cascade failures."""
    openai_breaker = circuit_breakers["openai"]

    # Simulate OpenAI outage
    with patch("openai.complete", side_effect=ConnectionError):
        # Multiple calls should fail then trip circuit
        for _ in range(5):
            try:
                await analyze_content("test")
            except (ConnectionError, CircuitOpenError):
                pass

    # Circuit should be open
    assert openai_breaker.state == CircuitState.OPEN

    # Anthropic should still work (different circuit)
    anthropic_breaker = circuit_breakers["anthropic"]
    assert anthropic_breaker.state == CircuitState.CLOSED
```

## Step 7: Document and Monitor

### Documentation

Add to your service's README:

```markdown
## Circuit Breakers

| Service | Threshold | Recovery | Fallback |
|---------|-----------|----------|----------|
| openai | 3 failures | 60s | Use gpt-5.2-mini |
| anthropic | 3 failures | 60s | Use cache |
| youtube | 5 failures | 120s | Return partial data |

### Monitoring

- Dashboard: [Grafana Circuit Breakers](...)
- Alerts: PagerDuty channel #resilience
- Runbook: [Circuit Breaker Runbook](...)
```

### Runbook Template

```markdown
## Circuit Breaker Open - {service}

### Symptoms
- Service returning 503 errors
- Alert: "Circuit {service} opened"
- Dashboard shows circuit in OPEN state

### Impact
- {describe impact on users}

### Resolution
1. Check {service} status page
2. Review logs for failure pattern
3. If transient: wait for auto-recovery
4. If persistent: {escalation steps}

### Verification
1. Circuit state returns to CLOSED
2. Service calls succeeding
3. Metrics returning to normal
```

## Quick Reference

```
┌─────────────────────────────────────────────────────────────┐
│ Circuit Breaker Quick Reference                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ CREATE:                                                      │
│   breaker = CircuitBreaker("name", failure_threshold=5)     │
│                                                              │
│ USE:                                                         │
│   @breaker                                                   │
│   async def my_function(): ...                              │
│                                                              │
│   result = await breaker.call(func, *args)                  │
│                                                              │
│ HANDLE:                                                      │
│   try:                                                       │
│       await breaker.call(...)                               │
│   except CircuitOpenError:                                  │
│       return fallback_response()                            │
│                                                              │
│ MONITOR:                                                     │
│   breaker.get_status()                                      │
│   breaker.state == CircuitState.OPEN                        │
│                                                              │
│ RESET (manual):                                              │
│   breaker.reset()                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

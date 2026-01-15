# Logging Patterns

Advanced structured logging patterns for production systems.

## Correlation IDs

**Trace requests across services:**
```python
import structlog
import uuid_utils  # pip install uuid-utils (UUID v7 support for Python < 3.14)

logger = structlog.get_logger()

@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    # Get or generate correlation ID (UUID v7 for time-ordering in distributed traces)
    correlation_id = request.headers.get("X-Correlation-ID") or str(uuid_utils.uuid7())

    # Bind to logger context (all logs in this request will include it)
    structlog.contextvars.bind_contextvars(
        correlation_id=correlation_id,
        method=request.method,
        path=request.url.path
    )

    # Add to response headers
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = correlation_id

    return response
```

**Benefits:**
- Find all logs related to a single request
- Track requests across microservices
- Debug distributed transactions

## Log Sampling

**Problem:** Too many logs in high-traffic endpoints
**Solution:** Sample less critical logs

```python
import random

def should_sample(level: str, rate: float = 0.1) -> bool:
    """Sample logs based on level and rate."""
    if level in ["ERROR", "CRITICAL"]:
        return True  # Always log errors
    return random.random() < rate

# Log 100% of errors, 10% of info
if should_sample("INFO", rate=0.1):
    logger.info("User created", user_id=user.id)
```

**Sampling rates:**
- ERROR/CRITICAL: 100% (always log)
- WARN: 50% (sample half)
- INFO: 10% (sample 10%)
- DEBUG: 1% (sample 1% in production)

## Log Aggregation with Loki

**Loki Query Language (LogQL) examples:**
```logql
# Find all errors in last hour
{app="backend"} |= "ERROR" | json

# Count errors by endpoint
sum by (endpoint) (
  count_over_time({app="backend"} |= "ERROR" [5m])
)

# p95 latency from structured logs
quantile_over_time(0.95,
  {app="backend"}
  | json
  | unwrap duration_ms [5m]
)

# Search for specific correlation ID
{app="backend"} | json | correlation_id="abc-123-def"
```

## SkillForge Logging Example

```python
import structlog
from structlog.processors import JSONRenderer, TimeStamper, add_log_level

# Configure structlog
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,  # Merge correlation IDs
        add_log_level,
        TimeStamper(fmt="iso"),
        JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True
)

logger = structlog.get_logger()

# Usage in workflow
@workflow_node
async def supervisor_node(state: AnalysisState):
    """Route to next agent."""

    # Bind context for all logs in this function
    log = logger.bind(
        correlation_id=state["correlation_id"],
        analysis_id=state["analysis_id"],
        workflow_step="supervisor"
    )

    completed = set(state["agents_completed"])
    available = [a for a in ALL_AGENTS if a not in completed]

    if not available:
        log.info("all_agents_completed", total_findings=len(state["findings"]))
        state["next_node"] = "quality_gate"
    else:
        next_agent = available[0]
        log.info("routing_to_agent", agent=next_agent, remaining=len(available))
        state["next_node"] = next_agent

    return state
```

**Example log output:**
```json
{
  "event": "routing_to_agent",
  "level": "info",
  "timestamp": "2025-01-15T10:30:45.123Z",
  "correlation_id": "abc-123-def",
  "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
  "workflow_step": "supervisor",
  "agent": "tech_comparator",
  "remaining": 7
}
```

See `templates/structured-logging.ts` for Winston setup.
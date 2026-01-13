---
name: Observability & Monitoring
description: Use when adding logging, metrics, tracing, or alerting to applications. Covers structured logging, Prometheus metrics, OpenTelemetry tracing, and alerting strategies.
context: fork
agent: metrics-architect
version: 1.0.0
category: Operations & Reliability
agents: [backend-system-architect, code-quality-reviewer, ai-ml-engineer]
keywords: [observability, monitoring, logging, metrics, tracing, alerts, Prometheus, OpenTelemetry]
author: SkillForge
---

# Observability & Monitoring Skill

Comprehensive frameworks for implementing observability including structured logging, metrics, distributed tracing, and alerting.

## When to Use

- Setting up application monitoring
- Implementing structured logging
- Adding metrics and dashboards
- Configuring distributed tracing
- Creating alerting rules
- Debugging production issues

## Three Pillars of Observability

```
┌─────────────────┬─────────────────┬─────────────────┐
│     LOGS        │     METRICS     │     TRACES      │
├─────────────────┼─────────────────┼─────────────────┤
│ What happened   │ How is system   │ How do requests │
│ at specific     │ performing      │ flow through    │
│ point in time   │ over time       │ services        │
└─────────────────┴─────────────────┴─────────────────┘
```

## Structured Logging

### Log Levels

| Level | Use Case |
|-------|----------|
| **ERROR** | Unhandled exceptions, failed operations |
| **WARN** | Deprecated API, retry attempts |
| **INFO** | Business events, successful operations |
| **DEBUG** | Development troubleshooting |

### Best Practice

```typescript
// Good: Structured with context
logger.info('User action completed', {
  action: 'purchase',
  userId: user.id,
  orderId: order.id,
  duration_ms: 150
});

// Bad: String interpolation
logger.info("User " + user.id + " completed purchase");
```

> See `templates/structured-logging.ts` for Winston setup and request middleware

## Metrics Collection

### RED Method (Rate, Errors, Duration)

Essential metrics for any service:
- **Rate** - Requests per second
- **Errors** - Failed requests per second
- **Duration** - Request latency distribution

### Prometheus Buckets

```typescript
// HTTP request latency
buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]

// Database query latency
buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1]
```

> See `templates/prometheus-metrics.ts` for full metrics configuration

## Distributed Tracing

### OpenTelemetry Setup

Auto-instrument common libraries:
- Express/HTTP
- PostgreSQL
- Redis

### Manual Spans

```typescript
tracer.startActiveSpan('processOrder', async (span) => {
  span.setAttribute('order.id', orderId);
  // ... work
  span.end();
});
```

> See `templates/opentelemetry-tracing.ts` for full setup

## Alerting Strategy

### Severity Levels

| Level | Response Time | Examples |
|-------|---------------|----------|
| **Critical (P1)** | < 15 min | Service down, data loss |
| **High (P2)** | < 1 hour | Major feature broken |
| **Medium (P3)** | < 4 hours | Increased error rate |
| **Low (P4)** | Next day | Warnings |

### Key Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| ServiceDown | `up == 0` for 1m | Critical |
| HighErrorRate | 5xx > 5% for 5m | Critical |
| HighLatency | p95 > 2s for 5m | High |
| LowCacheHitRate | < 70% for 10m | Medium |

> See `templates/alerting-rules.yml` for Prometheus alerting rules

## Health Checks

### Kubernetes Probes

| Probe | Purpose | Endpoint |
|-------|---------|----------|
| **Liveness** | Is app running? | `/health` |
| **Readiness** | Ready for traffic? | `/ready` |
| **Startup** | Finished starting? | `/startup` |

### Readiness Response

```json
{
  "status": "healthy|degraded|unhealthy",
  "checks": {
    "database": { "status": "pass", "latency_ms": 5 },
    "redis": { "status": "pass", "latency_ms": 2 }
  },
  "version": "1.0.0",
  "uptime": 3600
}
```

> See `templates/health-checks.ts` for implementation

## Observability Checklist

### Implementation
- [ ] JSON structured logging
- [ ] Request correlation IDs
- [ ] RED metrics (Rate, Errors, Duration)
- [ ] Business metrics
- [ ] Distributed tracing
- [ ] Health check endpoints

### Alerting
- [ ] Service outage alerts
- [ ] Error rate thresholds
- [ ] Latency thresholds
- [ ] Resource utilization alerts

### Dashboards
- [ ] Service overview
- [ ] Error analysis
- [ ] Performance metrics

---

## Advanced Structured Logging

### Correlation IDs

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

### Log Sampling

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

### Log Aggregation with Loki

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

---

## Metrics Deep Dive

### Metric Types

**1. Counter** - Monotonically increasing value (resets to 0 on restart)
```python
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

# Usage
http_requests_total.labels(method='GET', endpoint='/api/users', status=200).inc()
```

**Use cases:** Request counts, error counts, bytes processed

**2. Gauge** - Value that can go up or down
```python
active_connections = Gauge(
    'active_connections',
    'Number of active database connections'
)

# Usage
active_connections.set(25)  # Set to specific value
active_connections.inc()    # Increment by 1
active_connections.dec()    # Decrement by 1
```

**Use cases:** Queue length, memory usage, temperature

**3. Histogram** - Distribution of values (with buckets)
```python
request_duration = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]  # Important: Choose meaningful buckets!
)

# Usage
with request_duration.labels(method='GET', endpoint='/api/users').time():
    # ... handle request
    pass
```

**Use cases:** Request latency, response size

**4. Summary** - Like Histogram but calculates quantiles on client side
```python
request_duration = Summary(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint']
)
```

**Histogram vs Summary:**
- **Histogram**: Calculate quantiles on Prometheus server (recommended)
- **Summary**: Calculate quantiles on application side (higher client CPU, can't aggregate across instances)

### Cardinality Management

**Problem:** Too many unique label combinations

```python
# ❌ BAD: Unbounded cardinality (user_id can be millions of values)
http_requests_total = Counter(
    'http_requests_total',
    ['method', 'endpoint', 'user_id']  # user_id creates millions of time series!
)

# ✅ GOOD: Bounded cardinality
http_requests_total = Counter(
    'http_requests_total',
    ['method', 'endpoint', 'status']  # Limited to ~10 methods × 100 endpoints × 10 statuses = 10,000 series
)
```

**Cardinality limits:**
- Good: < 10,000 unique time series per metric
- Acceptable: 10,000-100,000
- Bad: > 100,000 (Prometheus performance degrades)

**Rule:** Never use unbounded labels (user IDs, request IDs, timestamps)

### Custom Business Metrics

```python
# LLM token usage
llm_tokens_used = Counter(
    'llm_tokens_used_total',
    'Total LLM tokens consumed',
    ['model', 'operation']  # e.g., model='claude-sonnet', operation='analysis'
)

# LLM cost tracking
llm_cost_dollars = Counter(
    'llm_cost_dollars_total',
    'Total LLM cost in dollars',
    ['model']
)

# Cache hit rate
cache_operations = Counter(
    'cache_operations_total',
    'Cache operations',
    ['operation', 'result']  # operation='get', result='hit|miss'
)

# Cache hit rate query:
# sum(rate(cache_operations_total{result="hit"}[5m])) /
# sum(rate(cache_operations_total[5m]))
```

---

## Distributed Tracing Patterns

### Span Relationships

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

# Parent span
with tracer.start_as_current_span("analyze_content") as parent_span:
    parent_span.set_attribute("content.url", url)
    parent_span.set_attribute("content.type", "article")

    # Child span (sequential)
    with tracer.start_as_current_span("fetch_content") as fetch_span:
        content = await fetch_url(url)
        fetch_span.set_attribute("content.size_bytes", len(content))

    # Another child span (sequential)
    with tracer.start_as_current_span("generate_embedding") as embed_span:
        embedding = await embed_text(content)
        embed_span.set_attribute("embedding.dimensions", len(embedding))

    # Parallel child spans (using asyncio.gather)
    async def analyze_with_span(agent_name: str, content: str):
        with tracer.start_as_current_span(f"agent_{agent_name}"):
            return await agent.analyze(content)

    results = await asyncio.gather(
        analyze_with_span("tech_comparator", content),
        analyze_with_span("security_auditor", content),
        analyze_with_span("implementation_planner", content)
    )
```

### Trace Sampling Strategies

**Head-based sampling** (decide at trace start):
```python
from opentelemetry.sdk.trace.sampling import (
    TraceIdRatioBased,  # Sample X% of traces
    ParentBased,        # Follow parent's sampling decision
    ALWAYS_ON,          # Always sample
    ALWAYS_OFF          # Never sample
)

# Sample 10% of traces
sampler = TraceIdRatioBased(0.1)
```

**Tail-based sampling** (decide after trace completes):
- Keep all traces with errors
- Keep slow traces (p95+ latency)
- Sample 1% of successful fast traces

**SkillForge sampling:**
- Development: 100% sampling
- Production: 10% sampling, 100% for errors

### Trace Analysis Queries

**Find slow traces:**
```
duration > 2s
```

**Find traces with errors:**
```
status = error
```

**Find traces for specific user:**
```
user.id = "abc-123"
```

**Find traces hitting specific service:**
```
service.name = "analysis-worker"
```

---

## Alert Fatigue Prevention

### Alert Grouping

**Group related alerts:**
```yaml
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s        # Wait 30s to collect similar alerts
  group_interval: 5m     # Send grouped alerts every 5m
  repeat_interval: 4h    # Re-send alert after 4h if still firing

  routes:
  - match:
      severity: critical
    receiver: pagerduty
    continue: true        # Continue to other routes

  - match:
      severity: warning
    receiver: slack
```

### Inhibition Rules

**Suppress noisy alerts when root cause is known:**
```yaml
inhibit_rules:
# If ServiceDown is firing, suppress HighErrorRate and HighLatency
- source_match:
    alertname: ServiceDown
  target_match_re:
    alertname: (HighErrorRate|HighLatency)
  equal: ['service']

# If DatabaseDown is firing, suppress all DB-related alerts
- source_match:
    alertname: DatabaseDown
  target_match_re:
    alertname: Database.*
  equal: ['cluster']
```

### Escalation Policies

```yaml
# Escalation: Slack → PagerDuty after 15 min
routes:
- match:
    severity: critical
  receiver: slack
  continue: true
  routes:
  - match:
      severity: critical
    receiver: pagerduty
    group_wait: 15m  # Escalate to PagerDuty after 15 min
```

### Runbook Links

**Add runbook links to alert annotations:**
```yaml
groups:
- name: app-alerts
  rules:
  - alert: HighErrorRate
    expr: |
      sum(rate(http_requests_total{status=~"5.."}[5m])) /
      sum(rate(http_requests_total[5m])) > 0.05
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value | humanizePercentage }}"
      runbook_url: "https://wiki.example.com/runbooks/high-error-rate"
```

**Runbook should include:**
1. What the alert means
2. Impact on users
3. Common causes
4. Investigation steps
5. Remediation steps
6. Escalation contacts

---

## Dashboard Design Principles

### Layout Patterns

**Golden Signals Dashboard (top row):**
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  Latency     │  Traffic     │  Errors      │  Saturation  │
│  (p50/p95)   │  (req/s)     │  (5xx rate)  │  (CPU/mem)   │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Service Dashboard Structure:**
1. **Overview** (single row) - Traffic, errors, latency, saturation
2. **Request breakdown** - By endpoint, method, status code
3. **Dependencies** - Database, Redis, external APIs
4. **Resources** - CPU, memory, disk, network
5. **Business metrics** - Registrations, purchases, etc.

### Metric Selection

**Start with RED metrics:**
- **Rate**: `rate(http_requests_total[5m])`
- **Errors**: `sum(rate(http_requests_total{status=~"5.."}[5m]))`
- **Duration**: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`

**Add USE metrics for resources:**
- **Utilization**: % of resource used
- **Saturation**: Queue depth, wait time
- **Errors**: Error count

### SLO/SLI Dashboards

**Service Level Indicators (SLIs):**
```promql
# Availability SLI: % of successful requests
sum(rate(http_requests_total{status!~"5.."}[30d])) /
sum(rate(http_requests_total[30d]))

# Latency SLI: % of requests < 1s
sum(rate(http_request_duration_seconds_bucket{le="1"}[30d])) /
sum(rate(http_request_duration_seconds_count[30d]))
```

**Service Level Objectives (SLOs):**
- Availability: 99.9% (43 min downtime/month)
- Latency: 99% of requests < 1s

**Error Budget:**
- 99.9% SLO = 0.1% error budget
- If error budget consumed, freeze feature work and focus on reliability

---

## Real-World SkillForge Examples

### Example 1: Langfuse Observability Integration

**SkillForge uses Langfuse for LLM observability:**
```python
from langfuse import Langfuse
from langfuse.decorators import observe, langfuse_context

langfuse = Langfuse(
    host="https://cloud.langfuse.com",
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
    secret_key=os.getenv("LANGFUSE_SECRET_KEY")
)

@observe(name="analyze_content")
async def analyze_content(url: str) -> AnalysisResult:
    """Analyze content with 8-agent workflow."""

    # Trace metadata
    langfuse_context.update_current_trace(
        name="content_analysis",
        user_id="system",
        metadata={"url": url, "workflow": "8-agent-supervisor"}
    )

    # Fetch content (child span)
    with langfuse_context.observe(name="fetch_content") as fetch_span:
        content = await fetch_url(url)
        fetch_span.metadata = {"content_size": len(content)}

    # Generate embedding (child span with cost tracking)
    with langfuse_context.observe(name="generate_embedding") as embed_span:
        embedding = await embed_text(content)
        embed_span.usage = {
            "input_tokens": len(content) // 4,  # Rough estimate
            "model": "voyage-code-2"
        }

    # Run 8-agent analysis (parallel spans)
    findings = await run_supervisor_workflow(content)

    # Track total cost
    langfuse_context.update_current_observation(
        usage={
            "total_tokens": sum(f.token_count for f in findings),
            "total_cost": sum(f.cost for f in findings)
        }
    )

    return AnalysisResult(findings=findings)
```

**Langfuse Dashboard views:**
- Trace waterfall (see parallel agent execution)
- Token usage by agent
- Cost tracking per analysis
- Prompt/completion inspection
- Latency breakdown

### Example 2: Structured Logging with Correlation

**SkillForge's actual logging setup:**
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

### Example 3: LLM Cost Tracking

**SkillForge tracks LLM costs per model and operation:**
```python
from prometheus_client import Counter, Histogram

# Token usage counter
llm_tokens_used = Counter(
    'llm_tokens_used_total',
    'Total LLM tokens consumed',
    ['model', 'operation', 'token_type']  # token_type = input|output
)

# Cost counter (in dollars)
llm_cost_dollars = Counter(
    'llm_cost_dollars_total',
    'Total LLM cost in dollars',
    ['model', 'operation']
)

# Latency histogram
llm_request_duration = Histogram(
    'llm_request_duration_seconds',
    'LLM request duration',
    ['model', 'operation'],
    buckets=[0.5, 1, 2, 5, 10, 20, 30]
)

@observe(name="llm_call")
async def call_llm(prompt: str, model: str, operation: str) -> str:
    """Call LLM with cost tracking."""

    start_time = time.time()

    response = await anthropic_client.messages.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024
    )

    duration = time.time() - start_time

    # Track metrics
    input_tokens = response.usage.input_tokens
    output_tokens = response.usage.output_tokens

    llm_tokens_used.labels(model=model, operation=operation, token_type="input").inc(input_tokens)
    llm_tokens_used.labels(model=model, operation=operation, token_type="output").inc(output_tokens)

    # Cost calculation (Claude Sonnet 4.5 pricing)
    input_cost = (input_tokens / 1_000_000) * 3.00   # $3/MTok input
    output_cost = (output_tokens / 1_000_000) * 15.00  # $15/MTok output
    total_cost = input_cost + output_cost

    llm_cost_dollars.labels(model=model, operation=operation).inc(total_cost)
    llm_request_duration.labels(model=model, operation=operation).observe(duration)

    logger.info("llm_call_completed",
        model=model,
        operation=operation,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_dollars=total_cost,
        duration_seconds=duration
    )

    return response.content[0].text
```

**Grafana dashboard queries:**
```promql
# Total cost per day
sum(increase(llm_cost_dollars_total[1d])) by (model)

# Token usage rate
sum(rate(llm_tokens_used_total[5m])) by (model, token_type)

# Cost per operation
sum(increase(llm_cost_dollars_total[1h])) by (operation)

# p95 LLM latency
histogram_quantile(0.95, rate(llm_request_duration_seconds_bucket[5m]))
```

**SkillForge cost insights:**
- Baseline: $35k/year → With caching: $2-5k/year (85-95% reduction)
- Most expensive operation: `quality_assessment` (40% of tokens)
- Highest cache hit rate: `tech_comparison` (92%)

---

## Extended Thinking Triggers

Use Opus 4.5 extended thinking for:
- **Incident investigation** - Correlating logs, metrics, traces
- **Alert tuning** - Reducing noise, catching real issues
- **Architecture decisions** - Choosing monitoring solutions
- **Performance debugging** - Cross-service latency analysis

## Templates Reference

| Template | Purpose |
|----------|---------|
| `structured-logging.ts` | Winston logger with request middleware |
| `prometheus-metrics.ts` | HTTP, DB, cache metrics with middleware |
| `opentelemetry-tracing.ts` | Distributed tracing setup |
| `alerting-rules.yml` | Prometheus alerting rules |
| `health-checks.ts` | Liveness, readiness, startup probes |

## Capability Details

### structured-logging
**Keywords:** logging, structured log, json log, correlation id, log level, winston, pino, structlog
**Solves:**
- How do I set up structured logging?
- Implement correlation IDs across services
- JSON logging best practices
- Log aggregation with Loki/LogQL

### correlation-tracking
**Keywords:** correlation id, request tracking, trace context, distributed logs
**Solves:**
- How do I track requests across services?
- Implement correlation IDs in middleware
- Find all logs for a single request
- Debug distributed transactions

### log-sampling
**Keywords:** log sampling, high traffic logging, sampling rate, log volume
**Solves:**
- How do I reduce log volume in production?
- Sample INFO logs while keeping all errors
- Manage logging costs at scale

### prometheus-metrics
**Keywords:** metrics, prometheus, counter, histogram, gauge, summary, red method
**Solves:**
- How do I collect application metrics?
- Implement RED method (Rate, Errors, Duration)
- Choose between Counter, Gauge, Histogram
- Avoid high cardinality metrics

### metric-types
**Keywords:** counter, gauge, histogram, summary, bucket, quantile
**Solves:**
- When to use Counter vs Gauge?
- Histogram vs Summary for latency
- Configure histogram buckets
- Calculate p95/p99 latency

### cardinality-management
**Keywords:** cardinality, label explosion, time series, prometheus performance
**Solves:**
- How do I prevent label cardinality explosions?
- Identify high cardinality metrics
- Fix unbounded labels (user IDs, request IDs)

### distributed-tracing
**Keywords:** tracing, distributed tracing, opentelemetry, span, trace id, waterfall
**Solves:**
- How do I implement distributed tracing?
- OpenTelemetry setup with auto-instrumentation
- Create manual spans for custom operations
- Trace sampling strategies

### trace-sampling
**Keywords:** trace sampling, head-based sampling, tail-based sampling, sampling strategy
**Solves:**
- How do I reduce trace volume?
- Sample 10% of traces but keep all errors
- Tail-based vs head-based sampling

### alerting-strategy
**Keywords:** alert, alerting, notification, threshold, pagerduty, slack, severity
**Solves:**
- How do I set up effective alerts?
- Define alert severity levels (P1-P4)
- Create service down and error rate alerts
- Write runbooks for alerts

### alert-fatigue-prevention
**Keywords:** alert fatigue, alert grouping, inhibition, escalation
**Solves:**
- How do I reduce alert noise?
- Group related alerts together
- Suppress alerts with inhibition rules
- Set up escalation policies

### dashboards
**Keywords:** dashboard, visualization, grafana, golden signals, red method, use method
**Solves:**
- How do I create monitoring dashboards?
- Design Golden Signals dashboard layout
- Build SLO/SLI dashboards
- Calculate error budgets

### health-checks
**Keywords:** health check, liveness, readiness, startup probe, kubernetes
**Solves:**
- How do I implement health check endpoints?
- Difference between liveness and readiness
- Health check for database and Redis

### langfuse-observability
**Keywords:** langfuse, llm observability, llm tracing, token usage, llm cost tracking
**Solves:**
- How do I monitor LLM calls with Langfuse?
- Track LLM token usage and cost
- Trace multi-agent workflows
- Real-world SkillForge LLM observability

### llm-cost-tracking
**Keywords:** llm cost, token tracking, cost optimization, prometheus llm metrics
**Solves:**
- How do I track LLM costs with Prometheus?
- Measure token usage by model and operation
- Calculate cost per analysis/operation
- Build LLM cost dashboards

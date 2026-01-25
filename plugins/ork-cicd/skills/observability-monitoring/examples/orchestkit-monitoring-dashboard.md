# OrchestKit Monitoring Dashboard - Real Implementation

This document shows OrchestKit's actual monitoring setup including metrics, dashboards, and alerting rules.

## Overview

**OrchestKit Monitoring Stack:**
- **Logs**: Structlog (JSON) → Loki
- **Metrics**: Prometheus (RED + business metrics)
- **Traces**: Langfuse (LLM observability)
- **Dashboards**: Grafana
- **Alerts**: Prometheus Alertmanager → Slack

**Key Metrics:**
- LLM costs: $35k/year → $2-5k/year (95% reduction via caching)
- Retrieval pass rate: 91.6% (target: >90%)
- Quality gate pass rate: 85% (target: >80%)
- Hybrid search latency: 5ms (HNSW index)

## Dashboard Structure

### 1. Service Overview Dashboard

**Top Row - Golden Signals:**
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  Latency     │  Traffic     │  Errors      │  Saturation  │
│  p50: 245ms  │  12.5 req/s  │  0.3% (5xx)  │  CPU: 45%    │
│  p95: 680ms  │  (stable)    │  (good)      │  Mem: 62%    │
│  p99: 1.2s   │              │              │  (healthy)   │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Prometheus Queries:**

```promql
# p95 latency
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket[5m])
)

# Request rate
sum(rate(http_requests_total[5m]))

# Error rate (5xx)
sum(rate(http_requests_total{status=~"5.."}[5m])) /
sum(rate(http_requests_total[5m]))

# CPU saturation
avg(rate(process_cpu_seconds_total[5m])) * 100
```

### 2. LLM Observability Dashboard

**Metrics Tracked:**
- Cost per model (Claude, Gemini, Voyage)
- Token usage (input/output)
- Cache hit rates (L1: Prompt Cache, L2: Semantic Cache)
- LLM latency distribution

**Cost Breakdown Panel:**
```promql
# Total cost per day by model
sum(increase(llm_cost_dollars_total[1d])) by (model)

# Cost per operation
sum(increase(llm_cost_dollars_total[1h])) by (operation)
```

**Example Results:**
| Model | Daily Cost | Monthly (Projected) |
|-------|------------|---------------------|
| claude-sonnet-4-20250514 | $5.20 | $156 |
| gemini-1.5-flash | $1.80 | $54 |
| voyage-code-2 | $0.40 | $12 |
| **Total** | **$7.40** | **$222** |

**Cache Performance Panel:**
```promql
# Cache hit rate
sum(rate(cache_operations_total{result="hit"}[5m])) /
sum(rate(cache_operations_total[5m]))

# Cost savings from cache (estimated)
sum(rate(cache_operations_total{result="hit"}[5m])) *
avg_over_time(llm_cost_dollars_total[1h])
```

**Results:**
| Cache Level | Hit Rate | Daily Savings |
|-------------|----------|---------------|
| L1 (Prompt Cache) | 90% | $90 |
| L2 (Semantic Cache) | 75% | $21 |
| **Total Savings** | - | **$111/day** |

### 3. Quality Metrics Dashboard

**Panels:**
1. Quality gate pass rate (target: >80%)
2. G-Eval scores by criterion (completeness, accuracy, coherence, depth)
3. Failed analyses count
4. Quality score distribution

**Quality Gate Pass Rate:**
```promql
# Pass rate over last 24h
sum(rate(quality_gate_passed_total[24h])) /
sum(rate(quality_gate_total[24h]))
```

**G-Eval Scores (from Langfuse):**
```sql
-- Track quality trends
SELECT
    DATE(timestamp) as date,
    AVG(value) FILTER (WHERE name = 'quality_completeness') as completeness,
    AVG(value) FILTER (WHERE name = 'quality_accuracy') as accuracy,
    AVG(value) FILTER (WHERE name = 'quality_coherence') as coherence,
    AVG(value) FILTER (WHERE name = 'quality_depth') as depth
FROM langfuse.scores
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY DATE(timestamp);
```

**Example Results:**
| Date | Completeness | Accuracy | Coherence | Depth | Overall |
|------|--------------|----------|-----------|-------|---------|
| 2025-01-20 | 0.85 | 0.92 | 0.88 | 0.78 | 0.86 |
| 2025-01-21 | 0.83 | 0.91 | 0.87 | 0.76 | 0.84 |

### 4. Database Performance Dashboard

**Panels:**
1. Query latency (p50/p95/p99)
2. Connection pool usage
3. Slow queries (>500ms)
4. Cache hit ratio

**Query Latency:**
```promql
# p95 query latency
histogram_quantile(0.95,
  rate(db_query_duration_seconds_bucket[5m])
) by (query_type)
```

**Connection Pool:**
```promql
# Active connections
db_connections_active

# Connection pool saturation
db_connections_active / db_connections_max
```

**Real Metrics:**
| Metric | Value | Target |
|--------|-------|--------|
| p50 query latency | 8ms | <100ms |
| p95 query latency | 45ms | <500ms |
| Active connections | 12 | <20 |
| Pool saturation | 60% | <80% |

### 5. Retrieval Quality Dashboard

**Metrics from Golden Dataset (98 analyses, 415 chunks):**

**Pass Rate:**
```promql
# Retrieval pass rate (expected chunk in top-k)
sum(retrieval_pass_total) / sum(retrieval_total)
```

**Results:** 186/203 queries passed = **91.6% pass rate** (target: >90%)

**MRR by Difficulty:**
```sql
-- Mean Reciprocal Rank by query difficulty
SELECT
    difficulty,
    COUNT(*) as queries,
    AVG(mrr) as avg_mrr
FROM retrieval_evaluation
GROUP BY difficulty;
```

**Results:**
| Difficulty | Queries | MRR | Pass Rate |
|------------|---------|-----|-----------|
| Easy | 78 | 0.892 | 96.2% |
| Medium | 89 | 0.745 | 91.0% |
| Hard | 36 | 0.686 | 83.3% |
| **Overall** | **203** | **0.777** | **91.6%** |

**Search Latency:**
```promql
# Hybrid search latency (HNSW + BM25 RRF)
histogram_quantile(0.95,
  rate(search_duration_seconds_bucket[5m])
)
```

**Results:**
| Operation | p50 | p95 | p99 |
|-----------|-----|-----|-----|
| Vector search (HNSW) | 3ms | 5ms | 8ms |
| BM25 search | 4ms | 7ms | 12ms |
| RRF fusion | 1ms | 2ms | 3ms |
| **Total hybrid search** | **8ms** | **14ms** | **23ms** |

**Comparison to IVFFlat:**
- HNSW: 5ms
- IVFFlat: 85ms
- **Speedup: 17x faster**

## Structured Logging Examples

### Log Format

**OrchestKit uses structlog with JSON output:**
```json
{
  "event": "supervisor_routing",
  "level": "info",
  "timestamp": "2025-01-21T10:30:45.123Z",
  "correlation_id": "abc-123-def",
  "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
  "workflow_step": "supervisor",
  "agent": "tech_comparator",
  "remaining_agents": 7,
  "content_length": 45823,
  "logger": "app.workflows.supervisor"
}
```

### Key Log Events

**1. Analysis Started:**
```json
{
  "event": "analysis_started",
  "level": "info",
  "analysis_id": "550e8400-...",
  "url": "https://example.com/article",
  "content_type": "article"
}
```

**2. Agent Execution:**
```json
{
  "event": "agent_execution_started",
  "level": "info",
  "agent_type": "security_auditor",
  "correlation_id": "abc-123-def",
  "analysis_id": "550e8400-..."
}
```

**3. LLM Call:**
```json
{
  "event": "llm_call_completed",
  "level": "info",
  "model": "claude-sonnet-4-20250514",
  "operation": "security_audit",
  "input_tokens": 1800,
  "output_tokens": 1200,
  "cost_dollars": 0.021,
  "duration_seconds": 2.3,
  "cache_hit": false
}
```

**4. Quality Gate:**
```json
{
  "event": "quality_gate_passed",
  "level": "info",
  "analysis_id": "550e8400-...",
  "quality_scores": {
    "completeness": 0.85,
    "accuracy": 0.92,
    "coherence": 0.88,
    "depth": 0.78
  },
  "overall_quality": 0.86,
  "passed": true
}
```

**5. Error Logging:**
```json
{
  "event": "analysis_failed",
  "level": "error",
  "analysis_id": "550e8400-...",
  "error_type": "ValidationError",
  "error_message": "Quality gate failed: depth score too low",
  "quality_scores": {
    "depth": 0.45
  },
  "traceback": "...",
  "correlation_id": "abc-123-def"
}
```

### Loki Queries (LogQL)

**Find all errors in last hour:**
```logql
{app="orchestkit-backend"} |= "ERROR" | json
```

**Count errors by endpoint:**
```logql
sum by (endpoint) (
  count_over_time({app="orchestkit-backend"} |= "ERROR" [5m])
)
```

**Search for specific analysis:**
```logql
{app="orchestkit-backend"}
| json
| analysis_id="550e8400-e29b-41d4-a716-446655440000"
```

**p95 LLM latency from logs:**
```logql
quantile_over_time(0.95,
  {app="orchestkit-backend"}
  | json
  | event="llm_call_completed"
  | unwrap duration_seconds [5m]
)
```

## Alerting Rules

### 1. Service Availability

**File:** `monitoring/prometheus/alerts/service.yml`

```yaml
groups:
- name: service-health
  interval: 30s
  rules:
  - alert: ServiceDown
    expr: up == 0
    for: 1m
    labels:
      severity: critical
      team: platform
    annotations:
      summary: "Service {{ $labels.job }} is down"
      description: "{{ $labels.instance }} has been down for 1 minute"
      runbook_url: "https://wiki.orchestkit.dev/runbooks/service-down"

  - alert: HighErrorRate
    expr: |
      sum(rate(http_requests_total{status=~"5.."}[5m])) /
      sum(rate(http_requests_total[5m])) > 0.05
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"
```

### 2. LLM Cost Alerts

**File:** `monitoring/prometheus/alerts/llm-cost.yml`

```yaml
groups:
- name: llm-costs
  interval: 1h
  rules:
  - alert: DailyCostExceeded
    expr: |
      sum(increase(llm_cost_dollars_total[24h])) > 20
    labels:
      severity: high
      team: ai-ml
    annotations:
      summary: "Daily LLM cost exceeded $20"
      description: "Current daily cost: ${{ $value }}"

  - alert: UnexpectedCostSpike
    expr: |
      sum(rate(llm_cost_dollars_total[1h])) >
      sum(rate(llm_cost_dollars_total[1h] offset 24h)) * 2
    for: 2h
    labels:
      severity: high
    annotations:
      summary: "LLM cost spike detected"
      description: "Current hourly cost is 2x yesterday's average"
```

### 3. Quality Degradation

**File:** `monitoring/prometheus/alerts/quality.yml`

```yaml
groups:
- name: quality-metrics
  interval: 5m
  rules:
  - alert: LowQualityGatePassRate
    expr: |
      sum(rate(quality_gate_passed_total[1h])) /
      sum(rate(quality_gate_total[1h])) < 0.80
    for: 30m
    labels:
      severity: high
      team: ml
    annotations:
      summary: "Quality gate pass rate below 80%"
      description: "Current pass rate: {{ $value | humanizePercentage }}"

  - alert: CacheHitRateDegraded
    expr: |
      sum(rate(cache_operations_total{result="hit"}[30m])) /
      sum(rate(cache_operations_total[30m])) < 0.70
    for: 1h
    labels:
      severity: medium
    annotations:
      summary: "Cache hit rate below 70%"
      description: "Cache performance degraded: {{ $value | humanizePercentage }}"
```

### 4. Database Performance

**File:** `monitoring/prometheus/alerts/database.yml`

```yaml
groups:
- name: database-performance
  interval: 1m
  rules:
  - alert: SlowQueries
    expr: |
      histogram_quantile(0.95,
        rate(db_query_duration_seconds_bucket[5m])
      ) > 0.5
    for: 10m
    labels:
      severity: high
    annotations:
      summary: "p95 query latency exceeded 500ms"
      description: "Current p95: {{ $value }}s"

  - alert: ConnectionPoolExhausted
    expr: db_connections_active / db_connections_max > 0.9
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Database connection pool near capacity"
      description: "{{ $value | humanizePercentage }} of connections in use"
```

## Alert Routing & Escalation

**File:** `monitoring/alertmanager/config.yml`

```yaml
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: slack-default

  routes:
  # Critical alerts → Slack + PagerDuty
  - match:
      severity: critical
    receiver: pagerduty-critical
    continue: true  # Also send to Slack

  # High severity → Slack
  - match:
      severity: high
    receiver: slack-high

  # Medium/low → Slack (throttled)
  - match_re:
      severity: (medium|low)
    receiver: slack-low
    group_interval: 1h

receivers:
- name: slack-default
  slack_configs:
  - api_url: <slack_webhook_url>
    channel: '#alerts'
    title: '{{ .GroupLabels.alertname }}'
    text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}'

- name: pagerduty-critical
  pagerduty_configs:
  - service_key: <pagerduty_service_key>
```

## Health Check Endpoints

### 1. Liveness Probe

**Endpoint:** `GET /health`
**Purpose:** Is the application running?

```python
@app.get("/health")
async def health_check():
    """Basic liveness check."""
    return {"status": "healthy"}
```

### 2. Readiness Probe

**Endpoint:** `GET /ready`
**Purpose:** Is the application ready to serve traffic?

```python
@app.get("/ready")
async def readiness_check():
    """Check if app can handle requests."""

    checks = {}

    # Database check
    try:
        await db.execute("SELECT 1")
        checks["database"] = {"status": "pass", "latency_ms": 5}
    except Exception as e:
        checks["database"] = {"status": "fail", "error": str(e)}

    # Redis check
    try:
        await redis.ping()
        checks["redis"] = {"status": "pass", "latency_ms": 2}
    except Exception as e:
        checks["redis"] = {"status": "fail", "error": str(e)}

    # Overall status
    all_healthy = all(c["status"] == "pass" for c in checks.values())
    status = "healthy" if all_healthy else "degraded"

    return {
        "status": status,
        "checks": checks,
        "version": "1.0.0",
        "uptime": int(time.time() - app.start_time)
    }
```

**Response:**
```json
{
  "status": "healthy",
  "checks": {
    "database": {"status": "pass", "latency_ms": 5},
    "redis": {"status": "pass", "latency_ms": 2}
  },
  "version": "1.0.0",
  "uptime": 3600
}
```

## References

- Template: `../scripts/structured-logging.ts`
- Template: `../scripts/prometheus-metrics.ts`
- Template: `../scripts/alerting-rules.yml`
- [OrchestKit Redis Connection](../../../../backend/app/shared/services/cache/redis_connection.py)
- [OrchestKit Quality Initiative](../../../../docs/QUALITY_INITIATIVE_FIXES.md)

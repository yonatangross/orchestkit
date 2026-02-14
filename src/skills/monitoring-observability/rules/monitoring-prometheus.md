---
title: "Monitoring: Prometheus Metrics"
impact: CRITICAL
impactDescription: "Prometheus metrics provide the foundation for all infrastructure monitoring — without proper metrics, alerting and dashboards are impossible."
tags: [prometheus, metrics, counter, histogram, gauge, red-method, cardinality]
---

# Prometheus Metrics

## RED Method (Rate, Errors, Duration)

Essential metrics for any service:
- **Rate** — Requests per second
- **Errors** — Failed requests per second
- **Duration** — Request latency distribution

## Metric Types

### Counter — Monotonically increasing value

```python
from prometheus_client import Counter

http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

# Usage
http_requests_total.labels(method='GET', endpoint='/api/users', status=200).inc()
```

**Use cases:** Request counts, error counts, bytes processed

### Gauge — Value that can go up or down

```python
from prometheus_client import Gauge

active_connections = Gauge(
    'active_connections',
    'Number of active database connections'
)

active_connections.set(25)
active_connections.inc()
active_connections.dec()
```

**Use cases:** Queue length, memory usage, active connections

### Histogram — Distribution of values (with buckets)

```python
from prometheus_client import Histogram

request_duration = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
)

with request_duration.labels(method='GET', endpoint='/api/users').time():
    pass  # handle request
```

**Use cases:** Request latency, response size

### Histogram vs Summary

- **Histogram**: Calculate quantiles server-side (recommended)
- **Summary**: Calculate quantiles client-side (higher CPU, cannot aggregate across instances)

## Recommended Bucket Configurations

```typescript
// HTTP request latency
buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]

// Database query latency
buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1]

// LLM request latency
buckets: [0.5, 1, 2, 5, 10, 20, 30]
```

## Cardinality Management

```python
# BAD: Unbounded cardinality
http_requests_total = Counter(
    'http_requests_total',
    ['method', 'endpoint', 'user_id']  # user_id creates millions of time series!
)

# GOOD: Bounded cardinality
http_requests_total = Counter(
    'http_requests_total',
    ['method', 'endpoint', 'status']  # ~10 x 100 x 10 = 10,000 series
)
```

**Limits:**
- Good: < 10,000 unique time series per metric
- Acceptable: 10,000-100,000
- Bad: > 100,000 (Prometheus performance degrades)

**Rule:** Never use unbounded labels (user IDs, request IDs, timestamps)

## Custom Business Metrics

```python
# LLM token usage
llm_tokens_used = Counter(
    'llm_tokens_used_total',
    'Total LLM tokens consumed',
    ['model', 'operation']
)

# Cache hit rate
cache_operations = Counter(
    'cache_operations_total',
    'Cache operations',
    ['operation', 'result']  # result='hit|miss'
)

# Cache hit rate PromQL:
# sum(rate(cache_operations_total{result="hit"}[5m])) /
# sum(rate(cache_operations_total[5m]))
```

## PromQL Quick Reference

```text
# Rate of requests
rate(http_requests_total[5m])

# Error rate percentage
sum(rate(http_requests_total{status=~"5.."}[5m])) /
sum(rate(http_requests_total[5m])) * 100

# p95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Total cost per day by model
sum(increase(llm_cost_dollars_total[1d])) by (model)
```

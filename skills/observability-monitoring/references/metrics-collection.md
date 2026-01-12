# Metrics Collection with Prometheus

Application metrics best practices.

## Metric Types

| Type | Use Case | Example |
|------|----------|---------|
| **Counter** | Monotonically increasing | `http_requests_total` |
| **Gauge** | Can go up/down | `memory_usage_bytes` |
| **Histogram** | Distribution | `http_request_duration_seconds` |
| **Summary** | Percentiles | `api_latency_summary` |

## Python (prometheus_client)

```python
from prometheus_client import Counter, Histogram, Gauge

# Counter: tracks total requests
http_requests = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
http_requests.labels(method='GET', endpoint='/api/users', status='200').inc()

# Histogram: tracks request duration
request_duration = Histogram('http_request_duration_seconds', 'HTTP request duration')

with request_duration.time():
    # Your code here
    pass

# Gauge: tracks current active connections
active_connections = Gauge('active_connections', 'Current active connections')
active_connections.set(42)
```

## PromQL Queries

```promql
# Request rate (per second)
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Memory usage trend
avg_over_time(memory_usage_bytes[1h])
```

## Best Practices

1. **Name consistently** - `<metric>_<unit>` (e.g., `http_requests_total`)
2. **Use labels sparingly** - high cardinality kills performance
3. **Avoid user IDs in labels** - causes cardinality explosion
4. **Monitor RED metrics** - Rate, Errors, Duration

See `templates/prometheus-metrics.ts` for complete setup.

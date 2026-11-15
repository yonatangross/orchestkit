# Monitoring Dashboards

Grafana dashboard patterns and SLO/SLI definitions.

## The Four Golden Signals

| Signal | Metric | Description |
|--------|--------|-------------|
| **Latency** | Response time | How long requests take |
| **Traffic** | Requests/sec | Volume of demand |
| **Errors** | Error rate | Failures per second |
| **Saturation** | Resource usage | How full the service is |

## SLO/SLI Examples

```yaml
# SLO: 99.9% availability
SLI: availability = successful_requests / total_requests
Target: > 0.999

# SLO: 95% of requests < 500ms
SLI: latency_p95 = histogram_quantile(0.95, request_duration_seconds)
Target: < 0.5

# SLO: < 0.1% error rate
SLI: error_rate = failed_requests / total_requests
Target: < 0.001
```

## Grafana Dashboard Structure

1. **Overview row** - traffic, errors, latency
2. **Saturation row** - CPU, memory, disk
3. **Details row** - per-endpoint breakdown
4. **Database row** - query performance, connections

## Best Practices

1. **Use time ranges** - Last 1h, 6h, 24h, 7d
2. **Percentiles over averages** - p50, p95, p99
3. **Color code thresholds** - green/yellow/red
4. **Include annotations** - deployments, incidents

See Grafana dashboards in `backend/grafana/dashboards/`.

# Alerting Strategies

Effective alerting to minimize false positives.

## Alerting Rules (Prometheus)

```yaml
groups:
  - name: api_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}% over last 5 minutes"

      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High API latency"
```

## Alert Severity Levels

| Severity | Response Time | Example |
|----------|---------------|---------|
| **Critical** | Immediate (page) | Service down, data loss |
| **High** | 30 min | High error rate, disk full |
| **Medium** | 4 hours | Slow responses, high memory |
| **Low** | Next day | Deprecation warnings |

## Best Practices

1. **Alert on symptoms, not causes** - "Users can't login" not "CPU high"
2. **Actionable alerts only** - every alert needs runbook
3. **Reduce noise** - use `for: 5m` to avoid flapping
4. **Group related alerts** - don't page for every instance
5. **Test alert rules** - `amtool alert query`

## Notification Channels

- **PagerDuty** - critical (on-call)
- **Slack** - warnings (team channel)
- **Email** - low priority (daily digest)

See `scripts/alerting-rules.yml` for complete examples.

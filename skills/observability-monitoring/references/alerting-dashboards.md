# Alerting and Dashboards

Effective alerting strategies and dashboard design patterns.

## Alert Severity Levels

| Level | Response Time | Examples |
|-------|---------------|----------|
| **Critical (P1)** | < 15 min | Service down, data loss |
| **High (P2)** | < 1 hour | Major feature broken |
| **Medium (P3)** | < 4 hours | Increased error rate |
| **Low (P4)** | Next day | Warnings |

## Key Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| ServiceDown | `up == 0` for 1m | Critical |
| HighErrorRate | 5xx > 5% for 5m | Critical |
| HighLatency | p95 > 2s for 5m | High |
| LowCacheHitRate | < 70% for 10m | Medium |

## Alert Grouping

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

## Inhibition Rules

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

## Escalation Policies

```yaml
# Escalation: Slack -> PagerDuty after 15 min
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

## Runbook Links

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

## Dashboard Design Principles

### Golden Signals Dashboard (top row)
```
+--------------+--------------+--------------+--------------+
|  Latency     |  Traffic     |  Errors      |  Saturation  |
|  (p50/p95)   |  (req/s)     |  (5xx rate)  |  (CPU/mem)   |
+--------------+--------------+--------------+--------------+
```

### Service Dashboard Structure
1. **Overview** (single row) - Traffic, errors, latency, saturation
2. **Request breakdown** - By endpoint, method, status code
3. **Dependencies** - Database, Redis, external APIs
4. **Resources** - CPU, memory, disk, network
5. **Business metrics** - Registrations, purchases, etc.

### RED Metrics for Dashboards
- **Rate**: `rate(http_requests_total[5m])`
- **Errors**: `sum(rate(http_requests_total{status=~"5.."}[5m]))`
- **Duration**: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`

### USE Metrics for Resources
- **Utilization**: % of resource used
- **Saturation**: Queue depth, wait time
- **Errors**: Error count

## SLO/SLI Dashboards

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

## Notification Channels

- **PagerDuty** - critical (on-call)
- **Slack** - warnings (team channel)
- **Email** - low priority (daily digest)

See `templates/alerting-rules.yml` for complete examples.
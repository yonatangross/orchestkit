---
title: "Monitoring: Alerting Rules"
impact: CRITICAL
impactDescription: "Effective alerting rules are the first line of defense for production issues — poor alerting leads to alert fatigue or missed incidents."
tags: [alerting, severity, escalation, inhibition, pagerduty, slack, runbook]
---

# Alerting Rules

## Alert Severity Levels

| Level | Response Time | Examples |
|-------|---------------|----------|
| **Critical (P1)** | < 15 min | Service down, data loss |
| **High (P2)** | < 1 hour | Major feature broken |
| **Medium (P3)** | < 4 hours | Increased error rate |
| **Low (P4)** | Next day | Warnings, deprecations |

## Key Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| ServiceDown | `up == 0` for 1m | Critical |
| HighErrorRate | 5xx > 5% for 5m | Critical |
| HighLatency | p95 > 2s for 5m | High |
| LowCacheHitRate | < 70% for 10m | Medium |

## Prometheus Alerting Rules

```yaml
groups:
  - name: api_alerts
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) /
          sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"
          runbook_url: "https://wiki.example.com/runbooks/high-error-rate"

      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High API latency"
```

## Alert Grouping

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
    continue: true

  - match:
      severity: warning
    receiver: slack
```

## Inhibition Rules

Suppress noisy alerts when root cause is known:

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

## Runbook Requirements

Every alert must link to a runbook containing:
1. What the alert means
2. Impact on users
3. Common causes
4. Investigation steps
5. Remediation steps
6. Escalation contacts

## Alert Fatigue Prevention

**Best Practices:**
1. **Alert on symptoms, not causes** — "Users cannot login" not "CPU high"
2. **Actionable alerts only** — every alert needs a runbook
3. **Reduce noise** — use `for: 5m` to avoid flapping
4. **Group related alerts** — do not page for every instance
5. **Test alert rules** — validate with `amtool alert query`

## Notification Channels

| Channel | Use For | Priority |
|---------|---------|----------|
| **PagerDuty** | Critical (on-call) | P1-P2 |
| **Slack** | Warnings (team channel) | P3 |
| **Email** | Low priority (daily digest) | P4 |

**Incorrect — alert without for clause causes flapping:**
```yaml
- alert: HighErrorRate
  expr: http_errors_total / http_requests_total > 0.05  # Immediate
  labels:
    severity: critical  # Pages on-call for brief spikes
```

**Correct — for clause prevents flapping:**
```yaml
- alert: HighErrorRate
  expr: http_errors_total / http_requests_total > 0.05
  for: 5m  # Must sustain 5min before firing
  labels:
    severity: critical
```

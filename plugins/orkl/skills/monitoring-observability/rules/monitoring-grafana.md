---
title: "Monitoring: Grafana Dashboards"
impact: CRITICAL
impactDescription: "Grafana dashboards translate raw metrics into actionable insights — proper dashboard design is essential for incident response and capacity planning."
tags: [grafana, dashboards, golden-signals, slo, sli, health-checks]
---

# Grafana Dashboards

## The Four Golden Signals

| Signal | Metric | Description |
|--------|--------|-------------|
| **Latency** | Response time | How long requests take |
| **Traffic** | Requests/sec | Volume of demand |
| **Errors** | Error rate | Failures per second |
| **Saturation** | Resource usage | How full the service is |

### Dashboard Layout (Top Row)

```
+--------------+--------------+--------------+--------------+
|  Latency     |  Traffic     |  Errors      |  Saturation  |
|  (p50/p95)   |  (req/s)     |  (5xx rate)  |  (CPU/mem)   |
+--------------+--------------+--------------+--------------+
```

## Service Dashboard Structure

1. **Overview** (single row) — Traffic, errors, latency, saturation
2. **Request breakdown** — By endpoint, method, status code
3. **Dependencies** — Database, Redis, external APIs
4. **Resources** — CPU, memory, disk, network
5. **Business metrics** — Registrations, purchases, LLM costs

## RED Metrics for Dashboards

```text
# Rate
rate(http_requests_total[5m])

# Errors
sum(rate(http_requests_total{status=~"5.."}[5m]))

# Duration
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

## USE Metrics for Resources

- **Utilization** — % of resource used
- **Saturation** — Queue depth, wait time
- **Errors** — Error count

## SLO/SLI Definitions

### Service Level Indicators (SLIs)

```text
# Availability SLI: % of successful requests
sum(rate(http_requests_total{status!~"5.."}[30d])) /
sum(rate(http_requests_total[30d]))

# Latency SLI: % of requests < 1s
sum(rate(http_request_duration_seconds_bucket{le="1"}[30d])) /
sum(rate(http_request_duration_seconds_count[30d]))
```

### Service Level Objectives (SLOs)

| SLO | Target | Error Budget |
|-----|--------|--------------|
| Availability | 99.9% | 43 min downtime/month |
| Latency | 99% < 1s | 1% of requests can be slow |

**Error Budget:** If consumed, freeze feature work and focus on reliability.

## Health Checks (Kubernetes)

| Probe | Purpose | Endpoint |
|-------|---------|----------|
| **Liveness** | Is app running? | `/health` |
| **Readiness** | Ready for traffic? | `/ready` |
| **Startup** | Finished starting? | `/startup` |

## Dashboard Best Practices

1. **Use time ranges** — Last 1h, 6h, 24h, 7d
2. **Percentiles over averages** — p50, p95, p99
3. **Color code thresholds** — green/yellow/red
4. **Include annotations** — deployments, incidents
5. **Link to runbooks** — from alert panels

**Incorrect — using average latency hides tail latency:**
```text
avg(http_request_duration_seconds)  # Misleading for user experience
```

**Correct — using percentiles shows tail latency:**
```text
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

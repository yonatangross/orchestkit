---
name: monitoring-observability
license: MIT
compatibility: "Claude Code 2.1.34+."
description: Monitoring and observability patterns for Prometheus metrics, Grafana dashboards, Langfuse LLM tracing, and drift detection. Use when adding logging, metrics, distributed tracing, LLM cost tracking, or quality drift monitoring.
tags: [monitoring, observability, prometheus, grafana, langfuse, tracing, metrics, drift-detection, logging]
context: fork
agent: metrics-architect
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: medium
metadata:
  category: document-asset-creation
---

# Monitoring & Observability

Comprehensive patterns for infrastructure monitoring, LLM observability, and quality drift detection. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Infrastructure Monitoring](#infrastructure-monitoring) | 3 | CRITICAL | Prometheus metrics, Grafana dashboards, alerting rules |
| [LLM Observability](#llm-observability) | 3 | HIGH | Langfuse tracing, cost tracking, evaluation scoring |
| [Drift Detection](#drift-detection) | 3 | HIGH | Statistical drift, quality regression, drift alerting |
| [Silent Failures](#silent-failures) | 3 | HIGH | Tool skipping, quality degradation, loop/token spike alerting |

**Total: 12 rules across 4 categories**

## Quick Start

```python
# Prometheus metrics with RED method
from prometheus_client import Counter, Histogram

http_requests = Counter('http_requests_total', 'Total requests', ['method', 'endpoint', 'status'])
http_duration = Histogram('http_request_duration_seconds', 'Request latency',
    buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5])
```

```python
# Langfuse LLM tracing
from langfuse import observe, get_client

@observe()
async def analyze_content(content: str):
    get_client().update_current_trace(
        user_id="user_123", session_id="session_abc",
        tags=["production", "orchestkit"],
    )
    return await llm.generate(content)
```

```python
# PSI drift detection
import numpy as np

psi_score = calculate_psi(baseline_scores, current_scores)
if psi_score >= 0.25:
    alert("Significant quality drift detected!")
```

## Infrastructure Monitoring

Prometheus metrics, Grafana dashboards, and alerting for application health.

| Rule | File | Key Pattern |
|------|------|-------------|
| Prometheus Metrics | `rules/monitoring-prometheus.md` | RED method, counters, histograms, cardinality |
| Grafana Dashboards | `rules/monitoring-grafana.md` | Golden Signals, SLO/SLI, health checks |
| Alerting Rules | `rules/monitoring-alerting.md` | Severity levels, grouping, escalation, fatigue prevention |

## LLM Observability

Langfuse-based tracing, cost tracking, and evaluation for LLM applications.

| Rule | File | Key Pattern |
|------|------|-------------|
| Langfuse Traces | `rules/llm-langfuse-traces.md` | @observe decorator, OTEL spans, agent graphs |
| Cost Tracking | `rules/llm-cost-tracking.md` | Token usage, spend alerts, Metrics API |
| Eval Scoring | `rules/llm-eval-scoring.md` | Custom scores, evaluator tracing, quality monitoring |

## Drift Detection

Statistical and quality drift detection for production LLM systems.

| Rule | File | Key Pattern |
|------|------|-------------|
| Statistical Drift | `rules/drift-statistical.md` | PSI, KS test, KL divergence, EWMA |
| Quality Drift | `rules/drift-quality.md` | Score regression, baseline comparison, canary prompts |
| Drift Alerting | `rules/drift-alerting.md` | Dynamic thresholds, correlation, anti-patterns |

## Silent Failures

Detection and alerting for silent failures in LLM agents.

| Rule | File | Key Pattern |
|------|------|-------------|
| Tool Skipping | `rules/silent-tool-skipping.md` | Expected vs actual tool calls, Langfuse traces |
| Quality Degradation | `rules/silent-degraded-quality.md` | Heuristics + LLM-as-judge, z-score baselines |
| Silent Alerting | `rules/silent-alerting.md` | Loop detection, token spikes, escalation workflow |

## Key Decisions

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Metric methodology | RED method (Rate, Errors, Duration) | Industry standard, covers essential service health |
| Log format | Structured JSON | Machine-parseable, supports log aggregation |
| Tracing | OpenTelemetry | Vendor-neutral, auto-instrumentation, broad ecosystem |
| LLM observability | Langfuse (not LangSmith) | Open-source, self-hosted, built-in prompt management |
| LLM tracing API | `@observe` + `get_client()` | OTEL-native, automatic span creation |
| Drift method | PSI for production, KS for small samples | PSI is stable for large datasets, KS more sensitive |
| Threshold strategy | Dynamic (95th percentile) over static | Reduces alert fatigue, context-aware |
| Alert severity | 4 levels (Critical, High, Medium, Low) | Clear escalation paths, appropriate response times |

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [references/](references/) | Logging, metrics, tracing, Langfuse, drift analysis guides |
| [checklists/](checklists/) | Implementation checklists for monitoring and Langfuse setup |
| [examples/](examples/) | Real-world monitoring dashboard and trace examples |
| [scripts/](scripts/) | Templates: Prometheus, OpenTelemetry, health checks, Langfuse |

## Related Skills

- `defense-in-depth` - Layer 8 observability as part of security architecture
- `devops-deployment` - Observability integration with CI/CD and Kubernetes
- `resilience-patterns` - Monitoring circuit breakers and failure scenarios
- `llm-evaluation` - Evaluation patterns that integrate with Langfuse scoring
- `caching` - Caching strategies that reduce costs tracked by Langfuse

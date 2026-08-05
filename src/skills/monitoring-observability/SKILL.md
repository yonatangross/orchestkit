---
name: monitoring-observability
license: MIT
compatibility: "Claude Code 2.1.220+."
description: Monitoring and observability patterns for Prometheus metrics, Grafana dashboards, Langfuse v4 LLM tracing (as_type, score_current_span, should_export_span, LangfuseMedia), and drift detection. Use when adding logging, metrics, distributed tracing, LLM cost tracking, or quality drift monitoring.
tags: [monitoring, observability, prometheus, grafana, langfuse, tracing, metrics, drift-detection, logging]
context: fork
version: 3.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
persuasion-type: reference
targets:
  # Python SDK. The JS/TS SDK is a separate line at 5.x (@langfuse/* packages) — see
  # references/langfuse-js-v5.md. The self-hosted platform is a third axis (v3) and is not an
  # SDK version.
  - library: langfuse
    version: ">=4.0.0"
upstream-version-tested: "4.14.2"
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
path_patterns: ["**/metrics/**", "**/tracing/**", "prometheus.*", "grafana/**"]
---

# Monitoring & Observability

A wrap around Prometheus, Grafana, OpenTelemetry and Langfuse, not a re-teaching of them. This
skill carries OrchestKit's delta (version floors, house decisions, scars) and points at the
vendor for everything else. Start at `references/ork-delta.md`.

## Upstream coverage (do not restate)

These topics are fully covered first-party. Read the source, do not add a local copy.

| Topic | First-party source |
|-------|--------------------|
| Prometheus metric types, RED method, cardinality, PromQL | <https://prometheus.io/docs/practices/> |
| Alertmanager grouping, inhibition, escalation, runbooks | <https://prometheus.io/docs/alerting/latest/configuration/> |
| Grafana dashboards, Loki and LogQL, Promtail | <https://grafana.com/docs/> |
| OpenTelemetry spans, sampling, context propagation | <https://opentelemetry.io/docs/> |
| Langfuse Python SDK (`@observe`, `as_type`, `score_current_span`, `should_export_span`, `LangfuseMedia`) | <https://langfuse.com/docs/sdk/python> |
| Langfuse v2 to v4 Python and v3 to v5 JS migration paths | <https://langfuse.com/docs/sdk/python/v4-migration> |
| Langfuse self-hosting (ClickHouse, Redis, S3, Helm) | <https://langfuse.com/docs/deployment/self-host> |
| Langfuse cost tracking, model pricing, Metrics API v2 | <https://langfuse.com/docs/model-usage-and-cost> |
| Langfuse scores, online evaluators, annotation queues, prompt management | <https://langfuse.com/docs/scores/overview> |
| Langfuse framework integrations (LangChain, LangGraph, CrewAI, Pydantic AI, Bedrock, LiveKit) | <https://langfuse.com/docs/integrations> |
| Agent Graphs, observation types, rendered tool calls | <https://langfuse.com/docs/tracing-features/agent-graphs> |
| PSI, KS test, KL and JS divergence, Wasserstein, embedding drift | <https://www.evidentlyai.com/blog/data-drift-detection-large-datasets> |
| EWMA control charts | <https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc324.htm> |
| structlog, Winston, correlation IDs, log sampling | <https://www.structlog.org/en/stable/> |

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Infrastructure Monitoring](#infrastructure-monitoring) | 1 | CRITICAL | Grafana dashboards, Golden Signals, SLO/SLI |
| [LLM Observability](#llm-observability) | 1 | HIGH | Langfuse tracing, observation types, agent graphs |
| [Silent Failures](#silent-failures) | 3 | HIGH | Tool skipping, quality degradation, loop/token spike alerting |

**Total: 5 rules across 3 categories.** Drift detection, cost tracking, eval scoring, Prometheus
instrumentation and alert-rule authoring moved to the upstream sources listed above.

## Quick Start

```python
# Langfuse v4 LLM tracing: semantic as_type plus inline scoring
from langfuse import observe, get_client

@observe(as_type="generation", name="analyze_content")
async def analyze_content(content: str):
    get_client().update_current_trace(
        user_id="user_123", session_id="session_abc",
        tags=["production", "orchestkit"],
    )
    result = await llm.generate(content)
    get_client().score_current_span(name="response_quality", value=0.85)
    return result
```

```python
# Prometheus RED method, wired the way this repo expects (bounded labels only)
from prometheus_client import Counter, Histogram

http_requests = Counter('http_requests_total', 'Total requests', ['method', 'endpoint', 'status'])
http_duration = Histogram('http_request_duration_seconds', 'Request latency',
    buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5])
```

## Infrastructure Monitoring

Dashboard and health-check patterns. Metric instrumentation and alert-rule syntax are upstream.

| Rule | File | Key Pattern |
|------|------|-------------|
| Grafana Dashboards | `rules/monitoring-grafana.md` | Golden Signals, SLO/SLI, health checks |

> **CC 2.1.161 — OTEL resource attributes as metric labels:** `OTEL_RESOURCE_ATTRIBUTES` values are now attached as labels on metric datapoints, so usage metrics can be sliced by custom dimensions (team, repo, environment). Add label selectors to dashboards for multi-tenant / per-team cost and usage tracking.

## LLM Observability

Langfuse-based tracing for LLM applications. Cost tracking, scoring and drift statistics are
upstream; what stays here is how this repo wires traces.

| Rule | File | Key Pattern |
|------|------|-------------|
| Langfuse Traces | `rules/llm-langfuse-traces.md` | @observe decorator, OTEL spans, agent graphs |

## Silent Failures

Detection and alerting for silent failures in LLM agents.

| Rule | File | Key Pattern |
|------|------|-------------|
| Tool Skipping | `rules/silent-tool-skipping.md` | Expected vs actual tool calls, Langfuse traces |
| Quality Degradation | `rules/silent-degraded-quality.md` | Heuristics + LLM-as-judge, z-score baselines |
| Silent Alerting | `rules/silent-alerting.md` | Loop detection, token spikes, escalation workflow |

> **CC 2.1.169 — OTEL client-cert paths require trust:** untrusted project settings can no longer set OTEL client-certificate paths without a trust confirmation. If your OTEL exporter uses client certs configured in project `.claude/settings.json`, expect a one-time trust prompt on first use in an untrusted project — telemetry silently not flowing after 2.1.169 is usually this gate, not the collector.

## Key Decisions

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Metric methodology | RED method (Rate, Errors, Duration) | Industry standard, covers essential service health |
| Log format | Structured JSON | Machine-parseable, supports log aggregation |
| Tracing | OpenTelemetry | Vendor-neutral, auto-instrumentation, broad ecosystem |
| LLM observability | Langfuse (not LangSmith) | Open-source, self-hosted, built-in prompt management |
| LLM tracing API | `@observe(as_type=...)` + `score_current_span()` | v4: semantic types, inline scoring, span filtering |
| Langfuse APIs | Observations API v2 + Metrics API v2 | v4 (Mar 2026): faster querying, aggregations at scale |
| Hook telemetry transport | JSONL under `~/.claude/analytics/`, never an SDK in-process | Hooks are per-event processes; SDK init would be paid on every spawn (`references/ork-delta.md`) |

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| `${CLAUDE_PLUGIN_ROOT}/skills/monitoring-observability/references/ork-delta.md` | **Start here.** Floors, house decisions and scars that upstream docs do not carry |
| `${CLAUDE_PLUGIN_ROOT}/skills/monitoring-observability/references/langfuse-js-v5.md` | **JS/TS SDK v5** delta from Python 4.x: package map, phantom packages, SpanProcessor vs exporter. Read before writing any JS Langfuse code |
| `${CLAUDE_PLUGIN_ROOT}/skills/monitoring-observability/references/experiments-api.md` | Langfuse experiments and dataset runs as this repo uses them |
| `${CLAUDE_PLUGIN_ROOT}/skills/monitoring-observability/references/evaluation-scores.md` | Score shapes and scoring pipeline wiring |
| `${CLAUDE_PLUGIN_ROOT}/skills/monitoring-observability/references/session-tracking.md` | Session and user grouping across multi-step workflows |
| `${CLAUDE_PLUGIN_ROOT}/skills/monitoring-observability/references/metrics-collection.md` | Claude Code OTEL metric inventory and collector-side joins |
| `${CLAUDE_PLUGIN_ROOT}/skills/monitoring-observability/references/dashboards.md` | Dashboard layout conventions |
| `${CLAUDE_PLUGIN_ROOT}/skills/monitoring-observability/references/structured-logging.md` | Structured log field conventions |
| `${CLAUDE_PLUGIN_ROOT}/skills/monitoring-observability/references/dev-agent-lens.md` | LiteLLM proxy layer for API-boundary observability |
| `${CLAUDE_PLUGIN_ROOT}/skills/monitoring-observability/examples/orchestkit-monitoring-dashboard.md` | Worked monitoring dashboard example |
| `${CLAUDE_PLUGIN_ROOT}/skills/monitoring-observability/scripts` | Templates: Prometheus, OpenTelemetry, health checks, Langfuse |

## Related Skills

- `defense-in-depth` - Layer 8 observability as part of security architecture
- `devops-deployment` - Observability integration with CI/CD and Kubernetes
- `resilience-patterns` - Monitoring circuit breakers and failure scenarios
- `llm-evaluation` - Evaluation patterns that integrate with Langfuse scoring
- `caching` - Caching strategies that reduce costs tracked by Langfuse

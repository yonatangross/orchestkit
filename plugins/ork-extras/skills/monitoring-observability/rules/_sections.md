---
title: Monitoring & Observability Rule Categories
version: 3.0.0
---

# Rule Categories

Total: 5 rules across 3 categories. Prometheus instrumentation, alert-rule authoring, cost
tracking, eval scoring and drift detection were removed as upstream restatement; see the
"Upstream coverage" table in `../SKILL.md` for where each topic now lives, and
`../references/ork-delta.md` for the ork-specific residue that survived.

## 1. Infrastructure Monitoring (monitoring), CRITICAL, 1 rule

Dashboard and health-check patterns. Metric instrumentation and Alertmanager syntax are upstream.

- `monitoring-grafana.md`: Golden Signals dashboards, SLO/SLI definitions, health checks

## 2. LLM Observability (llm), HIGH, 1 rule

Langfuse-based tracing for LLM applications.

- `llm-langfuse-traces.md`: @observe decorator, OTEL SpanProcessor, Agent Graphs, observation types

## 3. Silent Failures (silent), HIGH, 3 rules

Detection and alerting for silent failures in LLM agents: tool skipping, quality degradation,
and behavioral anomalies.

- `silent-tool-skipping.md`: Expected vs actual tool calls, Langfuse trace validation, agent profiles
- `silent-degraded-quality.md`: Heuristic plus LLM-as-judge quality checks, z-score baseline anomaly detection
- `silent-alerting.md`: Loop detection, token spikes, severity-based escalation, quarantine patterns

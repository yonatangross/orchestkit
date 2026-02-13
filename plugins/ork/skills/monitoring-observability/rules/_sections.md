---
title: Monitoring & Observability Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Infrastructure Monitoring (monitoring) — CRITICAL — 3 rules

Prometheus metrics, Grafana dashboards, and alerting for application health.

- `monitoring-prometheus.md` — RED method, counters, histograms, cardinality management
- `monitoring-grafana.md` — Golden Signals dashboards, SLO/SLI definitions, health checks
- `monitoring-alerting.md` — Severity levels, grouping, inhibition, escalation, fatigue prevention

## 2. LLM Observability (llm) — HIGH — 3 rules

Langfuse-based tracing, cost tracking, and evaluation for LLM applications.

- `llm-langfuse-traces.md` — @observe decorator, OTEL SpanProcessor, Agent Graphs, observation types
- `llm-cost-tracking.md` — Automatic token counting, spend alerts, Metrics API, custom pricing
- `llm-eval-scoring.md` — Custom scoring, evaluator tracing, multi-judge evaluation, score analytics

## 3. Drift Detection (drift) — HIGH — 3 rules

Statistical and quality drift detection for production LLM systems.

- `drift-statistical.md` — PSI, KS test, KL divergence, EWMA dynamic thresholds
- `drift-quality.md` — Score regression, baseline comparison, canary prompts, embedding drift
- `drift-alerting.md` — Dynamic thresholds, correlation with performance, anti-patterns

---
title: Performance Testing Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Load Testing (perf) — MEDIUM — 3 rules

Load and stress testing patterns for API performance validation.

- `perf-k6.md` — k6 load test stages, p95 thresholds, check() assertions
- `perf-locust.md` — Locust HttpUser tasks, on_start authentication, wait_time simulation
- `perf-types.md` — Load/stress/spike/soak test classification, traffic profiles, CI integration

## 2. Test Execution (pytest) — HIGH — 3 rules

Pytest infrastructure for fast, organized test execution.

- `execution.md` — Coverage reporting, --maxfail CI feedback, --lf iteration, threshold enforcement
- `pytest-execution.md` — Custom markers, pytest-xdist parallel execution, selective test runs
- `pytest-plugins.md` — Factory fixtures, pytest hooks, pytest-asyncio auto mode

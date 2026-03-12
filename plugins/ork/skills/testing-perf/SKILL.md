---
name: testing-perf
license: MIT
compatibility: "Claude Code 2.1.74+."
description: Performance and load testing patterns — k6 load tests, Locust stress tests, pytest execution optimization (xdist parallel, plugins), test type classification, and performance benchmarking. Use when writing load tests, optimizing test execution speed, or setting up pytest infrastructure.
tags: [testing, performance, k6, locust, pytest, load-testing, benchmarking]
context: fork
agent: test-generator
version: 2.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Performance & Load Testing Patterns

Focused skill for performance testing, load testing, and pytest execution optimization. Covers k6, Locust, pytest-xdist parallel execution, custom plugins, and test type classification.

## Quick Reference

| Area | File | Purpose |
|------|------|---------|
| **k6 Load Testing** | `rules/perf-k6.md` | Thresholds, stages, custom metrics, CI integration |
| **Locust Testing** | `rules/perf-locust.md` | Python load tests, task weighting, auth flows |
| **Test Types** | `rules/perf-types.md` | Load, stress, spike, soak test patterns |
| **Execution** | `rules/execution.md` | Coverage reporting, parallel execution, failure analysis |
| **Pytest Markers** | `rules/pytest-execution.md` | Custom markers, xdist parallel, worker isolation |
| **Pytest Plugins** | `rules/pytest-plugins.md` | Factory fixtures, plugin hooks, anti-patterns |
| **k6 Patterns** | `references/k6-patterns.md` | Staged ramp-up, authenticated requests, test types |
| **xdist Parallel** | `references/xdist-parallel.md` | Distribution modes, worker isolation, CI config |
| **Custom Plugins** | `references/custom-plugins.md` | conftest plugins, installable plugins, hook reference |
| **Perf Checklist** | `checklists/performance-checklist.md` | Planning, setup, metrics, load patterns, analysis |
| **Pytest Checklist** | `checklists/pytest-production-checklist.md` | Config, markers, parallel, fixtures, CI/CD |
| **Test Template** | `scripts/test-case-template.md` | Full test case documentation template |

## k6 Quick Start

Set up a load test with thresholds and staged ramp-up:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up
    { duration: '1m', target: 20 },   // Steady state
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95th percentile under 500ms
    http_req_failed: ['rate<0.01'],    // Less than 1% error rate
  },
};

export default function () {
  const res = http.get('http://localhost:8000/api/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(1);
}
```

Run: `k6 run --out json=results.json tests/load/api.js`

## Performance Test Types

| Type | Duration | VUs | Purpose | When to Use |
|------|----------|-----|---------|-------------|
| **Load** | 5-10 min | Expected traffic | Validate normal conditions | Every release |
| **Stress** | 10-20 min | 2-3x expected | Find breaking point | Pre-launch |
| **Spike** | 5 min | Sudden 10x surge | Test auto-scaling | Before events |
| **Soak** | 4-12 hours | Normal load | Detect memory leaks | Weekly/nightly |

## pytest Parallel Execution

Speed up test suites with pytest-xdist:

```toml
# pyproject.toml
[tool.pytest.ini_options]
addopts = ["-n", "auto", "--dist", "loadscope"]
markers = [
    "slow: marks tests as slow",
    "smoke: critical path tests for CI/CD",
]
```

```bash
# Run with parallel workers and coverage
pytest -n auto --dist loadscope --cov=app --cov-report=term-missing --maxfail=3

# CI fast path — skip slow tests
pytest -m "not slow" -n auto

# Debug mode — single worker
pytest -n 0 -x --tb=long
```

## Worker Database Isolation

When running parallel tests with databases, isolate per worker:

```python
@pytest.fixture(scope="session")
def db_engine(worker_id):
    db_name = f"test_db_{worker_id}" if worker_id != "master" else "test_db"
    engine = create_engine(f"postgresql://localhost/{db_name}")
    yield engine
    engine.dispose()
```

## Key Thresholds

| Metric | Target | Tool |
|--------|--------|------|
| p95 response time | < 500ms | k6 |
| p99 response time | < 1000ms | k6 |
| Error rate | < 1% | k6 / Locust |
| Business logic coverage | 90% | pytest-cov |
| Critical path coverage | 100% | pytest-cov |

## Decision Guide

| Scenario | Recommendation |
|----------|----------------|
| JavaScript/TypeScript team | k6 for load testing |
| Python team | Locust for load testing |
| Need CI thresholds | k6 (built-in threshold support) |
| Need distributed testing | Locust (built-in distributed mode) |
| Slow test suite | pytest-xdist with `-n auto` |
| Flaky parallel tests | `--dist loadscope` for fixture grouping |
| DB-heavy tests | Worker-isolated databases with `worker_id` |

## Related Skills

- `ork:testing-unit` — Unit testing patterns, pytest fixtures
- `ork:testing-e2e` — End-to-end performance testing with Playwright
- `ork:performance` — Core Web Vitals and optimization patterns

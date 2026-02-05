---
name: performance-testing
description: Performance and load testing with k6 and Locust. Use when validating system performance under load, stress testing, identifying bottlenecks, or establishing performance baselines.
tags: [testing, performance, load, stress]
context: fork
agent: metrics-architect
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# Performance Testing

Validate system behavior under load.

## k6 Load Test (JavaScript)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up
    { duration: '1m', target: 20 },   // Steady
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% under 500ms
    http_req_failed: ['rate<0.01'],    // <1% errors
  },
};

export default function () {
  const res = http.get('http://localhost:8500/api/health');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

## Locust Load Test (Python)

```python
from locust import HttpUser, task, between

class APIUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def get_analyses(self):
        self.client.get("/api/analyses")

    @task(1)
    def create_analysis(self):
        self.client.post(
            "/api/analyses",
            json={"url": "https://example.com"}
        )

    def on_start(self):
        """Login before tasks."""
        self.client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "password"
        })
```

## Test Types

### Load Test
```javascript
// Normal expected load
export const options = {
  vus: 50,           // Virtual users
  duration: '5m',    // Duration
};
```

### Stress Test
```javascript
// Find breaking point
export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '2m', target: 400 },
  ],
};
```

### Spike Test
```javascript
// Sudden traffic surge
export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '1s', target: 1000 },  // Spike!
    { duration: '3m', target: 1000 },
    { duration: '10s', target: 10 },
  ],
};
```

### Soak Test
```javascript
// Sustained load (memory leaks)
export const options = {
  vus: 50,
  duration: '4h',
};
```

## Metrics to Track

```javascript
import { Trend, Counter, Rate } from 'k6/metrics';

const responseTime = new Trend('response_time');
const errors = new Counter('errors');
const successRate = new Rate('success_rate');

export default function () {
  const start = Date.now();
  const res = http.get('http://localhost:8500/api/data');

  responseTime.add(Date.now() - start);

  if (res.status !== 200) {
    errors.add(1);
    successRate.add(false);
  } else {
    successRate.add(true);
  }
}
```

## CI Integration

```yaml
# GitHub Actions
- name: Run k6 load test
  run: |
    k6 run --out json=results.json tests/load/api.js

- name: Check thresholds
  run: |
    if [ $(jq '.thresholds | .[] | select(.ok == false)' results.json | wc -l) -gt 0 ]; then
      exit 1
    fi
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Tool | k6 (JS), Locust (Python) |
| Load profile | Start with expected traffic |
| Thresholds | p95 < 500ms, errors < 1% |
| Duration | 5-10 min for load, 4h+ for soak |

## Common Mistakes

- Testing against production without protection
- No warmup period
- Unrealistic load profiles
- Missing error rate thresholds

## Related Skills

- `observability-monitoring` - Metrics collection
- `performance-optimization` - Fixing bottlenecks
- `e2e-testing` - Functional validation

## Capability Details

### load-testing
**Keywords:** load test, concurrent users, k6, Locust, ramp up
**Solves:**
- Simulate concurrent user load
- Configure ramp-up patterns
- Test system under expected load

### stress-testing
**Keywords:** stress test, breaking point, peak load, overload
**Solves:**
- Find system breaking points
- Test beyond expected capacity
- Identify failure modes under stress

### latency-measurement
**Keywords:** latency, response time, p95, p99, percentile
**Solves:**
- Measure response time percentiles
- Track latency distribution
- Set latency SLO thresholds

### throughput-testing
**Keywords:** throughput, requests per second, RPS, TPS
**Solves:**
- Measure maximum throughput
- Test transactions per second
- Verify capacity requirements

### bottleneck-identification
**Keywords:** bottleneck, profiling, hot path, performance issue
**Solves:**
- Identify performance bottlenecks
- Profile critical code paths
- Diagnose slow operations

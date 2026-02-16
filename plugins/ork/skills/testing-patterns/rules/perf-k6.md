---
title: "Performance: k6 Patterns"
category: perf
impact: MEDIUM
impactDescription: "Establishes load testing thresholds and patterns for API performance validation with k6"
tags: performance, k6, load-testing, thresholds, ci
---

# k6 Load Testing

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

## Custom Metrics

```javascript
import { Trend, Counter, Rate } from 'k6/metrics';

const responseTime = new Trend('response_time');
const errors = new Counter('errors');
const successRate = new Rate('success_rate');
```

## CI Integration

```yaml
- name: Run k6 load test
  run: k6 run --out json=results.json tests/load/api.js
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Thresholds | p95 < 500ms, errors < 1% |
| Duration | 5-10 min for load, 4h+ for soak |

**Incorrect — No thresholds, tests pass even with poor performance:**
```javascript
export const options = {
  stages: [{ duration: '1m', target: 20 }]
  // Missing: thresholds for response time and errors
};
```

**Correct — Thresholds enforce performance requirements:**
```javascript
export const options = {
  stages: [{ duration: '1m', target: 20 }],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01']
  }
};
```

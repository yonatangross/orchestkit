# k6 Load Testing Patterns

Common patterns for effective performance testing with k6.

## Implementation

### Staged Ramp-Up Pattern

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 100 },  // Ramp to 100 users
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const res = http.get('http://localhost:8000/api/health');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'body contains status': (r) => r.body.includes('ok'),
  });

  sleep(Math.random() * 2 + 1); // 1-3 second think time
}
```

### Authenticated Requests Pattern

```javascript
import http from 'k6/http';
import { check } from 'k6';

export function setup() {
  const loginRes = http.post('http://localhost:8000/api/auth/login', {
    email: 'loadtest@example.com',
    password: 'testpassword',
  });

  return { token: loginRes.json('access_token') };
}

export default function (data) {
  const params = {
    headers: { Authorization: `Bearer ${data.token}` },
  };

  const res = http.get('http://localhost:8000/api/protected', params);
  check(res, { 'authenticated request ok': (r) => r.status === 200 });
}
```

## Test Types Summary

| Type | Duration | VUs | Purpose |
|------|----------|-----|---------|
| Smoke | 1 min | 1-5 | Verify script works |
| Load | 5-10 min | Expected | Normal traffic |
| Stress | 10-20 min | 2-3x expected | Find limits |
| Soak | 4-12 hours | Normal | Memory leaks |

## Checklist

- [ ] Define realistic thresholds (p95, p99, error rate)
- [ ] Include proper ramp-up period (avoid cold start)
- [ ] Add think time between requests (sleep)
- [ ] Use checks for functional validation
- [ ] Externalize configuration (stages, VUs)
- [ ] Run smoke test before full load test
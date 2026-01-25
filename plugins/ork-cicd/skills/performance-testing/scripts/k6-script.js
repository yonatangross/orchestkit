// Template: k6 Load Test Script
// Usage: Customize BASE_URL, endpoints, and thresholds for your API

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export const options = {
  // Test scenarios
  scenarios: {
    // Smoke test: Quick validation
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { test_type: 'smoke' },
    },
    // Load test: Normal expected traffic
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },   // Ramp up
        { duration: '3m', target: 50 },   // Steady state
        { duration: '1m', target: 0 },    // Ramp down
      ],
      startTime: '30s', // Start after smoke
      tags: { test_type: 'load' },
    },
  },

  // Performance thresholds
  thresholds: {
    http_req_duration: [
      'p(50)<200',   // 50% of requests under 200ms
      'p(95)<500',   // 95% of requests under 500ms
      'p(99)<1000',  // 99% of requests under 1s
    ],
    http_req_failed: ['rate<0.01'],  // Less than 1% failures
    checks: ['rate>0.99'],           // 99% of checks pass
    'api_response_time': ['p(95)<400'],
  },
};

// ============================================================================
// CUSTOM METRICS
// ============================================================================

const apiResponseTime = new Trend('api_response_time');
const apiErrors = new Counter('api_errors');
const apiSuccessRate = new Rate('api_success_rate');

// ============================================================================
// SETUP (runs once before all VUs)
// ============================================================================

export function setup() {
  console.log(`Testing against: ${BASE_URL}`);

  // Optional: Authenticate and get token
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: __ENV.TEST_USER || 'loadtest@example.com',
    password: __ENV.TEST_PASSWORD || 'testpassword',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const token = loginRes.json('access_token');
  if (!token) {
    console.warn('Authentication failed, running unauthenticated tests');
  }

  return { token };
}

// ============================================================================
// MAIN TEST SCENARIO
// ============================================================================

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    ...(data.token && { Authorization: `Bearer ${data.token}` }),
  };

  // Group 1: Health Check
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api/health`);
    check(res, {
      'health status 200': (r) => r.status === 200,
      'health response < 100ms': (r) => r.timings.duration < 100,
    });
  });

  // Group 2: Read Operations (70% of traffic)
  group('Read Operations', () => {
    // TODO: Replace with your actual endpoints
    const endpoints = [
      '/api/users',
      '/api/items',
      '/api/dashboard',
    ];

    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const res = http.get(`${BASE_URL}${endpoint}`, { headers });

    const success = check(res, {
      'read status 200': (r) => r.status === 200,
      'read has body': (r) => r.body && r.body.length > 0,
    });

    apiResponseTime.add(res.timings.duration);
    apiSuccessRate.add(success);
    if (!success) apiErrors.add(1);
  });

  // Group 3: Write Operations (30% of traffic)
  if (Math.random() < 0.3) {
    group('Write Operations', () => {
      // TODO: Replace with your actual create endpoint
      const payload = JSON.stringify({
        name: `LoadTest-${Date.now()}`,
        value: Math.random() * 100,
      });

      const res = http.post(`${BASE_URL}/api/items`, payload, { headers });

      const success = check(res, {
        'create status 201': (r) => r.status === 201,
        'create returns id': (r) => r.json('id') !== undefined,
      });

      apiResponseTime.add(res.timings.duration);
      apiSuccessRate.add(success);
      if (!success) apiErrors.add(1);
    });
  }

  // Think time: simulate real user behavior
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// ============================================================================
// TEARDOWN (runs once after all VUs complete)
// ============================================================================

export function teardown(data) {
  console.log('Load test complete');
  // Optional: Cleanup test data created during the run
}

// ============================================================================
// USAGE
// ============================================================================

// Run smoke test only:
//   k6 run --env BASE_URL=http://localhost:8000 script.js --scenario smoke

// Run full load test:
//   k6 run --env BASE_URL=http://localhost:8000 script.js

// Export results:
//   k6 run --out json=results.json script.js
//   k6 run --out influxdb=http://localhost:8086/k6 script.js
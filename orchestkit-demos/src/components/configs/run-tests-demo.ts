/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:run-tests skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const runTestsDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "run-tests",
  skillCommand: "/ork:run-tests",
  hook: "Parallel test execution at scale",
  primaryColor: "#22c55e",
  secondaryColor: "#3b82f6",
  accentColor: "#f59e0b",

  phases: [
    { name: "Discover Tests", shortName: "Discover" },
    { name: "Spawn Runners", shortName: "Spawn" },
    { name: "Execute Parallel", shortName: "Execute" },
    { name: "Aggregate Results", shortName: "Aggregate" },
    { name: "Generate Report", shortName: "Report" },
  ],

  // SIMPLE LEVEL - Single test file
  simple: {
    name: "Simple",
    description: "run utils tests",
    inputCount: 1,
    files: [
      {
        name: "tests/",
        status: "completed",
        children: [
          { name: "utils.test.ts", status: "completed", lines: 89 },
        ],
      },
    ],
    references: [
      { name: "test-patterns", status: "loaded", category: "testing" },
      { name: "vitest-runner", status: "loaded", category: "tools" },
    ],
    claudeResponse: [
      "Running test suite:",
      "",
      "• Files: 1",
      "• Tests: 12",
      "• Runner: Vitest",
      "• Mode: Sequential",
    ],
    codeSnippet: `TEST EXECUTION COMPLETE
──────────────────────
Suite: tests/utils.test.ts

Results:
 ✓ formatDate
   ✓ formats ISO date correctly (2ms)
   ✓ handles null input (1ms)
   ✓ handles invalid date (1ms)

 ✓ slugify
   ✓ converts spaces to hyphens (1ms)
   ✓ removes special characters (1ms)
   ✓ handles unicode (2ms)

 ✓ truncate
   ✓ truncates long strings (1ms)
   ✓ preserves short strings (1ms)
   ✓ handles custom suffix (1ms)

 ✓ capitalize
   ✓ capitalizes first letter (1ms)
   ✓ handles empty string (1ms)
   ✓ handles all caps (1ms)

Summary:
├─ Tests: 12 passed
├─ Duration: 156ms
├─ Coverage: 98%
└─ Status: PASSED ✓`,
    completionTime: "2s",
    metrics: {
      Tests: "12/12",
      Duration: "156ms",
      Coverage: "98%",
    },
  },

  // MEDIUM LEVEL - Multiple test suites
  medium: {
    name: "Medium",
    description: "run feature tests",
    inputCount: 8,
    files: [
      {
        name: "tests/",
        status: "completed",
        children: [
          {
            name: "unit/",
            status: "completed",
            children: [
              { name: "auth.test.ts", status: "completed", lines: 156 },
              { name: "users.test.ts", status: "completed", lines: 134 },
              { name: "payments.test.ts", status: "completed", lines: 189 },
            ],
          },
          {
            name: "integration/",
            status: "completed",
            children: [
              { name: "api.test.ts", status: "completed", lines: 234 },
              { name: "database.test.ts", status: "writing", lines: 167 },
            ],
          },
        ],
      },
    ],
    references: [
      { name: "test-patterns", status: "loaded", category: "testing" },
      { name: "parallel-testing", status: "loaded", category: "perf" },
      { name: "test-isolation", status: "loading", category: "patterns" },
    ],
    claudeResponse: [
      "Running test suites in parallel:",
      "",
      "• Suites: 5",
      "• Tests: 67",
      "• Runners: 4 parallel",
      "• Mode: Parallel + Isolated",
      "• Database: Test containers",
    ],
    codeSnippet: `TEST EXECUTION COMPLETE
──────────────────────
Project: feature-tests

Parallel Execution:
┌─ Runner 1: unit/auth.test.ts
│  ✓ 18/18 tests passed (234ms)
│
├─ Runner 2: unit/users.test.ts
│  ✓ 14/14 tests passed (189ms)
│
├─ Runner 3: unit/payments.test.ts
│  ✓ 21/21 tests passed (312ms)
│
├─ Runner 4: integration/api.test.ts
│  ✓ 12/12 tests passed (567ms)
│
└─ Runner 4: integration/database.test.ts
   ✓ 2/2 tests passed (1.2s)

Results by Category:
├─ Unit Tests: 53/53 passed
│   ├─ auth: 18 tests
│   ├─ users: 14 tests
│   └─ payments: 21 tests
│
└─ Integration Tests: 14/14 passed
    ├─ api: 12 tests
    └─ database: 2 tests

Coverage Report:
├─ Statements: 89%
├─ Branches: 82%
├─ Functions: 91%
└─ Lines: 88%

Summary:
├─ Total: 67/67 passed (100%)
├─ Duration: 1.8s (parallel)
│   └─ Sequential would be: 4.2s
├─ Speedup: 2.3x
└─ Status: PASSED ✓`,
    completionTime: "8s",
    metrics: {
      Tests: "67/67",
      Runners: "4",
      Duration: "1.8s",
      Coverage: "89%",
    },
  },

  // ADVANCED LEVEL - Full CI test suite
  advanced: {
    name: "Advanced",
    description: "run CI test suite",
    inputCount: 45,
    files: [
      {
        name: "tests/",
        status: "completed",
        children: [
          {
            name: "unit/",
            status: "completed",
            children: [
              { name: "auth/", status: "completed", lines: 0 },
              { name: "users/", status: "completed", lines: 0 },
              { name: "payments/", status: "completed", lines: 0 },
              { name: "orders/", status: "completed", lines: 0 },
            ],
          },
          {
            name: "integration/",
            status: "completed",
            children: [
              { name: "api/", status: "completed", lines: 0 },
              { name: "database/", status: "completed", lines: 0 },
              { name: "cache/", status: "completed", lines: 0 },
            ],
          },
          {
            name: "e2e/",
            status: "completed",
            children: [
              { name: "checkout.spec.ts", status: "completed", lines: 456 },
              { name: "auth.spec.ts", status: "completed", lines: 345 },
              { name: "profile.spec.ts", status: "writing", lines: 234 },
            ],
          },
          {
            name: "performance/",
            status: "pending",
            children: [
              { name: "load.test.ts", status: "pending", lines: 0 },
            ],
          },
        ],
      },
    ],
    references: [
      { name: "test-patterns", status: "loaded", category: "testing" },
      { name: "parallel-testing", status: "loaded", category: "perf" },
      { name: "e2e-testing", status: "loaded", category: "testing" },
      { name: "performance-testing", status: "loaded", category: "perf" },
      { name: "test-reporting", status: "loading", category: "ci" },
    ],
    claudeResponse: [
      "Running full CI test suite:",
      "",
      "• Suites: 45",
      "• Tests: 312",
      "• Runners: 8 parallel",
      "• E2E: 3 browser scenarios",
      "• Performance: Load testing",
      "• Containers: PostgreSQL, Redis",
      "• Report: JUnit + HTML",
    ],
    codeSnippet: `TEST EXECUTION COMPLETE
──────────────────────
Project: full-ci-suite

EXECUTION SUMMARY:
╔════════════════════════════════════════════════════════════╗
║ CI TEST SUITE PASSED                                       ║
╚════════════════════════════════════════════════════════════╝

┌─ Test Distribution (8 runners)
│  ├─ Runner 1-4: Unit tests (parallel)
│  ├─ Runner 5-6: Integration tests
│  ├─ Runner 7: E2E tests (Playwright)
│  └─ Runner 8: Performance tests (k6)
│
├─ Unit Tests (234 tests)
│  ├─ auth/: 45 tests ✓ (312ms)
│  ├─ users/: 38 tests ✓ (267ms)
│  ├─ payments/: 52 tests ✓ (423ms)
│  ├─ orders/: 41 tests ✓ (356ms)
│  ├─ products/: 28 tests ✓ (198ms)
│  └─ utils/: 30 tests ✓ (145ms)
│  Total: 234/234 passed (1.7s)
│
├─ Integration Tests (56 tests)
│  ├─ api/: 28 tests ✓ (2.3s)
│  │   ├─ REST endpoints: 18 tests
│  │   └─ GraphQL resolvers: 10 tests
│  │
│  ├─ database/: 18 tests ✓ (3.1s)
│  │   ├─ Migrations: 8 tests
│  │   ├─ Queries: 6 tests
│  │   └─ Transactions: 4 tests
│  │
│  └─ cache/: 10 tests ✓ (1.2s)
│      ├─ Redis operations: 6 tests
│      └─ Invalidation: 4 tests
│  Total: 56/56 passed (6.6s)
│
├─ E2E Tests (18 scenarios)
│  ├─ checkout.spec.ts: 8 scenarios ✓
│  │   ├─ Guest checkout (12.3s)
│  │   ├─ Registered user checkout (10.1s)
│  │   ├─ Payment failure handling (8.4s)
│  │   ├─ Coupon application (6.2s)
│  │   └─ ... +4 more
│  │
│  ├─ auth.spec.ts: 6 scenarios ✓
│  │   ├─ Login flow (5.6s)
│  │   ├─ Registration (7.2s)
│  │   ├─ Password reset (8.1s)
│  │   └─ ... +3 more
│  │
│  └─ profile.spec.ts: 4 scenarios ✓
│      ├─ Update profile (4.3s)
│      └─ ... +3 more
│  Total: 18/18 passed (45.2s)
│  Browser: Chromium (headed: false)
│
├─ Performance Tests (4 scenarios)
│  ├─ Load Test: API endpoints
│  │   ├─ VUs: 100 concurrent
│  │   ├─ Duration: 60s
│  │   ├─ Requests: 12,456
│  │   ├─ p95 latency: 89ms ✓ (<100ms)
│  │   └─ Error rate: 0.02% ✓ (<1%)
│  │
│  └─ Stress Test: Peak load
│      ├─ VUs: 500 concurrent
│      ├─ Duration: 30s
│      ├─ Requests: 8,234
│      ├─ p95 latency: 234ms ✓ (<500ms)
│      └─ Error rate: 0.8% ✓ (<5%)
│  Total: 4/4 passed (92.1s)
│
├─ Test Infrastructure
│  ├─ Containers Started:
│  │   ✓ PostgreSQL 16 (test data seeded)
│  │   ✓ Redis 7 (clean state)
│  │   ✓ LocalStack (S3, SQS mocked)
│  │
│  ├─ Test Isolation:
│  │   ✓ Database transactions rolled back
│  │   ✓ Redis flushed between suites
│  │   ✓ No test pollution detected
│  │
│  └─ Cleanup:
│      ✓ Containers stopped
│      ✓ Temp files removed
│      ✓ Ports released
│
├─ Coverage Report
│  ├─ Statements: 91.2% (target: 90%) ✓
│  ├─ Branches: 84.7% (target: 80%) ✓
│  ├─ Functions: 93.1% (target: 90%) ✓
│  ├─ Lines: 90.8% (target: 90%) ✓
│  │
│  └─ Uncovered Areas:
│      ⚠ src/legacy/deprecated.ts (0%)
│      ⚠ src/utils/rarely-used.ts (45%)
│      ⚠ src/edge-cases/ (67%)
│
├─ Flaky Test Detection
│  ✓ No flaky tests detected
│  ✓ All tests deterministic
│  ✓ Retry count: 0
│
├─ Reports Generated
│  ├─ JUnit XML: test-results.xml
│  ├─ HTML Report: coverage/index.html
│  ├─ Cobertura: coverage/cobertura.xml
│  └─ Performance: k6-results.json
│
└─ Timing Summary
   ├─ Total Duration: 2m 34s (parallel)
   ├─ Sequential Estimate: 8m 45s
   ├─ Speedup: 3.4x
   │
   ├─ Breakdown:
   │   Unit: 1.7s (7%)
   │   Integration: 6.6s (4%)
   │   E2E: 45.2s (29%)
   │   Performance: 92.1s (60%)
   │
   └─ CI Pipeline Status: PASSED ✓

FINAL RESULTS:
╔════════════════════════════════════════════════════════════╗
║  312 tests passed | 0 failed | 0 skipped                   ║
║  Coverage: 91.2% | Duration: 2m 34s | Status: PASSED       ║
╚════════════════════════════════════════════════════════════╝`,
    completionTime: "2m 34s",
    metrics: {
      Tests: "312/312",
      Runners: "8",
      Duration: "2m 34s",
      Coverage: "91.2%",
      Speedup: "3.4x",
    },
  },

  summaryTitle: "TEST SUITE PASSED",
  summaryTagline: "Parallel execution. Full coverage. Ship with confidence.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default runTestsDemoConfig;

/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:fix-issue skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const fixIssueDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "fix-issue",
  skillCommand: "/ork:fix-issue",
  hook: "From bug report to merged fix in minutes",
  primaryColor: "#ef4444",
  secondaryColor: "#22c55e",
  accentColor: "#f59e0b",

  phases: [
    { name: "Understand", shortName: "Read" },
    { name: "Hypothesize", shortName: "RCA" },
    { name: "Parallel Analysis", shortName: "Analyze" },
    { name: "Implement", shortName: "Fix" },
    { name: "Validate", shortName: "Test" },
    { name: "Prevent", shortName: "Guard" },
  ],

  // SIMPLE LEVEL - Simple typo/config fix
  simple: {
    name: "Simple",
    description: "fix-issue 123 (config typo)",
    inputCount: 1,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          { name: "config/app.ts", status: "completed", lines: 8 },
        ],
      },
      {
        name: "tests/",
        status: "completed",
        children: [
          { name: "config.test.ts", status: "completed", lines: 12 },
        ],
      },
    ],
    references: [
      { name: "hypothesis-rca", status: "loaded", category: "debug" },
      { name: "commit", status: "loaded", category: "git" },
    ],
    claudeResponse: [
      "Fixing issue #123:",
      "",
      "• Type: Configuration error",
      "• Root cause: Typo in env var name",
      "• Confidence: 95%",
      "• Fix: 1 line change",
    ],
    codeSnippet: `ISSUE #123: App fails to start in production
────────────────────────────────────────────

HYPOTHESIS FORMATION
────────────────────
H1: Environment variable typo (95% confidence)
    Test: Check env var spelling in config
    Result: CONFIRMED - DATABASE_ULR vs DATABASE_URL

SIMILAR ISSUES
──────────────
#89 (3 months ago) - Similar typo in API_KEY
Status: Closed, same root cause pattern

ROOT CAUSE ANALYSIS
───────────────────
[Debug Agent] Root cause: Line 12 in config/app.ts
              DATABASE_ULR should be DATABASE_URL

FIX IMPLEMENTATION
──────────────────
- config/app.ts: Fix typo DATABASE_ULR → DATABASE_URL
+ tests/config.test.ts: Add env var validation test

PREVENTION
──────────
✓ Added: Env var existence check at startup
✓ Added: Test case for all required env vars
✓ Runbook: Check env vars first on startup failure

VALIDATION
──────────
✓ Unit tests: 4/4 passing
✓ App starts successfully
✓ No regression

PR #124: fix(#123): correct DATABASE_URL env var typo
→ https://github.com/org/repo/pull/124`,
    completionTime: "45s",
    metrics: {
      Hypotheses: "1",
      Confidence: "95%",
      Files: "2",
    },
  },

  // MEDIUM LEVEL - Logic bug with multiple hypotheses
  medium: {
    name: "Medium",
    description: "fix-issue 456 (race condition)",
    inputCount: 5,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          {
            name: "services/",
            status: "completed",
            children: [
              { name: "order.service.ts", status: "completed", lines: 67 },
              { name: "inventory.service.ts", status: "completed", lines: 45 },
            ],
          },
          {
            name: "utils/",
            status: "completed",
            children: [
              { name: "lock.ts", status: "completed", lines: 34 },
            ],
          },
        ],
      },
      {
        name: "tests/",
        status: "completed",
        children: [
          { name: "order.test.ts", status: "completed", lines: 89 },
        ],
      },
    ],
    references: [
      { name: "hypothesis-rca", status: "loaded", category: "debug" },
      { name: "prevention-patterns", status: "loaded", category: "quality" },
      { name: "debug-investigator", status: "loading", category: "debug" },
    ],
    claudeResponse: [
      "Fixing issue #456:",
      "",
      "• Type: Race condition",
      "• Root cause: Missing lock",
      "• 3 hypotheses tested",
      "• 5 agents analyzing",
    ],
    codeSnippet: `ISSUE #456: Duplicate orders created intermittently
──────────────────────────────────────────────────

HYPOTHESIS FORMATION
────────────────────
H1: Race condition in order creation (75% confidence)
    Test: Check for concurrent order handling
    Result: CONFIRMED

H2: Database transaction isolation (60% confidence)
    Test: Check isolation level
    Result: NOT ROOT CAUSE (isolation is correct)

H3: Cache stale read (45% confidence)
    Test: Check cache invalidation
    Result: NOT ROOT CAUSE

PARALLEL ANALYSIS (5 Agents)
────────────────────────────
[Debug Investigator #1]
  Root cause: orderService.create() not atomic
  Location: order.service.ts:45

[Debug Investigator #2]
  Impact: 12 duplicate orders in production
  Affected: 8 customers, $2,400 in refunds

[Backend Architect]
  Fix: Add distributed lock using Redis
  Pattern: Optimistic locking with retry

[Frontend Developer]
  Fix: Add idempotency key to order button
  Prevents: Double-click submissions

[Test Generator]
  Required: Concurrent order creation test
  Coverage: Add race condition test suite

FIX DESIGN
──────────
Files to modify:
  - order.service.ts (add Redis lock)
  - inventory.service.ts (add atomic decrement)
  - lock.ts (new distributed lock utility)

FIX IMPLEMENTATION
──────────────────
+ Added Redis distributed lock on order creation
+ Added idempotency key validation
+ Added concurrent order tests

PREVENTION
──────────
✓ Automated: Concurrent order test in CI
✓ Validation: Idempotency key required on all mutations
✓ Runbook: Added "duplicate order" diagnosis steps

VALIDATION
──────────
✓ Unit tests: 24/24 passing
✓ Concurrent test: PASS (100 parallel orders)
✓ No duplicates after 1000 test runs

PR #457: fix(#456): add distributed lock to prevent duplicate orders
→ https://github.com/org/repo/pull/457`,
    completionTime: "4m 12s",
    metrics: {
      Hypotheses: "3",
      Agents: "5",
      Files: "5",
    },
  },

  // ADVANCED LEVEL - Complex cross-system bug
  advanced: {
    name: "Advanced",
    description: "fix-issue 789 (data corruption)",
    inputCount: 12,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          {
            name: "modules/sync/",
            status: "completed",
            children: [
              { name: "sync.service.ts", status: "completed", lines: 234 },
              { name: "conflict-resolver.ts", status: "completed", lines: 167 },
              { name: "event-sourcing.ts", status: "writing", lines: 189 },
            ],
          },
          {
            name: "modules/cache/",
            status: "completed",
            children: [
              { name: "invalidation.ts", status: "completed", lines: 89 },
            ],
          },
          {
            name: "modules/db/",
            status: "completed",
            children: [
              { name: "transaction.ts", status: "completed", lines: 145 },
              { name: "migration-fix.sql", status: "completed", lines: 34 },
            ],
          },
        ],
      },
      {
        name: "tests/",
        status: "completed",
        children: [
          { name: "sync.e2e.spec.ts", status: "completed", lines: 312 },
          { name: "conflict.test.ts", status: "completed", lines: 189 },
        ],
      },
    ],
    references: [
      { name: "hypothesis-rca", status: "loaded", category: "debug" },
      { name: "prevention-patterns", status: "loaded", category: "quality" },
      { name: "debug-investigator", status: "loaded", category: "debug" },
      { name: "similar-issue-search", status: "loaded", category: "memory" },
      { name: "runbook-entry-template", status: "loading", category: "ops" },
    ],
    claudeResponse: [
      "Fixing issue #789:",
      "",
      "• Type: Data corruption",
      "• Root cause: Event ordering bug",
      "• 5 hypotheses tested",
      "• 5 agents + 2 specialists",
      "• Cross-system fix required",
    ],
    codeSnippet: `ISSUE #789: Customer data randomly corrupted after sync
──────────────────────────────────────────────────────

SIMILAR ISSUES DETECTED
───────────────────────
#512 (6 months ago) - Similar sync corruption
  Root cause: Different (network timeout)
  Relevance: 40% - Different trigger, same symptoms

#234 (1 year ago) - Data inconsistency
  Root cause: Cache invalidation race
  Relevance: 85% - Similar pattern, may be regression

HYPOTHESIS FORMATION
────────────────────
H1: Event ordering violation (85% confidence)
    Test: Check event timestamps vs processing order
    Result: CONFIRMED - Events processed out of order

H2: Cache invalidation race (70% confidence)
    Test: Check cache vs DB state
    Result: CONTRIBUTING FACTOR

H3: Transaction isolation leak (55% confidence)
    Test: Check concurrent transaction interleaving
    Result: NOT ROOT CAUSE

H4: Network partition handling (40% confidence)
    Test: Simulate network failures
    Result: NOT ROOT CAUSE

H5: Clock skew between services (30% confidence)
    Test: Check NTP sync
    Result: NOT ROOT CAUSE

PARALLEL ANALYSIS (7 Agents)
────────────────────────────
[Debug Investigator #1]
  Root cause: sync.service.ts:89 processes events
  without checking logical timestamps
  Events with same physical timestamp processed randomly

[Debug Investigator #2]
  Impact analysis:
  - 47 customers affected
  - $12,500 in incorrect charges
  - 3 compliance violations logged

[Backend Architect]
  Fix: Implement vector clock ordering
  Add event sourcing with idempotent replay

[Database Engineer]
  Fix: Add event sequence number column
  Migration: Add sequence_id with unique constraint

[Cache Specialist]
  Fix: Implement write-through with sequence validation
  Invalidate cache on sequence mismatch

[Test Generator]
  Required tests:
  - Out-of-order event simulation
  - Concurrent sync stress test
  - Idempotent replay verification

[Compliance Agent]
  Actions: Log affected records for audit
  Notification: Compliance team notified

FIX DESIGN
──────────
Cross-system changes required:
1. sync.service.ts: Add vector clock ordering
2. conflict-resolver.ts: Use sequence-based resolution
3. event-sourcing.ts: Add idempotent event replay
4. invalidation.ts: Sequence-aware cache invalidation
5. transaction.ts: Add optimistic locking
6. migration-fix.sql: Add sequence_id column

FIX IMPLEMENTATION
──────────────────
Phase 1: Database migration (sequence_id)
Phase 2: Event ordering logic
Phase 3: Cache invalidation fix
Phase 4: Data repair script for affected records

PREVENTION
──────────
✓ Automated: Event ordering stress test in CI
✓ Automated: Sequence validation assertion
✓ Monitoring: Alert on sequence gaps > 0
✓ Runbook: Complete diagnosis flowchart

LESSONS LEARNED
───────────────
→ Stored in knowledge graph:
  - "Event ordering must use logical clocks, not physical"
  - "Cache invalidation must be sequence-aware"
  - "Similar to #234 - add to regression suite"

VALIDATION
──────────
✓ Unit tests: 67/67 passing
✓ E2E tests: 24/24 passing
✓ Stress test: 10,000 events, 0 corruption
✓ Data repair: 47 records corrected

PR #790: fix(#789): implement vector clock ordering for sync events
→ https://github.com/org/repo/pull/790`,
    completionTime: "18m 45s",
    metrics: {
      Hypotheses: "5",
      Agents: "7",
      Files: "12",
      Impact: "47 customers",
    },
  },

  summaryTitle: "ISSUE RESOLVED",
  summaryTagline: "Root cause found. Fix validated. Prevention in place.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default fixIssueDemoConfig;

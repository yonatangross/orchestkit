/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:assess-complexity skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const assessComplexityDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "assess-complexity",
  skillCommand: "/ork:assess-complexity",
  hook: "Know before you code: 7 metrics, 1 decision",
  primaryColor: "#f97316",
  secondaryColor: "#8b5cf6",
  accentColor: "#22c55e",

  phases: [
    { name: "Gather Metrics", shortName: "Metrics" },
    { name: "Score Criteria", shortName: "Score" },
    { name: "Calculate Total", shortName: "Calculate" },
    { name: "Decision", shortName: "Decide" },
  ],

  // SIMPLE LEVEL - Single file assessment
  simple: {
    name: "Simple",
    description: "assess utils/format.ts",
    inputCount: 1,
    files: [
      {
        name: "src/utils/format.ts",
        status: "completed",
        lines: 45,
      },
    ],
    references: [
      { name: "quality-gates", status: "loaded", category: "qa" },
      { name: "brainstorming", status: "loaded", category: "planning" },
    ],
    claudeResponse: [
      "Assessing task complexity:",
      "",
      "• 1 file analyzed",
      "• 7 complexity dimensions",
      "• Gathering codebase metrics",
      "• Calculating risk profile",
    ],
    codeSnippet: `COMPLEXITY ASSESSMENT: utils/format.ts
────────────────────────────────────────
Date: 2026-01-30
Assessor: complexity-analyzer

SCORES:
┌──────────────────────┬───────┐
│ Criterion            │ Score │
├──────────────────────┼───────┤
│ Lines of Code        │   1/5 │  (45 lines - trivial)
│ Time Estimate        │   1/5 │  (<30 min)
│ Files Affected       │   1/5 │  (single file)
│ Dependencies         │   1/5 │  (0 external deps)
│ Unknowns             │   1/5 │  (no unknowns)
│ Cross-Cutting        │   1/5 │  (isolated change)
│ Risk Level           │   1/5 │  (trivial, no risk)
├──────────────────────┼───────┤
│ TOTAL                │  7/35 │
└──────────────────────┴───────┘

RESULT:
├─ Average Score: 1.0
├─ Complexity Level: 1 (TRIVIAL)
├─ Can Proceed: YES
└─ Estimated Time: <30 minutes

RECOMMENDATION:
✓ Task is trivial - proceed immediately
✓ No breakdown required
✓ Low risk, well-understood pattern`,
    completionTime: "3s",
    metrics: {
      Score: "7/35",
      Level: "1",
      Decision: "PROCEED",
    },
  },

  // MEDIUM LEVEL - API endpoint assessment
  medium: {
    name: "Medium",
    description: "assess user auth module",
    inputCount: 6,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          { name: "auth/", status: "completed", lines: 0 },
          { name: "api/users.ts", status: "completed", lines: 156 },
          { name: "middleware/auth.ts", status: "completed", lines: 89 },
          { name: "types/user.ts", status: "completed", lines: 45 },
        ],
      },
      {
        name: "tests/",
        status: "completed",
        children: [
          { name: "auth.test.ts", status: "completed", lines: 234 },
        ],
      },
    ],
    references: [
      { name: "quality-gates", status: "loaded", category: "qa" },
      { name: "brainstorming", status: "loaded", category: "planning" },
      { name: "recall", status: "loading", category: "memory" },
    ],
    claudeResponse: [
      "Assessing auth module complexity:",
      "",
      "• 6 files in scope",
      "• 7 complexity dimensions",
      "• Cross-cutting auth concerns",
      "• Multiple integrations detected",
    ],
    codeSnippet: `COMPLEXITY ASSESSMENT: user auth module
────────────────────────────────────────
Date: 2026-01-30
Assessor: complexity-analyzer

AUTOMATED METRICS:
├─ Total Lines: 524 across 6 files
├─ Cyclomatic Complexity: 18 (moderate)
├─ Dependencies: jwt, bcrypt, passport
└─ Test Coverage: 78%

SCORES:
┌──────────────────────┬───────┬────────────────────────────┐
│ Criterion            │ Score │ Reason                     │
├──────────────────────┼───────┼────────────────────────────┤
│ Lines of Code        │   3/5 │ 524 lines (moderate)       │
│ Time Estimate        │   3/5 │ 2-8 hours estimated        │
│ Files Affected       │   3/5 │ 6 files in scope           │
│ Dependencies         │   3/5 │ 3 external deps (jwt, etc) │
│ Unknowns             │   2/5 │ Token refresh logic clear  │
│ Cross-Cutting        │   3/5 │ Auth touches 4 modules     │
│ Risk Level           │   3/5 │ Security-sensitive area    │
├──────────────────────┼───────┼────────────────────────────┤
│ TOTAL                │ 20/35 │                            │
└──────────────────────┴───────┴────────────────────────────┘

RESULT:
├─ Average Score: 2.9
├─ Complexity Level: 3 (MODERATE)
├─ Can Proceed: YES (with caution)
└─ Estimated Time: 4-6 hours

DEPENDENCY MAP:
  api/users.ts ──┬── middleware/auth.ts
                 ├── types/user.ts
                 └── services/jwt.ts (external)

RISK AREAS:
⚠ Token validation logic (line 45-67)
⚠ Password hashing (bcrypt rounds)
⚠ Session expiry handling

RECOMMENDATION:
✓ Complexity is manageable - proceed
⚠ Review security patterns before changes
⚠ Ensure test coverage stays above 80%`,
    completionTime: "12s",
    metrics: {
      Score: "20/35",
      Level: "3",
      Risk: "MEDIUM",
    },
  },

  // ADVANCED LEVEL - Enterprise system assessment
  advanced: {
    name: "Advanced",
    description: "assess payment microservice",
    inputCount: 24,
    files: [
      {
        name: "services/",
        status: "completed",
        children: [
          {
            name: "payment/",
            status: "completed",
            children: [
              { name: "processor.ts", status: "completed", lines: 456 },
              { name: "stripe.adapter.ts", status: "completed", lines: 234 },
              { name: "invoice.ts", status: "completed", lines: 189 },
              { name: "refund.ts", status: "completed", lines: 167 },
            ],
          },
          {
            name: "billing/",
            status: "completed",
            children: [
              { name: "subscription.ts", status: "completed", lines: 312 },
              { name: "usage.ts", status: "completed", lines: 145 },
            ],
          },
        ],
      },
      {
        name: "api/",
        status: "completed",
        children: [
          { name: "payment.routes.ts", status: "completed", lines: 134 },
          { name: "webhook.handler.ts", status: "completed", lines: 256 },
        ],
      },
    ],
    references: [
      { name: "quality-gates", status: "loaded", category: "qa" },
      { name: "brainstorming", status: "loaded", category: "planning" },
      { name: "recall", status: "loaded", category: "memory" },
      { name: "architecture-decision-record", status: "loading", category: "docs" },
    ],
    claudeResponse: [
      "Assessing enterprise payment service:",
      "",
      "• 24 files in scope",
      "• 7 complexity dimensions",
      "• PCI-DSS compliance required",
      "• Multiple external integrations",
      "• High-risk financial operations",
    ],
    codeSnippet: `COMPLEXITY ASSESSMENT: payment microservice
────────────────────────────────────────────
Date: 2026-01-30
Assessor: complexity-analyzer

AUTOMATED METRICS:
├─ Total Lines: 2,847 across 24 files
├─ Cyclomatic Complexity: 67 (HIGH)
├─ Dependencies: 12 (stripe, plaid, webhooks, etc.)
├─ Test Coverage: 91%
├─ Open Issues: 3 (2 security, 1 performance)
└─ Last Modified: 6 files in past week

SCORES:
┌──────────────────────┬───────┬────────────────────────────────────────┐
│ Criterion            │ Score │ Reason                                 │
├──────────────────────┼───────┼────────────────────────────────────────┤
│ Lines of Code        │   5/5 │ 2,847 lines (very large)               │
│ Time Estimate        │   5/5 │ 24+ hours (multi-day effort)           │
│ Files Affected       │   4/5 │ 24 files across 3 modules              │
│ Dependencies         │   5/5 │ 12 external (stripe, plaid, kafka...)  │
│ Unknowns             │   4/5 │ Webhook retry logic unclear            │
│ Cross-Cutting        │   5/5 │ Architectural - system-wide impact     │
│ Risk Level           │   5/5 │ Mission-critical, PCI-DSS compliance   │
├──────────────────────┼───────┼────────────────────────────────────────┤
│ TOTAL                │ 33/35 │                                        │
└──────────────────────┴───────┴────────────────────────────────────────┘

RESULT:
├─ Average Score: 4.7
├─ Complexity Level: 5 (VERY COMPLEX)
├─ Can Proceed: NO - BREAKDOWN REQUIRED
└─ Estimated Time: 5-8 days (without breakdown)

DEPENDENCY GRAPH:
┌─────────────────────────────────────────────────────────────────┐
│                        PAYMENT SERVICE                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  Processor  │───▶│   Stripe    │───▶│   Webhook   │         │
│  │   (456 LoC) │    │  (234 LoC)  │    │  (256 LoC)  │         │
│  └──────┬──────┘    └─────────────┘    └─────────────┘         │
│         │                                     ▲                 │
│         ▼                                     │                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Invoice   │───▶│    Kafka    │───▶│   Billing   │         │
│  │   (189 LoC) │    │   (event)   │    │  (457 LoC)  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                                                                 │
│  External: Stripe API, Plaid, SendGrid, PostgreSQL, Redis      │
└─────────────────────────────────────────────────────────────────┘

CRITICAL RISK AREAS:
┌─ [P0] SECURITY: PCI-DSS cardholder data handling
│       Files: stripe.adapter.ts:45-89, processor.ts:234-267
│       Risk: Non-compliance = $500K+ fines
│
├─ [P1] RELIABILITY: Webhook idempotency
│       Files: webhook.handler.ts:123-189
│       Risk: Duplicate charges, refund failures
│
├─ [P2] PERFORMANCE: N+1 query in subscription lookup
│       Files: billing/subscription.ts:67-89
│       Risk: Timeout at scale (>10K subscriptions)
│
└─ [P3] CONSISTENCY: Event ordering in Kafka
        Files: processor.ts:312-345
        Risk: Out-of-order payment state changes

RECOMMENDED BREAKDOWN:
┌────────────────────────────────────────────────────────────────┐
│ Subtask                          │ Est. Time │ Risk │ Priority │
├──────────────────────────────────┼───────────┼──────┼──────────┤
│ 1. Stripe adapter refactor       │ 4 hours   │ MED  │ P1       │
│ 2. Webhook idempotency fix       │ 8 hours   │ HIGH │ P0       │
│ 3. Subscription N+1 fix          │ 2 hours   │ LOW  │ P2       │
│ 4. Invoice generation update     │ 4 hours   │ MED  │ P1       │
│ 5. Event ordering safeguard      │ 6 hours   │ HIGH │ P1       │
│ 6. Integration test suite        │ 8 hours   │ MED  │ P2       │
└────────────────────────────────────────────────────────────────┘
Total after breakdown: 32 hours (6 subtasks, avg 5.3 hrs each)

RECOMMENDATION:
✗ DO NOT proceed as single task
✓ Break into 6 subtasks (see above)
✓ Start with P0: Webhook idempotency (highest risk)
✓ Requires architecture review before P0
✓ Consider PCI-DSS compliance review for subtask 1

DECISION LOG:
Previous: "Use Stripe Checkout instead of Elements" (2025-12-15)
Related: "Implement retry with exponential backoff" (2025-11-20)`,
    completionTime: "45s",
    metrics: {
      Score: "33/35",
      Level: "5",
      Decision: "BREAKDOWN",
      Subtasks: "6",
    },
  },

  summaryTitle: "COMPLEXITY ASSESSED",
  summaryTagline: "7 metrics. Clear decision. Build with confidence.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default assessComplexityDemoConfig;

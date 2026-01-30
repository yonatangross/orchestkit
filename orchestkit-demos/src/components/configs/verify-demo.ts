/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:verify skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const verifyDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "verify",
  skillCommand: "/ork:verify",
  hook: "6 agents validate your feature",
  primaryColor: "#22c55e",
  secondaryColor: "#8b5cf6",
  accentColor: "#f59e0b",

  phases: [
    { name: "Spawn Agents", shortName: "Spawn" },
    { name: "Test Suite", shortName: "Tests" },
    { name: "Type Check", shortName: "Types" },
    { name: "Security Scan", shortName: "Security" },
    { name: "Lint", shortName: "Lint" },
    { name: "E2E", shortName: "E2E" },
  ],

  // SIMPLE LEVEL - Basic utility function
  simple: {
    name: "Simple",
    description: "verify formatDate utility",
    inputCount: 1,
    files: [
      {
        name: "src/utils/formatDate.ts",
        status: "completed",
        lines: 25,
      },
      {
        name: "tests/formatDate.test.ts",
        status: "completed",
        lines: 45,
      },
    ],
    references: [
      { name: "test-patterns", status: "loaded", category: "testing" },
      { name: "unit-testing", status: "loaded", category: "testing" },
    ],
    claudeResponse: [
      "Spawning 6 verification agents:",
      "",
      "• 🧪 test-generator",
      "• 📝 code-quality-reviewer",
      "• 🔒 security-auditor",
      "• ⚡ performance-engineer",
    ],
    codeSnippet: `VERIFICATION RESULTS
────────────────────
✓ Tests:     8/8 passed (100%)
✓ Types:     No errors
✓ Security:  No vulnerabilities
✓ Lint:      0 issues
✓ Coverage:  98%

Score: 10/10 ⭐`,
    completionTime: "5s",
    metrics: {
      Agents: "6",
      Tests: "8/8",
      Coverage: "98%",
    },
  },

  // MEDIUM LEVEL - API endpoint
  medium: {
    name: "Medium",
    description: "verify user registration API",
    inputCount: 4,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          { name: "api/users.ts", status: "completed", lines: 89 },
          { name: "schemas/user.ts", status: "completed", lines: 45 },
          { name: "services/email.ts", status: "completed", lines: 67 },
        ],
      },
      {
        name: "tests/",
        status: "completed",
        children: [
          { name: "api/users.test.ts", status: "completed", lines: 156 },
          { name: "integration/registration.test.ts", status: "writing", lines: 89 },
        ],
      },
    ],
    references: [
      { name: "test-patterns", status: "loaded", category: "testing" },
      { name: "api-testing", status: "loaded", category: "testing" },
      { name: "security-scanning", status: "loading", category: "security" },
    ],
    claudeResponse: [
      "Spawning 6 verification agents:",
      "",
      "• 🧪 test-generator → Running 24 tests",
      "• 📝 code-quality-reviewer → Analyzing",
      "• 🔒 security-auditor → Scanning OWASP",
      "• ⚡ performance-engineer → Profiling",
      "• 🌐 e2e-tester → Browser tests",
    ],
    codeSnippet: `VERIFICATION RESULTS
────────────────────
✓ Tests:     24/24 passed (100%)
✓ Types:     No errors
✓ Security:  1 low severity (rate limit)
✓ Lint:      2 warnings (fixed)
✓ E2E:       5/5 scenarios passed
✓ Coverage:  94%

Score: 9/10 ⭐`,
    completionTime: "18s",
    metrics: {
      Agents: "6",
      Tests: "24/24",
      E2E: "5/5",
      Coverage: "94%",
    },
  },

  // ADVANCED LEVEL - Full feature
  advanced: {
    name: "Advanced",
    description: "verify checkout flow",
    inputCount: 12,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          {
            name: "features/checkout/",
            status: "completed",
            children: [
              { name: "CheckoutForm.tsx", status: "completed", lines: 234 },
              { name: "PaymentProcessor.ts", status: "completed", lines: 189 },
              { name: "CartSummary.tsx", status: "completed", lines: 145 },
              { name: "ShippingCalculator.ts", status: "writing", lines: 98 },
            ],
          },
          {
            name: "api/",
            status: "completed",
            children: [
              { name: "orders.ts", status: "completed", lines: 156 },
              { name: "payments.ts", status: "completed", lines: 178 },
            ],
          },
        ],
      },
      {
        name: "tests/",
        status: "completed",
        children: [
          { name: "checkout/", status: "completed", children: [
            { name: "form.test.tsx", status: "completed", lines: 234 },
            { name: "payment.test.ts", status: "completed", lines: 189 },
            { name: "integration.test.ts", status: "writing", lines: 267 },
          ]},
          { name: "e2e/", status: "completed", children: [
            { name: "checkout-flow.spec.ts", status: "completed", lines: 345 },
          ]},
        ],
      },
    ],
    references: [
      { name: "test-patterns", status: "loaded", category: "testing" },
      { name: "e2e-testing", status: "loaded", category: "testing" },
      { name: "security-scanning", status: "loaded", category: "security" },
      { name: "pci-compliance", status: "loading", category: "compliance" },
      { name: "performance-testing", status: "pending", category: "perf" },
    ],
    claudeResponse: [
      "Spawning 6 verification agents:",
      "",
      "• 🧪 test-generator → 67 tests",
      "• 📝 code-quality-reviewer → SOLID check",
      "• 🔒 security-auditor → PCI-DSS scan",
      "• ⚡ performance-engineer → Load test",
      "• 🌐 e2e-tester → 12 scenarios",
      "• ♿ accessibility-specialist → WCAG 2.2",
    ],
    codeSnippet: `VERIFICATION RESULTS
────────────────────
✓ Tests:     67/67 passed (100%)
✓ Types:     No errors
✓ Security:  PCI-DSS compliant
✓ Lint:      0 issues
✓ E2E:       12/12 scenarios passed
✓ A11y:      WCAG 2.2 AA compliant
✓ Perf:      <100ms p95 response
✓ Coverage:  91%

Score: 9.5/10 ⭐`,
    completionTime: "45s",
    metrics: {
      Agents: "6",
      Tests: "67/67",
      E2E: "12/12",
      Coverage: "91%",
    },
  },

  summaryTitle: "📊 VERIFICATION COMPLETE",
  summaryTagline: "6 agents. Parallel validation. Production confidence.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default verifyDemoConfig;

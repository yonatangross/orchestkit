/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:assess skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const assessDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "assess",
  skillCommand: "/ork:assess",
  hook: "Evaluate quality across 6 dimensions",
  primaryColor: "#22c55e",
  secondaryColor: "#f59e0b",
  accentColor: "#8b5cf6",

  phases: [
    { name: "Analyze", shortName: "Analyze" },
    { name: "Score Criteria", shortName: "Score" },
    { name: "Compare Baseline", shortName: "Compare" },
    { name: "Generate Report", shortName: "Report" },
  ],

  // SIMPLE LEVEL - Single feature assessment
  simple: {
    name: "Simple",
    description: "assess button component",
    inputCount: 1,
    files: [
      {
        name: "src/components/Button.tsx",
        status: "completed",
        lines: 89,
      },
    ],
    references: [
      { name: "component-quality-checklist", status: "loaded", category: "qa" },
      { name: "accessibility-standards", status: "loaded", category: "a11y" },
    ],
    claudeResponse: [
      "Assessing component quality:",
      "",
      "• 1 file analyzed",
      "• 6 quality dimensions",
      "• Scoring in progress",
      "• Generating assessment report",
    ],
    codeSnippet: `QUALITY ASSESSMENT REPORT
────────────────────────
Component: Button

Overall Score: 8.2/10 ✓ GOOD

┌─ Code Quality: 8.5/10
│  ✓ Clear naming (onClick, disabled)
│  ✓ Proper prop validation
│  ✓ Consistent formatting
│  ⚠ Missing JSDoc comments
│
├─ Accessibility: 7.8/10
│  ✓ Semantic HTML (<button>)
│  ✓ Keyboard navigation
│  ⚠ Missing aria-label for icon variants
│  ⚠ Color contrast: 4.5:1 (should be 4.5:1 minimum, you have 4.5:1)
│
├─ Performance: 9.0/10
│  ✓ No unnecessary re-renders
│  ✓ CSS-in-JS properly optimized
│  ✓ Bundle size: 2.4KB
│
├─ Testing: 7.5/10
│  ✓ Unit tests present (12 cases)
│  ✓ Edge cases covered
│  ⚠ No visual regression tests
│
├─ Type Safety: 9.2/10
│  ✓ Full TypeScript coverage
│  ✓ Proper generic types
│  ✓ Strict mode enabled
│
└─ Documentation: 7.0/10
   ✓ Storybook examples included
   ⚠ Missing usage guide
   ⚠ No TypeScript examples

Recommendations (Priority Order):
1. [HIGH] Add JSDoc comments to public props
2. [MEDIUM] Add missing aria-labels
3. [LOW] Create visual regression tests
4. [LOW] Enhance Storybook documentation

Comparison to Baseline:
├─ Previous version: 7.8/10 (+0.4 improvement) ✓
├─ Team average: 8.1/10 (+0.1 above average) ✓
└─ Best-in-class: 9.1/10 (-0.9 gap to close)`,
    completionTime: "8s",
    metrics: {
      Score: "8.2/10",
      Dimensions: "6",
      Issues: "2 HIGH",
    },
  },

  // MEDIUM LEVEL - API feature assessment
  medium: {
    name: "Medium",
    description: "assess user registration API",
    inputCount: 5,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          { name: "api/auth.ts", status: "completed", lines: 156 },
          { name: "schemas/user.ts", status: "completed", lines: 67 },
          { name: "services/email.ts", status: "completed", lines: 89 },
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
      { name: "api-quality-standards", status: "loaded", category: "qa" },
      { name: "security-checklist", status: "loaded", category: "security" },
      { name: "performance-benchmarks", status: "loading", category: "perf" },
    ],
    claudeResponse: [
      "Assessing API quality:",
      "",
      "• 4 files analyzed",
      "• 6 quality dimensions",
      "• 8 security checks",
      "• Performance profiled",
    ],
    codeSnippet: `QUALITY ASSESSMENT REPORT
────────────────────────
Feature: User Registration API

Overall Score: 7.6/10 ⚠ FAIR (Needs Improvement)

┌─ Code Quality: 8.1/10
│  ✓ Proper error handling
│  ✓ Input validation present
│  ✓ DRY principles followed
│  ⚠ Some functions > 50 lines (refactor needed)
│  ⚠ Missing logging in key operations
│
├─ Security: 7.2/10
│  ✓ Password hashing (bcrypt)
│  ✓ Email validation
│  ✓ Rate limiting implemented
│  ⚠ Missing CSRF token validation
│  ⚠ SQL injection protection: only partial
│  ✗ No audit logging for registrations
│
├─ Testing: 7.8/10
│  ✓ 28 test cases
│  ✓ 89% code coverage
│  ✓ Happy path + edge cases
│  ⚠ No integration tests with database
│  ⚠ No stress/load tests
│
├─ Performance: 7.4/10
│  ✓ Average response: 250ms
│  ⚠ P99 response: 2.3s (should be <1s)
│  ⚠ N+1 query issue in email verification
│  ⚠ No response caching
│
├─ Type Safety: 8.5/10
│  ✓ Full TypeScript
│  ✓ Input/output types defined
│  ✓ Zod schema validation
│
└─ Documentation: 6.8/10
   ⚠ API docs incomplete
   ⚠ Missing error response examples
   ✓ Request/response schemas documented
   ⚠ No setup guide for contributors

Critical Issues Found:
┌─ [P0] SECURITY: Email not verified before account creation
│       Risk: Account takeover via email spoofing
│       Fix: Send verification email, wait for confirmation
│
├─ [P1] PERFORMANCE: N+1 query on email uniqueness check
│       Impact: 250ms → 2.3s for bulk registration
│       Fix: Add database index on email column
│
└─ [P2] TESTING: No integration tests
        Gap: Can't verify database state changes
        Fix: Add integration test suite

Recommendations (Priority Order):
1. [CRITICAL] Implement email verification flow (2 days)
2. [HIGH] Add database index on email (1 hour)
3. [HIGH] Add CSRF token validation (4 hours)
4. [MEDIUM] Add audit logging (8 hours)
5. [MEDIUM] Create integration test suite (2 days)
6. [LOW] Refactor large functions (3 days)
7. [LOW] Add API response caching (2 days)

Comparison to Baseline:
├─ Previous version: 6.9/10 (+0.7 improvement) ✓
├─ Team average: 7.8/10 (-0.2 below average)
└─ Industry standard: 8.5/10 (-0.9 gap to close)

Implementation Timeline:
Week 1: Email verification + email index (Blocker fixes)
Week 2: CSRF + audit logging (Security hardening)
Week 3: Integration tests + performance fixes (Quality)`,
    completionTime: "32s",
    metrics: {
      Score: "7.6/10",
      Critical: "1",
      High: "2",
      Medium: "3",
    },
  },

  // ADVANCED LEVEL - Enterprise system assessment
  advanced: {
    name: "Advanced",
    description: "assess payment processing system",
    inputCount: 18,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          {
            name: "payment/",
            status: "completed",
            children: [
              { name: "payment.service.ts", status: "completed", lines: 289 },
              { name: "payment.processor.ts", status: "completed", lines: 234 },
              { name: "stripe.adapter.ts", status: "completed", lines: 167 },
              { name: "invoice.generator.ts", status: "completed", lines: 145 },
            ],
          },
          {
            name: "api/",
            status: "completed",
            children: [
              { name: "payment.routes.ts", status: "completed", lines: 89 },
              { name: "invoice.routes.ts", status: "completed", lines: 67 },
            ],
          },
        ],
      },
      {
        name: "tests/",
        status: "completed",
        children: [
          { name: "payment.test.ts", status: "completed", lines: 456 },
          { name: "payment.e2e.spec.ts", status: "completed", lines: 389 },
          { name: "stripe.mock.test.ts", status: "completed", lines: 234 },
        ],
      },
    ],
    references: [
      { name: "payment-security-standards", status: "loaded", category: "security" },
      { name: "pci-dss-compliance", status: "loaded", category: "compliance" },
      { name: "financial-system-qa", status: "loaded", category: "qa" },
      { name: "high-scale-payments", status: "loading", category: "architecture" },
    ],
    claudeResponse: [
      "Assessing enterprise payment system:",
      "",
      "• 18 files analyzed",
      "• 8 quality dimensions",
      "• PCI-DSS audit checklist",
      "• Financial compliance review",
      "• Load testing results analyzed",
    ],
    codeSnippet: `QUALITY ASSESSMENT REPORT
────────────────────────
System: Payment Processing Platform

Overall Score: 8.7/10 ✓ EXCELLENT (Production-Ready)

┌─ Code Quality: 8.9/10
│  ✓ Clean architecture (service/adapter pattern)
│  ✓ SOLID principles followed
│  ✓ DRY with minimal duplication
│  ✓ Well-organized error handling
│  ⚠ Two functions exceeding 100 lines
│  ⚠ Missing request/response logging
│
├─ Security: 8.5/10 (PCI-DSS Aligned)
│  ✓ No PII in logs
│  ✓ Payment data encrypted at rest
│  ✓ HTTPS enforced (all requests)
│  ✓ API key rotation implemented
│  ✓ Input validation + sanitization
│  ✓ Rate limiting (100 req/min per user)
│  ✓ Audit trail for all transactions
│  ⚠ Webhook signature verification: partially implemented
│  ⚠ Dead letter queue for failed webhooks
│
├─ Testing: 8.8/10
│  ✓ 127 test cases (92% coverage)
│  ✓ Unit tests with mocked Stripe API
│  ✓ Integration tests with test Stripe account
│  ✓ E2E payment flow tests
│  ✓ Failure scenario coverage
│  ✓ Load tests (1000 req/sec)
│  ⚠ No chaos engineering tests
│  ⚠ Missing idempotency tests
│
├─ Performance: 8.6/10
│  ✓ Payment processing: p95 = 450ms
│  ✓ Invoice generation: p95 = 200ms
│  ✓ Database queries optimized (indexed)
│  ✓ Caching layer for receipt lookups
│  ✓ Async invoice PDF generation
│  ⚠ Webhook processing: p95 = 2.1s
│  ⚠ No request batching for bulk operations
│
├─ Type Safety: 9.1/10
│  ✓ Full TypeScript + strict mode
│  ✓ Payment amount as decimal (not float)
│  ✓ Currency enum for type safety
│  ✓ Comprehensive error types
│
├─ Reliability: 8.7/10
│  ✓ Idempotency keys for retry-safety
│  ✓ Graceful degradation on Stripe timeout
│  ✓ Circuit breaker pattern implemented
│  ✓ Automatic retry with exponential backoff
│  ✓ 99.9% uptime SLA maintained
│  ⚠ No canary deployment for updates
│  ⚠ Limited chaos testing
│
├─ Compliance: 8.4/10 (PCI-DSS L1)
│  ✓ PCI-DSS compliance assessment: PASS
│  ✓ Regular penetration testing scheduled
│  ✓ Data retention policy enforced
│  ✓ GDPR right-to-deletion implemented
│  ✓ Audit logs retained 7 years
│  ⚠ Annual third-party audit pending
│
└─ Documentation: 8.2/10
   ✓ API documentation (OpenAPI/Swagger)
   ✓ Architecture decision records
   ✓ Runbook for common incidents
   ✓ Security guide for contributors
   ⚠ No disaster recovery playbook
   ⚠ Limited deployment guide

Critical Findings:
┌─ [AUDIT] Webhook signature verification incomplete
│          Risk: Payment hijacking if webhook forged
│          Status: Medium priority (1 week fix)
│          Fix: Verify all webhook signatures
│
├─ [AUDIT] Dead letter queue missing for failed webhooks
│          Risk: Payments not recorded if webhook fails
│          Status: High priority (implement ASAP)
│          Fix: Add DLQ + replay mechanism
│
└─ [AUDIT] No canary deployment for payment updates
           Risk: Widespread failures from bad deploy
           Status: Medium priority (2 weeks)
           Fix: Implement blue-green deployment

Security Audit Results (Penetration Testing):
✓ No SQL injection vulnerabilities
✓ No XSS vulnerabilities
✓ No CSRF vulnerabilities
✓ No privilege escalation paths
✓ No information disclosure
⚠ Timing attack on JWT validation (low risk)
✓ No rate limiting bypasses
✓ No authentication bypass methods

Compliance Dashboard:
├─ PCI-DSS: PASS (12/12 requirements)
├─ GDPR: PASS (data protection audit)
├─ SOC 2: PASS (annual attestation)
├─ Payment Network Rules: PASS
└─ HIPAA (if applicable): N/A

Performance Metrics:
├─ Payment processing latency: p95 = 450ms ✓
├─ Webhook delivery success: 99.7% ✓
├─ Database query performance: avg 12ms ✓
├─ API availability: 99.92% ✓ (exceeds 99.9% SLA)
└─ Error rate: 0.08% ✓

Recommendations (Priority Order):
1. [CRITICAL] Implement webhook DLQ + replay (2 days)
2. [HIGH] Complete webhook signature verification (1 day)
3. [HIGH] Add canary deployment pipeline (3 days)
4. [MEDIUM] Document disaster recovery playbook (2 days)
5. [MEDIUM] Add idempotency key tests (2 days)
6. [MEDIUM] Implement chaos engineering tests (3 days)
7. [LOW] Optimize webhook processing latency (3 days)
8. [LOW] Add request batching for bulk ops (2 days)

Comparison to Baseline:
├─ Previous version: 8.1/10 (+0.6 improvement) ✓✓
├─ Industry standard: 8.5/10 (+0.2 above) ✓
└─ Best-in-class fintech: 9.2/10 (-0.5 gap, acceptable)

Deployment Risk Assessment: LOW
├─ Test coverage: 92% (excellent)
├─ Monitoring: Comprehensive (Datadog)
├─ Rollback plan: Automated
├─ Canary deployment: Recommended
└─ Estimated safe to deploy: Yes

Next Steps:
1. Address critical DLQ issue (start immediately)
2. Schedule penetration testing (quarterly)
3. Begin canary deployment implementation
4. Update incident runbook post-fixes
5. Plan PCI-DSS annual audit (Q2 2024)`,
    completionTime: "2m 45s",
    metrics: {
      Score: "8.7/10",
      Dimensions: "8",
      Critical: "1",
      PCI_DSS: "PASS",
      Uptime: "99.92%",
    },
  },

  summaryTitle: "📊 ASSESSMENT COMPLETE",
  summaryTagline: "Quality measured. Gaps identified. Roadmap ready.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default assessDemoConfig;

/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:create-pr skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const createPRDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "create-pr",
  skillCommand: "/ork:create-pr",
  hook: "PRs that pass review the first time",
  primaryColor: "#22c55e",
  secondaryColor: "#8b5cf6",
  accentColor: "#f59e0b",

  phases: [
    { name: "Pre-Flight", shortName: "Check" },
    { name: "Parallel Validation", shortName: "Validate" },
    { name: "Gather Context", shortName: "Context" },
    { name: "Create PR", shortName: "Create" },
    { name: "Verify", shortName: "Verify" },
  ],

  // SIMPLE LEVEL - Single file PR
  simple: {
    name: "Simple",
    description: "create PR for hotfix",
    inputCount: 1,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          { name: "utils/string.ts", status: "completed", lines: 12 },
        ],
      },
    ],
    references: [
      { name: "commit", status: "loaded", category: "git" },
      { name: "pr-template", status: "loaded", category: "github" },
    ],
    claudeResponse: [
      "Creating PR for hotfix:",
      "",
      "• Branch: hotfix/string-escape",
      "• Files: 1 modified",
      "• Pre-flight: PASS",
      "• Tests: All green",
    ],
    codeSnippet: `PRE-FLIGHT CHECKS
─────────────────
✓ Branch: hotfix/string-escape (not protected)
✓ No uncommitted changes
✓ Pushed to origin

VALIDATION (Parallel)
─────────────────────
[Security Agent]     PASS - No secrets detected
[Test Agent]         PASS - 100% coverage, 4/4 tests
[Code Quality Agent] PASS - 0 lint errors

PR CREATED
──────────
#142: fix(utils): escape special chars in slugify

Summary:
- Fixed XSS vulnerability in string slugify function
- Added regex escape for special characters

Tests: 4/4 passing
Coverage: 100%

Closes #141

→ https://github.com/org/repo/pull/142`,
    completionTime: "12s",
    metrics: {
      Agents: "3",
      Files: "1",
      Coverage: "100%",
    },
  },

  // MEDIUM LEVEL - Feature branch with multiple files
  medium: {
    name: "Medium",
    description: "create PR for user feature",
    inputCount: 6,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          {
            name: "services/",
            status: "completed",
            children: [
              { name: "user.service.ts", status: "completed", lines: 89 },
              { name: "user.repository.ts", status: "completed", lines: 67 },
            ],
          },
          {
            name: "api/",
            status: "completed",
            children: [
              { name: "users.routes.ts", status: "completed", lines: 45 },
            ],
          },
          {
            name: "tests/",
            status: "writing",
            children: [
              { name: "user.test.ts", status: "writing", lines: 156 },
            ],
          },
        ],
      },
    ],
    references: [
      { name: "commit", status: "loaded", category: "git" },
      { name: "security-scanning", status: "loaded", category: "security" },
      { name: "review-pr", status: "loading", category: "review" },
    ],
    claudeResponse: [
      "Creating PR for user management feature:",
      "",
      "• Branch: feat/user-management",
      "• Files: 6 modified",
      "• 3 agents validating in parallel",
      "• Coverage: 94%",
    ],
    codeSnippet: `PRE-FLIGHT CHECKS
─────────────────
✓ Branch: feat/user-management
✓ 5 commits ahead of dev
✓ No merge conflicts

VALIDATION (Parallel - 3 Agents)
────────────────────────────────
[Security Agent]
  PASS - No secrets detected
  PASS - Dependencies: 0 vulnerabilities
  PASS - OWASP scan: clean

[Test Agent]
  ✓ 24/24 unit tests passing
  ✓ 8/8 integration tests passing
  Coverage: 94%

[Code Quality Agent]
  PASS - ruff: 0 errors
  PASS - mypy: 0 type errors
  WARN - 2 complexity warnings

PR CREATED
──────────
#287: feat(#180): add user profile management

## Summary
Complete user profile management with avatar upload,
email preferences, and account settings.

## Changes
- Add UserService with CRUD operations
- Add UserRepository with caching
- Add /users routes with validation
- Add comprehensive test suite

## Test Plan
- [x] Unit tests (24/24)
- [x] Integration tests (8/8)
- [x] Manual testing complete

Closes #180

→ https://github.com/org/repo/pull/287`,
    completionTime: "38s",
    metrics: {
      Agents: "3",
      Files: "6",
      Coverage: "94%",
    },
  },

  // ADVANCED LEVEL - Large feature with cross-cutting concerns
  advanced: {
    name: "Advanced",
    description: "create PR for auth + payment",
    inputCount: 18,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          {
            name: "modules/auth/",
            status: "completed",
            children: [
              { name: "auth.service.ts", status: "completed", lines: 234 },
              { name: "jwt.strategy.ts", status: "completed", lines: 89 },
              { name: "oauth/", status: "completed", lines: 0 },
            ],
          },
          {
            name: "modules/payment/",
            status: "completed",
            children: [
              { name: "payment.service.ts", status: "completed", lines: 189 },
              { name: "stripe.adapter.ts", status: "completed", lines: 156 },
              { name: "webhook.handler.ts", status: "writing", lines: 78 },
            ],
          },
          {
            name: "shared/",
            status: "completed",
            children: [
              { name: "middleware/", status: "completed", lines: 0 },
              { name: "guards/", status: "completed", lines: 0 },
            ],
          },
        ],
      },
      {
        name: "tests/",
        status: "completed",
        children: [
          { name: "auth.e2e.spec.ts", status: "completed", lines: 312 },
          { name: "payment.e2e.spec.ts", status: "completed", lines: 278 },
        ],
      },
    ],
    references: [
      { name: "commit", status: "loaded", category: "git" },
      { name: "security-scanning", status: "loaded", category: "security" },
      { name: "review-pr", status: "loaded", category: "review" },
      { name: "oauth-patterns", status: "loaded", category: "auth" },
      { name: "payment-integration", status: "loading", category: "payments" },
    ],
    claudeResponse: [
      "Creating PR for auth + payment system:",
      "",
      "• Branch: feat/auth-payment-v2",
      "• Files: 18 modified",
      "• 3 agents + 2 specialist agents",
      "• Coverage: 91%",
      "• Security: OWASP compliant",
    ],
    codeSnippet: `PRE-FLIGHT CHECKS
─────────────────
✓ Branch: feat/auth-payment-v2
✓ 23 commits ahead of dev
✓ Rebased on latest dev
✓ No merge conflicts

VALIDATION (5 Parallel Agents)
──────────────────────────────
[Security Agent]
  PASS - No hardcoded secrets
  PASS - Dependencies: 0 critical vulnerabilities
  PASS - OWASP Top 10: Compliant
  WARN - 2 medium severity findings (accepted)

[Test Agent]
  ✓ 67/67 unit tests passing
  ✓ 24/24 integration tests passing
  ✓ 12/12 E2E scenarios passing
  Coverage: 91%

[Code Quality Agent]
  PASS - ESLint: 0 errors
  PASS - TypeScript: 0 type errors
  PASS - Complexity: All within limits

[Auth Specialist Agent]
  PASS - JWT implementation secure
  PASS - OAuth flow compliant
  PASS - Token refresh working

[Payment Specialist Agent]
  PASS - Stripe integration verified
  PASS - Webhook signatures validated
  PASS - PCI-DSS patterns followed

PR CREATED
──────────
#456: feat(#320): complete auth + payment system v2

## Summary
Enterprise-grade authentication with multi-provider OAuth
and Stripe payment integration with webhook handling.

## Changes
### Authentication
- JWT auth with refresh tokens
- Google + GitHub OAuth providers
- Role-based access control (RBAC)
- Session management with Redis

### Payments
- Stripe integration with webhooks
- Subscription management
- Invoice generation
- Refund handling

### Infrastructure
- Auth middleware for all routes
- Guards for admin-only endpoints
- Rate limiting on auth endpoints

## Test Plan
- [x] Unit tests (67/67)
- [x] Integration tests (24/24)
- [x] E2E scenarios (12/12)
- [x] Security audit passed
- [x] Manual OAuth flow tested
- [x] Stripe test mode verified

## Security Review
- [x] OWASP Top 10 compliant
- [x] No secrets in code
- [x] Dependency audit clean

Closes #320

→ https://github.com/org/repo/pull/456`,
    completionTime: "2m 34s",
    metrics: {
      Agents: "5",
      Files: "18",
      Coverage: "91%",
      Security: "PASS",
    },
  },

  summaryTitle: "PR CREATED",
  summaryTagline: "Validated. Documented. Ready for review.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default createPRDemoConfig;

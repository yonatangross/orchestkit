/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:explore skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const exploreDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "explore",
  skillCommand: "/ork:explore",
  hook: "Understand codebases in minutes",
  primaryColor: "#06b6d4",
  secondaryColor: "#f59e0b",
  accentColor: "#8b5cf6",

  phases: [
    { name: "Parse Files", shortName: "Parse" },
    { name: "Map Structure", shortName: "Map" },
    { name: "Analyze Dependencies", shortName: "Deps" },
    { name: "Generate Guide", shortName: "Guide" },
  ],

  // SIMPLE LEVEL - Single utility module
  simple: {
    name: "Simple",
    description: "explore string utilities",
    inputCount: 1,
    files: [
      {
        name: "src/utils/",
        status: "completed",
        children: [
          { name: "string.ts", status: "completed", lines: 156 },
          { name: "string.test.ts", status: "completed", lines: 89 },
        ],
      },
    ],
    references: [
      { name: "codebase-mapping", status: "loaded", category: "analysis" },
      { name: "documentation-generation", status: "loaded", category: "docs" },
    ],
    claudeResponse: [
      "Exploring string utilities module:",
      "",
      "• 2 files analyzed",
      "• 245 lines of code",
      "• 12 exported functions",
      "• 89% test coverage",
    ],
    codeSnippet: `CODEBASE EXPLORATION REPORT
──────────────────────────
Module: src/utils/string.ts

Public API:
✓ capitalize(str: string) → string
✓ slugify(text: string) → string
✓ truncate(text, len, suffix) → string
✓ camelCase(str: string) → string

Dependencies:
• None (pure utility)

Test Coverage:
✓ 12/12 functions tested
✓ Edge cases covered (empty, null, unicode)

Insights:
• Single responsibility: string manipulation only
• No external dependencies
• Well-documented with examples`,
    completionTime: "6s",
    metrics: {
      Files: "2",
      Functions: "12",
      Coverage: "89%",
    },
  },

  // MEDIUM LEVEL - Feature module with API
  medium: {
    name: "Medium",
    description: "explore user service",
    inputCount: 6,
    files: [
      {
        name: "src/services/user/",
        status: "completed",
        children: [
          { name: "user.service.ts", status: "completed", lines: 234 },
          { name: "user.repository.ts", status: "completed", lines: 167 },
          { name: "user.dto.ts", status: "completed", lines: 89 },
          { name: "user.types.ts", status: "completed", lines: 45 },
          { name: "user.test.ts", status: "completed", lines: 312 },
        ],
      },
      {
        name: "src/api/users.routes.ts",
        status: "completed",
        lines: 156,
      },
    ],
    references: [
      { name: "codebase-mapping", status: "loaded", category: "analysis" },
      { name: "architecture-patterns", status: "loaded", category: "design" },
      { name: "database-patterns", status: "loading", category: "data" },
    ],
    claudeResponse: [
      "Exploring user service module:",
      "",
      "• 6 files analyzed",
      "• 1,003 lines of code",
      "• 24 exported members",
      "• 5 dependencies",
      "• Architecture: Service/Repository pattern",
    ],
    codeSnippet: `CODEBASE EXPLORATION REPORT
──────────────────────────
Module: src/services/user/

Architecture:
├── UserService (business logic)
│   ├── Repository pattern
│   ├── DTO transformation
│   └── Error handling
├── UserRepository (data access)
│   ├── Database queries
│   ├── Caching layer
│   └── Transaction support
└── Types & Interfaces

Class: UserService
  Methods:
  ✓ create(createUserDto) → Promise<UserDto>
  ✓ findById(id) → Promise<UserDto | null>
  ✓ findByEmail(email) → Promise<UserDto | null>
  ✓ update(id, updateDto) → Promise<UserDto>
  ✓ delete(id) → Promise<void>

Dependencies:
→ UserRepository (internal)
→ EmailService (external)
→ Logger (external)

Test Coverage:
✓ 18/24 methods fully tested
⚠ Integration tests: 2 missing
  (email notifications, transaction rollback)

Patterns Detected:
✓ Repository pattern
✓ Dependency injection
✓ DTO for API boundaries
✗ No caching at service level`,
    completionTime: "24s",
    metrics: {
      Files: "6",
      Classes: "2",
      Methods: "24",
      Coverage: "86%",
    },
  },

  // ADVANCED LEVEL - Large multi-module system
  advanced: {
    name: "Advanced",
    description: "explore auth + payment system",
    inputCount: 18,
    files: [
      {
        name: "src/modules/",
        status: "completed",
        children: [
          {
            name: "auth/",
            status: "completed",
            children: [
              { name: "auth.service.ts", status: "completed", lines: 289 },
              { name: "auth.controller.ts", status: "completed", lines: 145 },
              { name: "jwt.strategy.ts", status: "completed", lines: 92 },
              { name: "oauth/", status: "completed", children: [
                { name: "google.strategy.ts", status: "completed", lines: 78 },
                { name: "github.strategy.ts", status: "completed", lines: 64 },
              ]},
            ],
          },
          {
            name: "payment/",
            status: "completed",
            children: [
              { name: "payment.service.ts", status: "completed", lines: 234 },
              { name: "payment.processor.ts", status: "completed", lines: 189 },
              { name: "stripe.adapter.ts", status: "completed", lines: 167 },
              { name: "invoice.generator.ts", status: "writing", lines: 134 },
            ],
          },
          {
            name: "user/",
            status: "completed",
            children: [
              { name: "user.service.ts", status: "completed", lines: 212 },
              { name: "user.repository.ts", status: "completed", lines: 156 },
            ],
          },
        ],
      },
      {
        name: "src/shared/",
        status: "completed",
        children: [
          {
            name: "middleware/",
            status: "completed",
            children: [
              { name: "auth.middleware.ts", status: "completed", lines: 45 },
              { name: "error.middleware.ts", status: "completed", lines: 67 },
            ],
          },
          {
            name: "guards/",
            status: "completed",
            children: [
              { name: "jwt.guard.ts", status: "completed", lines: 34 },
              { name: "admin.guard.ts", status: "completed", lines: 28 },
            ],
          },
        ],
      },
      {
        name: "tests/",
        status: "completed",
        children: [
          { name: "auth.e2e.spec.ts", status: "completed", lines: 456 },
          { name: "payment.e2e.spec.ts", status: "completed", lines: 389 },
        ],
      },
    ],
    references: [
      { name: "codebase-mapping", status: "loaded", category: "analysis" },
      { name: "architecture-patterns", status: "loaded", category: "design" },
      { name: "oauth-patterns", status: "loaded", category: "security" },
      { name: "payment-integration", status: "loading", category: "payments" },
      { name: "dependency-injection", status: "pending", category: "patterns" },
    ],
    claudeResponse: [
      "Exploring enterprise auth + payment system:",
      "",
      "• 18 files analyzed",
      "• 3,247 lines of code",
      "• 7 modules with clear boundaries",
      "• 3 external integrations",
      "• Complex dependency graph",
      "• Architecture: Modular monolith",
    ],
    codeSnippet: `CODEBASE EXPLORATION REPORT
──────────────────────────
System: Authentication + Payment Module

Module Dependency Graph:
auth/
├─ requires: user/, shared/middleware
├─ provides: JWT tokens, OAuth flows
└─ exports: AuthService, JWTStrategy

payment/
├─ requires: user/, auth/, stripe-adapter
├─ provides: Payment processing, invoicing
└─ exports: PaymentService, StripeAdapter

user/
├─ requires: shared/middleware
├─ provides: User management
└─ exports: UserService, UserRepository

Classes Overview:
┌─ AuthService (289 lines)
│  ├─ login(credentials) → Promise<AuthToken>
│  ├─ register(userData) → Promise<User>
│  ├─ refresh(token) → Promise<AuthToken>
│  └─ logout(userId) → Promise<void>
│  Dependencies: UserService, JwtService, LoggerService
│
├─ PaymentService (234 lines)
│  ├─ processPayment(paymentData) → Promise<Transaction>
│  ├─ refund(transactionId) → Promise<void>
│  ├─ generateInvoice(transactionId) → Promise<Invoice>
│  └─ getTransactionHistory(userId) → Promise<Transaction[]>
│  Dependencies: StripeAdapter, InvoiceGenerator, UserService
│
└─ UserService (212 lines)
   ├─ findById(id) → Promise<User>
   ├─ updateProfile(id, data) → Promise<User>
   └─ addPaymentMethod(userId, method) → Promise<void>
   Dependencies: UserRepository, EncryptionService

Integration Points:
✓ Stripe API (PaymentProcessor)
✓ OAuth (Google, GitHub)
✓ Database (User, Transaction records)
✗ Email service (not yet integrated)

Dependency Injection Setup:
✓ Service locator pattern
⚠ 3 circular dependencies detected
  (payment → user → auth)
✓ All guards properly registered

Test Coverage:
├─ Unit tests: 156 test cases (92%)
├─ Integration tests: 45 test cases (78%)
└─ E2E tests: 23 scenarios (88%)

Architecture Assessment:
✓ Clear module boundaries
✓ Separation of concerns
⚠ Circular dependency concern
✓ Scalable to 5+ modules
✓ Good test isolation

Recommendations:
1. Resolve circular dependency (payment → user)
2. Add email notification service
3. Implement transaction saga pattern
4. Add caching layer for frequently queried users`,
    completionTime: "2m 8s",
    metrics: {
      Files: "18",
      Modules: "7",
      Classes: "12",
      Coverage: "89%",
    },
  },

  summaryTitle: "📊 CODEBASE EXPLORED",
  summaryTagline: "Architecture understood. Dependencies mapped. Ready to build.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default exploreDemoConfig;

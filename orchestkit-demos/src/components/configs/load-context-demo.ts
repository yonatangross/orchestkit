/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:load-context skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const loadContextDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "load-context",
  skillCommand: "/ork:load-context",
  hook: "Resume where you left off, instantly",
  primaryColor: "#8b5cf6",
  secondaryColor: "#06b6d4",
  accentColor: "#f59e0b",

  phases: [
    { name: "Check Pressure", shortName: "Check" },
    { name: "Query Sessions", shortName: "Sessions" },
    { name: "Query Decisions", shortName: "Decisions" },
    { name: "Load Entities", shortName: "Entities" },
  ],

  // SIMPLE LEVEL - Fresh session, minimal context
  simple: {
    name: "Simple",
    description: "load-context (new project)",
    inputCount: 1,
    files: [
      {
        name: ".claude/memory/",
        status: "completed",
        children: [
          { name: "graph.json", status: "completed", lines: 45 },
        ],
      },
    ],
    references: [
      { name: "memory-fabric", status: "loaded", category: "memory" },
    ],
    claudeResponse: [
      "Loading context for new project:",
      "",
      "• Context pressure: 12%",
      "• Loading tier: Full",
      "• Decisions: 2 found",
      "• Blockers: 0",
    ],
    codeSnippet: `[Memory Fabric Loaded]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context Pressure: 12% (Green - Full Load)

Recent Decisions (2):
  - [today] Chose TypeScript for type safety
  - [yesterday] Using pnpm over npm for performance

Unresolved Blockers (0):
  No blockers found ✓

Active Entities (3):
  - TypeScript -> CHOSEN_FOR -> type-safety
  - pnpm -> PREFERRED_OVER -> npm
  - project -> USES -> TypeScript

Next Steps from Last Session:
  - Set up project structure
  - Configure ESLint + Prettier
  - Add testing framework

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ready to continue where you left off.`,
    completionTime: "1s",
    metrics: {
      Decisions: "2",
      Blockers: "0",
      Entities: "3",
    },
  },

  // MEDIUM LEVEL - Mid-project with blockers
  medium: {
    name: "Medium",
    description: "load-context (active project)",
    inputCount: 8,
    files: [
      {
        name: ".claude/memory/",
        status: "completed",
        children: [
          { name: "graph.json", status: "completed", lines: 234 },
          { name: "sessions/", status: "completed", lines: 0 },
        ],
      },
    ],
    references: [
      { name: "memory-fabric", status: "loaded", category: "memory" },
      { name: "session-continuity", status: "loaded", category: "context" },
      { name: "mem0-memory", status: "loading", category: "cloud" },
    ],
    claudeResponse: [
      "Loading context for active project:",
      "",
      "• Context pressure: 45%",
      "• Loading tier: Reduced",
      "• Decisions: 5 (3 shown)",
      "• Blockers: 2 active",
    ],
    codeSnippet: `[Memory Fabric Loaded]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context Pressure: 45% (Yellow - Reduced Load)

Recent Decisions (3 of 5):
  - [2 hours ago] Added Redis for session caching
  - [yesterday] Switched to cursor pagination for user list
  - [2 days ago] Chose Stripe over PayPal for payments

Unresolved Blockers (2):
  ⚠ [HIGH] Stripe webhook signature failing in staging
    Session: 2024-01-29
    Impact: Payment confirmations delayed

  ⚠ [MEDIUM] E2E tests flaky on CI (network timeouts)
    Session: 2024-01-28
    Impact: PR merges delayed

Active Entities (5):
  - Redis -> USED_FOR -> session-caching
  - cursor-pagination -> IMPLEMENTED_IN -> user-list
  - Stripe -> CHOSEN_OVER -> PayPal
  - webhook-handler -> HAS_ISSUE -> signature-validation
  - E2E-tests -> HAS_ISSUE -> flaky-network

Cloud Memories (Mem0):
  - [1 day ago] Stripe test mode uses different signing key
  - [2 days ago] Redis connection pool: 10 connections optimal
  - [3 days ago] E2E tests need network retry wrapper

Next Steps from Last Session:
  1. Debug Stripe webhook signature issue
  2. Add retry logic to E2E test setup
  3. Complete payment flow integration tests

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠ 2 blockers need attention before proceeding.`,
    completionTime: "3s",
    metrics: {
      Decisions: "5",
      Blockers: "2",
      Entities: "8",
    },
  },

  // ADVANCED LEVEL - Large project with global best practices
  advanced: {
    name: "Advanced",
    description: "load-context (enterprise project)",
    inputCount: 24,
    files: [
      {
        name: ".claude/memory/",
        status: "completed",
        children: [
          { name: "graph.json", status: "completed", lines: 567 },
          { name: "sessions/", status: "completed", lines: 0 },
          { name: "global-cache.json", status: "completed", lines: 189 },
        ],
      },
    ],
    references: [
      { name: "memory-fabric", status: "loaded", category: "memory" },
      { name: "session-continuity", status: "loaded", category: "context" },
      { name: "mem0-memory", status: "loaded", category: "cloud" },
      { name: "global-best-practices", status: "loaded", category: "community" },
      { name: "context-compression", status: "loading", category: "optimization" },
    ],
    claudeResponse: [
      "Loading context for enterprise project:",
      "",
      "• Context pressure: 68%",
      "• Loading tier: Full (priority)",
      "• Decisions: 12 (5 critical)",
      "• Blockers: 3 active",
      "• Global practices: 4 relevant",
    ],
    codeSnippet: `[Memory Fabric Loaded]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context Pressure: 68% (Yellow - Priority Load)

🔴 CRITICAL DECISIONS (5 of 12):
  - [today] Approved: Migrate auth to OAuth 2.0 + PKCE
    Impact: All 47 microservices affected
    Owner: @security-team
    Status: In progress (Phase 2 of 4)

  - [yesterday] Approved: PostgreSQL 16 upgrade for pgvector 0.6
    Impact: 3 databases, 2TB data migration
    Owner: @database-engineer
    Status: Staging complete, production pending

  - [2 days ago] Blocked: Kubernetes HPA autoscaling
    Reason: Need approval for cost increase ($2k/month)
    Owner: @platform-team

  - [3 days ago] Approved: Event sourcing for audit trail
    Impact: Payment and user modules
    Owner: @backend-architect

  - [1 week ago] Approved: Multi-region deployment (US-East + EU-West)
    Impact: Latency reduction 40% for EU customers
    Owner: @devops-team

🚨 UNRESOLVED BLOCKERS (3):
  ⚠ [P0/CRITICAL] OAuth migration breaking change in user-service
    Session: 2024-01-30
    Impact: Production rollout blocked
    Assignee: @auth-team
    Root cause: Token format incompatibility with legacy clients
    Action: Implement token translation layer

  ⚠ [P1/HIGH] PostgreSQL 16 migration - pgvector index rebuild
    Session: 2024-01-29
    Impact: 4-hour downtime window needed
    Assignee: @database-engineer
    Action: Schedule maintenance window

  ⚠ [P2/MEDIUM] E2E tests timeout on multi-region setup
    Session: 2024-01-28
    Impact: CI pipeline 40% slower
    Assignee: @qa-team
    Action: Add regional test parallelization

ACTIVE ENTITIES (12):
Architecture:
  - OAuth-2.0-PKCE -> REPLACES -> JWT-only-auth
  - event-sourcing -> ENABLES -> audit-trail
  - multi-region -> REDUCES -> latency

Database:
  - PostgreSQL-16 -> UPGRADES_FROM -> PostgreSQL-14
  - pgvector-0.6 -> ENABLES -> hybrid-search
  - read-replicas -> SERVES -> EU-region

Security:
  - PKCE-flow -> REQUIRED_FOR -> public-clients
  - token-translation -> BRIDGES -> legacy-clients

CLOUD MEMORIES (Mem0 - Recent):
  - [4 hours ago] OAuth migration Phase 1 complete - 12 services migrated
  - [yesterday] pgvector 0.6 performance: 3x faster hybrid search
  - [2 days ago] Multi-region DNS: Route53 latency-based routing working
  - [3 days ago] Event sourcing schema: Use JSONB for event payload
  - [1 week ago] Kubernetes HPA: Start with 2-10 pods, 70% CPU target

🌐 GLOBAL BEST PRACTICES (Relevant):
  [94% confidence] OAuth 2.0 + PKCE mandatory for mobile apps
    From: 8 enterprises, SOC 2 requirement
    Relevance: Directly applies to current migration

  [91% confidence] PostgreSQL upgrades: Always test with production-like data
    From: 12 projects, 3 major incidents prevented
    Relevance: Applies to PostgreSQL 16 migration

  [89% confidence] Multi-region: Use active-active, not active-passive
    From: 5 enterprises, 99.99% uptime achieved
    Relevance: Validates current architecture choice

  [87% confidence] Event sourcing: CQRS separation recommended at scale
    From: 7 projects, query performance issues avoided
    Relevance: Consider for Phase 2 of audit trail

NEXT STEPS FROM LAST SESSION:
  1. 🔴 [P0] Resolve OAuth token translation layer
  2. 🔴 [P0] Schedule PostgreSQL maintenance window
  3. 🟡 [P1] Continue OAuth migration Phase 2 (15 services remaining)
  4. 🟡 [P1] Test pgvector hybrid search in staging
  5. 🟢 [P2] Fix E2E regional parallelization

TEAM ACTIVITY (Last 24h):
  - @auth-team: Working on token translation (8 commits)
  - @database-engineer: pgvector index optimization (3 commits)
  - @platform-team: HPA cost analysis document shared

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 3 blockers require immediate attention.
📊 12 decisions loaded | 4 global best practices applied
🔄 Last session: 4 hours ago (@backend-architect)`,
    completionTime: "6s",
    metrics: {
      Decisions: "12",
      Blockers: "3",
      Entities: "24",
      Global: "4",
    },
  },

  summaryTitle: "CONTEXT LOADED",
  summaryTagline: "Session restored. Blockers visible. Ready to continue.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default loadContextDemoConfig;

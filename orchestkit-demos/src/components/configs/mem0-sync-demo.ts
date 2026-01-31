/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:mem0-sync skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const mem0SyncDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "mem0-sync",
  skillCommand: "/ork:mem0-sync",
  hook: "Session context that persists forever",
  primaryColor: "#06b6d4",
  secondaryColor: "#8b5cf6",
  accentColor: "#22c55e",

  phases: [
    { name: "Collect Context", shortName: "Collect" },
    { name: "Extract Patterns", shortName: "Extract" },
    { name: "Sync to Cloud", shortName: "Sync" },
    { name: "Verify Storage", shortName: "Verify" },
  ],

  // SIMPLE LEVEL - Sync single session decision
  simple: {
    name: "Simple",
    description: "sync database decision",
    inputCount: 1,
    files: [
      {
        name: ".claude/memory/",
        status: "completed",
        children: [
          { name: "session-context.json", status: "completed", lines: 24 },
        ],
      },
    ],
    references: [
      { name: "mem0-memory", status: "loaded", category: "memory" },
      { name: "context-persistence", status: "loaded", category: "cloud" },
    ],
    claudeResponse: [
      "Syncing session context to mem0 cloud:",
      "",
      "• Decisions: 1 captured",
      "• Patterns: Auto-detected",
      "• Cloud: Syncing...",
      "• Status: Connected",
    ],
    codeSnippet: `MEM0 SYNC COMPLETE
──────────────────
Session: abc123-def456

Context Synced:
✓ Decision: "Use PostgreSQL for ACID"
  → Category: database
  → Confidence: 0.95
  → Tags: [sql, relational, transactions]

Cloud Storage:
✓ User ID: orchestkit-myproject-decisions
✓ Memory ID: mem_7f8a9b2c
✓ Indexed: Yes
✓ Searchable: Ready

Next Session Access:
  /recall "database decision"
  → Will retrieve this context automatically`,
    completionTime: "2s",
    metrics: {
      Decisions: "1",
      Synced: "1",
      Latency: "180ms",
    },
  },

  // MEDIUM LEVEL - Sync full session context
  medium: {
    name: "Medium",
    description: "sync architecture session",
    inputCount: 8,
    files: [
      {
        name: ".claude/memory/",
        status: "completed",
        children: [
          { name: "session-context.json", status: "completed", lines: 156 },
          { name: "decisions.json", status: "completed", lines: 89 },
          { name: "patterns.json", status: "writing", lines: 67 },
        ],
      },
    ],
    references: [
      { name: "mem0-memory", status: "loaded", category: "memory" },
      { name: "session-tracking", status: "loaded", category: "context" },
      { name: "pattern-detection", status: "loading", category: "ml" },
    ],
    claudeResponse: [
      "Syncing full session to mem0 cloud:",
      "",
      "• Decisions: 5 captured",
      "• Patterns: 3 detected",
      "• Code snippets: 8 indexed",
      "• File context: 12 files",
      "• Cloud: Multi-region sync",
    ],
    codeSnippet: `MEM0 SYNC COMPLETE
──────────────────
Session: arch-session-2024-01-30

Context Synced:
┌─ Decisions (5 total)
│  ✓ "Microservices over monolith for scaling"
│  ✓ "GraphQL for frontend, REST for B2B"
│  ✓ "Event sourcing for audit trail"
│  ✓ "Redis for session caching"
│  ✓ "Kubernetes for orchestration"
│
├─ Patterns Detected (3 total)
│  ✓ CQRS pattern (read/write separation)
│  ✓ Saga pattern (distributed transactions)
│  ✓ Circuit breaker (resilience)
│
├─ Code Context (8 snippets)
│  ✓ API gateway config
│  ✓ Database schema
│  ✓ Message queue setup
│  ✓ Auth middleware
│  ... +4 more
│
└─ File References (12 files)
   ✓ Linked to graph entities

Cloud Storage:
✓ User ID: orchestkit-ecommerce-decisions
✓ Memory IDs: mem_* (8 records)
✓ Cross-linked: 15 relations created
✓ Semantic index: Updated
✓ Sync time: 340ms

Future Context Recall:
  "What architecture decisions did we make?"
  → Returns all 5 decisions with full context`,
    completionTime: "8s",
    metrics: {
      Decisions: "5",
      Patterns: "3",
      Synced: "8",
      Relations: "15",
    },
  },

  // ADVANCED LEVEL - Sync cross-project enterprise context
  advanced: {
    name: "Advanced",
    description: "sync enterprise knowledge base",
    inputCount: 24,
    files: [
      {
        name: ".claude/memory/",
        status: "completed",
        children: [
          { name: "session-context.json", status: "completed", lines: 456 },
          { name: "decisions.json", status: "completed", lines: 234 },
          { name: "patterns.json", status: "completed", lines: 189 },
          { name: "blockers.json", status: "completed", lines: 78 },
          { name: "cross-project.json", status: "writing", lines: 145 },
        ],
      },
    ],
    references: [
      { name: "mem0-memory", status: "loaded", category: "memory" },
      { name: "enterprise-context", status: "loaded", category: "org" },
      { name: "cross-project-sync", status: "loaded", category: "meta" },
      { name: "team-knowledge-base", status: "loading", category: "kb" },
      { name: "compliance-tracking", status: "pending", category: "audit" },
    ],
    claudeResponse: [
      "Syncing enterprise knowledge to mem0:",
      "",
      "• Decisions: 18 captured",
      "• Patterns: 12 detected",
      "• Anti-patterns: 3 flagged",
      "• Blockers: 5 documented",
      "• Cross-project: 4 projects linked",
      "• Team context: 6 contributors",
      "• Compliance: SOC2 tagged",
    ],
    codeSnippet: `MEM0 SYNC COMPLETE
──────────────────
Session: enterprise-q1-2024

KNOWLEDGE BASE SYNC:
╔════════════════════════════════════════════════════════════╗
║ ENTERPRISE CONTEXT SYNCHRONIZED                            ║
╚════════════════════════════════════════════════════════════╝

┌─ Decisions Synced (18 total)
│  ├─ Architecture: 8 decisions
│  │   ✓ Microservices adoption (P0)
│  │   ✓ Event-driven messaging (P0)
│  │   ✓ Database per service (P1)
│  │   ... +5 more
│  │
│  ├─ Security: 5 decisions
│  │   ✓ Zero-trust network (P0)
│  │   ✓ mTLS everywhere (P0)
│  │   ✓ Secret rotation policy (P1)
│  │   ... +2 more
│  │
│  └─ DevOps: 5 decisions
│      ✓ GitOps deployment (P0)
│      ✓ Canary releases (P1)
│      ... +3 more
│
├─ Patterns Catalogued (12 total)
│  ✓ CQRS, Event Sourcing, Saga
│  ✓ Circuit Breaker, Bulkhead
│  ✓ Strangler Fig (migration)
│  ... +6 more
│
├─ Anti-Patterns Flagged (3 total)
│  ⚠ Circular service dependencies
│  ⚠ Shared database anti-pattern
│  ⚠ N+1 query in user service
│  💡 Lessons extracted and indexed
│
├─ Blockers Documented (5 total)
│  🚫 Legacy auth system (migration Q2)
│  🚫 Vendor lock-in (AWS specific)
│  🚫 Tech debt in payment service
│  ... +2 more
│
├─ Cross-Project Links (4 projects)
│  → ecommerce-platform (primary)
│  → mobile-api (dependent)
│  → admin-dashboard (dependent)
│  → data-pipeline (consumer)
│
├─ Team Context (6 contributors)
│  • @alice: Architecture lead
│  • @bob: Security specialist
│  • @charlie: DevOps engineer
│  ... +3 more
│
└─ Compliance Tags
   ✓ SOC2: 14 decisions tagged
   ✓ GDPR: 8 decisions tagged
   ✓ PCI-DSS: 5 decisions tagged

Cloud Storage Summary:
├─ Total memories: 24 records
├─ Relations created: 67
├─ Semantic embeddings: Generated
├─ Search index: Updated
├─ Sync latency: 1.2s (multi-region)
└─ Storage: 2.4MB compressed

Enterprise Features:
✓ Team-wide search enabled
✓ Decision audit trail active
✓ Pattern recommendations ON
✓ Anti-pattern warnings ON
✓ Cross-project context sharing

Access Patterns:
  /recall --global "architecture decisions"
  → Returns decisions across all 4 projects

  /recall --agent backend-system-architect
  → Returns agent-specific context

  /recall --category security
  → Returns security decisions only`,
    completionTime: "15s",
    metrics: {
      Decisions: "18",
      Patterns: "12",
      Projects: "4",
      Relations: "67",
      Compliance: "SOC2",
    },
  },

  summaryTitle: "CLOUD SYNC COMPLETE",
  summaryTagline: "Session context persisted. Cross-project. Forever searchable.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default mem0SyncDemoConfig;

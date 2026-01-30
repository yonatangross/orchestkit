/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:recall skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const recallDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "recall",
  skillCommand: "/ork:recall",
  hook: "Your team's decisions, instantly searchable",
  primaryColor: "#06b6d4",
  secondaryColor: "#8b5cf6",
  accentColor: "#22c55e",

  phases: [
    { name: "Parse Query", shortName: "Parse" },
    { name: "Search Graph", shortName: "Graph" },
    { name: "Search Mem0", shortName: "Cloud" },
    { name: "Merge Results", shortName: "Merge" },
  ],

  // SIMPLE LEVEL - Single entity search
  simple: {
    name: "Simple",
    description: "recall database",
    inputCount: 1,
    files: [
      {
        name: ".claude/memory/",
        status: "completed",
        children: [
          { name: "graph.json", status: "completed", lines: 156 },
        ],
      },
    ],
    references: [
      { name: "knowledge-graph", status: "loaded", category: "memory" },
    ],
    claudeResponse: [
      "Searching for: database",
      "",
      "• Graph search: 3 entities",
      "• Relations: 5 found",
      "• Context: 45% used",
    ],
    codeSnippet: `🔍 Found 3 results matching "database":

[GRAPH] PostgreSQL (Technology)
   → CHOSEN_FOR → ACID-requirements
   → USED_WITH → pgvector
   → PREFERRED_OVER → MongoDB
   Observations:
     "Chosen for ACID requirements and team familiarity"
     "pgvector extension for RAG applications"

[GRAPH] database-engineer (Agent)
   → RECOMMENDS → PostgreSQL
   → RECOMMENDS → cursor-pagination
   → USES → connection-pooling
   Observations:
     "Specialist in database architecture"
     "Recommends pool_size=10, max_overflow=20"

[GRAPH] cursor-pagination (Pattern)
   → PREFERRED_OVER → offset-pagination
   → SCALES_FOR → large-datasets
   Observations:
     "Scales well for 1M+ rows"
     "From remember: SUCCESS pattern"`,
    completionTime: "2s",
    metrics: {
      Entities: "3",
      Relations: "8",
      Source: "graph",
    },
  },

  // MEDIUM LEVEL - Category filtered with cloud sync
  medium: {
    name: "Medium",
    description: "recall --mem0 --category auth",
    inputCount: 5,
    files: [
      {
        name: ".claude/memory/",
        status: "completed",
        children: [
          { name: "graph.json", status: "completed", lines: 289 },
          { name: "cloud-sync.log", status: "completed", lines: 45 },
        ],
      },
    ],
    references: [
      { name: "knowledge-graph", status: "loaded", category: "memory" },
      { name: "mem0-memory", status: "loaded", category: "cloud" },
      { name: "decision-capture", status: "loading", category: "docs" },
    ],
    claudeResponse: [
      "Searching for: auth (category: auth)",
      "",
      "• Graph search: 4 entities",
      "• Mem0 cloud: 3 memories",
      "• Cross-refs: 2 found",
    ],
    codeSnippet: `🔍 Found 7 results matching "auth" (category: auth):

[GRAPH] JWT-authentication (Technology)
   → CHOSEN_OVER → session-tokens
   → REQUIRES → refresh-tokens
   → USED_WITH → Redis-session-store
   Observations:
     "Stateless auth chosen for microservices"
     "15-minute access token, 7-day refresh"

[GRAPH] OAuth-integration (Pattern)
   → IMPLEMENTS → Google-OAuth
   → IMPLEMENTS → GitHub-OAuth
   → REQUIRES → PKCE-flow
   Observations:
     "Multi-provider support required"
     "PKCE mandatory for public clients"

[GRAPH] RBAC (Architecture)
   → USES → permission-matrix
   → REQUIRES → role-hierarchy
   Observations:
     "Role-based access for admin panel"
     "4 roles: viewer, editor, admin, super-admin"

[GRAPH] security-auditor (Agent)
   → RECOMMENDS → JWT-authentication
   → RECOMMENDS → RBAC
   Observations:
     "Reviews all auth implementations"

[MEM0] [2 days ago] (auth) JWT chosen over session tokens for horizontal scaling

[MEM0] [1 week ago] (auth) OAuth PKCE flow mandatory - security requirement

[CROSS-REF] [3 days ago] "Multi-provider OAuth with Google + GitHub"
   📊 Linked entities: OAuth-integration, Google-OAuth, GitHub-OAuth`,
    completionTime: "4s",
    metrics: {
      Graph: "4",
      Cloud: "3",
      CrossRef: "2",
    },
  },

  // ADVANCED LEVEL - Global search with relationship queries
  advanced: {
    name: "Advanced",
    description: "recall --global what does database-engineer recommend",
    inputCount: 12,
    files: [
      {
        name: ".claude/memory/",
        status: "completed",
        children: [
          { name: "graph.json", status: "completed", lines: 567 },
          { name: "cloud-sync.log", status: "completed", lines: 89 },
          { name: "global-cache.json", status: "completed", lines: 234 },
        ],
      },
    ],
    references: [
      { name: "knowledge-graph", status: "loaded", category: "memory" },
      { name: "mem0-memory", status: "loaded", category: "cloud" },
      { name: "cross-project-patterns", status: "loaded", category: "global" },
      { name: "relationship-queries", status: "loading", category: "query" },
    ],
    claudeResponse: [
      "Relationship query: database-engineer recommendations",
      "",
      "• Direct relations: 8 found",
      "• Project scope: 5 memories",
      "• Global scope: 4 best practices",
      "• Cross-refs: 6 found",
    ],
    codeSnippet: `🔍 Found relationships for database-engineer (+ global best practices):

DIRECT RELATIONSHIPS
────────────────────
[GRAPH] database-engineer (Agent)
   → RECOMMENDS → PostgreSQL
   → RECOMMENDS → pgvector
   → RECOMMENDS → cursor-pagination
   → RECOMMENDS → connection-pooling
   → RECOMMENDS → read-replicas
   → USES → explain-analyze
   → AVOIDS → N+1-queries
   → AUTHORED → migration-patterns
   Observations:
     "Primary database architecture specialist"
     "10+ years PostgreSQL experience"
     "Certified AWS Database Specialty"

RELATED ENTITIES
────────────────
[GRAPH] cursor-pagination (Pattern)
   → PREFERRED_OVER → offset-pagination
   → SCALES_FOR → large-datasets
   Context: "Recommended by database-engineer for all lists > 1000 items"
   Success Rate: 100% (5 implementations)

[GRAPH] connection-pooling (Pattern)
   → USES → PgBouncer
   → CONFIG → "pool_size=10, max_overflow=20"
   Context: "Standard config from database-engineer"
   Success Rate: 100% (8 implementations)

[GRAPH] read-replicas (Architecture)
   → REQUIRES → async-replication
   → ENABLES → horizontal-read-scaling
   Context: "For read-heavy workloads > 1000 QPS"

[GRAPH] N+1-queries (AntiPattern)
   ← AVOIDS ← database-engineer
   Observations:
     "Causes exponential query growth"
     "Use DataLoader or eager loading instead"

PROJECT MEMORIES (Mem0)
───────────────────────
[MEM0] [1 day ago] database-engineer recommends pgvector over Pinecone for cost

[MEM0] [3 days ago] Connection pool tuning: start with 10, scale to 20 under load

[MEM0] [1 week ago] Migration pattern: always add indexes concurrently in production

[MEM0] [2 weeks ago] Query optimization: use EXPLAIN ANALYZE before every deployment

[MEM0] [1 month ago] Partitioning strategy: time-based for logs, hash for users

GLOBAL BEST PRACTICES (High Confidence)
───────────────────────────────────────
[GLOBAL] (94% confidence) PostgreSQL JSONB preferred over MongoDB for structured data
   From: 12 projects, 3 orgs

[GLOBAL] (91% confidence) Cursor pagination mandatory for APIs with > 100 items
   From: 8 projects, 2 orgs

[GLOBAL] (89% confidence) Connection pooling reduces latency 60-80%
   From: 15 projects, 5 orgs

[GLOBAL] (87% confidence) Read replicas recommended at > 500 QPS
   From: 6 projects, 2 orgs

CROSS-REFERENCES
────────────────
[CROSS-REF] PostgreSQL → pgvector → RAG-applications
   📊 Linked: database-engineer, llm-integrator, data-pipeline-engineer

[CROSS-REF] cursor-pagination → keyset-pagination → offset-pagination
   📊 Linked: database-engineer, backend-system-architect

[CROSS-REF] connection-pooling → PgBouncer → performance-optimization
   📊 Linked: database-engineer, devops-engineer

[CROSS-REF] N+1-queries → DataLoader → GraphQL-optimization
   📊 Linked: database-engineer, frontend-ui-developer

[CROSS-REF] migration-patterns → zero-downtime-deploy → blue-green
   📊 Linked: database-engineer, devops-engineer

[CROSS-REF] read-replicas → horizontal-scaling → high-availability
   📊 Linked: database-engineer, backend-system-architect

SUMMARY
───────
database-engineer has made 8 recommendations across 5 categories:
• Database: PostgreSQL, pgvector
• Patterns: cursor-pagination, connection-pooling
• Architecture: read-replicas
• Anti-patterns: N+1-queries (avoid)
• Tooling: explain-analyze, PgBouncer

Success rate: 100% on implemented recommendations
Global alignment: 91% match with community best practices`,
    completionTime: "8s",
    metrics: {
      Relations: "8",
      Project: "5",
      Global: "4",
      CrossRef: "6",
    },
  },

  summaryTitle: "MEMORIES RETRIEVED",
  summaryTagline: "Team knowledge at your fingertips. Patterns preserved.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default recallDemoConfig;

/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:remember skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const rememberDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "remember",
  skillCommand: "/ork:remember",
  hook: "Build your team's knowledge base",
  primaryColor: "#8b5cf6",
  secondaryColor: "#06b6d4",
  accentColor: "#22c55e",

  phases: [
    { name: "Parse Input", shortName: "Parse" },
    { name: "Extract Entities", shortName: "Extract" },
    { name: "Create Graph", shortName: "Graph" },
    { name: "Store Memory", shortName: "Store" },
  ],

  // SIMPLE LEVEL - Store single decision
  simple: {
    name: "Simple",
    description: "remember database choice",
    inputCount: 1,
    files: [
      {
        name: ".claude/memory/",
        status: "completed",
        children: [
          { name: "decisions.json", status: "completed", lines: 12 },
        ],
      },
    ],
    references: [
      { name: "knowledge-graph", status: "loaded", category: "memory" },
      { name: "decision-capture", status: "loaded", category: "docs" },
    ],
    claudeResponse: [
      "Remembering decision:",
      "",
      "• Input: 1 decision",
      "• Entities: 2 detected",
      "• Category: Auto-detected",
      "• Graph: Updated",
    ],
    codeSnippet: `✓ Remembered (database): "Chose PostgreSQL over MongoDB for ACID requirements"
   → Stored in knowledge graph
   → Created entity: PostgreSQL (Technology)
   → Created entity: ACID-requirements (Constraint)
   → Created relation: PostgreSQL → CHOSEN_FOR → ACID-requirements
   📊 Graph: 2 entities, 1 relation`,
    completionTime: "3s",
    metrics: {
      Entities: "2",
      Relations: "1",
      Category: "decision",
    },
  },

  // MEDIUM LEVEL - Store success pattern with relationships
  medium: {
    name: "Medium",
    description: "remember pagination success",
    inputCount: 5,
    files: [
      {
        name: ".claude/memory/",
        status: "completed",
        children: [
          { name: "decisions.json", status: "completed", lines: 34 },
          { name: "patterns.json", status: "completed", lines: 28 },
        ],
      },
    ],
    references: [
      { name: "knowledge-graph", status: "loaded", category: "memory" },
      { name: "pattern-catalog", status: "loaded", category: "patterns" },
      { name: "success-tracking", status: "loading", category: "metrics" },
    ],
    claudeResponse: [
      "Remembering success pattern:",
      "",
      "• Input: 1 pattern + outcome",
      "• Entities: 5 detected",
      "• Relations: 4 detected",
      "• Category: pagination",
      "• Outcome: success",
      "• Graph + mem0 sync",
    ],
    codeSnippet: `✅ Remembered SUCCESS (pagination): "cursor-based pagination scales 10x better than offset for 1M+ rows"
   → Stored in knowledge graph
   → Created entity: cursor-pagination (Pattern)
   → Created entity: offset-pagination (AntiPattern)
   → Created entity: large-datasets (Constraint)
   → Created relation: cursor-pagination → PREFERRED_OVER → offset-pagination
   → Created relation: cursor-pagination → SCALES_FOR → large-datasets
   📊 Graph: 5 entities, 4 relations
   → Also synced to mem0 cloud
   ✨ Pattern tagged as success (search weight +25%)`,
    completionTime: "7s",
    metrics: {
      Entities: "5",
      Relations: "4",
      Category: "pattern",
      Outcome: "success",
    },
  },

  // ADVANCED LEVEL - Store complex anti-pattern with lessons
  advanced: {
    name: "Advanced",
    description: "remember circular dependency issue",
    inputCount: 12,
    files: [
      {
        name: ".claude/memory/",
        status: "completed",
        children: [
          { name: "decisions.json", status: "completed", lines: 67 },
          { name: "patterns.json", status: "completed", lines: 89 },
          { name: "blockers.json", status: "completed", lines: 45 },
        ],
      },
    ],
    references: [
      { name: "knowledge-graph", status: "loaded", category: "memory" },
      { name: "anti-patterns", status: "loaded", category: "patterns" },
      { name: "architecture-decisions", status: "loaded", category: "design" },
      { name: "cross-project-lessons", status: "loading", category: "meta" },
    ],
    claudeResponse: [
      "Remembering complex anti-pattern:",
      "",
      "• Input: 1 anti-pattern + lesson",
      "• Entities: 12 detected",
      "• Relations: 8 detected",
      "• Category: architecture",
      "• Outcome: failed",
      "• Lesson extracted: Solution provided",
      "• Scope: Global (all projects)",
      "• Graph + mem0 + cross-project sync",
    ],
    codeSnippet: `❌ Remembered ANTI-PATTERN (architecture): "Payment service depending on User service depending on Payment service caused 3-month refactor"
   → Stored in knowledge graph
   → Created entity: circular-dependency (AntiPattern)
   → Created entity: payment-service (Architecture)
   → Created entity: user-service (Architecture)
   → Created entity: database-engineer (Agent)
   → Created entity: architecture-debt (Blocker)
   → Created relation: payment-service → DEPENDS_ON → user-service
   → Created relation: user-service → DEPENDS_ON → payment-service [CIRCULAR]
   → Created relation: database-engineer → CAUSED → circular-dependency
   💡 Lesson: Use event-driven architecture or saga pattern instead
      "Decouple services with async message queues (RabbitMQ/Kafka)"
   🌐 Scope: global (available in all projects)
   📊 Graph: 12 entities, 8 relations
   → Also synced to mem0 cloud (global scope)
   ⚠️ Anti-pattern tagged (blocks new similar patterns)
   📈 Added to "Top Architecture Mistakes" dashboard`,
    completionTime: "12s",
    metrics: {
      Entities: "12",
      Relations: "8",
      Category: "architecture",
      Scope: "global",
      Outcome: "failed",
    },
  },

  summaryTitle: "📊 MEMORY STORED",
  summaryTagline: "Team knowledge captured. Future-proof decisions. AI-assisted.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default rememberDemoConfig;

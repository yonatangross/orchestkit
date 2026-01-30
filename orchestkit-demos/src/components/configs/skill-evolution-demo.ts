/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:skill-evolution skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const skillEvolutionDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "skill-evolution",
  skillCommand: "/ork:skill-evolution",
  hook: "Skills that learn. Patterns that improve. Auto-evolve.",
  primaryColor: "#10b981",
  secondaryColor: "#f59e0b",
  accentColor: "#8b5cf6",

  phases: [
    { name: "Collect Patterns", shortName: "Collect" },
    { name: "Analyze Usage", shortName: "Analyze" },
    { name: "Suggest Changes", shortName: "Suggest" },
    { name: "Apply/Rollback", shortName: "Apply" },
  ],

  // SIMPLE LEVEL - View evolution report
  simple: {
    name: "Simple",
    description: "view skill evolution report",
    inputCount: 1,
    files: [
      {
        name: ".claude/feedback/",
        status: "completed",
        children: [
          { name: "edit-patterns.jsonl", status: "completed", lines: 234 },
          { name: "evolution-registry.json", status: "completed", lines: 89 },
        ],
      },
    ],
    references: [
      { name: "evolution-analysis", status: "loaded", category: "analytics" },
      { name: "version-management", status: "loaded", category: "versioning" },
    ],
    claudeResponse: [
      "Generating skill evolution report:",
      "",
      "• 3 skills tracked",
      "• 312 total uses analyzed",
      "• Edit patterns detected",
      "• Suggestions pending review",
    ],
    codeSnippet: `SKILL EVOLUTION REPORT
══════════════════════════════════════════════════════════════

Skills Summary:
┌────────────────────────────┬─────────┬─────────┬───────────┬────────────┐
│ Skill                      │ Uses    │ Success │ Avg Edits │ Suggestions│
├────────────────────────────┼─────────┼─────────┼───────────┼────────────┤
│ api-design-framework       │     156 │     94% │       1.8 │          2 │
│ database-schema-designer   │      89 │     91% │       2.1 │          1 │
│ fastapi-patterns           │      67 │     88% │       2.4 │          3 │
└────────────────────────────┴─────────┴─────────┴───────────┴────────────┘

Summary:
  Skills tracked: 3
  Total uses: 312
  Overall success rate: 91%

Top Pending Suggestions:
1. 93% | api-design-framework | add add_pagination
2. 88% | api-design-framework | add add_rate_limiting
3. 85% | fastapi-patterns | add add_error_handling

Run /ork:skill-evolution analyze <skill-id> for details`,
    completionTime: "4s",
    metrics: {
      Skills: "3",
      Uses: "312",
      "Success Rate": "91%",
    },
  },

  // MEDIUM LEVEL - Analyze and evolve specific skill
  medium: {
    name: "Medium",
    description: "evolve api-design-framework skill",
    inputCount: 5,
    files: [
      {
        name: ".claude/feedback/",
        status: "completed",
        children: [
          { name: "edit-patterns.jsonl", status: "completed", lines: 456 },
          { name: "evolution-registry.json", status: "completed", lines: 167 },
          { name: "metrics.json", status: "completed", lines: 89 },
        ],
      },
      {
        name: "skills/api-design-framework/",
        status: "completed",
        children: [
          { name: "SKILL.md", status: "writing", lines: 234 },
        ],
      },
    ],
    references: [
      { name: "evolution-analysis", status: "loaded", category: "analytics" },
      { name: "version-management", status: "loaded", category: "versioning" },
      { name: "pattern-detection", status: "loading", category: "ml" },
    ],
    claudeResponse: [
      "Analyzing api-design-framework evolution:",
      "",
      "• 156 uses analyzed",
      "• 132/156 users added pagination",
      "• 112/156 users added rate limiting",
      "• Creating version snapshot",
      "• Applying high-confidence suggestions",
    ],
    codeSnippet: `SKILL ANALYSIS: api-design-framework
────────────────────────────────────────
Uses: 156 | Success: 94% | Avg Edits: 1.8

Edit Patterns Detected:
┌──────────────────────────┬─────────┬──────────┬────────────┐
│ Pattern                  │ Freq    │ Samples  │ Confidence │
├──────────────────────────┼─────────┼──────────┼────────────┤
│ add_pagination           │    85%  │ 132/156  │       0.93 │
│ add_rate_limiting        │    72%  │ 112/156  │       0.88 │
│ add_error_handling       │    45%  │  70/156  │       0.56 │
│ add_validation           │    38%  │  59/156  │       0.48 │
│ remove_comments          │    22%  │  34/156  │       0.31 │
└──────────────────────────┴─────────┴──────────┴────────────┘

EVOLVING SKILL:
──────────────────────────────────────────────────────────────
Step 1: Creating version snapshot...
  ✓ Saved: versions/1.1.0-backup-1706612400

Step 2: Applying suggestion #1 (93% confidence):
  ADD pagination pattern to API response template

  Before:
    return Response(data=results)

  After:
    return Response(
      data=results,
      pagination={
        "cursor": next_cursor,
        "has_more": len(results) == limit
      }
    )

  ✓ Applied to SKILL.md (lines 89-102)

Step 3: Applying suggestion #2 (88% confidence):
  ADD rate_limiting middleware example

  ✓ Added new section: "Rate Limiting Pattern"
  ✓ Added reference: references/rate-limiting.md

Step 4: Updating version...
  ✓ Version: 1.1.0 → 1.2.0
  ✓ Changelog: "Added pagination + rate limiting patterns"

EVOLUTION COMPLETE:
├─ Version: 1.2.0
├─ Changes: 2 patterns added
├─ Rollback available: /ork:skill-evolution rollback 1.1.0
└─ Next review: 50 more uses`,
    completionTime: "18s",
    metrics: {
      Patterns: "2",
      Confidence: "93%",
      Version: "1.2.0",
    },
  },

  // ADVANCED LEVEL - Multi-skill evolution with rollback
  advanced: {
    name: "Advanced",
    description: "evolve 5 skills + rollback detection",
    inputCount: 12,
    files: [
      {
        name: ".claude/feedback/",
        status: "completed",
        children: [
          { name: "edit-patterns.jsonl", status: "completed", lines: 1456 },
          { name: "evolution-registry.json", status: "completed", lines: 345 },
          { name: "metrics.json", status: "completed", lines: 234 },
        ],
      },
      {
        name: "skills/",
        status: "completed",
        children: [
          { name: "api-design-framework/", status: "completed", lines: 0 },
          { name: "database-schema-designer/", status: "completed", lines: 0 },
          { name: "fastapi-patterns/", status: "writing", lines: 0 },
          { name: "auth-patterns/", status: "completed", lines: 0 },
          { name: "testing-patterns/", status: "pending", lines: 0 },
        ],
      },
    ],
    references: [
      { name: "evolution-analysis", status: "loaded", category: "analytics" },
      { name: "version-management", status: "loaded", category: "versioning" },
      { name: "pattern-detection", status: "loaded", category: "ml" },
      { name: "rollback-triggers", status: "loading", category: "safety" },
    ],
    claudeResponse: [
      "Enterprise skill evolution analysis:",
      "",
      "• 5 skills in scope",
      "• 847 total uses analyzed",
      "• Health monitoring active",
      "• Rollback detection enabled",
      "• Cross-skill pattern correlation",
    ],
    codeSnippet: `ENTERPRISE SKILL EVOLUTION REPORT
══════════════════════════════════════════════════════════════════════

PORTFOLIO OVERVIEW:
┌────────────────────────────┬─────────┬─────────┬───────────┬────────────┬──────────┐
│ Skill                      │ Uses    │ Success │ Avg Edits │ Suggestions│ Health   │
├────────────────────────────┼─────────┼─────────┼───────────┼────────────┼──────────┤
│ api-design-framework       │     256 │     94% │       1.6 │          0 │ ✓ GOOD   │
│ database-schema-designer   │     189 │     91% │       1.9 │          2 │ ✓ GOOD   │
│ fastapi-patterns           │     167 │     71% │       3.1 │          4 │ ⚠ ALERT  │
│ auth-patterns              │     134 │     89% │       2.0 │          1 │ ✓ GOOD   │
│ testing-patterns           │     101 │     86% │       2.3 │          2 │ ✓ GOOD   │
└────────────────────────────┴─────────┴─────────┴───────────┴────────────┴──────────┘

HEALTH ALERT: fastapi-patterns
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠ SUCCESS RATE DROPPED: 89% → 71% (-18% since version 2.3.0)

Root Cause Analysis:
├─ Version 2.3.0 introduced "async-first pattern"
├─ Pattern conflicts with sync database calls
├─ 48 users reverted to sync pattern (edit detected)
└─ Suggestion: Rollback to 2.2.0 or add compatibility layer

Recommended Action:
  /ork:skill-evolution rollback fastapi-patterns 2.2.0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VERSION HISTORY: fastapi-patterns
┌─────────┬────────────┬─────────┬───────┬───────────┬────────────────────────────┐
│ Version │ Date       │ Success │ Uses  │ Avg Edits │ Changelog                  │
├─────────┼────────────┼─────────┼───────┼───────────┼────────────────────────────┤
│ 2.3.0   │ 2026-01-21 │    71%  │    67 │       3.1 │ Added async-first pattern  │
│ 2.2.0   │ 2026-01-05 │    89%  │    80 │       2.0 │ Added dependency injection │
│ 2.1.0   │ 2025-12-15 │    91%  │    45 │       1.8 │ Initial release            │
└─────────┴────────────┴─────────┴───────┴───────────┴────────────────────────────┘

ROLLBACK INITIATED: fastapi-patterns 2.3.0 → 2.2.0
───────────────────────────────────────────────────────────────────────
Step 1: Creating backup of current version...
  ✓ Backed up: versions/.backup-2.3.0-1706612400

Step 2: Restoring version 2.2.0...
  ✓ Restored SKILL.md (356 lines)
  ✓ Restored references/dependency-injection.md
  ✗ Removed references/async-first.md (archived)

Step 3: Updating registry...
  ✓ Version: 2.3.0 → 2.2.0 (rollback)
  ✓ Status: async-first marked as "needs-review"

ROLLBACK COMPLETE:
├─ Reverted: fastapi-patterns to 2.2.0
├─ Backup: versions/.backup-2.3.0-1706612400
└─ Monitoring: Will alert if success rate improves

CROSS-SKILL PATTERN ANALYSIS:
───────────────────────────────────────────────────────────────────────
Correlated patterns detected across skills:

Pattern: add_pagination
├─ api-design-framework: 85% add rate
├─ database-schema-designer: 72% add rate
└─ Recommendation: Create shared pagination reference

Pattern: add_error_handling
├─ fastapi-patterns: 78% add rate
├─ auth-patterns: 82% add rate
└─ Recommendation: Standardize error format across skills

Pattern: add_rate_limiting
├─ api-design-framework: 72% add rate
├─ auth-patterns: 68% add rate
└─ Already standardized in v4.12.0

PENDING SUGGESTIONS (Ranked by Impact):
┌──────────────────────────────────┬────────────┬─────────────┬──────────┐
│ Suggestion                       │ Confidence │ Skill       │ Impact   │
├──────────────────────────────────┼────────────┼─────────────┼──────────┤
│ Add shared pagination reference  │       0.91 │ (multiple)  │ HIGH     │
│ Add connection pooling example   │       0.87 │ database-*  │ HIGH     │
│ Standardize error handling       │       0.85 │ (multiple)  │ MEDIUM   │
│ Add async/sync compatibility     │       0.82 │ fastapi-*   │ HIGH     │
│ Add circuit breaker pattern      │       0.79 │ api-design  │ MEDIUM   │
│ Add retry with backoff           │       0.76 │ auth-*      │ MEDIUM   │
│ Add input sanitization           │       0.74 │ (multiple)  │ HIGH     │
│ Add logging standardization      │       0.71 │ (multiple)  │ LOW      │
└──────────────────────────────────┴────────────┴─────────────┴──────────┘

EVOLUTION SUMMARY:
├─ Skills analyzed: 5
├─ Total uses: 847
├─ Suggestions pending: 8
├─ Rollbacks triggered: 1 (fastapi-patterns)
├─ Health status: 4/5 GOOD, 1/5 ALERT (now fixed)
└─ Next scheduled analysis: 7 days

ACTIONS TAKEN THIS SESSION:
✓ Rolled back fastapi-patterns 2.3.0 → 2.2.0
✓ Archived async-first.md for future review
✓ Created cross-skill pattern report
✓ Queued 8 suggestions for review

Run /ork:skill-evolution evolve <skill-id> to apply suggestions`,
    completionTime: "1m 12s",
    metrics: {
      Skills: "5",
      Uses: "847",
      Rollbacks: "1",
      Suggestions: "8",
    },
  },

  summaryTitle: "SKILLS EVOLVED",
  summaryTagline: "Learn from usage. Auto-improve. Safe rollback. Always better.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default skillEvolutionDemoConfig;

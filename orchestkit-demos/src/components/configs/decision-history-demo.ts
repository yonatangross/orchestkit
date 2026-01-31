/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:decision-history skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const decisionHistoryDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "decision-history",
  skillCommand: "/ork:decision-history",
  hook: "Every decision tracked. Every rationale preserved. Time travel.",
  primaryColor: "#6366f1",
  secondaryColor: "#22c55e",
  accentColor: "#f59e0b",

  phases: [
    { name: "Aggregate Sources", shortName: "Aggregate" },
    { name: "Filter & Sort", shortName: "Filter" },
    { name: "Generate View", shortName: "Generate" },
    { name: "Export", shortName: "Export" },
  ],

  // SIMPLE LEVEL - List recent decisions
  simple: {
    name: "Simple",
    description: "list recent decisions",
    inputCount: 1,
    files: [
      {
        name: ".claude/context/knowledge/decisions/",
        status: "completed",
        children: [
          { name: "active.json", status: "completed", lines: 156 },
        ],
      },
    ],
    references: [
      { name: "cli-commands", status: "loaded", category: "cli" },
      { name: "data-schema", status: "loaded", category: "schema" },
    ],
    claudeResponse: [
      "Fetching decision history:",
      "",
      "• Parsing active decisions",
      "• Sorting by date",
      "• Generating ASCII table",
    ],
    codeSnippet: `DECISION HISTORY
════════════════════════════════════════════════════════════════

Recent Decisions (Last 30 Days):
┌────────────┬──────────┬────────────────────────────────────────────┬────────────┐
│ Date       │ CC Ver   │ Summary                                    │ Category   │
├────────────┼──────────┼────────────────────────────────────────────┼────────────┤
│ 2026-01-28 │ 2.1.22   │ **Task Management**: Adopted TaskCreate... │ lifecycle  │
│ 2026-01-25 │ 2.1.22   │ **Async Hooks**: 6 hooks now fire-and-f... │ hooks      │
│ 2026-01-21 │ 2.1.16   │ **CC 2.1.16 Support**: Full Claude Code... │ architectu │
│ 2026-01-18 │ 2.1.16   │ **agent-browser Skill**: Added complete... │ ai         │
│ 2026-01-15 │ 2.1.11   │ **Memory Graph**: Switched to graph-fir... │ memory     │
└────────────┴──────────┴────────────────────────────────────────────┴────────────┘

Commands:
  decision-history list --cc-version 2.1.16  # Filter by CC version
  decision-history show <id>                  # View full decision
  decision-history mermaid --output docs/     # Generate timeline`,
    completionTime: "2s",
    metrics: {
      Decisions: "5",
      Sources: "1",
      Period: "30 days",
    },
  },

  // MEDIUM LEVEL - Generate timeline with filters
  medium: {
    name: "Medium",
    description: "generate CC version timeline",
    inputCount: 4,
    files: [
      {
        name: ".claude/",
        status: "completed",
        children: [
          { name: "context/knowledge/decisions/active.json", status: "completed", lines: 256 },
          { name: "coordination/decision-log.json", status: "completed", lines: 189 },
        ],
      },
      {
        name: "CHANGELOG.md",
        status: "completed",
        lines: 1456,
      },
    ],
    references: [
      { name: "cli-commands", status: "loaded", category: "cli" },
      { name: "data-schema", status: "loaded", category: "schema" },
      { name: "cc-version-mapping", status: "loading", category: "compat" },
    ],
    claudeResponse: [
      "Generating CC version timeline:",
      "",
      "• Parsing CHANGELOG.md",
      "• Aggregating 3 sources",
      "• Grouping by CC version",
      "• Generating Mermaid diagram",
    ],
    codeSnippet: `DECISION HISTORY TIMELINE
════════════════════════════════════════════════════════════════

Grouped by Claude Code Version:
────────────────────────────────────────────────────────────────

CC 2.1.22 (Current)
  ├── 2026-01-28 ── Task Management System adoption
  │   HIGH │ lifecycle │ TaskCreate/TaskUpdate/TaskList integration
  ├── 2026-01-25 ── Async hooks (fire-and-forget)
  │   HIGH │ hooks │ 6 hooks now non-blocking
  └── 2026-01-23 ── Memory graph primary storage
      MEDIUM │ memory │ Graph-first architecture

CC 2.1.16
  ├── 2026-01-21 ── Full CC 2.1.16 support
  │   HIGH │ architecture │ Task tools, better streaming
  ├── 2026-01-18 ── agent-browser skill
  │   MEDIUM │ ai │ Vision-aware web browsing
  └── 2026-01-15 ── Hook stdin consumption fix
      HIGH │ hooks │ Fixed 39 hooks reading stdin

CC 2.1.11
  ├── 2025-12-20 ── Setup hooks for initialization
  │   HIGH │ lifecycle │ One-time setup on first run
  └── 2025-12-15 ── Self-healing context
      MEDIUM │ architecture │ Auto-recovery from corruption

MERMAID TIMELINE GENERATED:
────────────────────────────────────────────────────────────────
\`\`\`mermaid
timeline
    title OrchestKit Evolution with Claude Code
    section CC 2.1.22
        Task Management System : lifecycle : HIGH
        Async Hooks Fire-and-Forget : hooks : HIGH
        Memory Graph Primary : memory : MEDIUM
    section CC 2.1.16
        Full CC 2.1.16 Support : architecture : HIGH
        agent-browser Skill : ai : MEDIUM
        Hook Stdin Fix : hooks : HIGH
    section CC 2.1.11
        Setup Hooks : lifecycle : HIGH
        Self-healing Context : architecture : MEDIUM
\`\`\`

Saved to: docs/decision-timeline.md`,
    completionTime: "8s",
    metrics: {
      Decisions: "8",
      "CC Versions": "3",
      Mermaid: "Generated",
    },
  },

  // ADVANCED LEVEL - Full analysis with stats and search
  advanced: {
    name: "Advanced",
    description: "full decision analysis + search",
    inputCount: 12,
    files: [
      {
        name: ".claude/",
        status: "completed",
        children: [
          { name: "context/knowledge/decisions/", status: "completed", lines: 0 },
          { name: "coordination/decision-log.json", status: "completed", lines: 345 },
          { name: "feedback/changelog-decisions.json", status: "completed", lines: 567 },
        ],
      },
      {
        name: "CHANGELOG.md",
        status: "completed",
        lines: 2456,
      },
      {
        name: "docs/",
        status: "completed",
        children: [
          { name: "decisions/", status: "completed", lines: 0 },
          { name: "ADR/", status: "writing", lines: 0 },
        ],
      },
    ],
    references: [
      { name: "cli-commands", status: "loaded", category: "cli" },
      { name: "data-schema", status: "loaded", category: "schema" },
      { name: "cc-version-mapping", status: "loaded", category: "compat" },
      { name: "mermaid-templates", status: "loading", category: "viz" },
    ],
    claudeResponse: [
      "Enterprise decision analysis:",
      "",
      "• 4 data sources aggregated",
      "• 67 decisions indexed",
      "• Cross-referencing CC versions",
      "• Generating statistics",
      "• Executing search query",
    ],
    codeSnippet: `DECISION HISTORY - ENTERPRISE ANALYSIS
══════════════════════════════════════════════════════════════════════

DATA SOURCES AGGREGATED:
┌────────────────────────────────────────┬──────────┬──────────────────┐
│ Source                                 │ Decisions│ Last Updated     │
├────────────────────────────────────────┼──────────┼──────────────────┤
│ CHANGELOG.md                           │       45 │ 2026-01-28       │
│ .claude/context/knowledge/decisions/   │       12 │ 2026-01-28       │
│ .claude/coordination/decision-log.json │        8 │ 2026-01-27       │
│ docs/ADR/*.md                          │        2 │ 2026-01-15       │
├────────────────────────────────────────┼──────────┼──────────────────┤
│ TOTAL (deduplicated)                   │       67 │                  │
└────────────────────────────────────────┴──────────┴──────────────────┘

STATISTICS:
───────────────────────────────────────────────────────────────────────

By Category:
┌─────────────────┬───────┬────────────────────────────────────────────┐
│ Category        │ Count │ Distribution                               │
├─────────────────┼───────┼────────────────────────────────────────────┤
│ architecture    │    18 │ ████████████████████                  27% │
│ hooks           │    14 │ ████████████████                      21% │
│ lifecycle       │    12 │ ██████████████                        18% │
│ memory          │     9 │ ██████████                            13% │
│ ai              │     7 │ ████████                              10% │
│ security        │     4 │ █████                                  6% │
│ other           │     3 │ ████                                   5% │
└─────────────────┴───────┴────────────────────────────────────────────┘

By Impact:
├─ HIGH:   28 (42%)
├─ MEDIUM: 31 (46%)
└─ LOW:     8 (12%)

By Claude Code Version:
┌──────────┬───────┬─────────────┬────────────────────────────────────┐
│ CC Ver   │ Count │ Date Range  │ Key Decisions                      │
├──────────┼───────┼─────────────┼────────────────────────────────────┤
│ 2.1.22   │    12 │ Jan 2026    │ Task Management, Async Hooks       │
│ 2.1.16   │    18 │ Jan 2026    │ Task Tools, agent-browser          │
│ 2.1.11   │    15 │ Dec 2025    │ Setup Hooks, Self-healing          │
│ 2.1.6    │    10 │ Nov 2025    │ Permission Patterns                │
│ 2.1.0    │    12 │ Oct 2025    │ context: fork, Skill System        │
└──────────┴───────┴─────────────┴────────────────────────────────────┘

SEARCH RESULTS: "typescript hooks"
───────────────────────────────────────────────────────────────────────

Found 4 decisions matching "typescript hooks":

1. [2026-01-25] Async Hooks Migration (HIGH)
   CC 2.1.22 │ hooks
   Summary: Migrated 6 hooks to fire-and-forget pattern for
   non-blocking execution. Uses TypeScript with esbuild bundling.
   Rationale: Hooks were blocking Claude Code startup, causing
   5-8 second delays. Async execution eliminates this overhead.
   Related: langgraph-workflows, context-engineering

2. [2026-01-18] TypeScript Hooks Infrastructure (HIGH)
   CC 2.1.16 │ hooks
   Summary: Converted all 167 hooks from bash to TypeScript.
   Rationale: Type safety, better error handling, faster execution
   via esbuild bundling. Reduced hook execution time by 60%.
   Related: split-bundles, esbuild-optimization

3. [2025-12-20] Setup Hooks for One-Time Init (HIGH)
   CC 2.1.11 │ lifecycle
   Summary: Added setup.ts hook type for first-run initialization.
   Rationale: Need to generate instance IDs, create directories,
   and validate environment on first Claude Code start.
   Related: instance-id-generation, worktree-coordination

4. [2025-11-15] Hook Timeout Configuration (MEDIUM)
   CC 2.1.6 │ hooks
   Summary: Added configurable timeouts per hook type.
   Rationale: Some hooks (mem0) require longer timeouts for
   network I/O while others (permission) need to be fast.
   Related: async-hooks, timeout-patterns

DECISION TIMELINE (Full Project):
───────────────────────────────────────────────────────────────────────

\`\`\`mermaid
%%{init: {'theme': 'dark'}}%%
timeline
    title OrchestKit Architecture Evolution
    section Q4 2025
        CC 2.1.0 : context fork pattern
                 : Skill system v1
        CC 2.1.6 : Permission patterns
                 : Hook timeouts
        CC 2.1.11 : Setup hooks
                  : Self-healing context
    section Q1 2026
        CC 2.1.16 : TypeScript hooks
                  : agent-browser skill
                  : Task tools support
        CC 2.1.22 : Task Management System
                  : Async hooks (fire-and-forget)
                  : Memory graph primary
\`\`\`

DECISION HEALTH:
───────────────────────────────────────────────────────────────────────
├─ Documented: 67/67 (100%)
├─ With Rationale: 62/67 (93%)
├─ Cross-Referenced: 48/67 (72%)
├─ Superseded: 3/67 (4%)
└─ Deprecated: 2/67 (3%)

EXPORT OPTIONS:
───────────────────────────────────────────────────────────────────────
✓ Mermaid timeline: docs/decision-timeline.md
✓ JSON export: .claude/feedback/decisions-export.json
✓ ADR format: docs/ADR/0001-0067.md (67 files)
✓ CSV for analysis: decisions.csv

RECOMMENDATIONS:
───────────────────────────────────────────────────────────────────────
1. 5 decisions missing rationale - run /ork:decision-history enrich
2. 19 decisions not cross-referenced - consider linking related
3. 2 deprecated decisions should be archived

Run /ork:decision-history show <id> for full decision details`,
    completionTime: "28s",
    metrics: {
      Decisions: "67",
      Sources: "4",
      Categories: "7",
      "CC Versions": "5",
    },
  },

  summaryTitle: "DECISIONS MAPPED",
  summaryTagline: "67 decisions. Full rationale. CC version evolution. Never forget why.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default decisionHistoryDemoConfig;

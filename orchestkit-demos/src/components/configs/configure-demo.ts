/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:configure skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const configureDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "configure",
  skillCommand: "/ork:configure",
  hook: "Your AI toolkit, your rules",
  primaryColor: "#f59e0b",
  secondaryColor: "#8b5cf6",
  accentColor: "#22c55e",

  phases: [
    { name: "Choose Preset", shortName: "Preset" },
    { name: "Customize Skills", shortName: "Skills" },
    { name: "Configure Hooks", shortName: "Hooks" },
    { name: "Setup MCPs", shortName: "MCPs" },
    { name: "Save Config", shortName: "Save" },
  ],

  // SIMPLE LEVEL - Quick preset selection
  simple: {
    name: "Simple",
    description: "configure (lite preset)",
    inputCount: 1,
    files: [
      {
        name: "~/.claude/plugins/",
        status: "completed",
        children: [
          { name: "orchestkit/config.json", status: "completed", lines: 24 },
        ],
      },
    ],
    references: [
      { name: "presets", status: "loaded", category: "config" },
    ],
    claudeResponse: [
      "Configuring OrchestKit:",
      "",
      "• Preset: Lite",
      "• Skills: 10 essential",
      "• Hooks: Safety only",
      "• MCPs: Disabled",
    ],
    codeSnippet: `ORCHESTKIT CONFIGURATION WIZARD
═══════════════════════════════

Step 1: Choose Preset
─────────────────────
│ Preset   │ Skills │ Agents │ Hooks │
├──────────┼────────┼────────┼───────┤
│ Complete │ 185    │ 35     │ 167   │
│ Standard │ 185    │ 0      │ 167   │
│ Lite     │ 10     │ 0      │ 167   │  ← Selected
│ Hooks    │ 0      │ 0      │ 167   │
└──────────┴────────┴────────┴───────┘

> Selected: Lite (Essential skills only)

Step 2: Confirm Skills (10)
───────────────────────────
✓ explore      - Codebase analysis
✓ implement    - Feature implementation
✓ verify       - Multi-agent validation
✓ commit       - Conventional commits
✓ create-pr    - PR creation
✓ review-pr    - PR review
✓ remember     - Store decisions
✓ recall       - Search memories
✓ brainstorming- Design exploration
✓ doctor       - Health diagnostics

Step 3: Safety Hooks (Always On)
────────────────────────────────
✓ git-branch-protection (cannot disable)
✓ file-guard (cannot disable)
✓ redact-secrets (cannot disable)

Step 4: MCPs
────────────
All MCPs disabled (lite preset default)
Enable later with /configure --mcps

CONFIGURATION SAVED
───────────────────
Location: ~/.claude/plugins/orchestkit/config.json

{
  "version": "1.0.0",
  "preset": "lite",
  "skills": {
    "explore": true,
    "implement": true,
    "verify": true,
    "commit": true,
    "create-pr": true,
    "review-pr": true,
    "remember": true,
    "recall": true,
    "brainstorming": true,
    "doctor": true
  },
  "hooks": {
    "safety": true,
    "productivity": false,
    "quality": false
  },
  "mcps": {}
}

✓ Configuration saved successfully
→ Restart Claude Code to apply changes`,
    completionTime: "8s",
    metrics: {
      Skills: "10",
      Hooks: "3",
      MCPs: "0",
    },
  },

  // MEDIUM LEVEL - Customized standard setup
  medium: {
    name: "Medium",
    description: "configure (backend + security)",
    inputCount: 6,
    files: [
      {
        name: "~/.claude/plugins/",
        status: "completed",
        children: [
          { name: "orchestkit/config.json", status: "completed", lines: 89 },
          { name: "mcps/", status: "completed", lines: 0 },
        ],
      },
    ],
    references: [
      { name: "presets", status: "loaded", category: "config" },
      { name: "mcp-config", status: "loaded", category: "mcps" },
      { name: "hook-configuration", status: "loading", category: "hooks" },
    ],
    claudeResponse: [
      "Configuring OrchestKit:",
      "",
      "• Base: Standard preset",
      "• Categories: Backend + Security",
      "• Agents: 6 technical",
      "• MCPs: 2 enabled",
    ],
    codeSnippet: `ORCHESTKIT CONFIGURATION WIZARD
═══════════════════════════════

Step 1: Choose Preset
─────────────────────
> Selected: Standard (Skills + Hooks, no agents by default)

Step 2: Customize Skill Categories
──────────────────────────────────
Available categories:
  [x] AI/ML (26 skills)
  [x] Backend (15 skills)      ← Selected
  [ ] Frontend (8 skills)
  [ ] Testing (13 skills)
  [x] Security (7 skills)      ← Selected
  [ ] DevOps (4 skills)
  [ ] Planning (6 skills)

Total skills selected: 48

Step 3: Enable Agents
─────────────────────
Technical Agents (Selected 6):
  [x] backend-system-architect
  [x] database-engineer
  [x] security-auditor
  [x] security-layer-auditor
  [x] test-generator
  [x] code-quality-reviewer

Product Agents (None selected)

Step 4: Configure Hooks
───────────────────────
Safety Hooks (Always On):
  ✓ git-branch-protection
  ✓ file-guard
  ✓ redact-secrets

Productivity Hooks:
  [x] auto-approve-safe-commands
  [ ] notification-sounds
  [x] session-logging

Quality Gates:
  [x] coverage-threshold (80%)
  [x] lint-on-save
  [ ] complexity-warnings

Step 5: Configure MCPs
──────────────────────
  [x] context7         - Library documentation
  [ ] sequential-thinking
  [x] memory           - Cross-session persistence
  [ ] playwright

MCP Configuration:
  context7:
    timeout: 30s
    cache: enabled
  memory:
    backend: local
    sync: manual

CONFIGURATION SAVED
───────────────────
Location: ~/.claude/plugins/orchestkit/config.json

{
  "version": "1.0.0",
  "preset": "standard",
  "skills": {
    "ai_ml": true,
    "backend": true,
    "security": true
  },
  "agents": {
    "backend-system-architect": true,
    "database-engineer": true,
    "security-auditor": true,
    "security-layer-auditor": true,
    "test-generator": true,
    "code-quality-reviewer": true
  },
  "hooks": {
    "safety": true,
    "productivity": {
      "auto_approve": true,
      "session_logging": true
    },
    "quality": {
      "coverage_threshold": 80,
      "lint_on_save": true
    }
  },
  "mcps": {
    "context7": { "enabled": true },
    "memory": { "enabled": true, "backend": "local" }
  }
}

✓ Configuration saved successfully
✓ MCPs configured
→ Restart Claude Code to apply changes`,
    completionTime: "45s",
    metrics: {
      Skills: "48",
      Agents: "6",
      Hooks: "8",
      MCPs: "2",
    },
  },

  // ADVANCED LEVEL - Full enterprise configuration
  advanced: {
    name: "Advanced",
    description: "configure (monorepo + CC 2.1.20)",
    inputCount: 24,
    files: [
      {
        name: "~/.claude/plugins/",
        status: "completed",
        children: [
          { name: "orchestkit/config.json", status: "completed", lines: 234 },
          { name: "orchestkit/presets/", status: "completed", lines: 0 },
          { name: "mcps/", status: "completed", lines: 0 },
        ],
      },
      {
        name: ".claude/",
        status: "completed",
        children: [
          { name: "settings.json", status: "completed", lines: 45 },
        ],
      },
    ],
    references: [
      { name: "presets", status: "loaded", category: "config" },
      { name: "mcp-config", status: "loaded", category: "mcps" },
      { name: "hook-configuration", status: "loaded", category: "hooks" },
      { name: "cc-2120-features", status: "loaded", category: "cc" },
      { name: "monorepo-patterns", status: "loading", category: "monorepo" },
    ],
    claudeResponse: [
      "Configuring OrchestKit for enterprise:",
      "",
      "• Base: Monorepo preset",
      "• All categories enabled",
      "• All 36 agents enabled",
      "• CC 2.1.20 features configured",
      "• 4 MCPs with custom settings",
    ],
    codeSnippet: `ORCHESTKIT CONFIGURATION WIZARD
═══════════════════════════════

Step 1: Choose Preset
─────────────────────
> Selected: Monorepo (Complete + multi-directory support)

Step 2: Customize Skill Categories
──────────────────────────────────
All categories enabled (62 skills):
  [x] AI/ML (26 skills)
  [x] Backend (15 skills)
  [x] Frontend (8 skills)
  [x] Testing (13 skills)
  [x] Security (7 skills)
  [x] DevOps (4 skills)
  [x] Planning (6 skills)
  [x] Memory (12 skills)
  [x] Workflow (18 skills)
  [x] Integration (15 skills)
  ... and 71 more

Step 3: Enable Agents
─────────────────────
All 36 agents enabled:

Product Agents (6):
  [x] market-intelligence
  [x] product-strategist
  [x] requirements-translator
  [x] ux-researcher
  [x] prioritization-analyst
  [x] business-case-builder

Technical Agents (14):
  [x] backend-system-architect
  [x] frontend-ui-developer
  [x] database-engineer
  [x] llm-integrator
  [x] workflow-architect
  [x] data-pipeline-engineer
  [x] test-generator
  [x] code-quality-reviewer
  [x] security-auditor
  [x] security-layer-auditor
  [x] debug-investigator
  [x] metrics-architect
  [x] rapid-ui-designer
  [x] system-design-reviewer

Specialist Agents (15):
  [x] ... all enabled

Step 4: Configure Hooks
───────────────────────
All hook categories enabled (89 hooks):

Safety (Always On):
  ✓ git-branch-protection
  ✓ file-guard
  ✓ redact-secrets

Productivity:
  [x] auto-approve-safe-commands
  [x] notification-sounds
  [x] session-logging
  [x] desktop-notifications

Quality Gates:
  [x] coverage-threshold: 85%
  [x] lint-on-save
  [x] complexity-warnings (threshold: 15)
  [x] type-coverage: 95%

Team Coordination:
  [x] file-locks
  [x] conflict-detection
  [x] worktree-awareness

Async Hooks (6):
  [x] background-analytics
  [x] memory-sync
  [x] prompt-enhancement
  [x] agent-telemetry
  [x] decision-capture
  [x] context-compression

Step 5: Configure MCPs
──────────────────────
All 4 MCPs enabled with custom settings:

context7:
  timeout: 60s
  cache: aggressive
  preload: ["react", "typescript", "fastapi"]

sequential-thinking:
  max_steps: 10
  thinking_budget: 5000 tokens

memory:
  backend: postgres
  sync: automatic
  retention: 90 days

playwright:
  headless: true
  timeout: 30s
  screenshots: on-failure

Step 6: CC 2.1.20 Settings
──────────────────────────
New features configuration:

Task Management:
  [x] Enable task deletion (status: "deleted")
  [x] Orphan detection: automatic cleanup

PR Integration:
  [x] PR status enrichment at session start
  [x] Auto-detect open PRs on branch
  [x] Set ORCHESTKIT_PR_URL env var

Background Agents:
  [x] Permission profile suggestions
  [x] Pre-mapped profiles for common agents:
      - security-auditor: read-only
      - test-generator: test-files-only
      - code-quality-reviewer: read-only

Monorepo Detection:
  [x] Enable monorepo detection
  [x] Auto-suggest --add-dir usage
  [x] Detected directories:
      - frontend/
      - backend/
      - packages/shared/
      - infrastructure/

Step 7: CC 2.1.7 Settings
─────────────────────────
Turn Duration:
  [x] Show turn duration in statusline

Context Window:
  [x] Use effective context window
  MCP deferral threshold: 10%
  Compression trigger: 70%

CONFIGURATION SAVED
───────────────────
Locations:
  ~/.claude/plugins/orchestkit/config.json
  .claude/settings.json

config.json (excerpt):
{
  "version": "1.0.0",
  "preset": "monorepo",
  "skills": { "all": true },
  "agents": { "all": true },
  "hooks": {
    "safety": true,
    "productivity": { "all": true },
    "quality": {
      "coverage_threshold": 85,
      "type_coverage": 95,
      "complexity_threshold": 15
    },
    "team": { "all": true },
    "async": { "all": true }
  },
  "mcps": {
    "context7": { "enabled": true, "cache": "aggressive" },
    "sequential-thinking": { "enabled": true, "max_steps": 10 },
    "memory": { "enabled": true, "backend": "postgres" },
    "playwright": { "enabled": true, "headless": true }
  },
  "cc2120": {
    "task_deletion": true,
    "pr_enrichment": true,
    "permission_profiles": true,
    "monorepo_detection": true
  },
  "cc217": {
    "turn_duration": true,
    "effective_window": true,
    "mcp_defer_threshold": 0.10
  },
  "monorepo": {
    "directories": ["frontend", "backend", "packages/shared", "infrastructure"],
    "auto_add_dir": true
  }
}

SUMMARY
───────
✓ 62 skills enabled
✓ 36 agents enabled
✓ 89 hooks configured (6 async)
✓ 4 MCPs configured
✓ CC 2.1.20 features enabled
✓ CC 2.1.7 optimizations enabled
✓ Monorepo support configured

→ Restart Claude Code to apply all changes
→ Run /doctor to verify configuration`,
    completionTime: "2m 15s",
    metrics: {
      Skills: "185",
      Agents: "35",
      Hooks: "167",
      MCPs: "4",
    },
  },

  summaryTitle: "CONFIGURED",
  summaryTagline: "Your AI toolkit, customized. Ready to accelerate.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default configureDemoConfig;

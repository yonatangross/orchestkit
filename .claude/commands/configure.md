---
description: Interactive SkillForge configuration wizard
---

# SkillForge Configuration

Interactive setup for customizing your SkillForge installation. Similar to `/claude-hud:configure`.

## Overview

This wizard helps you:
1. Choose a preset (Complete, Standard, Lite, Hooks-only)
2. Customize skill categories
3. Toggle agents on/off
4. Configure hooks
5. Configure MCP integrations (optional)
6. Preview and save

## Step 1: Choose Preset

Use the AskUserQuestion tool to ask:

**Question:** "Which SkillForge preset would you like to start with?"

**Options:**
| Preset | Skills | Agents | Commands | Hooks | Description |
|--------|--------|--------|----------|-------|-------------|
| **Complete** (Recommended) | 78 | 20 | 11 | 92 | Everything - full AI-assisted development |
| **Standard** | 78 | 0 | 11 | 92 | All skills, no agents (spawn manually) |
| **Lite** | 10 | 0 | 5 | 92 | Essential skills only, minimal overhead |
| **Hooks-only** | 0 | 0 | 0 | 92 | Just safety guardrails |

## Step 2: Customize Skill Categories

Based on preset, ask which categories to enable:

```
AI/ML (26 skills)
├── agent-loops, rag-retrieval, embeddings, function-calling
├── multi-agent-orchestration, ollama-local, prompt-caching
├── semantic-caching, llm-streaming, llm-evaluation, llm-testing
├── llm-safety-patterns, context-engineering, context-compression
├── langfuse-observability, langgraph-functional
└── LangGraph: supervisor, routing, parallel, state, checkpoints, human-in-loop

Backend (15 skills)
├── fastapi-advanced, clean-architecture, api-design-framework
├── api-versioning, rate-limiting, background-jobs, caching-strategies
├── database-schema-designer, resilience-patterns, streaming-api-patterns
├── mcp-server-building, observability-monitoring
└── error-handling-rfc9457, pgvector-search

Frontend (8 skills)
├── react-server-components-framework, edge-computing-patterns
├── design-system-starter, motion-animation-patterns, i18n-date-patterns
├── type-safety-validation, performance-optimization
└── browser-content-capture

Testing (13 skills)
├── unit-testing, integration-testing, e2e-testing, performance-testing
├── webapp-testing, llm-testing, msw-mocking, vcr-http-recording
├── test-data-management, test-standards-enforcer, evidence-verification
├── quality-gates, golden-dataset-*
└── golden-dataset-curation, golden-dataset-management, golden-dataset-validation

Security (7 skills)
├── owasp-top-10, auth-patterns, input-validation
├── security-scanning, defense-in-depth
└── llm-safety-patterns, context-engineering (security aspects)

DevOps (4 skills)
├── devops-deployment, observability-monitoring
├── langfuse-observability, worktree-coordination

Planning (6 skills)
├── brainstorming, system-design-interrogation
├── architecture-decision-record, ascii-visualizer
├── project-structure-enforcer, code-review-playbook
```

## Step 3: Customize Agents

Toggle agents on/off:

**Product Agents (6):**
- market-intelligence - Analyze market trends
- product-strategist - Validate product decisions
- requirements-translator - PRDs from ideas
- ux-researcher - User journey mapping
- prioritization-analyst - RICE/ICE scoring
- business-case-builder - ROI analysis

**Technical Agents (14):**
- backend-system-architect - API & database design
- frontend-ui-developer - React 19 components
- database-engineer - PostgreSQL optimization
- llm-integrator - LLM API connections
- workflow-architect - LangGraph pipelines
- data-pipeline-engineer - Embeddings & vectors
- test-generator - Generate test suites
- code-quality-reviewer - Code review & linting
- security-auditor - Vulnerability scanning
- security-layer-auditor - Defense-in-depth
- debug-investigator - Root cause analysis
- metrics-architect - OKRs & KPIs
- rapid-ui-designer - Tailwind prototypes
- system-design-reviewer - Architecture review

## Step 4: Configure Hooks

**Safety Hooks (Always On - Cannot Disable):**
- git-branch-protection - Block commits to main/dev
- file-guard - Block writes to protected paths
- redact-secrets - Remove secrets from output

**Productivity Hooks (Toggleable):**
- auto-approve-safe-bash - Skip prompts for safe commands
- auto-approve-readonly - Skip prompts for reads
- audit-logger - Log all operations
- error-tracker - Track error patterns

**Quality Gate Hooks (Toggleable):**
- coverage-threshold-gate - Block if coverage drops
- pattern-consistency-enforcer - Enforce code patterns
- backend-layer-validator - Clean architecture
- test-pattern-validator - Enforce test patterns

**Team Coordination Hooks (Toggleable):**
- multi-instance-init - Register instance
- file-lock-check - Prevent concurrent edits
- conflict-predictor - Warn merge conflicts

**Notification Hooks (Toggleable, default OFF):**
- desktop.sh - Desktop notifications
- sound.sh - Sound alerts

## Step 5: Configure MCP Integrations (Optional)

MCPs (Model Context Protocol servers) enhance SkillForge commands but are **NOT required**.
Commands work without them - MCPs just add extra capabilities.

**All MCPs are disabled by default.** Use this step to enable the ones you want.

Use the AskUserQuestion tool:

**Question:** "Which MCP integrations would you like to enable? (Optional - commands work without them)"

**Options (multiSelect: true):**

| MCP | Purpose | Enhances |
|-----|---------|----------|
| **context7** | Up-to-date library documentation | /implement, /verify, /review-pr |
| **sequential-thinking** | Structured reasoning for complex problems | /brainstorm, /implement |
| **memory** | Cross-session knowledge persistence | /brainstorm, /explore, /fix-issue |
| **playwright** | Browser automation for E2E testing | /verify, browser-content-capture skill |

**Default:** None selected (all MCPs disabled by default)

### Enabling MCPs

SkillForge ships with `.mcp.json` containing all MCP configurations, but **all are disabled by default**.

To enable selected MCPs, update `.mcp.json` by setting `"disabled": false` for each selected MCP:

```json
{
  "$schema": "https://raw.githubusercontent.com/anthropics/claude-code/main/schemas/mcp.schema.json",
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"],
      "description": "Up-to-date documentation for frameworks and libraries",
      "disabled": false
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropics/mcp-server-sequential-thinking"],
      "description": "Complex reasoning and architectural decision support",
      "disabled": true
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@anthropics/mcp-server-memory"],
      "description": "Cross-session memory and context persistence",
      "env": {
        "MEMORY_FILE": ".claude/memory/memory.json"
      },
      "disabled": true
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropics/mcp-server-playwright"],
      "description": "Browser automation for e2e testing and content capture",
      "disabled": true
    }
  }
}
```

**Note:** Only set `"disabled": false` for MCPs the user selected. Keep `"disabled": true` for unselected MCPs.

### If user selects "None":

- Keep all MCPs disabled (no changes to `.mcp.json`)
- Commands will work with reduced functionality
- User can run `/configure` again later to enable MCPs

---

## Step 6: Preview & Save

Show the user their configuration:

```
Your SkillForge Configuration
─────────────────────────────

Preset: [selected preset] (customized)

┌─────────────────────────────────────────────────────────────┐
│  SKILLS: X/78 enabled                                       │
│  ├── AI/ML: X/26                                            │
│  ├── Backend: X/15                                          │
│  ├── Frontend: X/8                                          │
│  ├── Testing: X/13                                          │
│  ├── Security: X/7                                          │
│  ├── DevOps: X/4                                            │
│  └── Planning: X/6                                          │
│                                                             │
│  AGENTS: X/20 enabled                                       │
│  ├── Product: X/6                                           │
│  └── Technical: X/14                                        │
│                                                             │
│  COMMANDS: X/11 enabled                                     │
│                                                             │
│  HOOKS: X/92 active                                         │
│  ├── Safety: 3 (always on)                                  │
│  ├── Productivity: X                                        │
│  ├── Quality Gates: X                                       │
│  ├── Team: X                                                │
│  └── Notifications: X                                       │
│                                                             │
│  MCPs: X/4 enabled                                          │
│  └── [list enabled MCPs or "None (all disabled)"]           │
└─────────────────────────────────────────────────────────────┘

Estimated token overhead: ~X tokens/session
```

## Save Configuration

Write to: `~/.claude/plugins/skillforge/config.json`

```json
{
  "version": "1.0.0",
  "preset": "complete",
  "customized": false,
  "skills": {
    "ai_ml": true,
    "backend": true,
    "frontend": true,
    "testing": true,
    "security": true,
    "devops": true,
    "planning": true,
    "disabled": []
  },
  "agents": {
    "product": true,
    "technical": true,
    "disabled": []
  },
  "hooks": {
    "safety": true,
    "productivity": true,
    "quality_gates": true,
    "team_coordination": true,
    "notifications": false,
    "disabled": []
  },
  "commands": {
    "enabled": true,
    "disabled": []
  },
  "mcps": {
    "context7": false,
    "sequential_thinking": false,
    "memory": false,
    "playwright": false
  }
}
```

## Reconfigure Anytime

Users can run `/skillforge:configure` again to modify settings.

## Manual Edit

Direct editing: `~/.claude/plugins/skillforge/config.json`

For MCPs: Edit `.mcp.json` and set `"disabled": false` for MCPs you want to enable.

## Preset Definitions

### Complete (Default)
```json
{
  "preset": "complete",
  "skills": { "ai_ml": true, "backend": true, "frontend": true, "testing": true, "security": true, "devops": true, "planning": true },
  "agents": { "product": true, "technical": true },
  "hooks": { "safety": true, "productivity": true, "quality_gates": true, "team_coordination": true, "notifications": false },
  "commands": { "enabled": true },
  "mcps": { "context7": false, "sequential_thinking": false, "memory": false, "playwright": false }
}
```

### Standard
```json
{
  "preset": "standard",
  "skills": { "ai_ml": true, "backend": true, "frontend": true, "testing": true, "security": true, "devops": true, "planning": true },
  "agents": { "product": false, "technical": false },
  "hooks": { "safety": true, "productivity": true, "quality_gates": true, "team_coordination": true, "notifications": false },
  "commands": { "enabled": true },
  "mcps": { "context7": false, "sequential_thinking": false, "memory": false, "playwright": false }
}
```

### Lite
```json
{
  "preset": "lite",
  "skills": { "ai_ml": false, "backend": false, "frontend": false, "testing": true, "security": true, "devops": false, "planning": true },
  "agents": { "product": false, "technical": false },
  "hooks": { "safety": true, "productivity": true, "quality_gates": false, "team_coordination": false, "notifications": false },
  "commands": { "enabled": true, "disabled": ["add-golden", "implement", "fix-issue", "review-pr", "run-tests", "create-pr"] },
  "mcps": { "context7": false, "sequential_thinking": false, "memory": false, "playwright": false }
}
```

### Hooks-only
```json
{
  "preset": "hooks-only",
  "skills": { "ai_ml": false, "backend": false, "frontend": false, "testing": false, "security": false, "devops": false, "planning": false },
  "agents": { "product": false, "technical": false },
  "hooks": { "safety": true, "productivity": true, "quality_gates": false, "team_coordination": true, "notifications": false },
  "commands": { "enabled": false },
  "mcps": { "context7": false, "sequential_thinking": false, "memory": false, "playwright": false }
}
```
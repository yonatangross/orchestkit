# SkillForge Configuration System

## Inspired by: claude-hud's interactive configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SKILLFORGE CONFIGURATION FLOW                          │
│                                                                             │
│  User runs: /skillforge:configure                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STEP 1: CHOOSE PRESET                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │  COMPLETE   │  │  STANDARD   │  │    LITE     │  │ HOOKS-ONLY  │       │
│   │ (Recommended)│  │             │  │             │  │             │       │
│   ├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤       │
│   │ 78 skills   │  │ 78 skills   │  │ 10 skills   │  │  0 skills   │       │
│   │ 20 agents   │  │  0 agents   │  │  0 agents   │  │  0 agents   │       │
│   │ 11 commands │  │ 11 commands │  │  5 commands │  │  0 commands │       │
│   │ 92 hooks    │  │ 92 hooks    │  │ 92 hooks    │  │ 92 hooks    │       │
│   │             │  │             │  │             │  │             │       │
│   │ "Everything"│  │ "No agents" │  │ "Essential" │  │ "Safety"    │       │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│        [*]              [ ]              [ ]              [ ]               │
│                                                                             │
│   [Continue] [Back]                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      STEP 2: CUSTOMIZE CATEGORIES                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Toggle skill categories on/off:                                            │
│                                                                             │
│   [x] AI/ML (26 skills)                                                     │
│       ├── agent-loops, rag-retrieval, embeddings...                         │
│       └── LangGraph: supervisor, routing, parallel...                       │
│                                                                             │
│   [x] Backend (15 skills)                                                   │
│       └── fastapi, api-design, database, caching...                         │
│                                                                             │
│   [x] Frontend (8 skills)                                                   │
│       └── react-server-components, motion, i18n...                          │
│                                                                             │
│   [x] Testing (13 skills)                                                   │
│       └── unit, integration, e2e, performance...                            │
│                                                                             │
│   [x] Security (7 skills)                                                   │
│       └── owasp, auth-patterns, input-validation...                         │
│                                                                             │
│   [x] DevOps (4 skills)                                                     │
│       └── deployment, observability, coordination...                        │
│                                                                             │
│   [x] Planning (6 skills)                                                   │
│       └── brainstorming, architecture, code-review...                       │
│                                                                             │
│   [Continue] [Back] [Reset to Preset]                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STEP 3: CUSTOMIZE AGENTS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Toggle agents on/off:                                                      │
│                                                                             │
│   Product Agents (6):                                                       │
│   [x] market-intelligence      "Analyze market trends"                      │
│   [x] product-strategist       "Validate product decisions"                 │
│   [x] requirements-translator  "PRDs from ideas"                            │
│   [x] ux-researcher            "User journey mapping"                       │
│   [x] prioritization-analyst   "RICE/ICE scoring"                           │
│   [x] business-case-builder    "ROI analysis"                               │
│                                                                             │
│   Technical Agents (14):                                                    │
│   [x] backend-system-architect "API & database design"                      │
│   [x] frontend-ui-developer    "React 19 components"                        │
│   [x] database-engineer        "PostgreSQL optimization"                    │
│   [x] llm-integrator           "LLM API connections"                        │
│   [x] workflow-architect       "LangGraph pipelines"                        │
│   [x] data-pipeline-engineer   "Embeddings & vectors"                       │
│   [x] test-generator           "Generate test suites"                       │
│   [x] code-quality-reviewer    "Code review & linting"                      │
│   [x] security-auditor         "Vulnerability scanning"                     │
│   [x] security-layer-auditor   "Defense-in-depth"                           │
│   [x] debug-investigator       "Root cause analysis"                        │
│   [x] metrics-architect        "OKRs & KPIs"                                │
│   [x] rapid-ui-designer        "Tailwind prototypes"                        │
│   [x] system-design-reviewer   "Architecture review"                        │
│                                                                             │
│   [Continue] [Back] [Select All] [Select None]                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       STEP 4: CUSTOMIZE HOOKS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Hook Categories:                                                           │
│                                                                             │
│   SAFETY (Always On - Cannot Disable)                                       │
│   [x] git-branch-protection    Block commits to main/dev                    │
│   [x] file-guard               Block writes to protected paths              │
│   [x] redact-secrets           Remove secrets from output                   │
│                                                                             │
│   PRODUCTIVITY (Toggleable)                                                 │
│   [x] auto-approve-safe-bash   Skip prompts for safe commands               │
│   [x] auto-approve-readonly    Skip prompts for reads                       │
│   [x] audit-logger             Log all operations                           │
│   [x] error-tracker            Track error patterns                         │
│                                                                             │
│   QUALITY GATES (Toggleable)                                                │
│   [x] coverage-threshold-gate  Block if coverage drops                      │
│   [x] pattern-consistency      Enforce code patterns                        │
│   [x] backend-layer-validator  Clean architecture                           │
│   [ ] test-pattern-validator   Enforce test patterns                        │
│                                                                             │
│   TEAM COORDINATION (Toggleable)                                            │
│   [x] multi-instance-init      Register instance                            │
│   [x] file-lock-check          Prevent concurrent edits                     │
│   [x] conflict-predictor       Warn merge conflicts                         │
│                                                                             │
│   NOTIFICATIONS (Toggleable)                                                │
│   [ ] desktop.sh               Desktop notifications                        │
│   [ ] sound.sh                 Sound alerts                                 │
│                                                                             │
│   [Continue] [Back] [Reset to Defaults]                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STEP 5: PREVIEW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Your SkillForge Configuration                                             │
│   ─────────────────────────────                                             │
│                                                                             │
│   Preset: Complete (customized)                                             │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │  SKILLS: 72/78 enabled                                          │       │
│   │  ├── AI/ML: 26                                                  │       │
│   │  ├── Backend: 15                                                │       │
│   │  ├── Frontend: 8                                                │       │
│   │  ├── Testing: 13                                                │       │
│   │  ├── Security: 7                                                │       │
│   │  ├── DevOps: 4                                                  │       │
│   │  └── Planning: 6 (6 disabled)                                   │       │
│   │                                                                 │       │
│   │  AGENTS: 18/20 enabled                                          │       │
│   │  ├── Product: 6                                                 │       │
│   │  └── Technical: 12 (2 disabled)                                 │       │
│   │                                                                 │       │
│   │  COMMANDS: 11/11 enabled                                        │       │
│   │                                                                 │       │
│   │  HOOKS: 88/92 active                                            │       │
│   │  ├── Safety: 3 (always on)                                      │       │
│   │  ├── Productivity: 7                                            │       │
│   │  ├── Quality Gates: 15                                          │       │
│   │  ├── Team: 8                                                    │       │
│   │  └── Notifications: 0/2 (disabled)                              │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│   Estimated token overhead: ~1,200 tokens/session                           │
│                                                                             │
│   [Save Configuration] [Edit Again] [Cancel]                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SAVED!                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Configuration saved to: ~/.claude/plugins/skillforge/config.json          │
│                                                                             │
│   You can reconfigure anytime with:                                         │
│   > /skillforge:configure                                                   │
│                                                                             │
│   Or edit directly:                                                         │
│   > ~/.claude/plugins/skillforge/config.json                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Configuration Command
```
.claude/commands/configure.md
```
Creates an interactive configuration flow using AskUserQuestion tool.

### Phase 2: Config Schema
```json
// ~/.claude/plugins/skillforge/config.json
{
  "preset": "complete",
  "skills": {
    "ai-ml": true,
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
    "disabled": ["sound.sh"]
  },
  "commands": {
    "all": true,
    "disabled": []
  }
}
```

### Phase 3: Loader Integration
Hooks read config.json and skip disabled items.

---

## Comparison: claude-hud vs skillforge

| Feature | claude-hud | skillforge |
|---------|------------|------------|
| Purpose | Status display | Dev toolkit |
| Presets | Full/Essential/Minimal | Complete/Standard/Lite/Hooks-only |
| Configure | /claude-hud:configure | /skillforge:configure |
| Manual edit | config.json | config.json |
| Preview | Yes (HUD preview) | Yes (component summary) |

---

## Files to Create

```
.claude/
├── commands/
│   └── configure.md           # Interactive configuration command
├── schemas/
│   └── config.schema.json     # Config file schema
└── scripts/
    └── config-loader.sh       # Reads config, exports enabled items
```

---

## Next Steps

1. Create /skillforge:configure command
2. Create config.schema.json
3. Update all hooks to check config before running
4. Update plugin.json with bundles section
5. Create marketplace install scripts

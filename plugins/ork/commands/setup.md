---
description: "Personalized setup and onboarding wizard. Use when setting up OrchestKit for a new project, configuring plugins, or generating a readiness score and improvement plan."
allowed-tools: [Read, Grep, Glob, Bash, AskUserQuestion, mcp__memory__search_nodes, mcp__memory__create_entities, mcp__memory__create_relations]
---

# Auto-generated from skills/setup/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# OrchestKit Setup Wizard

Personalized onboarding that scans your codebase, detects your stack, recommends skills and MCPs, and generates an actionable improvement plan.

## When to Use

- First time after installing OrchestKit (`/plugin install ork`)
- Joining a new project and want OrchestKit tuned for it
- Periodically with `--rescan` to track improvement
- Enterprise users who need safe, user-scoped install confirmation

## Quick Start

```bash
/ork:setup              # Full 8-phase wizard
/ork:setup --rescan     # Re-scan after changes (skip safety phase)
/ork:setup --score-only # Just show readiness score
/ork:setup --plan-only  # Just show improvement plan
/ork:setup --channel    # Just show release channel
/ork:setup --configure  # Jump directly to Phase 3.5: project configuration wizard
```

## Argument Resolution

```python
FLAG = "$ARGUMENTS[0]"  # First token: --rescan, --score-only, --plan-only, --channel
# If no arguments, run full 8-phase wizard.
# $ARGUMENTS is the full string (CC 2.1.59 indexed access)
```

## The Nine Phases

| Phase | What | Tools Used | Output |
|-------|------|-----------|--------|
| 1. Scan | Detect languages, frameworks, infra, existing config | Glob, Grep, Read | Raw scan data |
| 2. Stack | Classify detected stack, confidence levels | — | Stack profile |
| 3. Safety | Check existing config, confirm scope (user/project) | Read, AskUserQuestion | Install confirmation |
| 3.5. Configure | Interactive project configuration wizard → writes env block to per-project settings | Read, Write, AskUserQuestion | Configured settings file |
| 4. Skills | Match stack to skills, suggest custom skills | Grep, Glob | Skill recommendations |
| 5. MCPs | Recommend MCPs based on stack and gaps | Read, Bash | MCP recommendations |
| 6. Score | Compute readiness score (0-10, 6 dimensions) | All above data | Readiness score |
| 7. Plan | Prioritized improvements with runnable commands | — | Action plan |
| 8. Keys | Install recommended keyboard shortcuts | Read, Bash, AskUserQuestion | Keybindings |


## Phase 1: Scan

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/setup/references/scan-phase.md")` for full scan commands (20 parallel Glob probes + dependency file reads + pattern detection counts).

Scans for package manifests (package.json, pyproject.toml, go.mod, Cargo.toml, etc.), infrastructure (Docker, GitHub Actions, Terraform, K8s), and existing CC configuration. Pattern detection counts API routes, React components, models, and tests for custom skill suggestions.

## Phase 2: Stack Detection

Classify scan results into a stack profile. Present to user:

```
Detected Stack:
  Languages:   Python 3.12, TypeScript 5.6, SQL
  Frameworks:  FastAPI 0.115, React 19, Next.js 16
  Database:    PostgreSQL (via Alembic), Redis
  Infra:       Docker, GitHub Actions (3 workflows)
  Testing:     pytest, Playwright
  Existing CC: .claude/settings.json found, no conflicts
```

### Stack-to-Skill Mapping

| Detected | Recommended Skills |
|----------|--------------------|
| Python | `python-backend`, `async-jobs`, `database-patterns` |
| FastAPI | `api-design`, `testing-unit`, `testing-integration` |
| React | `react-server-components-framework`, `ui-components`, `responsive-patterns` |
| Next.js | `react-server-components-framework`, `performance`, `vite-advanced` |
| Zustand | `zustand-patterns` |
| SQLAlchemy/Alembic | `database-patterns` |
| Docker/K8s | `devops-deployment`, `distributed-systems` |
| Terraform | `devops-deployment` |
| GitHub Actions | `devops-deployment` |
| LLM/AI deps | `llm-integration`, `rag-retrieval`, `langgraph`, `mcp-patterns` |
| Test frameworks | `testing-unit`, `testing-e2e`, `testing-integration`, `golden-dataset` |
| Security concerns | `security-patterns` |

**All stacks get**: `explore`, `implement`, `verify`, `commit`, `review-pr`, `fix-issue`, `doctor`, `remember`, `brainstorm`, `help`

## Phase 2b: Channel Detection

Detect release channel from `manifests/ork.json` version string. Classification: `X.Y.Z` = stable, `X.Y.Z-beta.*` = beta, `X.Y.Z-alpha.*` = alpha. Display alongside stack profile. Use `--channel` flag to show only channel detection.

## Phase 3: Safety Check

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/setup/references/safety-check.md")` for the full AskUserQuestion prompt and conflict detection logic.

Offers three install scopes: User-only (recommended, invisible to teammates), Project-wide (committed to repo), or Already installed (skip to configure). Checks for existing OrchestKit installs and conflicting plugins.

## Phase 3.5: Project Configuration Wizard

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/setup/references/configure-wizard.md")` for the full 5-step interactive configuration flow (branch strategy, commit scope, localhost browser, perf telemetry, log verbosity) and env var reference.

> Also reachable directly via `/ork:setup --configure` — skips phases 1-3.


## Phase 4: Skill Recommendations

Present in 3 tiers using `AskUserQuestion`:

```python
AskUserQuestion(questions=[{
  "question": "Which skill categories should we prioritize? (all are available, this helps focus the improvement plan)",
  "header": "Focus areas",
  "options": [
    {"label": "Full-stack (Recommended)", "description": "All detected stack skills + security + testing", "markdown": "```\nFull-Stack Focus\n────────────────\nBackend:   api-design, database-patterns\nFrontend:  react-server-components, ui-components\nSecurity:  security-patterns\nTesting:   testing-unit, testing-e2e\nDevOps:    devops-deployment\nWorkflow:  implement, verify, commit\n```"},
    {"label": "Backend focus", "description": "API, database, async, security patterns", "markdown": "```\nBackend Focus\n─────────────\nCore:      api-design, database-patterns\nAsync:     async-jobs, distributed-systems\nSecurity:  security-patterns\nTesting:   testing-unit, testing-integration\nSkipped:   UI, components, accessibility\n```"},
    {"label": "Frontend focus", "description": "React, UI components, performance, accessibility", "markdown": "```\nFrontend Focus\n──────────────\nCore:      react-server-components\nUI:        ui-components, responsive-patterns\nPerf:      performance, vite-advanced\nA11y:      accessibility patterns\nSkipped:   database, async, infra\n```"},
    {"label": "DevOps focus", "description": "CI/CD, deployment, monitoring, infrastructure", "markdown": "```\nDevOps Focus\n────────────\nCI/CD:     devops-deployment\nInfra:     distributed-systems\nMonitor:   observability patterns\nSecurity:  security-patterns\nSkipped:   UI, components, API design\n```"}
  ],
  "multiSelect": true
}])
```

### Custom Skill Suggestions

Based on pattern detection from Phase 1:

```
Detected patterns that could become custom skills:
  47 API routes   → Create "api-endpoint" skill (auto-generate: route + schema + migration + test)
  83 React comps  → Create "component" skill (auto-generate: component + props + story + test)
  8 deploy steps  → Create "deploy-checklist" skill (automate your DEPLOY.md)

To create any of these: see CONTRIBUTING-SKILLS.md in the plugin for authoring standards
```

## Phase 5: MCP Recommendations

Check what's installed vs recommended:

```python
# Read existing MCP config
Read(file_path=".mcp.json")  # project-level
Bash(command="cat ~/.claude/settings.json 2>/dev/null | python3 -c \"import json,sys; d=json.load(sys.stdin); print(json.dumps(d.get('mcpServers',{}), indent=2))\"")
```

### MCP Recommendation Matrix

| MCP | When to Recommend | Install Effort |
|-----|-------------------|---------------|
| **Context7** | Always — eliminates doc hallucination | Zero (cloud, free) |
| **Memory** | Always — knowledge graph persistence | Low (local npx) |
| **Sequential Thinking** | If using Sonnet/Haiku subagents | Low (local npx) |
| **Tavily** | If web-research-workflow relevant | Medium (needs API key, free tier) |
| **NotebookLM** | If many docs/READMEs for team RAG | Medium (Google auth) |
| **Agentation** | If frontend UI work detected | Medium (npm install) |
| **Phoenix/Langfuse** | If LLM observability desired (local tracing, cost tracking) | Medium (Docker, optional) |

Present as toggles with impact labels. Show install commands for selected MCPs:

```
MCP Setup Commands:
  Context7:  Already configured ✓
  Memory:    /ork:configure mcp memory
  Tavily:    Sign up at app.tavily.com → /ork:configure mcp tavily
```

## Phase 6: Readiness Score

Compute a composite score (0-10) from 6 dimensions:

| Dimension | Weight | Calculation |
|-----------|--------|-------------|
| **Stack Coverage** | 25% | matched_skills / relevant_skills_for_detected_stack |
| **Hook Protection** | 20% | hooks_active / total_hooks (from /ork:doctor logic) |
| **MCP Enhancement** | 15% | installed_mcps / recommended_mcps |
| **Memory Depth** | 15% | entity_count from `mcp__memory__search_nodes` (target: 50+) |
| **Custom Skills** | 15% | custom_skills_created / suggested_customs |
| **Agent Utilization** | 10% | 1.0 if agents accessible, 0.5 if no MCPs limit agent capability |

### Score Presentation

```
OrchestKit Readiness Score: 7.2 / 10  (stable channel, v7.0.0)

  Stack Coverage  ████████░░  9/10  Python + React fully covered
  Hook Protection ████████░░  8/10  107 hooks active
  MCP Enhancement ██████░░░░  6/10  2/3 recommended MCPs active
  Memory Depth    ████░░░░░░  4/10  12 entities (target: 50+)
  Custom Skills   ██░░░░░░░░  2/10  0/3 suggested skills created
  Agent Utilization ████████░░  8/10  30 agents available

  Top improvement: Add /ork:remember patterns → +1.5 points
```

### Memory Integration

Store the score for tracking over time:

```python
mcp__memory__create_entities(entities=[{
  "name": "OrchestKit Setup Score",
  "entityType": "metric",
  "observations": [
    "Score: 7.2/10 on 2026-02-26",
    "Stack: Python + React + Next.js",
    "Gap: Memory depth (12/50 entities), Custom skills (0/3)"
  ]
}])
```

## Phase 7: Improvement Plan

Generate prioritized, **runnable** recommendations:

```
Your Personalized Improvement Plan:

P0 (do now):
  $ /ork:remember "our API uses cursor pagination, never offset"
  $ /ork:remember "FastAPI + SQLAlchemy 2.0 async + Alembic migrations"
  $ /ork:remember "React 19 + TanStack Query + Zustand for state"
  → Seeds your knowledge graph. Agents use this context automatically.

P1 (this week):
  $ /ork:configure mcp tavily
  → Enables web research for up-to-date library docs.

  Create a custom skill per CONTRIBUTING-SKILLS.md for your most repeated pattern (47 routes detected).
  → e.g., "FastAPI endpoint with Pydantic schema, Alembic migration, and pytest"

P2 (ongoing):
  $ /ork:explore architecture
  → Deep analysis of your codebase structure.

  $ /ork:setup --rescan
  → Re-run in 2 weeks to track score improvement.
```

### Save Plan to Memory

```python
mcp__memory__create_entities(entities=[{
  "name": "OrchestKit Improvement Plan",
  "entityType": "plan",
  "observations": [
    "P0: Seed knowledge graph with 3 core patterns",
    "P1: Add Tavily MCP, create api-endpoint custom skill",
    "P2: Run /ork:explore architecture, rescan in 2 weeks"
  ]
}])
```

## Phase 7b: CLAUDE.md Health Check

After the improvement plan, check if the user's CLAUDE.md could benefit from CC 2.1.59+ modular structure.

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/setup/references/claude-md-health.md")` for analysis steps, thresholds, @import syntax, and `.claude/rules/` path-scoped rules.

```python
# Quick check
Bash(command="wc -l CLAUDE.md 2>/dev/null | awk '{print $1}'")
Glob(pattern=".claude/rules/*.md")
```

If CLAUDE.md > 200 lines and no `.claude/rules/` exist, recommend splitting. Show the output template from the reference doc.

## Phase 8: Keybindings

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/setup/references/keybindings.md")` for the full keybinding prompt, default shortcuts, and merge logic.

Offers 5 recommended shortcuts (commit, verify, implement, explore, review-pr). Merges with existing `~/.claude/keybindings.json` without overwriting user-defined bindings.

## Post-Setup

> **Tip (CC 2.1.69+):** After setup completes, run `/reload-plugins` to activate all plugin changes without restarting your session.

## CLI Flags

| Flag | Behavior |
|------|----------|
| (none) | Full 9-phase wizard (includes 3.5 configure + 7b health check) |
| `--rescan` | Re-run scan + score, skip safety phase |
| `--configure` | Jump directly to Phase 3.5: project configuration wizard |
| `--score-only` | Show current readiness score (Phase 6 only) |
| `--plan-only` | Show improvement plan (Phase 7 only) |
| `--channel` | Show detected release channel only |

## Related Skills

- `ork:doctor` — Health diagnostics (wizard uses its checks)
- `ork:configure` — Detailed configuration (wizard recommends then links here)
- `ork:remember` — Knowledge persistence (wizard seeds initial patterns)
- `ork:explore` — Deep codebase analysis (wizard links for follow-up)
- `ork:help` — Skill directory (wizard surfaces relevant subset)

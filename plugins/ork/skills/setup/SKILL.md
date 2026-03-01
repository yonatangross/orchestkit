---
name: setup
license: MIT
compatibility: "Claude Code 2.1.59+."
description: "Personalized onboarding wizard. Scans your codebase, detects your stack, recommends skills and MCPs, generates a readiness score and improvement plan."
argument-hint: "[--rescan] [--score-only] [--plan-only] [--channel]"
context: inherit
version: 1.0.0
author: OrchestKit
tags: [onboarding, setup, wizard, configuration, stack-detection, mcp, personalization]
user-invocable: true
disable-model-invocation: true
allowed-tools: [Read, Grep, Glob, Bash, AskUserQuestion, mcp__memory__search_nodes, mcp__memory__create_entities, mcp__memory__create_relations]
skills: [doctor, configure, remember, explore, help]
complexity: medium
metadata:
  category: configuration
---

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
```

## Argument Resolution

```python
FLAG = "$ARGUMENTS[0]"  # First token: --rescan, --score-only, --plan-only, --channel
# If no arguments, run full 8-phase wizard.
# $ARGUMENTS is the full string (CC 2.1.59 indexed access)
```

## The Eight Phases

| Phase | What | Tools Used | Output |
|-------|------|-----------|--------|
| 1. Scan | Detect languages, frameworks, infra, existing config | Glob, Grep, Read | Raw scan data |
| 2. Stack | Classify detected stack, confidence levels | — | Stack profile |
| 3. Safety | Check existing config, confirm scope (user/project) | Read, AskUserQuestion | Install confirmation |
| 4. Skills | Match stack to skills, suggest custom skills | Grep, Glob | Skill recommendations |
| 5. MCPs | Recommend MCPs based on stack and gaps | Read, Bash | MCP recommendations |
| 6. Score | Compute readiness score (0-10, 6 dimensions) | All above data | Readiness score |
| 7. Plan | Prioritized improvements with runnable commands | — | Action plan |
| 8. Keys | Install recommended keyboard shortcuts | Read, Bash, AskUserQuestion | Keybindings |

---

## Phase 1: Scan

Run ALL scan commands in **one parallel batch** for speed:

```python
# PARALLEL — launch all in ONE message
Glob(pattern="**/package.json")
Glob(pattern="**/pyproject.toml")
Glob(pattern="**/go.mod")
Glob(pattern="**/Cargo.toml")
Glob(pattern="**/pom.xml")
Glob(pattern="**/*.csproj")
Glob(pattern="**/Gemfile")
Glob(pattern="**/composer.json")
Glob(pattern="**/.claude/settings.json")
Glob(pattern="**/.mcp.json")
Glob(pattern="**/docker-compose*.yml")
Glob(pattern="**/Dockerfile*")
Glob(pattern="**/.github/workflows/*.yml")
Glob(pattern="**/terraform/**/*.tf")
Glob(pattern="**/k8s/**/*.yaml")
Glob(pattern="**/CONTRIBUTING.md")
Glob(pattern="**/tsconfig.json")
Glob(pattern="**/next.config.*")
Glob(pattern="**/vite.config.*")
Glob(pattern="**/alembic.ini")
```

Then read key dependency files found:

```python
# PARALLEL — read detected package manifests
Read(file_path="package.json")       # if found
Read(file_path="pyproject.toml")     # if found
Read(file_path="requirements.txt")   # if found
Read(file_path=".mcp.json")          # if found
Read(file_path=".claude/settings.json")  # if found
```

### Pattern Detection (for custom skill suggestions)

```python
# PARALLEL — count repeated patterns
Grep(pattern="@app\\.(route|get|post|put|delete|patch)", glob="**/*.py", output_mode="count")
Grep(pattern="@router\\.(get|post|put|delete|patch)", glob="**/*.py", output_mode="count")
Grep(pattern="export (default |)function", glob="**/*.tsx", output_mode="count")
Grep(pattern="export (default |)function", glob="**/*.jsx", output_mode="count")
Grep(pattern="class.*Model\\)", glob="**/*.py", output_mode="count")
Grep(pattern="def test_", glob="**/*.py", output_mode="count")
Grep(pattern="(describe|it|test)\\(", glob="**/*.{ts,tsx,js}", output_mode="count")
```

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
| FastAPI | `api-design`, `testing-patterns` |
| React | `react-server-components-framework`, `ui-components`, `responsive-patterns` |
| Next.js | `react-server-components-framework`, `performance`, `vite-advanced` |
| Zustand | `zustand-patterns` |
| SQLAlchemy/Alembic | `database-patterns` |
| Docker/K8s | `devops-deployment`, `distributed-systems` |
| Terraform | `devops-deployment` |
| GitHub Actions | `devops-deployment` |
| LLM/AI deps | `llm-integration`, `rag-retrieval`, `langgraph`, `mcp-patterns` |
| Test frameworks | `testing-patterns`, `golden-dataset` |
| Security concerns | `security-patterns` |

**All stacks get**: `explore`, `implement`, `verify`, `commit`, `review-pr`, `fix-issue`, `doctor`, `remember`, `brainstorming`, `help`

## Phase 2b: Channel Detection

Detect the user's release channel from the OrchestKit version string in the plugin manifest:

```python
# Read version from the installed plugin manifest
Grep(pattern="\"version\"", path="manifests/ork.json", output_mode="content")
```

### Classification Rules

| Version Pattern | Channel | Description |
|----------------|---------|-------------|
| `X.Y.Z-alpha.*` | **Alpha** | Bleeding-edge, may include incomplete features |
| `X.Y.Z-beta.*` | **Beta** | Feature-complete previews, may have rough edges |
| `X.Y.Z` (no suffix) | **Stable** | Production-ready, fully tested |

### Channel Display

Present the detected channel alongside the stack profile:

```
Release Channel: stable (v7.0.0)
  You're on the stable channel — production-ready releases only.
```

If on a prerelease channel:

```
Release Channel: beta (v7.1.0-beta.1)
  You're on the beta channel — early access to upcoming features.
  To switch to stable: /plugin install ork@latest
```

```
Release Channel: alpha (v7.1.0-alpha.1)
  You're on the alpha channel — bleeding-edge, expect breaking changes.
  To switch to stable: /plugin install ork@latest
```

Use `--channel` flag to show only the channel detection (skip all other phases).

## Phase 3: Safety Check

Use `AskUserQuestion` to confirm installation scope:

```python
AskUserQuestion(questions=[{
  "question": "How should OrchestKit be installed?",
  "header": "Install scope",
  "options": [
    {"label": "User-only (Recommended)", "description": "Plugin loads only for you. Invisible to teammates. Safe for enterprise.", "markdown": "```\nUser-Only Install\n─────────────────\n~/.claude/\n  └── plugins/\n        └── ork/    ← only YOU see this\n\nTeammates: unaffected\nGit:       nothing committed\nEnterprise: safe, no repo changes\n```"},
    {"label": "Project-wide", "description": "Adds to .claude/plugins — loads for everyone in this repo.", "markdown": "```\nProject-Wide Install\n────────────────────\nyour-repo/\n  └── .claude/\n        └── plugins/\n              └── ork/  ← everyone sees this\n\nTeammates: auto-loaded for all\nGit:       committed to repo\nRequires:  team buy-in\n```"},
    {"label": "Already installed", "description": "Skip installation, just configure.", "markdown": "```\nSkip to Configure\n─────────────────\n✓ Plugin already installed\n→ Jump to Phase 4: Skill recommendations\n→ Then Phase 5: MCP setup\n→ Then Phase 6: Readiness score\n```"}
  ],
  "multiSelect": false
}])
```

### Conflict Detection

Check for existing OrchestKit installs or conflicting plugins:

```python
Grep(pattern="ork", path="~/.claude/settings.json", output_mode="content")
Glob(pattern="~/.claude/plugins/ork*")
```

Report: "No conflicts detected" or "Found existing ork install — version {version}."

## Phase 4: Skill Recommendations

Present in 3 tiers using `AskUserQuestion`:

```python
AskUserQuestion(questions=[{
  "question": "Which skill categories should we prioritize? (all are available, this helps focus the improvement plan)",
  "header": "Focus areas",
  "options": [
    {"label": "Full-stack (Recommended)", "description": "All detected stack skills + security + testing", "markdown": "```\nFull-Stack Focus\n────────────────\nBackend:   api-design, database-patterns\nFrontend:  react-server-components, ui-components\nSecurity:  security-patterns, testing-patterns\nDevOps:    devops-deployment\nWorkflow:  implement, verify, commit\n```"},
    {"label": "Backend focus", "description": "API, database, async, security patterns", "markdown": "```\nBackend Focus\n─────────────\nCore:      api-design, database-patterns\nAsync:     async-jobs, distributed-systems\nSecurity:  security-patterns\nTesting:   testing-patterns (integration)\nSkipped:   UI, components, accessibility\n```"},
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
  Hook Protection ████████░░  8/10  78 hooks active
  MCP Enhancement ██████░░░░  6/10  2/3 recommended MCPs active
  Memory Depth    ████░░░░░░  4/10  12 entities (target: 50+)
  Custom Skills   ██░░░░░░░░  2/10  0/3 suggested skills created
  Agent Utilization████████░░  8/10  38 agents available

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

See [CLAUDE.md Health Check](references/claude-md-health.md) for analysis steps, thresholds, @import syntax, and `.claude/rules/` path-scoped rules.

```python
# Quick check
Bash(command="wc -l CLAUDE.md 2>/dev/null | awk '{print $1}'")
Glob(pattern=".claude/rules/*.md")
```

If CLAUDE.md > 200 lines and no `.claude/rules/` exist, recommend splitting. Show the output template from the reference doc.

## Phase 8: Keybindings

Check for existing keybindings and offer to install recommended shortcuts:

```python
# Check existing keybindings
Bash(command="cat ~/.claude/keybindings.json 2>/dev/null || echo '[]'")
```

Prompt the user:

```python
AskUserQuestion(questions=[{
  "question": "Install recommended keybindings for top OrchestKit skills?",
  "header": "Keyboard shortcuts",
  "options": [
    {"label": "Yes, install keybindings (Recommended)", "description": "Adds 5 shortcuts: commit, verify, implement, explore, review-pr"},
    {"label": "Skip", "description": "No keyboard shortcuts"}
  ],
  "multiSelect": false
}])
```

If **Yes**: write or merge into `~/.claude/keybindings.json`:

```json
[
  {"key": "ctrl+shift+c", "command": "/ork:commit", "description": "Git commit with validation"},
  {"key": "ctrl+shift+v", "command": "/ork:verify", "description": "Run verification suite"},
  {"key": "ctrl+shift+i", "command": "/ork:implement", "description": "Implement feature"},
  {"key": "ctrl+shift+e", "command": "/ork:explore", "description": "Deep codebase exploration"},
  {"key": "ctrl+shift+r", "command": "/ork:review-pr", "description": "Review pull request"}
]
```

If the file already exists, **merge** — read existing entries, add only keybindings whose `key` is not already bound, then write back. Never overwrite user-defined bindings.

## CLI Flags

| Flag | Behavior |
|------|----------|
| (none) | Full 8-phase wizard (includes 7b health check) |
| `--rescan` | Re-run scan + score, skip safety phase |
| `--score-only` | Show current readiness score (Phase 6 only) |
| `--plan-only` | Show improvement plan (Phase 7 only) |
| `--channel` | Show detected release channel only |

## Related Skills

- `ork:doctor` — Health diagnostics (wizard uses its checks)
- `ork:configure` — Detailed configuration (wizard recommends then links here)
- `ork:remember` — Knowledge persistence (wizard seeds initial patterns)
- `ork:explore` — Deep codebase analysis (wizard links for follow-up)
- `ork:help` — Skill directory (wizard surfaces relevant subset)

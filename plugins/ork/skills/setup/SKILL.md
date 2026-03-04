---
name: setup
license: MIT
compatibility: "Claude Code 2.1.59+."
description: "Personalized onboarding wizard. Use when setting up OrchestKit for a new project, configuring plugins, or generating a readiness score and improvement plan."
argument-hint: "[--rescan] [--score-only] [--plan-only] [--channel] [--configure]"
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

## Phase 3.5: Project Configuration Wizard

> Also reachable directly via `/ork:setup --configure` — skips phases 1-3.

This phase walks users through every configurable OrchestKit behaviour and writes the result to the correct project settings file. When running the full wizard, show this phase AFTER the safety/install check. When running `--configure` alone, start here.

### Step 0: Detect config target and read current settings

The write target depends on the project type:

- **Developing OrchestKit itself** (`src/settings/ork.settings.json` exists): write to `src/settings/ork.settings.json` — this is the plugin's global defaults file.
- **Any other project** (yonatan-hq, client repos, etc.): write to `.claude/settings.json` — this is per-project CC settings that override plugin defaults without touching global config.

```python
# Detect config target
is_orchestkit_dev = len(Glob(pattern="src/settings/ork.settings.json")) > 0

if is_orchestkit_dev:
    config_target = "src/settings/ork.settings.json"
    existing_settings = Read(file_path="src/settings/ork.settings.json") or {}
else:
    config_target = ".claude/settings.json"
    existing_settings = Read(file_path=".claude/settings.json") or {}

# Extract current env block if present
current_env = existing_settings.get("env", {})
```

Show the user what's already set so they aren't surprised by overwrites.

### Step 1: Branch Strategy

```python
AskUserQuestion(questions=[{
  "question": "Which branches should block direct commits and pushes?",
  "header": "Protected branches",
  "options": [
    {
      "label": "main, master (Recommended)",
      "description": "Standard Git Flow defaults. Feature work goes on branches.",
      "markdown": "```\nORCHESTKIT_PROTECTED_BRANCHES=main,master\n\nBlocked:  git commit on main/master\n          git push to main/master\nAllowed:  feature/, fix/, issue/ branches\n```"
    },
    {
      "label": "main, master, dev",
      "description": "Adds dev as a protected integration branch.",
      "markdown": "```\nORCHESTKIT_PROTECTED_BRANCHES=main,master,dev\n\nBlocked:  git commit on main/master/dev\nAllowed:  feature/, fix/, issue/ branches\nBest for: teams with a long-lived dev branch\n```"
    },
    {
      "label": "main only",
      "description": "Minimal protection — only main is locked.",
      "markdown": "```\nORCHESTKIT_PROTECTED_BRANCHES=main\n\nBlocked:  git commit on main\nAllowed:  master, dev, feature/ branches\nBest for: simple solo projects\n```"
    },
    {
      "label": "Custom",
      "description": "I'll specify my own comma-separated branch list."
    }
  ],
  "multiSelect": false
}])
```

If **Custom** selected: ask for the comma-separated list inline.

Generated env var: `ORCHESTKIT_PROTECTED_BRANCHES=<value>`

### Step 2: Commit Format Enforcement

```python
AskUserQuestion(questions=[{
  "question": "How strictly should commit message format be enforced?",
  "header": "Commit scope",
  "options": [
    {
      "label": "Optional scope (Recommended)",
      "description": "Both `feat: msg` and `feat(scope): msg` are valid.",
      "markdown": "```\nORCHESTKIT_COMMIT_SCOPE=optional\n\nValid:    feat: Add login\n          feat(auth): Add login\n          fix(#123): Resolve crash\nBlocked:  bad commit message\n```"
    },
    {
      "label": "Required scope",
      "description": "Every commit must include a scope: `type(scope): msg`",
      "markdown": "```\nORCHESTKIT_COMMIT_SCOPE=required\n\nValid:    feat(auth): Add login\n          fix(#123): Resolve crash\nBlocked:  feat: Add login  ← no scope!\nBest for: large teams, monorepos\n```"
    },
    {
      "label": "Scope disabled",
      "description": "Only type+colon required. Scopes ignored in validation.",
      "markdown": "```\nORCHESTKIT_COMMIT_SCOPE=none\n\nValid:    feat: Anything\n          fix: Short message\nBlocked:  bad commit message (no type)\nBest for: solo projects, quick iteration\n```"
    }
  ],
  "multiSelect": false
}])
```

Generated env var: `ORCHESTKIT_COMMIT_SCOPE=<value>`

### Step 3: Local Dev Browser Access

```python
AskUserQuestion(questions=[{
  "question": "Should agents be allowed to browse *.localhost URLs (e.g. hq-web.localhost:1355)?",
  "header": "Localhost browser",
  "options": [
    {
      "label": "Yes, allow *.localhost (Recommended)",
      "description": "RFC 6761 reserved TLD — cannot route to external hosts. Enables visual verification of local dev servers.",
      "markdown": "```\nORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST=1\n\nAllowed:  hq-web.localhost:1355\n          app.localhost:3000\nBlocked:  localhost (bare, no subdomain)\n          127.0.0.1\nSafe:     *.localhost can't reach internet\n```"
    },
    {
      "label": "No, block all localhost",
      "description": "Stricter mode — blocks *.localhost AND bare localhost. Use for enterprise/sandboxed environments.",
      "markdown": "```\nORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST=0\n\nBlocked:  all localhost variants\n          hq-web.localhost (even subdomains)\nBest for: enterprise, air-gapped, or\n          regulated environments\n```"
    }
  ],
  "multiSelect": false
}])
```

Generated env var: `ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST=<value>`

### Step 4: Performance Telemetry

```python
AskUserQuestion(questions=[{
  "question": "Should OrchestKit write a token-usage snapshot at session end?",
  "header": "Perf snapshot",
  "options": [
    {
      "label": "Yes, enable perf snapshots (Recommended)",
      "description": "Writes ~/.claude/perf/snap-YYYY-MM-DD-HH.json. Used by /ork:assess and perf-compare.sh.",
      "markdown": "```\nORCHESTKIT_PERF_SNAPSHOT_ENABLED=1\n\nWrites:   ~/.claude/perf/snap-<bucket>.json\nContains: total tokens, top hooks, by-category\nUsed by:  scripts/perf-compare.sh (before/after)\n          /ork:assess (performance dimension)\n```"
    },
    {
      "label": "No, disable perf snapshots",
      "description": "Skip writing snapshot files. Useful in CI or shared environments.",
      "markdown": "```\nORCHESTKIT_PERF_SNAPSHOT_ENABLED=0\n\nNo files written at session end.\nBest for: CI pipelines, shared accounts,\n          disk-constrained environments\n```"
    }
  ],
  "multiSelect": false
}])
```

Generated env var: `ORCHESTKIT_PERF_SNAPSHOT_ENABLED=<value>`

### Step 5: Log Verbosity

```python
AskUserQuestion(questions=[{
  "question": "What log level should OrchestKit hooks use?",
  "header": "Log level",
  "options": [
    {
      "label": "warn — quiet (Recommended)",
      "description": "Only warnings and errors. Minimal noise.",
      "markdown": "```\nORCHESTKIT_LOG_LEVEL=warn\n\nShows:   Warnings, errors\nHides:   Debug traces, info messages\nBest for: daily use, production\n```"
    },
    {
      "label": "info — moderate",
      "description": "Key events logged. Good for onboarding.",
      "markdown": "```\nORCHESTKIT_LOG_LEVEL=info\n\nShows:   Warnings, errors, key events\nHides:   Debug traces\nBest for: onboarding, monitoring behaviour\n```"
    },
    {
      "label": "debug — verbose",
      "description": "Full trace of every hook decision.",
      "markdown": "```\nORCHESTKIT_LOG_LEVEL=debug\n\nShows:   Everything\nBest for: troubleshooting, bug reports\nNote:    Use /ork:doctor for health checks\n```"
    }
  ],
  "multiSelect": false
}])
```

Generated env var: `ORCHESTKIT_LOG_LEVEL=<value>`

### Writing the Configuration

After all 5 steps, write (or merge) the env block into `config_target` (set in Step 0):

```python
# Merge new env values (preserving existing keys not in wizard scope)
new_env = {
  **current_env,  # preserve all keys we didn't ask about (e.g. ENABLE_TOOL_SEARCH)
  "ORCHESTKIT_PROTECTED_BRANCHES": <from step 1>,
  "ORCHESTKIT_COMMIT_SCOPE": <from step 2>,
  "ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST": <from step 3>,
  "ORCHESTKIT_PERF_SNAPSHOT_ENABLED": <from step 4>,
  "ORCHESTKIT_LOG_LEVEL": <from step 5>,
}
updated_settings = {**existing_settings, "env": new_env}

Write(file_path=config_target, content=json.dumps(updated_settings, indent=2))
```

> **Note on per-project vs global:** Writing to `.claude/settings.json` overrides the plugin defaults for THIS project only — other projects remain unaffected. Writing to `src/settings/ork.settings.json` changes the global defaults shipped with the plugin itself. Only do that when developing OrchestKit.

### Configuration Summary

After writing, present a confirmation table (use `config_target` in the header):

```
OrchestKit Configuration Written → .claude/settings.json
──────────────────────────────────────────────────────────
  Protected branches    main,master
  Commit scope          optional
  Localhost browser     allowed (RFC 6761)
  Perf snapshot         enabled
  Log level             warn

Settings are in effect immediately for this project.
Other projects using ork are unaffected.
To reconfigure: /ork:setup --configure
To see full readiness: /ork:setup --score-only
```

### Env Var Quick Reference

| Env Var | Default | Values | Effect |
|---------|---------|--------|--------|
| `ORCHESTKIT_PROTECTED_BRANCHES` | `main,master` | comma-separated branches | Blocks direct commits/pushes |
| `ORCHESTKIT_COMMIT_SCOPE` | `optional` | `optional` \| `required` \| `none` | Commit message scope enforcement |
| `ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST` | `1` | `1` \| `0` | Allow `*.localhost` browser access |
| `ORCHESTKIT_PERF_SNAPSHOT_ENABLED` | `1` | `1` \| `0` | Write session token snapshots |
| `ORCHESTKIT_LOG_LEVEL` | `warn` | `debug` \| `info` \| `warn` \| `error` | Hook log verbosity |
| `ENABLE_TOOL_SEARCH` | `auto:5` | `auto:N` \| `off` | MCP tool discovery limit |

---

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
  Hook Protection ████████░░  8/10  95 hooks active
  MCP Enhancement ██████░░░░  6/10  2/3 recommended MCPs active
  Memory Depth    ████░░░░░░  4/10  12 entities (target: 50+)
  Custom Skills   ██░░░░░░░░  2/10  0/3 suggested skills created
  Agent Utilization ████████░░  8/10  38 agents available

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

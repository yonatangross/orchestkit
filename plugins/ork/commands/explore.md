---
description: "Multi-angle codebase exploration spawning 3-5 parallel agents for code structure, data flow, architecture patterns, and health assessment. Generates ASCII visualizations, import graphs, and design pattern detection with cross-session memory storage. Use when exploring a repo, discovering architecture, onboarding to a new codebase, or analyzing design patterns."
allowed-tools: [AskUserQuestion, Read, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskStop, mcp__memory__search_nodes, Bash, ToolSearch]
---

# Auto-generated from skills/explore/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Codebase Exploration

Multi-angle codebase exploration using 3-5 parallel agents.

## Quick Start

```bash
/ork:explore authentication
```

> **Opus 4.6**: Exploration agents use native adaptive thinking for deeper pattern recognition across large codebases.


## STEP -0.5: Effort-Aware Agent Scaling (CC 2.1.120+)

Read `${CLAUDE_EFFORT}` to scale exploration depth before any other decision.

```python
# CC 2.1.120+ env var; explicit --effort= overrides
EFFORT = os.environ.get("CLAUDE_EFFORT")
for token in "$ARGUMENTS".split():
    if token.startswith("--effort="):
        EFFORT = token.split("=", 1)[1]
EFFORT = EFFORT or "high"  # default
```

| Effort | Agent count | Phases | Time |
|--------|-------------|--------|------|
| `low` | 1 (structure-only) | 1, 2, 8 | ~1 min |
| `medium` | 2 (structure + data flow) | 1, 2, 3 (subset), 8 | ~3 min |
| `high` (default) | 4 (full parallel team) | 1–8 | ~6 min |
| `xhigh` (Opus 4.7 only) | 5 (+ uncertainty pass on health scores) | 1–8 + caveats | ~8 min |

**Override gate:** if the user passes `--effort=high` explicitly while `${CLAUDE_EFFORT}` is `low`, the flag wins. `/ork:doctor` warns when `xhigh` is requested without Opus 4.7.


## STEP 0: Verify User Intent with AskUserQuestion

**BEFORE creating tasks**, clarify what the user wants to explore:

```python
AskUserQuestion(
  questions=[{
    "question": "What aspect do you want to explore?",
    "header": "Focus",
    "options": [
      {"label": "Full exploration (Recommended)", "description": "Code structure + data flow + architecture + health assessment", "markdown": "```\nFull Exploration (8 phases)\n───────────────────────────\n  4 parallel explorer agents:\n  ┌──────────┐ ┌──────────┐\n  │ Structure│ │ Data     │\n  │ Explorer │ │ Flow     │\n  ├──────────┤ ├──────────┤\n  │ Pattern  │ │ Product  │\n  │ Analyst  │ │ Context  │\n  └──────────┘ └──────────┘\n         ▼\n  ┌──────────────────────┐\n  │ Code Health    N/10  │\n  │ Dep Hotspots   map   │\n  │ Architecture   diag  │\n  └──────────────────────┘\n  Output: Full exploration report\n```"},
      {"label": "Code structure only", "description": "Find files, classes, functions related to topic", "markdown": "```\nCode Structure\n──────────────\n  Grep ──▶ Glob ──▶ Map\n\n  Output:\n  ├── File tree (relevant)\n  ├── Key classes/functions\n  ├── Import graph\n  └── Entry points\n  No agents — direct search\n```"},
      {"label": "Data flow", "description": "Trace how data moves through the system", "markdown": "```\nData Flow Trace\n───────────────\n  Input ──▶ Transform ──▶ Output\n    │          │            │\n    ▼          ▼            ▼\n  [API]    [Service]    [DB/Cache]\n\n  Traces: request lifecycle,\n  state mutations, side effects\n  Agent: 1 data-flow explorer\n```"},
      {"label": "Architecture patterns", "description": "Identify design patterns and integrations", "markdown": "```\nArchitecture Analysis\n─────────────────────\n  ┌─────────────────────┐\n  │ Detected Patterns    │\n  │ ├── MVC / Hexagonal  │\n  │ ├── Event-driven?    │\n  │ ├── Service layers   │\n  │ └── External APIs    │\n  ├─────────────────────┤\n  │ Integration Map      │\n  │ DB ←→ Cache ←→ Queue │\n  └─────────────────────┘\n  Agent: backend-system-architect\n```"},
      {"label": "Quick search", "description": "Just find relevant files, skip deep analysis", "markdown": "```\nQuick Search (~30s)\n───────────────────\n  Grep + Glob ──▶ File list\n\n  Output:\n  ├── Matching files\n  ├── Line references\n  └── Brief summary\n  No agents, no health check,\n  no report generation\n```"}
    ],
    "multiSelect": false
  }]
)
```

**Based on answer, adjust workflow:**
- **Full exploration**: All phases, all parallel agents
- **Code structure only**: Skip phases 5-7 (health, dependencies, product)
- **Data flow**: Focus phase 3 agents on data tracing
- **Architecture patterns**: Focus on backend-system-architect agent
- **Quick search**: Skip to phases 1-2 only, return file list


## STEP 0b: Select Orchestration Mode

### MCP Probe

```python
# memory is alwaysLoad in .mcp.json (CC 2.1.121+, #1541) — probe below kept as fallback for older CC:
ToolSearch(query="select:mcp__memory__search_nodes")
Write(".claude/chain/capabilities.json", { memory, timestamp })

if capabilities.memory:
  mcp__memory__search_nodes({ query: "architecture decisions for {path}" })
  # Enrich exploration with past decisions
```

### Exploration Handoff

After exploration completes, write results for downstream skills:

```python
Write(".claude/chain/exploration.json", JSON.stringify({
  "phase": "explore", "skill": "explore",
  "timestamp": now(), "status": "completed",
  "outputs": {
    "architecture_map": { ... },
    "patterns_found": ["repository", "service-layer"],
    "complexity_hotspots": ["src/auth/", "src/payments/"]
  }
}))
```


Choose **Agent Teams** (mesh) or **Task tool** (star):

1. Agent Teams mode (GA since CC 2.1.33) → **recommended for 4+ agents**
2. Task tool mode → **for quick/single-focus exploration**
3. `ORCHESTKIT_FORCE_TASK_TOOL=1` → **Task tool** (override)

| Aspect | Task Tool | Agent Teams |
|--------|-----------|-------------|
| Discovery sharing | Lead synthesizes after all complete | Explorers share discoveries as they go |
| Cross-referencing | Lead connects dots | Data flow explorer alerts architecture explorer |
| Cost | ~150K tokens | ~400K tokens |
| Best for | Quick/focused searches | Deep full-codebase exploration |

> **Fallback:** If Agent Teams encounters issues, fall back to Task tool for remaining exploration.


## Task Management (MANDATORY)

**BEFORE doing ANYTHING else, create tasks to show progress:**

```python
# 1. Create main task IMMEDIATELY
TaskCreate(subject="Explore: {topic}", description="Deep codebase exploration for {topic}", activeForm="Exploring {topic}")

# 2. Create subtasks for each phase
TaskCreate(subject="Initial file search", activeForm="Searching files")                # id=2
TaskCreate(subject="Check knowledge graph", activeForm="Checking memory")              # id=3
TaskCreate(subject="Launch exploration agents", activeForm="Dispatching explorers")     # id=4
TaskCreate(subject="Assess code health (0-10)", activeForm="Assessing code health")    # id=5
TaskCreate(subject="Map dependency hotspots", activeForm="Mapping dependencies")       # id=6
TaskCreate(subject="Add product perspective", activeForm="Adding product context")     # id=7
TaskCreate(subject="Generate exploration report", activeForm="Generating report")      # id=8

# 3. Set dependencies for sequential phases
TaskUpdate(taskId="3", addBlockedBy=["2"])  # Memory check needs file search first
TaskUpdate(taskId="4", addBlockedBy=["3"])  # Agents need memory context
TaskUpdate(taskId="5", addBlockedBy=["4"])  # Health needs exploration done
TaskUpdate(taskId="6", addBlockedBy=["4"])  # Hotspots need exploration done
TaskUpdate(taskId="7", addBlockedBy=["4"])  # Product needs exploration done
TaskUpdate(taskId="8", addBlockedBy=["5", "6", "7"])  # Report needs all analysis done

# 4. Before starting each task, verify it's unblocked
task = TaskGet(taskId="2")  # Verify blockedBy is empty

# 5. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask
```


## Workflow Overview

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Initial Search** | Grep, Glob for matches | File locations |
| **2. Memory Check** | Search knowledge graph | Prior context |
| **3. Deep Exploration** | 4 parallel explorers | Multi-angle analysis |
| **4. AI System (if applicable)** | LangGraph, prompts, RAG | AI-specific findings |
| **5. Code Health** | Rate code 0-10 | Quality scores |
| **6. Dependency Hotspots** | Identify coupling | Hotspot visualization |
| **7. Product Perspective** | Business context | Findability suggestions |
| **8. Report Generation** | Compile findings | Actionable report |

### Progressive Output (CC 2.1.76)

Output findings **incrementally** as each phase completes — don't batch until the report:

| After Phase | Show User |
|-------------|-----------|
| 1. Initial Search | File matches, grep results |
| 2. Memory Check | Prior decisions and relevant context |
| 3. Deep Exploration | Each explorer agent's findings as they return |
| 5. Code Health | Health score with dimension breakdown |

For Phase 3 parallel agents, output each agent's findings **as soon as it returns** — don't wait for all 4 explorers. Early findings from one agent may answer the user's question before remaining agents complete, allowing early termination.


### Phase 1: Initial Search

```python
# PARALLEL - Quick searches
Grep(pattern="$ARGUMENTS[0]", output_mode="files_with_matches")
Glob(pattern="**/*$ARGUMENTS[0]*")
```

### Phase 2: Memory Check

```python
mcp__memory__search_nodes(query="$ARGUMENTS[0]")
mcp__memory__search_nodes(query="architecture")
```

### Phase 3: Parallel Deep Exploration (4 Agents)

Load `Read("${CLAUDE_SKILL_DIR}/rules/exploration-agents.md")` for Task tool mode prompts.

Load `Read("${CLAUDE_SKILL_DIR}/rules/agent-teams-mode.md")` for Agent Teams alternative.

### Phase 4: AI System Exploration (If Applicable)

For AI/ML topics, add exploration of: LangGraph workflows, prompt templates, RAG pipeline, caching strategies.

### Phase 5: Code Health Assessment

Load `Read("${CLAUDE_SKILL_DIR}/rules/code-health-assessment.md")` for agent prompt. Load `Read("${CLAUDE_SKILL_DIR}/references/code-health-rubric.md")` for scoring criteria.

### Phase 6: Dependency Hotspot Map

Load `Read("${CLAUDE_SKILL_DIR}/rules/dependency-hotspot-analysis.md")` for agent prompt. Load `Read("${CLAUDE_SKILL_DIR}/references/dependency-analysis.md")` for metrics.

### Phase 7: Product Perspective

Load `Read("${CLAUDE_SKILL_DIR}/rules/product-perspective.md")` for agent prompt. Load `Read("${CLAUDE_SKILL_DIR}/references/findability-patterns.md")` for best practices.

### Phase 8: Generate Report

Load `Read("${CLAUDE_SKILL_DIR}/references/exploration-report-template.md")`.

### Phase 8b: Emit Dashboard Spec (json-render)

Parse `--render=` from `$ARGUMENTS`. Default is `both`.

| Mode | Behavior |
|------|----------|
| `markdown` | Current behavior — markdown report only. No spec emitted. |
| `json-render` | Emit `.claude/chain/explore-dashboard.json` only. Skip markdown report. |
| `both` | Emit spec **and** markdown. Default — gives the human a report and downstream skills a structured handoff. |

When emitting a spec:

1. Load the format and catalog: `Read("${CLAUDE_SKILL_DIR}/references/dashboard-spec.md")`. Reference example: `references/dashboard-example.json`.
2. Build the spec object using only catalog component types: `Card`, `StatGrid`, `DataTable`, `StatusBadge`, `BarMeter`, `Heatmap`, `Markdown`.
3. Write to `.claude/chain/explore-dashboard.json` with compact JSON (no indentation) — minimizes token cost for downstream consumers.
4. Validate before declaring success:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/render-spec.mjs" .claude/chain/explore-dashboard.json --check
```

If validation fails (exit ≠ 0), **do not emit** — fall back to markdown-only and surface the error to the user. Never write a partial or invalid spec.

5. For `--render=both`, render the markdown view from the spec for consistency:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/render-spec.mjs" .claude/chain/explore-dashboard.json
```

Pipe the output into the user-facing markdown report (or use it as-is). This guarantees the JSON spec and markdown report stay in sync — a single source of truth.

**Why this matters:** Downstream skills (`/ork:fix-issue`, `/ork:implement`, `/ork:create-pr`) parse `.claude/chain/explore-dashboard.json` directly instead of re-reading 3000-token markdown. Measured: spec ≈ 580 tokens for the same content. Backwards-compatible: old chained workflows that read markdown keep working in `both` mode.

## Phase 6 — Notebook summary (signal-fired, optional)

After the session synthesis lands, optionally invoke `scripts/post_explore_summary.py <session-dir>` to auto-emit a notebook-backed summary of the exploration. Self-skips on every non-happy-path so it never breaks the run:

```bash
python3 plugins/ork/skills/explore/scripts/post_explore_summary.py "$CLAUDE_JOB_DIR"
```

Auto-skip conditions (all exit 0, all WARN-logged):

| Skip reason | Trigger |
|-------------|---------|
| `signal absent` | `len(dirs_scanned) < 3` (or field missing on `explore-output.json`) |
| `yg-mcp-core not importable` | `yg-mcp-core>=0.3.0` not installed (orchestkit is public; yg-mcp-core lives on private `pypi.yonyon.ai` — HQ-only) |
| `hq-content MCP unreachable` | MCP server down OR `.mcp.json` doesn't define `hq-content` |

Session dir must contain `explore-output.json` (with `dirs_scanned: list[str]`, optional `synthesis: str`, required `notebook_id: str`). Handoff JSON at `<session-dir>/explore-summary.json` records `status` (`fired` / `skipped`) and `summary_path` on success.

Mirrors the `/ork:brainstorm` post-synth podcast pattern from PR #1889. Closes orchestkit#1893.

## Common Exploration Queries

- "How does authentication work?"
- "Where are API endpoints defined?"
- "Find all usages of EventBroadcaster"
- "What's the workflow for content analysis?"

## Running unattended with /goal

Set a completion condition with `/goal` (CC 2.1.139+) and this skill will keep working across turns until the condition is met. Works in interactive, `-p`, and Remote Control. The overlay panel shows live elapsed / turns / tokens.

**Example completion condition for this skill:**

```
/goal until report.has_architecture_diagram AND patterns.detected_count >= 5
```

Stops when: codebase architecture diagram is generated and at least 5 design patterns have been classified. Compatible with claude.ai Remote Control runs.

## Related Skills
- `ork:implement`: Implement after exploration

**Version:** 2.6.0 (April 2026) — `${CLAUDE_EFFORT}` env var scales agent count (CC 2.1.120, #1540)

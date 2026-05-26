---
description: "Renders planned changes — architecture and before/after comparisons, risk heat maps, execution order, dependency graphs, impact metrics — in your chosen output format (ASCII + emojis, an interactive HTML playground, or a NotebookLM infographic). Stores visualizations in memory for cross-session reference. Use when reviewing implementation plans, comparing approaches, assessing risk, or analyzing change propagation."
allowed-tools: [Read, Grep, Glob, Task, TaskCreate, TaskUpdate, AskUserQuestion, Bash, Write, mcp__memory__search_nodes, mcp__memory__create_entities, ToolSearch]
---

# Auto-generated from skills/visualize-plan/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Plan Visualization

Render planned changes as structured ASCII visualizations with risk analysis, execution order, and impact metrics. Every section answers a specific reviewer question.

**Core principle:** Encode judgment into visualization, not decoration.

```bash
/ork:visualize-plan                          # Auto-detect from current branch
/ork:visualize-plan billing module redesign  # Describe the plan
/ork:visualize-plan #234                     # Pull from GitHub issue
```

## Argument Resolution

```python
PLAN_INPUT = "$ARGUMENTS"    # Full argument string
PLAN_TOKEN = "$ARGUMENTS[0]" # First token — could be issue "#234" or plan description
# If starts with "#", treat as GitHub issue number. Otherwise, plan description.
# $ARGUMENTS (full string) for multi-word descriptions (CC 2.1.59 indexed access)
```


## CRITICAL: Task Tracking

```python
# 1. Create main task IMMEDIATELY
TaskCreate(subject="Visualize plan: {PLAN_INPUT}", description="Plan visualization with ASCII rendering", activeForm="Analyzing plan context")

# 2. Create subtasks for each phase
TaskCreate(subject="Detect or clarify plan context", activeForm="Detecting plan context")          # id=2
TaskCreate(subject="Gather data and explore architecture", activeForm="Gathering plan data")       # id=3
TaskCreate(subject="Render tier 1 header", activeForm="Rendering header")                          # id=4
TaskCreate(subject="Render sections + dispatch to chosen format(s)", activeForm="Rendering sections") # id=5
TaskCreate(subject="Offer actions and store in memory", activeForm="Finalizing visualization")     # id=6

# 3. Set dependencies for sequential phases
TaskUpdate(taskId="3", addBlockedBy=["2"])  # Data gathering needs context first
TaskUpdate(taskId="4", addBlockedBy=["3"])  # Header needs gathered data
TaskUpdate(taskId="5", addBlockedBy=["4"])  # Sections need header rendered
TaskUpdate(taskId="6", addBlockedBy=["5"])  # Actions need sections done

# 4. Before starting each task, verify it's unblocked
task = TaskGet(taskId="2")  # Verify blockedBy is empty

# 5. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask
```

## STEP -1: Check Memory for Prior Plans

```python
# Search for related prior visualizations
mcp__memory__search_nodes(query="plan visualization {PLAN_INPUT}")
# If found, offer to compare with previous plan
```

## STEP 0: Detect or Clarify Plan Context

**First**, attempt auto-detection by running `scripts/detect-plan-context.sh`:

```bash
bash "$SKILL_DIR/scripts/detect-plan-context.sh"
```

This outputs branch name, issue number (if any), commit count, and file change summary.

**If auto-detection finds a clear plan** (branch with commits diverging from main, or issue number in args), proceed to Step 1.

**If ambiguous**, clarify with AskUserQuestion:

```python
AskUserQuestion(
  questions=[{
    "question": "What should I visualize?",
    "header": "Source",
    "options": [
      {"label": "Current branch changes (Recommended)", "description": "Auto-detect from git diff against main", "markdown": "```\nBranch Diff Analysis\n────────────────────\n$ git diff main...HEAD\n\n→ File change manifest (+A, M, -D)\n→ Execution swimlane by phase\n→ Risk dashboard + pre-mortems\n→ Impact summary (lines, tests, API)\n```"},
      {"label": "Describe the plan", "description": "I'll explain what I'm planning to change", "markdown": "```\nPlan Description\n────────────────\nYou describe → I visualize:\n\n→ Before/after architecture diagrams\n→ Execution order with dependencies\n→ Risk analysis per component\n→ Decision log (ADR-lite format)\n```"},
      {"label": "GitHub issue", "description": "Pull plan from a specific issue number", "markdown": "```\nGitHub Issue Source\n───────────────────\n$ gh issue view #N\n\n→ Extract requirements from body\n→ Map to file-level changes\n→ Generate execution phases\n→ Link back to issue for tracking\n```"},
      {"label": "Quick file diff only", "description": "Just show the change manifest, skip analysis", "markdown": "```\nQuick File Diff\n───────────────\n[A] src/new-file.ts        +120\n[M] src/existing.ts    +15  -8\n[D] src/old-file.ts        -45\n─────────────────────────────\nNET: +82 lines, 3 files\n\nNo risk analysis or swimlanes\n```"}
    ],
    "multiSelect": false
  }]
)
```


## STEP 0.5: Choose Output Format (Front Door)

Decide **how** to render before gathering data. First **probe capabilities**, then ask only for what's available. Full procedure: `Read("${CLAUDE_SKILL_DIR}/references/format-dispatch.md")`.

Use the established MCP-probe pattern — `Read("${CLAUDE_SKILL_DIR}/../chain-patterns/references/mcp-detection.md")` — not ad-hoc checks:

```python
# infographic is available IFF the notebooklm studio tool resolves:
ToolSearch(query="select:mcp__notebooklm-mcp__studio_create")
```

Gate the options: **ascii** always (the floor); **playground** if the `playground` skill is installed (ships with ork); **infographic** if `studio_create` resolved above (server reachable + `nlm login` done). If only ASCII is available, skip the question.

If only ASCII is available, **skip the question** and render ASCII. Otherwise ask (hide ungated options, surface a one-line install/auth hint instead):

```python
AskUserQuestion(questions=[{
  "question": "How should I render this plan?",
  "header": "Format",
  "options": [
    {"label": "ASCII + emojis (Recommended)", "description": "Fast, in-chat, zero-dependency. Always the floor — rendered first even if you also pick a richer format."},
    {"label": "Interactive playground", "description": "Single-file HTML explorer written to docs/<branch-dir>/plan-viz.html (also satisfies the PR Playground gate). Delegates to the playground skill."},
    {"label": "NotebookLM infographic", "description": "Stakeholder-ready infographic/slides via notebooklm studio_create. Async — fired and notified, never blocks."},
    {"label": "All available", "description": "ASCII inline now + the richer formats linked as they finish."}
  ],
  "multiSelect": false
}])
```

**ASCII floor rule:** always render ASCII first/inline regardless of choice — never `await` the async NotebookLM job. Record the chosen format(s) as `FORMATS` for STEP 4 dispatch.


## STEP 1: Gather Data

Run `scripts/analyze-impact.sh` for precise counts:

```bash
bash "$SKILL_DIR/scripts/analyze-impact.sh"
```

This produces: files by action (add/modify/delete), line counts, test files affected, and dependency changes.

For architecture-level understanding **and the default before/after section [0]**, spawn an Explore agent that maps the component graph at BOTH the base and the head:

```python
Agent(
  subagent_type="Explore",
  prompt="Map component architecture of {affected_directories} at TWO points: (a) base = each file as returned by `git show origin/main:<path>` (NOT the working tree — avoids conflating uncommitted edits), (b) head = current working tree. Return per point: components, dependencies, data flows; mark what is added [+], removed [-], or changed [~] between them. Use the ascii-visualizer skill for diagrams.",
  model="haiku"
)
```

If the diff touches frontend (`*.tsx`/`*.css`/route files), also run a `design-context-extract` pass so the design surface is part of before/after. Patterns: `Read("${CLAUDE_SKILL_DIR}/references/before-after-arch-patterns.md")`.

Build a compact **plan brief** (markdown) from this data — the single interchange every non-ASCII format consumes (see `format-dispatch.md`).


## STEP 2: Render Tier 1 Header (Always)

Use `assets/tier1-header.md` template. Load `Read("${CLAUDE_SKILL_DIR}/references/visualization-tiers.md")` for field computation (risk level, confidence, reversibility).

```
PLAN: {plan_name} ({issue_ref})  |  {phase_count} phases  |  {file_count} files  |  +{added} -{removed} lines
Risk: {risk_level}  |  Confidence: {confidence}  |  Reversible until {last_safe_phase}
Branch: {branch} -> {base_branch}

[0] Before/After  [1] Changes  [2] Execution  [3] Risks  [4] Decisions  [5] Impact  [all]
```


## STEP 3: Ask Which Sections to Expand

**Section [0] Before/After is rendered automatically as the lead** whenever the Explore map shows structural changes (skipped with a one-line note otherwise) — so it is never buried behind a picker choice. The options below select among the remaining sections [1]–[5]; "All sections" includes [0].

```python
AskUserQuestion(
  questions=[{
    "question": "Which sections to render?",
    "header": "Sections",
    "options": [
      {"label": "All sections", "description": "Full visualization with all 6 core sections", "markdown": "```\n[0] Before/After      Arch diff (base vs head)\n[1] Change Manifest   [A]/[M]/[D] file tree\n[2] Execution         Swimlane with phases\n[3] Risks             Dashboard + pre-mortems\n[4] Decisions         ADR-lite decision log\n[5] Impact            Lines, tests, API, deps\n```"},
      {"label": "Changes + Execution", "description": "File diff tree and execution swimlane", "markdown": "```\n[1] Change Manifest\n    [M] src/auth.ts         +45 -12\n    [A] src/oauth.ts        +89\n\n[2] Execution Swimlane\n    Phase 1 ====[auth]========▶\n    Phase 2 ----[blocked]--===▶\n```"},
      {"label": "Risks + Decisions", "description": "Risk dashboard and decision log", "markdown": "```\n[3] Risk Dashboard\n    MEDIUM ██░░ migration reversible\n    HIGH   ███░ API breaking change\n    Pre-mortem: \"What if auth fails?\"\n\n[4] Decision Log\n    D1: OAuth2 over JWT (security)\n    D2: Postgres over Redis (durability)\n```"},
      {"label": "Impact only", "description": "Just the numbers: files, lines, tests, API surface", "markdown": "```\n[5] Impact Summary\n    ┌──────────┬─────┬───────┐\n    │ Metric   │Count│ Delta │\n    ├──────────┼─────┼───────┤\n    │ Files    │  12 │  +3   │\n    │ Lines    │ 450 │ +127  │\n    │ Tests    │   8 │  +4   │\n    │ API sfc  │   3 │  +1   │\n    └──────────┴─────┴───────┘\n```"}
    ],
    "multiSelect": false
  }]
)
```


## STEP 4: Render Requested Sections

Render each requested section following `${CLAUDE_SKILL_DIR}/rules/section-rendering.md` conventions. Use the corresponding reference for ASCII patterns:

| Section | Reference | Key Convention |
|---------|-----------|----------------|
| [0] Before/After Arch | (load `${CLAUDE_SKILL_DIR}/references/before-after-arch-patterns.md`) | Side-by-side base vs head; mark `[+]`/`[~]`/`[-]`; skip if nothing structural changed |
| [1] Change Manifest | (load `${CLAUDE_SKILL_DIR}/references/change-manifest-patterns.md`) | `[A]`/`[M]`/`[D]` + `+N -N` per file |
| [2] Execution Swimlane | (load `${CLAUDE_SKILL_DIR}/references/execution-swimlane-patterns.md`) | `===` active, `---` blocked, `\|` deps |
| [3] Risk Dashboard | (load `${CLAUDE_SKILL_DIR}/references/risk-dashboard-patterns.md`) | Reversibility timeline + 3 pre-mortems |
| [4] Decision Log | (load `${CLAUDE_SKILL_DIR}/references/decision-log-patterns.md`) | ADR-lite: Context/Decision/Alternatives/Tradeoff |
| [5] Impact Summary | (load `${CLAUDE_SKILL_DIR}/assets/impact-dashboard.md`) | Table: Added/Modified/Deleted/NET + tests/API/deps |


## STEP 4b: Dispatch to Format(s)

Render the selected sections into the `FORMATS` chosen in STEP 0.5. **ASCII always renders first/inline** — the other formats consume the same plan brief. Full table + delegation patterns: `Read("${CLAUDE_SKILL_DIR}/references/format-dispatch.md")`.

| Format | Action |
|--------|--------|
| ASCII | Native render (above) — always, the floor |
| Playground | Hand the plan brief to the `playground` skill → write `docs/<branch-dir>/plan-viz.html`, link it |
| Infographic | Run the `notebooklm` `studio_create(artifact_type=infographic\|slides)` flow — **fire-and-notify**, poll `studio_status`, never await |
| All | ASCII inline now + the rest linked as they finish |

`<branch-dir>` = branch with `/` → `--` (same path the PR Playground gate checks).


## STEP 5: Offer Actions

After rendering, offer next steps:

```python
AskUserQuestion(
  questions=[{
    "question": "What next?",
    "header": "Actions",
    "options": [
      {"label": "Write to designs/", "description": "Save as designs/{branch}.md for PR review", "markdown": "```\nSave to File\n────────────\ndesigns/\n  └── feat-billing-redesign.md\n      ├── Header + metadata\n      ├── All rendered sections\n      └── Ready for PR description\n```"},
      {"label": "Generate GitHub issues", "description": "Create issues from execution phases with labels and milestones", "markdown": "```\nGitHub Issues\n─────────────\n#101 [billing] Phase 1: Schema migration\n     labels: component:billing, risk:medium\n#102 [billing] Phase 2: API endpoints\n     labels: component:billing, risk:low\n     blocked-by: #101\n```"},
      {"label": "Drill deeper", "description": "Expand blast radius, cross-layer check, or migration checklist", "markdown": "```\nDeep Dive Options\n─────────────────\n[6] Blast Radius\n    direct → transitive → test impact\n[7] Cross-Layer Consistency\n    Frontend ↔ Backend endpoint gaps\n[8] Migration Checklist\n    Ordered runbook with time estimates\n```"},
      {"label": "Done", "description": "Plan visualization complete"}
    ],
    "multiSelect": false
  }]
)
```

**Progressive upgrade:** if ASCII-only was rendered and a richer format is still available (per the STEP 0.5 probe), replace the "Done" option with "Upgrade to playground / infographic" — it reuses the plan brief, no recomputation (see `references/format-dispatch.md`).

**Write to file:** Save full report to `designs/{branch-name}.md` using `assets/plan-report.md` template.

**Generate issues:** For each execution phase, create a GitHub issue with title `[{component}] {phase_description}`, labels (component + `risk:{level}`), milestone, body from plan sections, and blocked-by references.

**Store in memory:** Save plan summary to knowledge graph for future comparison:

```python
mcp__memory__create_entities(entities=[{
  "name": "Plan: {plan_name}",
  "entityType": "plan-visualization",
  "observations": [
    "Branch: {branch}",
    "Risk: {risk_level}, Confidence: {confidence}",
    "Phases: {phase_count}, Files: {file_count}",
    "Key decisions: {decision_summary}"
  ]
}])
```


## Deep Dives (Tier 3, on request)

Available when user selects "Drill deeper". Load `Read("${CLAUDE_SKILL_DIR}/references/deep-dives.md")` for cross-layer and migration patterns.

| Section | What It Shows | Reference |
|---------|--------------|-----------|
| [6] Blast Radius | Concentric rings of impact (direct -> transitive -> tests) | (load `${CLAUDE_SKILL_DIR}/references/blast-radius-patterns.md`) |
| [7] Cross-Layer Consistency | Frontend/backend endpoint alignment with gap detection | (load `${CLAUDE_SKILL_DIR}/references/deep-dives.md`) |
| [8] Migration Checklist | Ordered runbook with sequential/parallel blocks and time estimates | (load `${CLAUDE_SKILL_DIR}/references/deep-dives.md`) |


## Key Principles

| Principle | Application |
|-----------|-------------|
| **Progressive disclosure** | Tier 1 header always, sections on request |
| **Judgment over decoration** | Every section answers a reviewer question |
| **Precise over estimated** | Use scripts for file/line counts |
| **Honest uncertainty** | Confidence levels, pre-mortems, tradeoff costs |
| **Actionable output** | Write to file, generate issues, drill deeper |
| **Anti-slop** | No generic transitions, no fake precision, no unused sections |

## Rules Quick Reference

| Rule | Impact | What It Covers |
|------|--------|----------------|
| section-rendering (load `${CLAUDE_SKILL_DIR}/rules/section-rendering.md`) | HIGH | Rendering conventions for all 6 core sections ([0]–[5]) |
| ASCII diagrams | MEDIUM | Via `ascii-visualizer` skill (box-drawing, file trees, workflows) |

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:
| File | Content |
|------|---------|
| `visualization-tiers.md` | Progressive disclosure tiers and header field computation |
| `change-manifest-patterns.md` | Change manifest ASCII patterns |
| `execution-swimlane-patterns.md` | Execution swimlane ASCII patterns |
| `risk-dashboard-patterns.md` | Risk dashboard ASCII patterns |
| `decision-log-patterns.md` | Decision log ASCII patterns |
| `blast-radius-patterns.md` | Blast radius ASCII patterns |
| `deep-dives.md` | Cross-layer consistency and migration checklist |
| `format-dispatch.md` | Output-format capability probe, ASCII-floor rule, delegation to playground/notebooklm |
| `before-after-arch-patterns.md` | Section [0] before/after architecture per output format |

## Assets

Load on demand with `Read("${CLAUDE_SKILL_DIR}/assets/<file>")`:
| File | Content |
|------|---------|
| `plan-report.md` | Full mustache-style report template |
| `impact-dashboard.md` | Impact table template |
| `tier1-header.md` | 5-line summary template |

## Related Skills

- `ork:implement` - Execute planned changes
- `ork:explore` - Understand current architecture
- `ork:assess` - Evaluate complexity and risks
- `ork:memory` - Search prior plan visualizations
- `ork:remember` - Store plan decisions for future reference

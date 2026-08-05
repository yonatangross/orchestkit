---
name: visualize-plan
license: MIT
compatibility: "Claude Code 2.1.220+."
description: "Renders planned changes — architecture and before/after comparisons, risk heat maps, execution order, dependency graphs, impact metrics — in your chosen output format (ASCII + emojis, an interactive HTML playground, or a NotebookLM infographic). Stores visualizations in memory for cross-session reference. Use when reviewing implementation plans, comparing approaches, assessing risk, or analyzing change propagation."
argument-hint: "[plan-or-issue]"
context: fork
# user-typed commands stay interactive; CC >= 2.1.218 backgrounds forks by default (#3093)
background: false
agent: workflow-architect
model: sonnet
version: 2.1.0
author: OrchestKit
tags: [visualization, planning, before-after, architecture, diff, risk, impact, migration, playground, infographic, multi-format]
user-invocable: true
allowed-tools: [Read, Grep, Glob, Agent, TaskCreate, TaskUpdate, AskUserQuestion, Bash, Write, mcp__memory__search_nodes, mcp__memory__create_entities, ToolSearch]
skills: [quickviz, explore, architecture-decision-record, memory, remember]
complexity: medium
persuasion-type: guidance
hooks:
  PreToolUse:
    - matcher: "Bash"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs skill/plan-context-loader"
      once: true
metadata:
  category: document-asset-creation
  mcp-server: memory
triggers:
  keywords: [visualize, "visualize plan", "visualize the plan", "visualize the", "show diagram", "before and after", "execution order", "risk and impact", swimlane, "what files will change"]
  examples:
    - "visualize the plan for the billing module redesign"
    - "show me a before and after diagram for this migration"
    - "whats the risk and impact of the changes"
  anti-triggers: [implement, brainstorm, explore, assess, fix]
---

# Plan Visualization

Render planned changes as structured ASCII visualizations with risk analysis, execution order, and impact metrics. Every section answers a specific reviewer question.

**Core principle:** Encode judgment into visualization, not decoration.

```bash
/ork:visualize-plan                          # Auto-detect from current branch
/ork:visualize-plan billing module redesign  # Describe the plan
/ork:visualize-plan #234                     # Pull from GitHub issue
/ork:visualize-plan --quick                  # Header + changes + impact, zero questions
/ork:visualize-plan --playground             # Skip straight to the HTML dashboard
/ork:visualize-plan --infographic            # Skip straight to NotebookLM
```

## Argument Resolution

```python
PLAN_INPUT = "$ARGUMENTS"    # Full argument string
PLAN_TOKEN = "$ARGUMENTS[0]" # First token — could be issue "#234" or plan description
# If starts with "#", treat as GitHub issue number. Otherwise, plan description.
# $ARGUMENTS (full string) for multi-word descriptions (CC 2.1.59 indexed access)

# Flags are stripped from PLAN_INPUT before it is used as a description:
#   --quick        → QUICK=true: tier-1 header + [1] Changes + [5] Impact, no Explore
#                    agent, no questions at all, no memory write. The 15-second answer.
#   --playground   → FORMATS=[ascii, playground]      (no format question)
#   --infographic  → FORMATS=[ascii, infographic]     (no format question)
#   --all          → FORMATS=[ascii, + everything the probe found]
```

## Question budget: ZERO before the first render

This skill used to ask three blocking questions (source, then format, then sections)
before a single character rendered, plus a fourth after. That is why fast paths leaked to
`quickviz` and to hand-written HTML.

The format answer is **not needed** to render ASCII — the ASCII floor rule renders it
first regardless of what the user picks. So asking up front buys nothing and costs a
round-trip. The rule now:

| Decision | When | How |
|---|---|---|
| Source | before | Auto-detect. Ask **only** if detection is genuinely ambiguous (STEP 0). |
| Sections | never | Default to **all**. The tier-1 header is the progressive-disclosure layer. |
| Format | **after** ASCII | One post-render question (STEP 5), merged with drill-deeper. |

`--quick` skips even that one.

---

## CRITICAL: Task Tracking

**`--quick` skips this whole block.** A 15-second render does not need a dependency graph; the
task overhead would cost more than the work.

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

# 4. Update status as you progress
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
      {"label": "Current branch changes (Recommended)", "description": "Auto-detect from git diff against main"},
      {"label": "Describe the plan", "description": "I'll explain what I'm planning to change"},
      {"label": "GitHub issue", "description": "Pull plan from a specific issue number"},
      {"label": "Quick file diff only", "description": "Just show the change manifest, skip analysis"}
    ],
    "multiSelect": false
  }]
)
```

---

## STEP 0.5: Probe Formats (silent — no question here)

Probe **capabilities** now so STEP 5 can offer only what will actually work. **Do not ask
anything at this step.** Full procedure: `Read("${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/format-dispatch.md")`.

Use the established MCP-probe pattern — `Read("${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/mcp-detection.md")` — not ad-hoc checks:

```python
# infographic is available IFF the notebooklm studio tool resolves:
ToolSearch(query="select:mcp__notebooklm-mcp__studio_create")
# chart-encoding is available IFF the bundled /dataviz skill resolves
# (CC >= 2.1.198, disableBundledSkills off). It is a MARK-layer upgrade
# applied WITHIN a format, not a 4th format — see chart-encoding-standard.md.
```

Record what is available as `AVAILABLE`: **ascii** always (the floor); **playground** if the
`playground` skill is installed (ships with ork); **infographic** if `studio_create` resolved above
(server reachable + `nlm login` done). Orthogonally, if the **`/dataviz`** skill resolved, upgrade
the chart *marks* in the non-ASCII formats via its form-heuristic + validated palette; if it did not
resolve, charts stay ASCII-card — dataviz is never required.

`FORMATS` is then set **without asking**:

```python
if   "--quick" in flags:        FORMATS = ["ascii"]              # and STEP 5 is skipped too
elif "--playground" in flags:   FORMATS = ["ascii", "playground"]
elif "--infographic" in flags:  FORMATS = ["ascii", "infographic"]
elif "--all" in flags:          FORMATS = AVAILABLE
else:                           FORMATS = ["ascii"]              # upgrade offered in STEP 5
```

**ASCII floor rule:** ASCII renders first/inline regardless — and because it never depends on the
format choice, the choice is deferred to STEP 5 where it costs nothing. Never `await` the async
NotebookLM job.

---

## STEP 1: Gather Data

Run `scripts/analyze-impact.sh` for precise counts:

```bash
bash "$SKILL_DIR/scripts/analyze-impact.sh"
```

This produces: files by action (add/modify/delete), line counts, test files affected, and dependency changes.

**`--quick` stops here** — the impact script alone feeds the header, [1] Changes, and [5] Impact.
No Explore agent, no before/after map, no memory write.

For architecture-level understanding **and the default before/after section [0]**, spawn an Explore agent that maps the component graph at BOTH the base and the head:

```python
Agent(
  subagent_type="Explore",
  prompt="Map component architecture of {affected_directories} at TWO points: (a) base = each file as returned by `git show origin/main:<path>` (NOT the working tree — avoids conflating uncommitted edits), (b) head = current working tree. Return per point: components, dependencies, data flows; mark what is added [+], removed [-], or changed [~] between them. Use the quickviz skill for diagrams.",
  model="haiku"
)
```

If the diff touches frontend (`*.tsx`/`*.css`/route files), also run a `design-context-extract` pass so the design surface is part of before/after. Patterns: `Read("${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/before-after-arch-patterns.md")`.

Build a compact **plan brief** (markdown) from this data — the single interchange every non-ASCII format consumes (see `format-dispatch.md`).

---

## STEP 2: Render Tier 1 Header (Always)

Use `assets/tier1-header.md` template. Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/visualization-tiers.md")` for field computation (risk level, confidence, reversibility).

```
PLAN: {plan_name} ({issue_ref})  |  {phase_count} phases  |  {file_count} files  |  +{added} -{removed} lines
Risk: {risk_level}  |  Confidence: {confidence}  |  Reversible until {last_safe_phase}
Branch: {branch} -> {base_branch}

[0] Before/After  [1] Changes  [2] Execution  [3] Risks  [4] Decisions  [5] Impact  [all]
```

---

## STEP 3: Select Sections (no question — default to all)

**Render all six sections.** They are the content; asking which ones to render is asking the
reviewer to choose before they have seen anything. The tier-1 header is already the
progressive-disclosure layer, and a section with nothing to say is skipped with a one-line reason
(not padded), so "all" never means "bloated".

```python
SECTIONS = ["0","1","2","3","4","5"]      # default
if QUICK: SECTIONS = ["1","5"]            # --quick: change manifest + impact only
```

**Section [0] Before/After leads** whenever the Explore map shows structural changes, and is
skipped with a one-line note otherwise. If the user asked for specific sections in their prompt
("just the risks"), honor that — but do not *prompt* for it.

---

## STEP 4: Render Requested Sections

Render each requested section following `${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/rules/section-rendering.md` conventions. Use the corresponding reference for ASCII patterns:

| Section | Reference | Key Convention |
|---------|-----------|----------------|
| [0] Before/After Arch | (load `${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/before-after-arch-patterns.md`) | Side-by-side base vs head; mark `[+]`/`[~]`/`[-]`; skip if nothing structural changed |
| [1] Change Manifest | (load `${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/change-manifest-patterns.md`) | `[A]`/`[M]`/`[D]` + `+N -N` per file |
| [2] Execution Swimlane | (load `${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/execution-swimlane-patterns.md`) | `===` active, `---` blocked, `\|` deps |
| [3] Risk Dashboard | (load `${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/risk-dashboard-patterns.md`) | Reversibility timeline + 3 pre-mortems |
| [4] Decision Log | (load `${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/decision-log-patterns.md`) | ADR-lite: Context/Decision/Alternatives/Tradeoff |
| [5] Impact Summary | (load `${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/assets/impact-dashboard.md`) | Table: Added/Modified/Deleted/NET + tests/API/deps |

---

## STEP 4b: Dispatch to Format(s)

Render the selected sections into the `FORMATS` chosen in STEP 0.5. **ASCII always renders first/inline** — the other formats consume the same plan brief. Full table + delegation patterns: `Read("${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/format-dispatch.md")`.

| Format | Action |
|--------|--------|
| ASCII | Native render (above) — always, the floor |
| Playground | Classify the archetype (below), then hand the plan brief to the `playground` skill → write `docs/<branch-dir>/plan-viz.html`, link it |
| Infographic | Run the `notebooklm` `studio_create(artifact_type=infographic\|slides)` flow — **fire-and-notify**, poll `studio_status`, never await |
| All | ASCII inline now + the rest linked as they finish |
| Charts (marks *within* Playground / Infographic) | For sections with quantitative marks — **[3] Risk, [5] Impact, [6] Blast Radius** — pick the form via `/dataviz` (`choosing-a-form`) and the palette via its 6-check formula, then run `validate_palette.js`. On validator FAIL **or** `/dataviz` absent, fall back to the ASCII-card layout. Chrome stays ork tokens (§2 of `playground-visual-standard.md`); only the data marks come from the validated palette. See `${CLAUDE_PLUGIN_ROOT}/skills/shared/rules/chart-encoding-standard.md`. |

`<branch-dir>` = branch with `/` → `--` (same path the PR Playground gate checks). The filename is
**always `plan-viz.html`** — not `index.html`, not a topic name. One name is what makes slug lookup
and the artifact gallery work at all.

> **Playground archetype:** a plan visualization is usually a **DASHBOARD** — and as of 2026-08 that
> is a first-class archetype with a template, not a free pass. **Copy
> `skills/shared/assets/playground-exemplars/plan-dashboard.template.html` and swap the `plan-state`
> island**; do not free-hand the CSS. It ships the §2 tokens, a sticky tier-1 header, `<details>`
> sections `[0]`–`[5]`, a table twin per chart, the copy-prompt bar, and the reduced-motion gate.
> If the plan instead demonstrates a *user-facing flow* or a *prioritization/decision*, route to the
> **user-story-player** or **decision-board** archetype. Apply the §0 routing rule in
> `Read("${CLAUDE_PLUGIN_ROOT}/skills/shared/rules/playground-visual-standard.md")` and run its §10
> self-audit — including the DASHBOARD rows — before declaring done.
>
> **Backlog to dispatch?** If the plan is a backlog the user must prioritize **and route to execution**,
> use the **decision-router** variant — each card routes to an ork strategy and emits a plan-only
> invocation: `Read("${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/decision-router.md")`.
>
> **Living plan (multi-wave)?** If the plan executes over multiple sessions/waves, or completion is
> verifiable by commands, use the **living-plan** exemplar (`living-plan.template.html`): the playground
> embeds an `lpp-state` JSON block, every item carries a "done when" evidence check, and progress renders
> FROM state.
>
> **Update mode — detect by SLUG, never by path.** The path is derived from the branch name, so a branch
> rename moves it and a path-keyed check silently forks the plan into a second file. Run the finder
> BEFORE authoring:
>
> ```bash
> bash "$SKILL_DIR/scripts/find-living-plan.sh" "$SLUG"   # 0=update it · 1=author new · 2=already forked, STOP
> ```
>
> On exit 0, MERGE into the file it printed (flip statuses, append changelog, move removed items to
> dropped) wherever it lives. On exit 2, do not write a third file — name both paths and ask which
> survives. Full contract: `Read("${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/format-dispatch.md")`
> §Living-plan update mode. Gated by `tests/orphans/test-duplicate-living-plans.sh`.

---

## STEP 5: Offer Actions — the ONE question

This is the only blocking question in a default run, and it carries the format choice that used to
block at STEP 0.5. **Skip it entirely when `--quick`, or when the format was set by flag and there
is nothing left to offer.** Build the option list from what the STEP 0.5 probe actually found —
never offer a path that will fail.

```python
options = []
if "playground" in AVAILABLE and "playground" not in FORMATS:
    options.append({"label": "Interactive dashboard (Recommended)",
                    "description": "Single-file HTML at docs/<branch-dir>/plan-viz.html, from plan-dashboard.template.html. Also satisfies the PR Playground gate. Multi-wave plans become LIVING plans, updated in place."})
if "infographic" in AVAILABLE and "infographic" not in FORMATS:
    options.append({"label": "NotebookLM infographic",
                    "description": "Stakeholder-ready infographic/slides. Async — fired and notified, never blocks."})
options.append({"label": "Drill deeper",
                "description": "Blast radius, cross-layer consistency, or migration checklist"})
options.append({"label": "Generate GitHub issues",
                "description": "One issue per execution phase, with labels, milestone, and blocked-by links"})

# AskUserQuestion caps at 4 options. "Done" must ALWAYS survive that cap — an
# actions menu with no exit is a trap — so reserve its slot instead of appending.
DONE = {"label": "Done", "description": "Plan visualization complete"}
AskUserQuestion(questions=[{"question": "What next?", "header": "Actions",
                           "options": options[:3] + [DONE], "multiSelect": False}])
```

Anything squeezed out by the cap stays reachable by asking — the menu is a shortcut, not the
whole surface. `Write to designs/{branch}.md` (template: `assets/plan-report.md`) is one of these.

Upgrading reuses the plan brief built in STEP 1 — **no recomputation**
(see `references/format-dispatch.md`). If nothing richer is available, the question drops to
drill-deeper / issues / done.

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

---

## Deep Dives (Tier 3, on request)

Available when user selects "Drill deeper". Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/deep-dives.md")` for cross-layer and migration patterns.

| Section | What It Shows | Reference |
|---------|--------------|-----------|
| [6] Blast Radius | Concentric rings of impact (direct -> transitive -> tests) | (load `${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/blast-radius-patterns.md`) |
| [7] Cross-Layer Consistency | Frontend/backend endpoint alignment with gap detection | (load `${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/deep-dives.md`) |
| [8] Migration Checklist | Ordered runbook with sequential/parallel blocks and time estimates | (load `${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/deep-dives.md`) |

---

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
| section-rendering (load `${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/rules/section-rendering.md`) | HIGH | Rendering conventions for all 6 core sections ([0]–[5]) |
| ASCII diagrams | MEDIUM | Via `quickviz` skill (box-drawing, file trees, workflows) |

## References

Load on demand with `Read("${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/references/<file>")`:
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

## Examples (read one before your first run)

Complete worked runs — real input, real ASCII output, real emitted artifact. The ASCII patterns in
them match `references/*-patterns.md` exactly, so they are safe to imitate directly.

| File | Shows |
|------|-------|
| `examples/01-dashboard-run.md` | The default path end to end: detect → gather → header → all six sections → the one question → the emitted HTML. Same scenario as the sample state in `plan-dashboard.template.html`. |
| `examples/02-living-plan-update.md` | Update mode on a **renamed branch**: slug-keyed detection, the JSON merge, the evidence gate, and the exit-2 fork case. |
| `examples/03-quick-run.md` | `--quick`: what is skipped, what the output looks like, and what it must never fabricate. |

## Assets

Load on demand with `Read("${CLAUDE_PLUGIN_ROOT}/skills/visualize-plan/assets/<file>")`:
| File | Content |
|------|---------|
| `plan-report.md` | Full mustache-style report template |
| `impact-dashboard.md` | Impact table template |
| `tier1-header.md` | 5-line summary template |

## Quality Bar

Done means all of these hold:
- The Tier 1 header always renders with every field populated — risk, confidence, reversibility, branch, and file/line counts.
- File and line counts come from `scripts/analyze-impact.sh`, not estimated or guessed.
- Every rendered section answers its reviewer question; a section with no content is skipped with a one-line reason, never padded.
- **Section [3] names the point of no return by phase id** (`--- POINT OF NO RETURN (after P3) ---`), not by implication, and each pre-mortem states a **mechanism** — trigger, sequence, resulting bad state — not a category. "Migration risk" is a heading; "P2 ships while an in-flight retry queue still points at the inline charge path, so the same invoice is charged twice" is a pre-mortem. This is the section's measured failure mode, not a style preference: `rules/section-rendering.md` §[3] carries the falsifiable test for both.
- Section [0] Before/After maps base (`git show origin/main:<path>`) against head (working tree), marking each node `[+]`/`[~]`/`[-]`, and is skipped with a note when nothing structural changed.
- ASCII renders first/inline regardless of chosen format; any async format (infographic) is fired-and-notified, never awaited.
- The plan summary is stored to the memory knowledge graph for cross-session comparison (skipped under `--quick`).
- **Zero blocking questions before the first render.** Source is auto-detected (asked only when
  genuinely ambiguous), sections default to all, and format is chosen after the ASCII floor is
  already on screen — at most one question per run, none under `--quick`.
- A playground output started from `plan-dashboard.template.html` (or the living-plan / player /
  board exemplar the §0 routing rule selected) — never hand-rolled CSS — and passed the §10
  self-audit including the DASHBOARD rows.
- A living plan was located by **slug** via `scripts/find-living-plan.sh` before authoring, so an
  existing plan is updated in place rather than forked into a second file.

## Related Skills

- `ork:implement` - Execute planned changes
- `ork:explore` - Understand current architecture
- `ork:assess` - Evaluate complexity and risks
- `ork:memory` - Search prior plan visualizations
- `ork:remember` - Store plan decisions for future reference

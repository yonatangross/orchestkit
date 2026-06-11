---
description: "Design exploration using parallel agents through a 7-phase process: topic analysis, memory context, divergent ideation (10+ ideas), feasibility filtering, evaluation with devil's advocate scoring (0-10 across 7 dimensions), synthesis of top approaches, and trade-off comparison. Supports open exploration, constrained design, comparison, quick ideation, and iterative optimization modes. Use when brainstorming ideas, exploring solutions, or comparing alternatives."
allowed-tools: [AskUserQuestion, Task, Read, Grep, Glob, TaskCreate, TaskUpdate, TaskList, TaskStop, ToolSearch, PushNotification, mcp__memory__search_nodes]
---

# Auto-generated from skills/brainstorm/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Brainstorming Ideas Into Designs

Transform rough ideas into fully-formed designs through intelligent agent selection and structured exploration.

**Core principle:** Analyze the topic, select relevant agents dynamically, explore alternatives in parallel, present design incrementally.

## Argument Resolution

```python
TOPIC = "$ARGUMENTS"  # Full argument string, e.g., "API design for payments"
# $ARGUMENTS[0] is the first token (CC 2.1.59 indexed access)
```


## STEP -1: MCP Probe + Resume Check

Probe MCP servers once at skill start, store capabilities, and resume from any prior crashed session. Each phase emits a JSON handoff file consumed by the next.

Full procedure + handoff-file table: `Read("${CLAUDE_SKILL_DIR}/references/mcp-probe-resume.md")`


## STEP 0: Project Context Discovery

**BEFORE creating tasks or selecting agents**, detect the project tier. This becomes the **complexity ceiling** for all downstream decisions.

### Auto-Detection (scan codebase)

```python
# PARALLEL — quick signals (launch all in ONE message)
Grep(pattern="take-home|assignment|interview|hackathon", glob="README*", output_mode="content")
Grep(pattern="take-home|assignment|interview|hackathon", glob="*.md", output_mode="content")
Glob(pattern=".github/workflows/*")
Glob(pattern="**/Dockerfile")
Glob(pattern="**/terraform/**")
Glob(pattern="**/k8s/**")
Glob(pattern="CONTRIBUTING.md")
```

### Tier Classification

| Signal | Tier |
|--------|------|
| README says "take-home", "assignment", time limit | **1. Interview** |
| < 10 files, no CI, no Docker | **2. Hackathon** |
| `.github/workflows/`, 10-25 deps | **3. MVP** |
| Module boundaries, Redis, background jobs | **4. Growth** |
| K8s/Terraform, DDD structure, monorepo | **5. Enterprise** |
| CONTRIBUTING.md, LICENSE, minimal deps | **6. Open Source** |

**If confidence is low**, ask the user:

```python
AskUserQuestion(questions=[{
  "question": "What kind of project is this?",
  "header": "Project tier",
  "options": [
    {"label": "Interview / take-home", "description": "8-15 files, 200-600 LOC, simple architecture"},
    {"label": "Startup / MVP", "description": "MVC monolith, managed services, ship fast"},
    {"label": "Growth / enterprise", "description": "Modular monolith or DDD, full observability"},
    {"label": "Open source library", "description": "Minimal API surface, exhaustive tests"}
  ],
  "multiSelect": false
}])
```

**Pass the detected tier as context to ALL downstream agents and phases.** The tier constrains which patterns are appropriate — see `scope-appropriate-architecture` skill for the full matrix.

> **Override:** User can always override the detected tier. Warn them of trade-offs if they choose a higher tier than detected.


## STEP 0a: Verify User Intent with AskUserQuestion

**Clarify brainstorming constraints:**

```python
# NOTE: AskUserQuestion caps each question at 4 options (CC schema: minItems 2,
# maxItems 4). Use plain `label` + `description` only — the schema permits a
# `preview` field, but on current CC it forces a side-by-side picker layout with
# dead up/down keyboard nav (confirmed 2026-05-28), so skills no longer use it
# (`markdown` was never valid). The 6 legacy
# modes are split across 3 valid questions: Q1 = exploration flow, Q2 folds the
# old "Constrained design" mode into constraints, Q3 carries the orthogonal
# "Plan first" preamble (it composes with any Q1 mode — it was never mutually
# exclusive). "Quick ideation" + STEP 0c /effort=low overlap; both downscale.
AskUserQuestion(
  questions=[
    {
      "question": "What type of design exploration?",
      "header": "Mode",
      "options": [
        {"label": "Open exploration (Recommended)", "description": "Generate 10+ ideas, evaluate all, synthesize top 3"},
        {"label": "Comparison", "description": "Compare 2-3 specific approaches I have in mind"},
        {"label": "Quick ideation", "description": "Generate ideas fast, skip deep evaluation"},
        {"label": "Iterative optimization", "description": "Try, measure, keep/discard, repeat (autoresearch-style)"}
      ],
      "multiSelect": false
    },
    {
      "question": "Any preferences or constraints?",
      "header": "Constraints",
      "options": [
        {"label": "None", "description": "Explore all possibilities"},
        {"label": "Use existing patterns", "description": "Prefer patterns already in codebase"},
        {"label": "Minimize complexity", "description": "Favor simpler solutions"},
        {"label": "Fixed requirements (constrained)", "description": "Hard requirements to work within — skip divergent phase, focus on feasibility (old 'Constrained design' mode)"}
      ],
      "multiSelect": false
    },
    {
      "question": "Research before ideating?",
      "header": "Plan-first",
      "options": [
        {"label": "No — dive straight in (Recommended)", "description": "Go directly to ideation"},
        {"label": "Yes — plan first", "description": "Read-only research (EnterPlanMode): scan codebase, map the solution space, then ExitPlanMode for approval before Phase 1 (old 'Plan first' mode)"}
      ],
      "multiSelect": false
    }
  ]
)
```

**If Q3 = 'Yes — plan first' (composes with any Q1 mode):**

```python
# 1. Enter read-only plan mode
EnterPlanMode("Brainstorm exploration: $TOPIC")

# 2. Research phase — Read/Grep/Glob ONLY, no Write/Edit
#    - Scan existing codebase for related patterns
#    - Search for prior decisions on this topic (memory graph)
#    - Identify constraints, dependencies, and trade-offs

# 3. Produce structured exploration plan:
#    - Key questions to answer
#    - Dimensions to explore
#    - Agents to spawn and their focus areas
#    - Evaluation criteria

# 4. Exit plan mode — returns plan for user approval
ExitPlanMode()

# 5. User reviews. If approved → continue to Phase 1 with plan as input.
```

**Based on answers, adjust workflow:**
- **Open exploration** (Q1): Full 7-phase process with all agents
- **Comparison** (Q1): Skip ideation, jump to evaluation phase
- **Quick ideation** (Q1): Generate ideas, skip deep evaluation
- **Iterative optimization** (Q1): Skip phases 2-6, enter autoresearch-style loop (see below)
- **Constrained design** (Q2 = "Fixed requirements"): Skip divergent phase, focus on feasibility within the stated requirements — composes with any Q1 mode

**If 'Iterative optimization' selected:** skip Phases 2-6 and enter the autoresearch-style metric-driven loop.

Full sub-flow (metric question, baseline, loop body): `Read("${CLAUDE_SKILL_DIR}/references/iterative-optimization-mode.md")`


## STEP 0b: Select Orchestration Mode (skip for Tier 1-2)

Choose **Agent Teams** (mesh — agents debate and challenge ideas) or **Task tool** (star — all report to lead):

1. Agent Teams mode (GA since CC 2.1.33) → **recommended for 3+ agents** (real-time debate produces better ideas)
2. Task tool mode → **for quick ideation**
3. `ORCHESTKIT_FORCE_TASK_TOOL=1` → **Task tool** (override)

| Aspect | Task Tool | Agent Teams |
|--------|-----------|-------------|
| Idea generation | Each agent generates independently | Agents riff on each other's ideas |
| Devil's advocate | Lead challenges after all complete | Agents challenge each other in real-time |
| Cost | ~150K tokens | ~400K tokens |
| Best for | Quick ideation, constrained design | Open exploration, deep evaluation |

> **Fallback:** If Agent Teams encounters issues, fall back to Task tool for remaining phases.


## STEP 0c: Effort-Aware Phase Scaling (CC 2.1.76; `xhigh` added in 2.1.111)

Read the `/effort` setting and scale brainstorm depth — `low` runs phases 0/2/5 only, `high` (default) runs all 7, `xhigh` adds extra devil's-advocate and synthesis rounds. Explicit user choice in STEP 0a always overrides downscaling.

Full level table + detection rules: `Read("${CLAUDE_SKILL_DIR}/references/effort-scaling.md")`


## 🚨 CRITICAL: Task Management is MANDATORY (CC 2.1.16)

```python
# 1. Create main task IMMEDIATELY
TaskCreate(
  subject="Brainstorm: {topic}",
  description="Design exploration with parallel agent research",
  activeForm="Brainstorming {topic}"
)

# 2. Create subtasks for each phase
TaskCreate(subject="Analyze topic and select agents", activeForm="Analyzing topic")          # id=2
TaskCreate(subject="Search memory for past decisions", activeForm="Searching knowledge graph") # id=3
TaskCreate(subject="Generate divergent ideas (10+)", activeForm="Generating ideas")          # id=4
TaskCreate(subject="Feasibility fast-check", activeForm="Checking feasibility")              # id=5
TaskCreate(subject="Evaluate with devil's advocate", activeForm="Evaluating ideas")          # id=6
TaskCreate(subject="Synthesize top approaches", activeForm="Synthesizing approaches")        # id=7
TaskCreate(subject="Present design options", activeForm="Presenting options")                # id=8

# 3. Set dependencies (sequential chain: 2→3→4→5→6→7→8)
for i in range(3, 9):
    TaskUpdate(taskId=str(i), addBlockedBy=[str(i-1)])

# 4. Before starting each task, verify it's unblocked
task = TaskGet(taskId="2")  # Verify blockedBy is empty
# 5. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask
```


## 🔄 The Seven-Phase Process

| Phase | Activities | Output |
|-------|------------|--------|
| **0. Topic Analysis** | Classify keywords, select 3-5 agents | Agent list |
| **1. Memory + Context** | Search graph, check codebase, read experiment journal | Prior patterns |
| **2. Divergent Exploration** | Generate 10+ ideas WITHOUT filtering | Idea pool |
| **3. Keep/Discard Gate** | Binary viability: keep, discard, or crash (10s per idea) | Survivors only |
| **4. Evaluation & Rating** | Rate 0-10 (7 dimensions incl. **simplicity**), devil's advocate | Ranked ideas |
| **5. Synthesis** | Filter to top 2-3, trade-off table, **test strategy per approach** | Options |
| **6. Design Presentation** | Present in 200-300 word sections, log to experiment journal | Validated design |
| **6.5. Audio Podcast** (signal-fired, optional) | Auto-emit `brainstorm-podcast.m4a` when composite≥8.0 + approaches≥4 | `.m4a` file |

### Phase 6.5 — Post-synthesis audio podcast (signal-fired, optional)

After Phase 6 lands, optionally invoke `scripts/post_synth_podcast.py <session-dir>` to auto-emit an audio podcast summarizing the top approaches + trade-offs. Self-skips on every non-happy-path so it never breaks the brainstorm:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/post_synth_podcast.py "$CLAUDE_JOB_DIR"
```

Auto-skip conditions (all exit 0, all WARN-logged):

| Skip reason | Trigger |
|-------------|---------|
| `signal absent` | `composite[recommended] < 8.0` OR `len(approaches) < 4` |
| `design-doc.md not found` | Phase 6 didn't write a design doc to the session dir |
| `yg-mcp-core not importable` | `yg-mcp-core>=0.3.0` not installed (orchestkit is public; yg-mcp-core lives on private `pypi.yonyon.ai` — HQ-only) |
| `hq-content MCP unreachable` | MCP server down OR `.mcp.json` doesn't define `hq-content` |

Session dir must contain `brainstorm-output.json` (with `recommended`, `composite`, `approaches`) + `design-doc.md`. Handoff JSON at `<session-dir>/brainstorm-podcast.json` records `status` (`fired` / `skipped`) and `m4a_path` on success.

Mirrors `Yonatan-HQ/hq-ext-plugin#194` (audio_podcast handler for `/hq-ext:decide`).

### Progressive Output (CC 2.1.76)

Output results **incrementally** after each phase — don't batch everything until the end:

| After Phase | Show User |
|-------------|-----------|
| 0. Topic Analysis | Selected agents, tier classification |
| 1. Memory + Context | Prior decisions, relevant patterns, experiment journal summary |
| 2. Divergent Exploration | Each agent's ideas as they return (don't wait for all) |
| 3. Keep/Discard Gate | Survivors and discard reasons (keep/discard/crash per idea) |
| 4. Evaluation | Top-rated ideas with 7-dimension scores |

For Phase 2 parallel agents, output each agent's ideas **as soon as it returns** — don't wait for all agents. This lets users see early ideas and redirect the exploration if needed. Showing ideas incrementally also helps users build a mental model of the solution space faster than a final dump.

Load the phase workflow for detailed instructions:
```
Read("${CLAUDE_SKILL_DIR}/references/phase-workflow.md")
```


## ⚠️ When NOT to Use

Skip brainstorming when:
- Requirements are crystal clear and specific
- Only one obvious approach exists
- User has already designed the solution
- Time-sensitive bug fix or urgent issue


## Quick Reference: Agent Selection

| Topic Example | Agents to Spawn |
|---------------|-----------------|
| "brainstorm API for users" | workflow-architect, backend-system-architect, security-auditor, **test-generator** |
| "brainstorm dashboard UI" | workflow-architect, frontend-ui-developer, **test-generator** |
| "brainstorm RAG pipeline" | workflow-architect, llm-integrator, data-pipeline-engineer, **test-generator** |
| "brainstorm caching strategy" | workflow-architect, backend-system-architect, frontend-performance-engineer, **test-generator** |
| "brainstorm design system" | workflow-architect, frontend-ui-developer, design-context-extractor, component-curator, **test-generator** |
| "brainstorm event sourcing" | workflow-architect, event-driven-architect, backend-system-architect, **test-generator** |
| "brainstorm pricing strategy" | workflow-architect, product-strategist, web-research-analyst, **test-generator** |
| "brainstorm deploy pipeline" | workflow-architect, infrastructure-architect, ci-cd-engineer, **test-generator** |

**Always include:** `workflow-architect` for system design perspective, `test-generator` for testability assessment.


## Agent Teams Alternative: Brainstorming Team

In Agent Teams mode, form a brainstorming team where agents debate ideas in real-time. Dynamically select teammates based on topic analysis (Phase 0):

```python
TeamCreate(team_name="brainstorm-{topic-slug}", description="Brainstorm {topic}")

# Always include the system design lead
Agent(subagent_type="ork:workflow-architect", name="system-designer",
     team_name="brainstorm-{topic-slug}",
     prompt="""You are the system design lead for brainstorming: {topic}
     DIVERGENT MODE: Generate 3-4 architectural approaches.
     When other teammates share ideas, build on them or propose alternatives.
     Challenge ideas that seem over-engineered — advocate for simplicity.
     After divergent phase, help synthesize the top approaches.""")

# Domain-specific teammates (select 2-3 based on topic keywords)
Agent(subagent_type="ork:backend-system-architect", name="backend-thinker",
     team_name="brainstorm-{topic-slug}",
     prompt="""Brainstorm backend approaches for: {topic}
     DIVERGENT MODE: Generate 3-4 backend-specific ideas.
     When system-designer shares architectural ideas, propose concrete API designs.
     Challenge ideas from other teammates with implementation reality checks.
     Play devil's advocate on complexity vs simplicity trade-offs.""")

Agent(subagent_type="ork:frontend-ui-developer", name="frontend-thinker",
     team_name="brainstorm-{topic-slug}",
     prompt="""Brainstorm frontend approaches for: {topic}
     DIVERGENT MODE: Generate 3-4 UI/UX ideas.
     When backend-thinker proposes APIs, suggest frontend patterns that match.
     Challenge backend proposals that create poor user experiences.
     Advocate for progressive disclosure and accessibility.""")

# Always include: testability assessor
Agent(subagent_type="ork:test-generator", name="testability-assessor",
     team_name="brainstorm-{topic-slug}",
     prompt="""Assess testability for each brainstormed approach: {topic}
     For every idea shared by teammates, evaluate:
     - Can core logic be unit tested without external services?
     - What's the mock/stub surface area?
     - Can it be integration-tested with docker-compose/testcontainers?
     Score testability 0-10 per the evaluation rubric.
     Challenge designs that score below 5 on testability.
     Propose test strategies for the top approaches in synthesis phase.""")

# Optional: Add security-auditor, llm-integrator based on topic
```

**Key advantage:** Agents riff on each other's ideas and play devil's advocate in real-time, rather than generating ideas in isolation.

**Fork pattern (CC 2.1.89 — #1227):** All brainstorm agents are fork-eligible: prompts are <500 words, no custom model, no worktree. CC shares the parent's cached API prefix across forks, reducing cost by ~60%. Do NOT add `model=` to agent calls. See `chain-patterns/references/fork-pattern.md`.

> **Nested delegation (CC 2.1.172+):** Teammates MAY be instructed to delegate a bounded sub-question to their declared sub-agents (e.g. backend-thinker → database-engineer to sanity-check a schema idea) instead of guessing inline. Keep chains ≤ 3 levels deep; divergent ideation itself stays flat — the parallel teammates above ARE the fan-out for independent ideas. See chain-patterns Pattern 9 (CC 2.1.172+).

**Team teardown** after synthesis:
```python
# After Phase 5 synthesis and design presentation
# TeamDelete() gracefully shuts down all teammates — no manual shutdown_request
# needed. (SendMessage params are {to, message, summary}; CC discourages
# originating shutdown_request, and TeamDelete supersedes it.)
TeamDelete()

# Worktree cleanup (CC 2.1.72) — for Tier 3+ projects that entered a worktree
# If EnterWorktree was called during brainstorm (e.g., Plan first → worktree), exit it
ExitWorktree(action="keep")  # Keep branch for follow-up /ork:implement
```

> **Fallback:** If team formation fails, load `Read("${CLAUDE_SKILL_DIR}/references/phase-workflow.md")` and use standard Phase 2 Task spawns.

> **Partial results (CC 2.1.76):** Background agents that are killed (timeout, context limit) return responses tagged with `[PARTIAL RESULT]`. When collecting Phase 2 divergent ideas, check each agent's output for this tag. If present, include the partial ideas but note them as incomplete in Phase 3 feasibility. Prefer synthesizing partial results over re-spawning agents.

> **PostCompact recovery:** Long brainstorm sessions may trigger context compaction. The PostCompact hook re-injects branch and task state. If compaction occurs mid-brainstorm, check `.claude/chain/state.json` for the last completed phase and resume from the next handoff file (see Phase Handoffs table). Reactive compaction (CC 2.1.142+) now sizes the first summarize to the actual overflow, so mid-turn stalls are rare — no need to expect a second pass.

> **When context fills (CC 2.1.141+):** Instead of ending the session, use the rewind menu's "Summarize up to here" to compress earlier turns while keeping recent context intact — a deliberate compaction point that pairs with the improved reactive compaction above.

> **Session recap (CC 2.1.108+):** After idle periods, use `/recap` to restore conversational context alongside checkpoint-resume. Enabled by default since CC 2.1.110 (even with telemetry disabled).

> **Push notifications (CC 2.1.110+):** For long brainstorm sessions, use `PushNotification` to alert when synthesis is complete (requires Remote Control with "Push when Claude decides").
>
> **Lighter alternative (CC 2.1.141+):** Hooks can emit desktop notifications, window titles, and bells natively via the `terminalSequence` field in hook JSON output — no Remote Control required, no Anthropic round-trip. See #1847 for the migration of ork's existing notification hooks.

> **Manual cleanup:** If `TeamDelete()` doesn't terminate all agents, press `Ctrl+F` twice to force-stop remaining background agents. Note: `/clear` (CC 2.1.72+) preserves background agents — only foreground tasks are cleared.


## Key Principles

| Principle | Application |
|-----------|-------------|
| **Dynamic agent selection** | Select agents based on topic keywords |
| **Parallel research** | Launch 3-5 agents in ONE message |
| **Memory-first** | Check graph for past decisions before research |
| **Divergent-first** | Generate 10+ ideas BEFORE filtering |
| **Task tracking** | Use TaskCreate/TaskUpdate for progress visibility |
| **YAGNI ruthlessly** | Remove unnecessary complexity |


## Running unattended with /goal

Set a completion condition with `/goal` (CC 2.1.139+, **2.1.143+ recommended for this skill**) and this skill will keep working across turns until the condition is met. Works in interactive, `-p`, and Remote Control. The overlay panel shows live elapsed / turns / tokens.

> **Why 2.1.143+:** Pre-2.1.143 `/goal` evaluator could fire while background shells or delegated subagents were still running — racing the parallel agents this skill spawns in Phase 2. Fixed in CC 2.1.143 (changelog: "`/goal` evaluator firing while background shells or delegated subagents are still running").

**Example completion condition for this skill:**

```
/goal until design.options_count >= 2 AND user_chose_option
```

Stops when: 2+ ranked design options presented and the user selects one (or after Phase 6 if running unattended via -p). Compatible with claude.ai Remote Control runs.


## 📜 Related Skills

- `ork:architecture-decision-record` - Document key decisions made during brainstorming
- `ork:implement` - Execute the implementation plan after brainstorming completes
- `ork:explore` - Deep codebase exploration to understand existing patterns
- `ork:assess` - Rate quality 0-10 with dimension breakdown
- `ork:design-to-code` - Convert brainstormed UI designs into components
- `ork:component-search` - Find existing components before building new ones
- `ork:competitive-analysis` - Porter's Five Forces, SWOT for product brainstorms

## Picker fallback (#1795)

The picker stall reported in orchestkit#1795 was a **schema break, not a CC input bug**: questions with >4 options or a `markdown` field (the `markdown` key is not valid — the schema field is `preview`) fail `AskUserQuestion` validation, so the picker never renders. All skill questions conform to the schema (2–4 options, no `preview` on multiSelect), enforced by `tests/skills/structure/test-askuserquestion-schema.sh`. Separately, although the schema *permits* a `preview` field, current CC renders any question that uses one in a side-by-side picker layout where ↑/↓ keyboard navigation is dead (confirmed 2026-05-28). So skills now standardize on plain `label` + `description` only and no longer set `preview`. If you still hit a stall on a future CC build, `ORK_ASK_FALLBACK=text` remains as a defensive opt-in: the `lifecycle/ask-fallback-injector` hook then tells the assistant to pose options inline as a numbered list. Hook propagates globally — no per-skill edit needed.

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:

| File | Content |
|------|---------|
| `phase-workflow.md` | Detailed 7-phase instructions |
| `divergent-techniques.md` | SCAMPER, Mind Mapping, etc. |
| `evaluation-rubric.md` | 0-10 scoring criteria |
| `devils-advocate-prompts.md` | Challenge templates |
| `socratic-questions.md` | Requirements discovery |
| `common-pitfalls.md` | Mistakes to avoid |
| `example-session-dashboard.md` | Complete example |
| `mcp-probe-resume.md` | STEP -1 probe + resume + handoff-file table |
| `iterative-optimization-mode.md` | Autoresearch-style metric loop sub-flow |
| `effort-scaling.md` | `/effort` levels and phase scaling rules |

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
    {"label": "Interview / take-home", "description": "8-15 files, 200-600 LOC, simple architecture", "markdown": "```\nTier 1: Interview / Take-Home\n─────────────────────────────\nFiles:    8-15 max\nLOC:      200-600\nArch:     Flat structure, no abstractions\nPatterns: Direct imports, inline logic\nTests:    Unit only, co-located\n```"},
    {"label": "Startup / MVP", "description": "MVC monolith, managed services, ship fast", "markdown": "```\nTier 3: Startup / MVP\n─────────────────────\nArch:     MVC monolith\nDB:       Managed (RDS/Supabase)\nCI:       GitHub Actions (1-2 workflows)\nPatterns: Service layer, repository pattern\nDeploy:   Vercel / Railway / Fly.io\n```"},
    {"label": "Growth / enterprise", "description": "Modular monolith or DDD, full observability", "markdown": "```\nTier 4-5: Growth / Enterprise\n─────────────────────────────\nArch:     Modular monolith or DDD\nInfra:    K8s, Terraform, Redis, queues\nCI:       Multi-stage pipelines\nPatterns: Hexagonal, CQRS, event-driven\nObserve:  Structured logging, tracing\n```"},
    {"label": "Open source library", "description": "Minimal API surface, exhaustive tests", "markdown": "```\nTier 6: Open Source Library\n──────────────────────────\nAPI:      Minimal public surface\nTests:    100% coverage, property-based\nDocs:     README, API docs, examples\nCI:       Matrix builds, release automation\nPatterns: Semver, CONTRIBUTING.md\n```"}
  ],
  "multiSelect": false
}])
```

**Pass the detected tier as context to ALL downstream agents and phases.** The tier constrains which patterns are appropriate — see `scope-appropriate-architecture` skill for the full matrix.

> **Override:** User can always override the detected tier. Warn them of trade-offs if they choose a higher tier than detected.


## STEP 0a: Verify User Intent with AskUserQuestion

**Clarify brainstorming constraints:**

```python
AskUserQuestion(
  questions=[
    {
      "question": "What type of design exploration?",
      "header": "Type",
      "options": [
        {"label": "Open exploration (Recommended)", "description": "Generate 10+ ideas, evaluate all, synthesize top 3", "markdown": "```\nOpen Exploration (7 phases)\n──────────────────────────\n  Diverge        Evaluate       Synthesize\n  ┌─────┐       ┌─────┐       ┌─────┐\n  │ 10+ │──────▶│Rate │──────▶│Top 3│\n  │ideas│       │0-10 │       │picks│\n  └─────┘       └─────┘       └─────┘\n  3-5 agents    Devil's        Trade-off\n  in parallel   advocate       table\n```"},
        {"label": "Constrained design", "description": "I have specific requirements to work within", "markdown": "```\nConstrained Design\n──────────────────\n  Requirements ──▶ Feasibility ──▶ Design\n  ┌──────────┐    ┌──────────┐    ┌──────┐\n  │ Fixed    │    │ Check    │    │ Best │\n  │ bounds   │    │ fit      │    │ fit  │\n  └──────────┘    └──────────┘    └──────┘\n  Skip divergent phase, focus on\n  feasibility within constraints\n```"},
        {"label": "Comparison", "description": "Compare 2-3 specific approaches I have in mind", "markdown": "```\nComparison Mode\n───────────────\n  Approach A ──┐\n  Approach B ──┼──▶ Rate 0-10 ──▶ Winner\n  Approach C ──┘    (6 dims)\n\n  Skip ideation, jump straight\n  to evaluation + trade-off table\n```"},
        {"label": "Quick ideation", "description": "Generate ideas fast, skip deep evaluation", "markdown": "```\nQuick Ideation\n──────────────\n  Braindump ──▶ Light filter ──▶ List\n  ┌────────┐   ┌────────────┐   ┌────┐\n  │ 10+    │   │ Viable?    │   │ 5-7│\n  │ ideas  │   │ Y/N only   │   │ out│\n  └────────┘   └────────────┘   └────┘\n  Fast pass, no deep scoring\n```"},
        {"label": "Plan first", "description": "Structured exploration before generating ideas", "markdown": "```\nPlan Mode Exploration\n─────────────────────\n  1. EnterPlanMode($TOPIC)\n  2. Analyze constraints\n  3. Research precedents\n  4. Map solution space\n  5. ExitPlanMode → options\n  6. User picks direction\n  7. Deep dive on chosen path\n\n  Best for: Architecture,\n  design systems, trade-offs\n```"},
        {"label": "Iterative optimization", "description": "Try, measure, keep/discard, repeat (autoresearch-style)", "markdown": "```\nIterative Optimization (autoresearch-style)\n───────────────────────────────────────────\n  ┌──────────┐\n  │ Baseline │──measure──┐\n  └──────────┘           │\n       ┌─────────────────┘\n       ▼\n  ┌─────────┐  ┌─────────┐  ┌──────────┐\n  │ Try     │─▶│ Measure │─▶│ Keep or  │─┐\n  │ variant │  │ metric  │  │ Discard  │ │\n  └─────────┘  └─────────┘  └──────────┘ │\n       ▲                                 │\n       └─────────────────────────────────┘\n  Requires: one command + one metric\n  Runs until: user interrupts or plateau\n```"}
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
        {"label": "I'll specify", "description": "Let me provide specific constraints"}
      ],
      "multiSelect": false
    }
  ]
)
```

**If 'Plan first' selected:**

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
- **Open exploration**: Full 7-phase process with all agents
- **Constrained design**: Skip divergent phase, focus on feasibility
- **Comparison**: Skip ideation, jump to evaluation phase
- **Quick ideation**: Generate ideas, skip deep evaluation
- **Iterative optimization**: Skip phases 2-6, enter autoresearch-style loop (see below)

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


## CRITICAL: Task Management is MANDATORY (CC 2.1.16)

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


## The Seven-Phase Process

| Phase | Activities | Output |
|-------|------------|--------|
| **0. Topic Analysis** | Classify keywords, select 3-5 agents | Agent list |
| **1. Memory + Context** | Search graph, check codebase, read experiment journal | Prior patterns |
| **2. Divergent Exploration** | Generate 10+ ideas WITHOUT filtering | Idea pool |
| **3. Keep/Discard Gate** | Binary viability: keep, discard, or crash (10s per idea) | Survivors only |
| **4. Evaluation & Rating** | Rate 0-10 (7 dimensions incl. **simplicity**), devil's advocate | Ranked ideas |
| **5. Synthesis** | Filter to top 2-3, trade-off table, **test strategy per approach** | Options |
| **6. Design Presentation** | Present in 200-300 word sections, log to experiment journal | Validated design |

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


## When NOT to Use

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
Agent(subagent_type="workflow-architect", name="system-designer",
     team_name="brainstorm-{topic-slug}",
     prompt="""You are the system design lead for brainstorming: {topic}
     DIVERGENT MODE: Generate 3-4 architectural approaches.
     When other teammates share ideas, build on them or propose alternatives.
     Challenge ideas that seem over-engineered — advocate for simplicity.
     After divergent phase, help synthesize the top approaches.""")

# Domain-specific teammates (select 2-3 based on topic keywords)
Agent(subagent_type="backend-system-architect", name="backend-thinker",
     team_name="brainstorm-{topic-slug}",
     prompt="""Brainstorm backend approaches for: {topic}
     DIVERGENT MODE: Generate 3-4 backend-specific ideas.
     When system-designer shares architectural ideas, propose concrete API designs.
     Challenge ideas from other teammates with implementation reality checks.
     Play devil's advocate on complexity vs simplicity trade-offs.""")

Agent(subagent_type="frontend-ui-developer", name="frontend-thinker",
     team_name="brainstorm-{topic-slug}",
     prompt="""Brainstorm frontend approaches for: {topic}
     DIVERGENT MODE: Generate 3-4 UI/UX ideas.
     When backend-thinker proposes APIs, suggest frontend patterns that match.
     Challenge backend proposals that create poor user experiences.
     Advocate for progressive disclosure and accessibility.""")

# Always include: testability assessor
Agent(subagent_type="test-generator", name="testability-assessor",
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

**Team teardown** after synthesis:
```python
# After Phase 5 synthesis and design presentation
SendMessage(type="shutdown_request", recipient="system-designer", content="Brainstorm complete")
SendMessage(type="shutdown_request", recipient="backend-thinker", content="Brainstorm complete")
SendMessage(type="shutdown_request", recipient="frontend-thinker", content="Brainstorm complete")
SendMessage(type="shutdown_request", recipient="testability-assessor", content="Brainstorm complete")
# ... shutdown any additional domain teammates
TeamDelete()

# Worktree cleanup (CC 2.1.72) — for Tier 3+ projects that entered a worktree
# If EnterWorktree was called during brainstorm (e.g., Plan first → worktree), exit it
ExitWorktree(action="keep")  # Keep branch for follow-up /ork:implement
```

> **Fallback:** If team formation fails, load `Read("${CLAUDE_SKILL_DIR}/references/phase-workflow.md")` and use standard Phase 2 Task spawns.

> **Partial results (CC 2.1.76):** Background agents that are killed (timeout, context limit) return responses tagged with `[PARTIAL RESULT]`. When collecting Phase 2 divergent ideas, check each agent's output for this tag. If present, include the partial ideas but note them as incomplete in Phase 3 feasibility. Prefer synthesizing partial results over re-spawning agents.

> **PostCompact recovery:** Long brainstorm sessions may trigger context compaction. The PostCompact hook re-injects branch and task state. If compaction occurs mid-brainstorm, check `.claude/chain/state.json` for the last completed phase and resume from the next handoff file (see Phase Handoffs table).

> **Session recap (CC 2.1.108+):** After idle periods, use `/recap` to restore conversational context alongside checkpoint-resume. Enabled by default since CC 2.1.110 (even with telemetry disabled).

> **Push notifications (CC 2.1.110+):** For long brainstorm sessions, use `PushNotification` to alert when synthesis is complete (requires Remote Control with "Push when Claude decides").

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

Set a completion condition with `/goal` (CC 2.1.139+) and this skill will keep working across turns until the condition is met. Works in interactive, `-p`, and Remote Control. The overlay panel shows live elapsed / turns / tokens.

**Example completion condition for this skill:**

```
/goal until design.options_count >= 2 AND user_chose_option
```

Stops when: 2+ ranked design options presented and the user selects one (or after Phase 6 if running unattended via -p). Compatible with claude.ai Remote Control runs.


## Related Skills

- `ork:architecture-decision-record` - Document key decisions made during brainstorming
- `ork:implement` - Execute the implementation plan after brainstorming completes
- `ork:explore` - Deep codebase exploration to understand existing patterns
- `ork:assess` - Rate quality 0-10 with dimension breakdown
- `ork:design-to-code` - Convert brainstormed UI designs into components
- `ork:component-search` - Find existing components before building new ones
- `ork:competitive-analysis` - Porter's Five Forces, SWOT for product brainstorms

## Picker fallback (#1795)

If the `AskUserQuestion` picker stalls (CC 2.1.139 input bug — orchestkit#1795), set `ORK_ASK_FALLBACK=text` before starting CC. The `lifecycle/ask-fallback-injector` hook injects a reminder telling the assistant to pose options inline as a numbered list and ask the user to reply with the option number. Hook propagates globally — no per-skill edit needed once set.

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

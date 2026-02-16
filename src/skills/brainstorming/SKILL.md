---
name: brainstorming
license: MIT
compatibility: "Claude Code 2.1.34+. Requires memory MCP server."
description: "Design exploration with parallel agents. Use when brainstorming ideas, exploring solutions, or comparing alternatives."
argument-hint: "[topic-or-idea]"
tags: [planning, ideation, creativity, design]
context: fork
version: 4.2.0
author: OrchestKit
user-invocable: true
allowed-tools: [AskUserQuestion, Task, Read, Grep, Glob, TaskCreate, TaskUpdate, TaskList, mcp__memory__search_nodes]
skills: [architecture-decision-record, api-design, design-system-starter, memory, remember, assess-complexity, scope-appropriate-architecture, testing-patterns]
complexity: medium
metadata:
  category: workflow-automation
  mcp-server: memory
---

# Brainstorming Ideas Into Designs

Transform rough ideas into fully-formed designs through intelligent agent selection and structured exploration.

**Core principle:** Analyze the topic, select relevant agents dynamically, explore alternatives in parallel, present design incrementally.

---

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

---

## STEP 0a: Verify User Intent with AskUserQuestion

**Clarify brainstorming constraints:**

```python
AskUserQuestion(
  questions=[
    {
      "question": "What type of design exploration?",
      "header": "Type",
      "options": [
        {"label": "Open exploration (Recommended)", "description": "Generate 10+ ideas, evaluate all, synthesize top 3"},
        {"label": "Constrained design", "description": "I have specific requirements to work within"},
        {"label": "Comparison", "description": "Compare 2-3 specific approaches I have in mind"},
        {"label": "Quick ideation", "description": "Generate ideas fast, skip deep evaluation"}
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

**Based on answers, adjust workflow:**
- **Open exploration**: Full 7-phase process with all agents
- **Constrained design**: Skip divergent phase, focus on feasibility
- **Comparison**: Skip ideation, jump to evaluation phase
- **Quick ideation**: Generate ideas, skip deep evaluation

---

## STEP 0b: Select Orchestration Mode (skip for Tier 1-2)

Choose **Agent Teams** (mesh — agents debate and challenge ideas) or **Task tool** (star — all report to lead):

1. `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` → **Agent Teams mode**
2. Agent Teams unavailable → **Task tool mode** (default)
3. Otherwise: Open exploration with 3+ agents → recommend **Agent Teams** (real-time debate produces better ideas); Quick ideation → **Task tool**

| Aspect | Task Tool | Agent Teams |
|--------|-----------|-------------|
| Idea generation | Each agent generates independently | Agents riff on each other's ideas |
| Devil's advocate | Lead challenges after all complete | Agents challenge each other in real-time |
| Cost | ~150K tokens | ~400K tokens |
| Best for | Quick ideation, constrained design | Open exploration, deep evaluation |

> **Fallback:** If Agent Teams encounters issues, fall back to Task tool for remaining phases.

---

## CRITICAL: Task Management is MANDATORY (CC 2.1.16)

```python
# Create main task IMMEDIATELY
TaskCreate(
  subject="Brainstorm: {topic}",
  description="Design exploration with parallel agent research",
  activeForm="Brainstorming {topic}"
)

# Create subtasks for each phase
TaskCreate(subject="Analyze topic and select agents", activeForm="Analyzing topic")
TaskCreate(subject="Search memory for past decisions", activeForm="Searching knowledge graph")
TaskCreate(subject="Generate divergent ideas (10+)", activeForm="Generating ideas")
TaskCreate(subject="Feasibility fast-check", activeForm="Checking feasibility")
TaskCreate(subject="Evaluate with devil's advocate", activeForm="Evaluating ideas")
TaskCreate(subject="Synthesize top approaches", activeForm="Synthesizing approaches")
TaskCreate(subject="Present design options", activeForm="Presenting options")
```

---

## The Seven-Phase Process

| Phase | Activities | Output |
|-------|------------|--------|
| **0. Topic Analysis** | Classify keywords, select 3-5 agents | Agent list |
| **1. Memory + Context** | Search graph, check codebase | Prior patterns |
| **2. Divergent Exploration** | Generate 10+ ideas WITHOUT filtering | Idea pool |
| **3. Feasibility Fast-Check** | 30-second viability per idea, **including testability** | Filtered ideas |
| **4. Evaluation & Rating** | Rate 0-10 (6 dimensions incl. **testability**), devil's advocate | Ranked ideas |
| **5. Synthesis** | Filter to top 2-3, trade-off table, **test strategy per approach** | Options |
| **6. Design Presentation** | Present in 200-300 word sections, **include test plan** | Validated design |

See `references/phase-workflow.md` for detailed instructions.

---

## When NOT to Use

Skip brainstorming when:
- Requirements are crystal clear and specific
- Only one obvious approach exists
- User has already designed the solution
- Time-sensitive bug fix or urgent issue

---

## Quick Reference: Agent Selection

| Topic Example | Agents to Spawn |
|---------------|-----------------|
| "brainstorm API for users" | workflow-architect, backend-system-architect, security-auditor, **test-generator** |
| "brainstorm dashboard UI" | workflow-architect, frontend-ui-developer, ux-researcher, **test-generator** |
| "brainstorm RAG pipeline" | workflow-architect, llm-integrator, data-pipeline-engineer, **test-generator** |
| "brainstorm caching strategy" | workflow-architect, backend-system-architect, frontend-performance-engineer, **test-generator** |

**Always include:** `workflow-architect` for system design perspective, `test-generator` for testability assessment.

---

## Agent Teams Alternative: Brainstorming Team

In Agent Teams mode, form a brainstorming team where agents debate ideas in real-time. Dynamically select teammates based on topic analysis (Phase 0):

```python
TeamCreate(team_name="brainstorm-{topic-slug}", description="Brainstorm {topic}")

# Always include the system design lead
Task(subagent_type="workflow-architect", name="system-designer",
     team_name="brainstorm-{topic-slug}",
     prompt="""You are the system design lead for brainstorming: {topic}
     DIVERGENT MODE: Generate 3-4 architectural approaches.
     When other teammates share ideas, build on them or propose alternatives.
     Challenge ideas that seem over-engineered — advocate for simplicity.
     After divergent phase, help synthesize the top approaches.""")

# Domain-specific teammates (select 2-3 based on topic keywords)
Task(subagent_type="backend-system-architect", name="backend-thinker",
     team_name="brainstorm-{topic-slug}",
     prompt="""Brainstorm backend approaches for: {topic}
     DIVERGENT MODE: Generate 3-4 backend-specific ideas.
     When system-designer shares architectural ideas, propose concrete API designs.
     Challenge ideas from other teammates with implementation reality checks.
     Play devil's advocate on complexity vs simplicity trade-offs.""")

Task(subagent_type="frontend-ui-developer", name="frontend-thinker",
     team_name="brainstorm-{topic-slug}",
     prompt="""Brainstorm frontend approaches for: {topic}
     DIVERGENT MODE: Generate 3-4 UI/UX ideas.
     When backend-thinker proposes APIs, suggest frontend patterns that match.
     Challenge backend proposals that create poor user experiences.
     Advocate for progressive disclosure and accessibility.""")

# Always include: testability assessor
Task(subagent_type="test-generator", name="testability-assessor",
     team_name="brainstorm-{topic-slug}",
     prompt="""Assess testability for each brainstormed approach: {topic}
     For every idea shared by teammates, evaluate:
     - Can core logic be unit tested without external services?
     - What's the mock/stub surface area?
     - Can it be integration-tested with docker-compose/testcontainers?
     Score testability 0-10 per the evaluation rubric.
     Challenge designs that score below 5 on testability.
     Propose test strategies for the top approaches in synthesis phase.""")

# Optional: Add security-auditor, ux-researcher, llm-integrator based on topic
```

**Key advantage:** Agents riff on each other's ideas and play devil's advocate in real-time, rather than generating ideas in isolation.

**Team teardown** after synthesis:
```python
# After Phase 5 synthesis and design presentation
SendMessage(type="shutdown_request", recipient="system-designer", content="Brainstorm complete")
SendMessage(type="shutdown_request", recipient="backend-thinker", content="Brainstorm complete")
SendMessage(type="shutdown_request", recipient="frontend-thinker", content="Brainstorm complete")
SendMessage(type="shutdown_request", recipient="testability-assessor", content="Brainstorm complete")
# ... shutdown any additional domain teammates
TeamDelete()
```

> **Fallback:** If team formation fails, use standard Phase 2 Task spawns from [Phase Workflow](references/phase-workflow.md).

---

## Key Principles

| Principle | Application |
|-----------|-------------|
| **Dynamic agent selection** | Select agents based on topic keywords |
| **Parallel research** | Launch 3-5 agents in ONE message |
| **Memory-first** | Check graph for past decisions before research |
| **Divergent-first** | Generate 10+ ideas BEFORE filtering |
| **Task tracking** | Use TaskCreate/TaskUpdate for progress visibility |
| **YAGNI ruthlessly** | Remove unnecessary complexity |

---

## Related Skills

- `architecture-decision-record` - Document key decisions made during brainstorming
- `implement` - Execute the implementation plan after brainstorming completes
- `explore` - Deep codebase exploration to understand existing patterns
- `assess` - Rate quality 0-10 with dimension breakdown

## References

- [Phase Workflow](references/phase-workflow.md) - Detailed 7-phase instructions
- [Divergent Techniques](references/divergent-techniques.md) - SCAMPER, Mind Mapping, etc.
- [Evaluation Rubric](references/evaluation-rubric.md) - 0-10 scoring criteria
- [Devil's Advocate Prompts](references/devils-advocate-prompts.md) - Challenge templates
- [Socratic Questions](references/socratic-questions.md) - Requirements discovery
- [Common Pitfalls](references/common-pitfalls.md) - Mistakes to avoid
- [Example Session](references/example-session-dashboard.md) - Complete example

---

**Version:** 4.3.0 (February 2026) - Added testability scoring to evaluation, test strategy to synthesis output

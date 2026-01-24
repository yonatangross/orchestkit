---
name: brainstorming
description: Use when creating or developing anything, before writing code or implementation plans. Brainstorming skill refines ideas through structured questioning and alternatives.
tags: [planning, ideation, creativity, design]
context: fork
version: 4.1.0
author: OrchestKit
user-invocable: true
allowedTools: [Task, Read, Grep, Glob, TaskCreate, TaskUpdate, TaskList, mcp__memory__search_nodes]
skills: [architecture-decision-record, api-design-framework, design-system-starter, recall, remember, assess-complexity]
---

# Brainstorming Ideas Into Designs

Transform rough ideas into fully-formed designs through intelligent agent selection and structured exploration.

**Core principle:** Analyze the topic, select relevant agents dynamically, explore alternatives in parallel, present design incrementally.

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
| **3. Feasibility Fast-Check** | 30-second viability per idea | Filtered ideas |
| **4. Evaluation & Rating** | Rate 0-10, devil's advocate challenge | Ranked ideas |
| **5. Synthesis** | Filter to top 2-3, trade-off table | Options |
| **6. Design Presentation** | Present in 200-300 word sections | Validated design |

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
| "brainstorm API for users" | workflow-architect, backend-system-architect, security-auditor |
| "brainstorm dashboard UI" | workflow-architect, frontend-ui-developer, ux-researcher |
| "brainstorm RAG pipeline" | workflow-architect, llm-integrator, data-pipeline-engineer |
| "brainstorm caching strategy" | workflow-architect, backend-system-architect, performance-engineer |

**Always include:** `workflow-architect` for system design perspective.

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

**Version:** 4.1.0 (January 2026) - Refactored to progressive loading structure

---
name: explore
license: MIT
compatibility: "Claude Code 2.1.59+. Requires memory MCP server."
description: "explore — Deep codebase exploration with parallel agents. Use when exploring a repo, discovering architecture, finding files, or analyzing design patterns."
argument-hint: "[topic-or-feature]"
context: fork
version: 2.1.0
author: OrchestKit
tags: [exploration, code-search, architecture, codebase, health-assessment]
user-invocable: true
allowed-tools: [AskUserQuestion, Read, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskOutput, TaskStop, mcp__memory__search_nodes, Bash]
skills: [ascii-visualizer, architecture-decision-record, memory, architecture-patterns]
complexity: high
model: sonnet
discovers: [implement, fix-issue, assess]
metadata:
  category: workflow-automation
  mcp-server: memory
---

# Codebase Exploration

Multi-angle codebase exploration using 3-5 parallel agents.

## Quick Start

```bash
/ork:explore authentication
```

> **Opus 4.6**: Exploration agents use native adaptive thinking for deeper pattern recognition across large codebases.

---

## STEP 0: Verify User Intent with AskUserQuestion

**BEFORE creating tasks**, clarify what the user wants to explore:

```python
AskUserQuestion(
  questions=[{
    "question": "What aspect do you want to explore?",
    "header": "Focus",
    "options": [
      {"label": "Full exploration (Recommended)", "description": "Code structure + data flow + architecture + health assessment"},
      {"label": "Code structure only", "description": "Find files, classes, functions related to topic"},
      {"label": "Data flow", "description": "Trace how data moves through the system"},
      {"label": "Architecture patterns", "description": "Identify design patterns and integrations"},
      {"label": "Quick search", "description": "Just find relevant files, skip deep analysis"}
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

---

## STEP 0b: Select Orchestration Mode

Choose **Agent Teams** (mesh) or **Task tool** (star):

1. `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` → **Agent Teams mode**
2. Agent Teams unavailable → **Task tool mode** (default)
3. Full exploration with 4+ agents → recommend **Agent Teams**; Quick/single-focus → **Task tool**

| Aspect | Task Tool | Agent Teams |
|--------|-----------|-------------|
| Discovery sharing | Lead synthesizes after all complete | Explorers share discoveries as they go |
| Cross-referencing | Lead connects dots | Data flow explorer alerts architecture explorer |
| Cost | ~150K tokens | ~400K tokens |
| Best for | Quick/focused searches | Deep full-codebase exploration |

> **Fallback:** If Agent Teams encounters issues, fall back to Task tool for remaining exploration.

---

## Task Management (MANDATORY)

**BEFORE doing ANYTHING else, create tasks to show progress:**

```python
TaskCreate(subject="Explore: {topic}", description="Deep codebase exploration for {topic}", activeForm="Exploring {topic}")
TaskCreate(subject="Initial file search", activeForm="Searching files")
TaskCreate(subject="Check knowledge graph", activeForm="Checking memory")
TaskCreate(subject="Launch exploration agents", activeForm="Dispatching explorers")
TaskCreate(subject="Assess code health (0-10)", activeForm="Assessing code health")
TaskCreate(subject="Map dependency hotspots", activeForm="Mapping dependencies")
TaskCreate(subject="Add product perspective", activeForm="Adding product context")
TaskCreate(subject="Generate exploration report", activeForm="Generating report")
```

---

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

---

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

See [Exploration Agents](rules/exploration-agents.md) for Task tool mode prompts.

See [Agent Teams Mode](rules/agent-teams-mode.md) for Agent Teams alternative.

### Phase 4: AI System Exploration (If Applicable)

For AI/ML topics, add exploration of: LangGraph workflows, prompt templates, RAG pipeline, caching strategies.

### Phase 5: Code Health Assessment

See [Code Health Assessment](rules/code-health-assessment.md) for agent prompt. See [Code Health Rubric](references/code-health-rubric.md) for scoring criteria.

### Phase 6: Dependency Hotspot Map

See [Dependency Hotspot Analysis](rules/dependency-hotspot-analysis.md) for agent prompt. See [Dependency Analysis](references/dependency-analysis.md) for metrics.

### Phase 7: Product Perspective

See [Product Perspective](rules/product-perspective.md) for agent prompt. See [Findability Patterns](references/findability-patterns.md) for best practices.

### Phase 8: Generate Report

See [Exploration Report Template](references/exploration-report-template.md).

## Common Exploration Queries

- "How does authentication work?"
- "Where are API endpoints defined?"
- "Find all usages of EventBroadcaster"
- "What's the workflow for content analysis?"

## Related Skills
- `ork:implement`: Implement after exploration
---

**Version:** 2.1.0 (February 2026)

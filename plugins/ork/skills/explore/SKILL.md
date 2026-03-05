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
hooks:
  PreToolUse:
    - matcher: "Glob"
      command: "${CLAUDE_PLUGIN_ROOT}/src/hooks/bin/run-hook.mjs skill/repo-structure-indexer"
      once: true
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

## Common Exploration Queries

- "How does authentication work?"
- "Where are API endpoints defined?"
- "Find all usages of EventBroadcaster"
- "What's the workflow for content analysis?"

## Related Skills
- `ork:implement`: Implement after exploration
---

**Version:** 2.1.0 (February 2026)

---
name: explore
description: Deep codebase exploration with parallel specialized agents. Use when exploring a repo, finding files, or discovering architecture with the explore agent.
context: fork
version: 1.3.0
author: OrchestKit
tags: [exploration, code-search, architecture, codebase]
user-invocable: true
allowedTools: [Read, Grep, Glob, Task, TaskCreate, TaskUpdate, mcp__memory__search_nodes]
skills: [ascii-visualizer, architecture-decision-record, recall, clean-architecture]
---

# Codebase Exploration

Multi-angle codebase exploration using 3-5 parallel agents.

## Quick Start

```bash
/explore authentication
```

---

## ⚠️ CRITICAL: Task Management is MANDATORY (CC 2.1.16)

**BEFORE doing ANYTHING else, create tasks to show progress:**

```python
# 1. Create main exploration task IMMEDIATELY
TaskCreate(
  subject="Explore: {topic}",
  description="Deep codebase exploration for {topic}",
  activeForm="Exploring {topic}"
)

# 2. Create subtasks for phases
TaskCreate(subject="Initial file search", activeForm="Searching files")
TaskCreate(subject="Check knowledge graph", activeForm="Checking memory")
TaskCreate(subject="Launch exploration agents", activeForm="Dispatching explorers")
TaskCreate(subject="Generate exploration report", activeForm="Generating report")

# 3. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done
```

---

## Workflow

### Phase 1: Initial Search

```python
# PARALLEL - Quick searches
Grep(pattern="$ARGUMENTS", output_mode="files_with_matches")
Glob(pattern="**/*$ARGUMENTS*")
```

### Phase 2: Memory Check

```python
mcp__memory__search_nodes(query="$ARGUMENTS")
mcp__memory__search_nodes(query="architecture")
```

### Phase 3: Parallel Deep Exploration (4 Agents)

Launch 4 specialized explorers in ONE message with `run_in_background: true`:

```python
# PARALLEL - All 4 in ONE message
Task(
  subagent_type="Explore",
  prompt="""Code Structure: Find all files, classes, functions related to: $ARGUMENTS

  SUMMARY: End with: "RESULT: [N] files, [M] classes - [key location, e.g., 'src/auth/']"
  """,
  run_in_background=True
)
Task(
  subagent_type="Explore",
  prompt="""Data Flow: Trace entry points, processing, storage for: $ARGUMENTS

  SUMMARY: End with: "RESULT: [entry] → [processing] → [storage] - [N] hop flow"
  """,
  run_in_background=True
)
Task(
  subagent_type="backend-system-architect",
  prompt="""Backend Patterns: Analyze architecture patterns, integrations, dependencies for: $ARGUMENTS

  SUMMARY: End with: "RESULT: [pattern name] - [N] integrations, [M] dependencies"
  """,
  run_in_background=True
)
Task(
  subagent_type="frontend-ui-developer",
  prompt="""Frontend Analysis: Find components, state management, routes for: $ARGUMENTS

  SUMMARY: End with: "RESULT: [N] components, [state lib] - [key route]"
  """,
  run_in_background=True
)
```

**Explorer Roles:**
1. **Code Structure Explorer** - Files, classes, functions
2. **Data Flow Explorer** - Entry points, processing, storage
3. **Backend Architect** - Patterns, integration, dependencies
4. **Frontend Developer** - Components, state, routes

### Phase 4: AI System Exploration (If Applicable)

For AI/ML topics, add exploration of:
- LangGraph workflows
- Prompt templates
- RAG pipeline
- Caching strategies

### Phase 5: Generate Report

```markdown
# Exploration Report: $ARGUMENTS

## Quick Answer
[1-2 sentence summary]

## File Locations
| File | Purpose |
|------|---------|
| `path/to/file.py` | [description] |

## Architecture Overview
[ASCII diagram]

## Data Flow
1. [Entry] → 2. [Processing] → 3. [Storage]

## How to Modify
1. [Step 1]
2. [Step 2]
```

## Common Exploration Queries

- "How does authentication work?"
- "Where are API endpoints defined?"
- "Find all usages of EventBroadcaster"
- "What's the workflow for content analysis?"

## Related Skills
- implement: Implement after exploration
## Key Project Directories

- `backend/app/workflows/` - LangGraph agent workflows
- `backend/app/api/` - FastAPI endpoints
- `backend/app/services/` - Business logic
- `backend/app/db/` - Database models
- `frontend/src/features/` - React feature modules
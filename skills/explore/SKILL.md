---
name: explore
description: Deep codebase exploration with parallel specialized agents. Use when exploring codebase, understanding code, finding files, or discovering architecture.
context: fork
version: 1.0.0
author: SkillForge
tags: [exploration, code-search, architecture, codebase]
---

# Codebase Exploration

Multi-angle codebase exploration using 3-5 parallel agents.

## When to Use

- Understanding how a feature works
- Finding where code is defined
- Tracing data flow through the system
- Learning codebase architecture

## Quick Start

```bash
/explore authentication
```

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

### Phase 3: Parallel Deep Exploration

Launch 4 specialized explorers in ONE message:

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
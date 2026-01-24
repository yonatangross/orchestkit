---
name: explore
description: Deep codebase exploration with parallel specialized agents. Use when exploring a repo, finding files, or discovering architecture with the explore agent.
context: fork
version: 2.0.0
author: OrchestKit
tags: [exploration, code-search, architecture, codebase, health-assessment]
user-invocable: true
allowedTools: [Read, Grep, Glob, Task, TaskCreate, TaskUpdate, mcp__memory__search_nodes, Bash]
skills: [ascii-visualizer, architecture-decision-record, recall, clean-architecture, assess-complexity]
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

# 2. Create subtasks for phases (8-phase process)
TaskCreate(subject="Initial file search", activeForm="Searching files")
TaskCreate(subject="Check knowledge graph", activeForm="Checking memory")
TaskCreate(subject="Launch exploration agents", activeForm="Dispatching explorers")
TaskCreate(subject="Assess code health (0-10)", activeForm="Assessing code health")
TaskCreate(subject="Map dependency hotspots", activeForm="Mapping dependencies")
TaskCreate(subject="Add product perspective", activeForm="Adding product context")
TaskCreate(subject="Generate exploration report", activeForm="Generating report")

# 3. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done
```

---

## Workflow Overview

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Initial Search** | Grep, Glob for matches | File locations |
| **2. Memory Check** | Search knowledge graph | Prior context |
| **3. Deep Exploration** | 4 parallel explorers | Multi-angle analysis |
| **4. Code Health Assessment** | Rate found code 0-10 | Quality scores |
| **5. Dependency Hotspot Map** | Identify coupling | Hotspot visualization |
| **6. Product Perspective** | Business context | Findability suggestions |
| **7. Report Generation** | Compile findings | Actionable report |

---

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

### Phase 5: Code Health Assessment (NEW)

**Goal:** Rate found code quality 0-10 with specific dimensions.

```python
Task(
  subagent_type="code-quality-reviewer",
  prompt="""CODE HEALTH ASSESSMENT for files related to: $ARGUMENTS

  Rate each dimension 0-10:

  1. READABILITY (0-10)
     - Clear naming conventions?
     - Appropriate comments?
     - Logical organization?

  2. MAINTAINABILITY (0-10)
     - Single responsibility?
     - Low coupling?
     - Easy to modify?

  3. TESTABILITY (0-10)
     - Pure functions where possible?
     - Dependency injection?
     - Existing test coverage?

  4. COMPLEXITY (0-10, inverted: 10=simple, 0=complex)
     - Cyclomatic complexity?
     - Nesting depth?
     - Function length?

  5. DOCUMENTATION (0-10)
     - API docs present?
     - Usage examples?
     - Architecture notes?

  Output:
  {
    "overall_score": N.N,
    "dimensions": {
      "readability": N,
      "maintainability": N,
      "testability": N,
      "complexity": N,
      "documentation": N
    },
    "hotspots": ["file:line - issue"],
    "recommendations": ["improvement suggestion"]
  }

  SUMMARY: End with: "HEALTH: [N.N]/10 - [best dimension] strong, [worst dimension] needs work"
  """,
  run_in_background=True
)
```

### Phase 6: Dependency Hotspot Map (NEW)

**Goal:** Identify highly-coupled code and dependency bottlenecks.

```python
# Analyze imports and dependencies
Task(
  subagent_type="backend-system-architect",
  prompt="""DEPENDENCY HOTSPOT ANALYSIS for: $ARGUMENTS

  Analyze coupling and dependencies:

  1. IMPORT ANALYSIS
     - Which files import this code?
     - What does this code import?
     - Circular dependencies?

  2. COUPLING SCORE (0-10, 10=highly coupled)
     - How many files would break if this changes?
     - Fan-in (incoming dependencies)
     - Fan-out (outgoing dependencies)

  3. CHANGE IMPACT
     - Blast radius of modifications
     - Files that always change together

  4. HOTSPOT VISUALIZATION
     ```
     [Module A] --depends--> [Target] <--depends-- [Module B]
                                |
                                v
                           [Module C]
     ```

  Output:
  {
    "coupling_score": N,
    "fan_in": N,
    "fan_out": N,
    "circular_deps": [],
    "change_impact": ["file - reason"],
    "hotspot_diagram": "ASCII diagram"
  }

  SUMMARY: End with: "COUPLING: [N]/10 - [N] incoming, [M] outgoing deps - [key concern]"
  """,
  run_in_background=True
)
```

### Phase 7: Product Perspective Agent (NEW)

**Goal:** Add business context and findability suggestions.

```python
Task(
  subagent_type="product-strategist",
  prompt="""PRODUCT PERSPECTIVE for: $ARGUMENTS

  Analyze from a product/business viewpoint:

  1. BUSINESS CONTEXT
     - What user problem does this code solve?
     - What feature/capability does it enable?
     - Who are the users of this code?

  2. FINDABILITY SUGGESTIONS
     - Better naming for discoverability?
     - Missing documentation entry points?
     - Where should someone look first?

  3. KNOWLEDGE GAPS
     - What context is missing for new developers?
     - What tribal knowledge exists?
     - What should be documented?

  4. SEARCH OPTIMIZATION
     - Keywords someone might use to find this
     - Alternative terms for the same concept
     - Related concepts to cross-reference

  Output:
  {
    "business_purpose": "description",
    "primary_users": ["user type"],
    "findability_issues": ["issue - suggestion"],
    "recommended_entry_points": ["file - why start here"],
    "search_keywords": ["keyword"],
    "documentation_gaps": ["gap"]
  }

  SUMMARY: End with: "FINDABILITY: [N] issues - start at [recommended entry point]"
  """,
  run_in_background=True
)
```

### Phase 8: Generate Report

```markdown
# Exploration Report: $ARGUMENTS

## Quick Answer
[1-2 sentence summary]

## File Locations
| File | Purpose | Health Score |
|------|---------|--------------|
| `path/to/file.py` | [description] | [N.N/10] |

## Code Health Summary
| Dimension | Score | Notes |
|-----------|-------|-------|
| Readability | [N/10] | [note] |
| Maintainability | [N/10] | [note] |
| Testability | [N/10] | [note] |
| Complexity | [N/10] | [note] |
| Documentation | [N/10] | [note] |
| **Overall** | **[N.N/10]** | |

## Architecture Overview
[ASCII diagram]

## Dependency Hotspot Map
```
[Incoming deps] → [TARGET] → [Outgoing deps]
```
- **Coupling Score:** [N/10]
- **Fan-in:** [N] files depend on this
- **Fan-out:** [M] dependencies
- **Circular Dependencies:** [list or "None"]

## Data Flow
1. [Entry] → 2. [Processing] → 3. [Storage]

## Findability & Entry Points
| Entry Point | Why Start Here |
|-------------|----------------|
| `path/to/file.py` | [reason] |

**Search Keywords:** [keyword1], [keyword2], [keyword3]

## Product Context
- **Business Purpose:** [what problem this solves]
- **Primary Users:** [who uses this]
- **Documentation Gaps:** [what's missing]

## How to Modify
1. [Step 1]
2. [Step 2]

## Recommendations
1. [Health improvement]
2. [Findability improvement]
3. [Documentation improvement]
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

---

**Version:** 2.0.0 (January 2026)

**v2.0.0 Enhancements:**
- Added **Code Health Assessment**: Rate found code 0-10 across 5 dimensions (readability, maintainability, testability, complexity, documentation)
- Added **Dependency Hotspot Map**: Visualize coupling, fan-in/fan-out, circular dependencies
- Added **Product Perspective Agent**: Business context, findability suggestions, documentation gaps
- Updated report template with health scores, hotspot diagrams, and entry points
- Expanded from 5-phase to 8-phase process

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Health scoring | 5 dimensions, 0-10 scale | Granular feedback on specific improvement areas |
| Dependency analysis | Fan-in/fan-out metrics | Quantifies coupling for informed refactoring decisions |
| Product perspective | Dedicated agent | Bridges technical exploration with business understanding |
| Findability focus | Entry points + keywords | Helps future explorers discover code faster |
| Report format | Structured markdown with tables | Scannable, actionable output |
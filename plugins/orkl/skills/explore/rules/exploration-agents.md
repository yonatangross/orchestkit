---
title: Exploration Agents (Task Tool Mode)
impact: HIGH
impactDescription: "Defines parallel agent spawning pattern for concurrent codebase exploration"
tags: agents, exploration, task-tool
---

# Exploration Agents (Task Tool Mode)

Launch 4 specialized explorers in ONE message with `run_in_background: true`:

```python
# PARALLEL - All 4 in ONE message
Task(
  subagent_type="Explore",
  prompt="""Code Structure: Find all files, classes, functions related to: $ARGUMENTS

  Scope: ONLY read files directly relevant to the topic. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [N] files, [M] classes - [key location, e.g., 'src/auth/']"
  """,
  run_in_background=True,
  max_turns=25
)
Task(
  subagent_type="Explore",
  prompt="""Data Flow: Trace entry points, processing, storage for: $ARGUMENTS

  Scope: ONLY read files directly relevant to the topic. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [entry] → [processing] → [storage] - [N] hop flow"
  """,
  run_in_background=True,
  max_turns=25
)
Task(
  subagent_type="backend-system-architect",
  prompt="""Backend Patterns: Analyze architecture patterns, integrations, dependencies for: $ARGUMENTS

  Scope: ONLY read files directly relevant to the topic. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [pattern name] - [N] integrations, [M] dependencies"
  """,
  run_in_background=True,
  max_turns=25
)
Task(
  subagent_type="frontend-ui-developer",
  prompt="""Frontend Analysis: Find components, state management, routes for: $ARGUMENTS

  Scope: ONLY read files directly relevant to the topic. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [N] components, [state lib] - [key route]"
  """,
  run_in_background=True,
  max_turns=25
)
```

## Explorer Roles

1. **Code Structure Explorer** - Files, classes, functions
2. **Data Flow Explorer** - Entry points, processing, storage
3. **Backend Architect** - Patterns, integration, dependencies
4. **Frontend Developer** - Components, state, routes

**Incorrect — Sequential exploration:**
```python
Task(subagent_type="Explore", prompt="Find auth files")
# Wait...
Task(subagent_type="Explore", prompt="Trace auth flow")
# Wait...
Task(subagent_type="backend-system-architect", prompt="Analyze patterns")
# Slow, sequential
```

**Correct — Parallel exploration in one message:**
```python
# All 4 in ONE message with run_in_background: true
Task(subagent_type="Explore", prompt="Code Structure: Find all files related to auth",
     run_in_background=True, max_turns=25)
Task(subagent_type="Explore", prompt="Data Flow: Trace auth entry→storage",
     run_in_background=True, max_turns=25)
Task(subagent_type="backend-system-architect", prompt="Backend Patterns: Analyze auth architecture",
     run_in_background=True, max_turns=25)
Task(subagent_type="frontend-ui-developer", prompt="Frontend: Find auth components",
     run_in_background=True, max_turns=25)
# Parallel execution
```

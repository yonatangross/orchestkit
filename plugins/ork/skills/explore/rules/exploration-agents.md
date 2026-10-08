---
title: Spawn parallel exploration agents using Agent tool for concurrent codebase analysis
impact: HIGH
impactDescription: "Defines parallel agent spawning pattern for concurrent codebase exploration"
tags: agents, exploration, task-tool
---

# Exploration Agents (Agent Tool Mode)

Launch 4 specialized explorers in ONE message with `run_in_background: true`:

```python
# PARALLEL - All 4 in ONE message
Agent(
  subagent_type="Explore",
  model="haiku",
  prompt="""Code Structure: Find all files, classes, functions related to: $ARGUMENTS

  Scope: ONLY read files directly relevant to the topic. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [N] files, [M] classes - [key location, e.g., 'src/auth/']"
  """,
  run_in_background=True,
  max_turns=25
)
Agent(
  subagent_type="Explore",
  model="haiku",
  prompt="""Data Flow: Trace entry points, processing, storage for: $ARGUMENTS

  Scope: ONLY read files directly relevant to the topic. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [entry] → [processing] → [storage] - [N] hop flow"
  """,
  run_in_background=True,
  max_turns=25
)
Agent(
  subagent_type="ork:backend-system-architect",
  prompt="""Backend Patterns: Analyze architecture patterns, integrations, dependencies for: $ARGUMENTS

  Scope: ONLY read files directly relevant to the topic. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [pattern name] - [N] integrations, [M] dependencies"
  """,
  run_in_background=True,
  max_turns=25
)
Agent(
  subagent_type="ork:frontend-ui-developer",
  prompt="""Frontend Analysis: Find components, state management, routes for: $ARGUMENTS

  Scope: ONLY read files directly relevant to the topic. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [N] components, [state lib] - [key route]"
  """,
  run_in_background=True,
  max_turns=25
)
```

## Fork Pattern (CC 2.1.89 #1227; explicit since CC 2.1.232)

These agents are **fork-eligible**: short prompts (<500 words), no custom model, no worktree isolation. CC shares the parent's cached API prefix across all 4 forks, reducing cost by ~60%.

Since CC 2.1.232 forking is on by default and `subagent_type: "fork"` selects it explicitly. A fork subagent inherits the full conversation and prompt cache and always runs on the parent model; other types start fresh. The eligibility conditions matter only for ordinary `Agent()` calls.

> See `chain-patterns/references/fork-pattern.md` for full details.

**Do NOT** add `model=` or `isolation="worktree"` to a fork or to the `ork:` role agents above: either one breaks cache sharing on ordinary `Agent()` calls.

**Do** pin the two `Explore` explorers to `model="haiku"`. `Explore` is read-only and starts fresh (not a fork), so the pin gives up no shared prefix. Measured on 52 Opus `Explore` spawns over 7 days: first-turn prefix 69k tokens against 394k for a fork, 366M cache-read tokens in total, none of them used a file-writing tool. Haiku 5.5 costs 1/40 of Opus 5.5 per token at list price, though it counts about 30% more tokens for the same text. A quality probe on a real explore brief has not been run; revert the pin if explorer results get thinner.

## Explorer Roles

1. **Code Structure Explorer** - Files, classes, functions
2. **Data Flow Explorer** - Entry points, processing, storage
3. **Backend Architect** - Patterns, integration, dependencies
4. **Frontend Developer** - Components, state, routes

**Incorrect — Sequential exploration:**
```python
Agent(subagent_type="Explore", model="haiku", prompt="Find auth files")
# Wait...
Agent(subagent_type="Explore", model="haiku", prompt="Trace auth flow")
# Wait...
Agent(subagent_type="ork:backend-system-architect", prompt="Analyze patterns")
# Slow, sequential
```

**Correct — Parallel exploration in one message:**
```python
# All 4 in ONE message with run_in_background: true
Agent(subagent_type="Explore", model="haiku", prompt="Code Structure: Find all files related to auth",
     run_in_background=True, max_turns=25)
Agent(subagent_type="Explore", model="haiku", prompt="Data Flow: Trace auth entry→storage",
     run_in_background=True, max_turns=25)
Agent(subagent_type="ork:backend-system-architect", prompt="Backend Patterns: Analyze auth architecture",
     run_in_background=True, max_turns=25)
Agent(subagent_type="ork:frontend-ui-developer", prompt="Frontend: Find auth components",
     run_in_background=True, max_turns=25)
# Parallel execution
```

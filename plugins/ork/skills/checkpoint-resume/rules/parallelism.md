---
title: Parallelism Rules
impact: HIGH
tags: [checkpoint, parallelism, task-agents]
---

# Parallelism Rules

## Rule

Only parallelize phases that have **empty `dependencies` arrays** and **do not share file writes**.

## How to Parallelize

Use Task sub-agents for independent phases:

```
Phase A (no deps) ─┐
Phase B (no deps) ─┼─ run in parallel via Task agents
Phase C (no deps) ─┘
Phase D (depends on A, B, C) ─ run after all complete
```

## When NOT to Parallelize

- Phases that write to the same files (causes merge conflicts)
- Phases where one needs output from another
- Phases that both create GitHub issues in the same repo section (ordering matters for issue numbers)

## State and Parallel Phases

Each parallel sub-agent should write its own phase completion back to the main state file. Use locking or sequential state updates if multiple agents complete simultaneously.

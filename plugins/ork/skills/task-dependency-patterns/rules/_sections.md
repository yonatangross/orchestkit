---
title: Task Dependency Patterns Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Task Lifecycle (task) — HIGH — 3 rules

Patterns for managing task dependencies, coordination, and completion in multi-agent workflows.

- `task-dependency-validation.md` — Validate blockers resolved before starting, detect circular dependencies
- `task-agent-coordination.md` — Clear ownership, avoid duplicate work, coordinate via messages and task list
- `task-completion-criteria.md` — Only mark complete when fully verified, create follow-ups for remaining work

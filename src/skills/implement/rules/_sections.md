---
title: Implement Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Scope & Architecture (scope) — HIGH — 1 rule

Enforces tier-based ceilings on architecture complexity so implementation patterns never exceed what the project scope warrants.

- `tier-validation.md` — Match implementation tier to assessed complexity; tier ceiling constrains every phase

## 2. Quality Gates (quality) — HIGH — 1 rule

Blocks phase progression when new code lacks test coverage, ensuring tests are produced alongside every implementation task.

- `test-coverage-requirement.md` — Require test output from test-generator agent before Phase 6; zero-coverage is a blocker

## 3. Git & Session Resilience (resilience) — HIGH — 2 rules

Prevents work loss from rate limits, crashes, or interrupted sessions by committing at logical milestones and exiting worktrees cleanly.

- `commit-after-milestone.md` — Commit after each logical phase; never batch all commits to session end
- `worktree-cleanup.md` — Always call ExitWorktree after implementation, regardless of success or failure

## 4. Agent Coordination (coordination) — HIGH — 1 rule

Prevents parallel agents from silently overwriting each other's work by requiring explicit, non-overlapping file scope boundaries.

- `agent-scope-containment.md` — Assign explicit file scope to each subagent; prohibit writes outside assigned scope

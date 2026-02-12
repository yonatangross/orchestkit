---
title: Git Workflow Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Branch Protection (protection) — CRITICAL — 1 rule

Protected branch rules that prevent direct commits to main/dev. Violations can break deployments and lose team work.

- `branch-protection.md` — Protected branches, required workflows, emergency procedures

## 2. Merge Strategy (merge) — HIGH — 1 rule

When to rebase vs merge, how to handle conflicts, and keeping history clean.

- `merge-strategy.md` — Rebase-first workflow, merge commit rules, conflict resolution

## 3. History Hygiene (hygiene) — HIGH — 1 rule

Maintaining a clean, useful git history for debugging (bisect) and code review.

- `history-hygiene.md` — Squashing, fixup commits, interactive rebase, history cleanup

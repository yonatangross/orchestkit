---
title: Checkpoint Resume Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Phase Ordering Priority (ordering) — CRITICAL — 1 rule

Schedule phases so the highest-value, hardest-to-reconstruct work (GitHub issues, commits) completes before file-heavy phases — minimizing loss when a rate limit hits mid-session.

- `ordering-priority.md` — Priority ranking, incorrect vs. correct phase ordering examples, parallelization guidance

## 2. State Write Timing (state-timing) — CRITICAL — 1 rule

Write `.claude/pipeline-state.json` immediately after every phase completes — never accumulate updates — so a rate-limit hit always leaves a valid resume point.

- `state-write-timing.md` — Correct write-after-phase pattern, state write checklist, fields to update on each write

## 3. Checkpoint Mini-Commit (checkpoint-commit) — HIGH — 1 rule

Every 3 completed phases, create a mini-commit that captures work in progress and provides a git recovery point if later phases fail.

- `checkpoint-mini-commit.md` — Cadence rule, mini-commit format with Co-Authored-By, staging command, anti-pattern examples

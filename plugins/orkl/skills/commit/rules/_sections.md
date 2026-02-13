---
title: Commit Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Atomic Commits (atomic) — CRITICAL — 1 rule

The foundational principle: one logical change per commit. Violations make history unusable for bisect, revert, and review.

- `atomic-commit.md` — What makes a commit atomic, detection heuristics, examples

## 2. Commit Splitting (splitting) — HIGH — 1 rule

When a commit is too large or mixes concerns, how to split it into atomic units.

- `commit-splitting.md` — Interactive staging, hunk splitting, separation strategies

## 3. Conventional Format (format) — HIGH — 1 rule

Message format rules that enable automated changelog generation and semantic versioning.

- `conventional-format.md` — Type/scope/description format, breaking changes, co-author attribution

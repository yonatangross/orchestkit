---
title: Zustand Patterns Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Middleware (zustand) — CRITICAL — 2 rules

Correct middleware composition order and common pitfalls.

- `zustand-middleware-order.md` — persist outermost, immer innermost, devtools/subscribeWithSelector in between
- `zustand-middleware-pitfalls.md` — Avoid direct mutation without immer, async middleware patterns, persist migrations

## 2. Store Architecture (zustand) — HIGH — 1 rule

Store organization patterns for maintainability.

- `zustand-slice-pattern.md` — Split large stores into typed slices, combine without circular dependencies

---
title: Testing Patterns Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Test Isolation (isolation) — HIGH — 1 rule

Prevents order-dependent and shared-state tests that pass sequentially but fail when parallelized, shuffled, or run individually.

- `test-isolation.md` — Each test must set up its own state, clean up after itself, and pass when run in isolation or in any order

## 2. Assertion Quality (maintainability) — MEDIUM — 1 rule

Requires assertions to verify observable behavior rather than implementation details, preventing tests from breaking on every refactor.

- `assertion-quality.md` — Assert return values, public side effects, and error behavior; never assert internal method calls, private state, or specific SQL queries

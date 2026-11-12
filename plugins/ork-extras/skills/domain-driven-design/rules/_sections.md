---
title: Domain-Driven Design Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Aggregate Boundaries (aggregates) — CRITICAL — 1 rule

Defining transactional consistency boundaries and controlling access through aggregate roots. Wrong boundaries cause data corruption and consistency violations.

- `aggregate-boundaries.md` — Aggregate root design, reference by ID, one-aggregate-per-transaction

## 2. Aggregate Invariants (invariants) — HIGH — 1 rule

Enforcing business rules within aggregate boundaries. Unenforced invariants lead to invalid domain state.

- `aggregate-invariants.md` — Business rule enforcement, specification pattern, invariant validation

## 3. Aggregate Sizing (sizing) — HIGH — 1 rule

Right-sizing aggregates for performance and consistency. Oversized aggregates cause contention; undersized ones lose consistency.

- `aggregate-sizing.md` — When to split, collection limits, eventual consistency trade-offs

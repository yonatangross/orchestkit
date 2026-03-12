---
title: Remember Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Graph Integrity (graph-integrity) — HIGH — 2 rules

Prevents fragmented and inconsistent knowledge graphs by enforcing schema compliance and duplicate detection before every write.

- `duplicate-entity-detection.md` — Search for existing entities (80%+ name match + same type) before creating new ones; merge instead of duplicate
- `entity-relationship-validation.md` — Validate entity types and relation types against the allowed schema before writing to the graph

## 2. Observation Quality (quality) — MEDIUM — 1 rule

Ensures stored observations pass a recall-value test so future sessions can act on them without additional context.

- `observation-quality-gate.md` — Every observation must contain at least one concrete metric, version, or conditional statement; reject vague labels

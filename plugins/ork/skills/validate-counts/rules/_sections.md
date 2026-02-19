---
title: Validate Counts Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Authoritative Sources (sources) — HIGH — 1 rule

Which files are the ground truth for hook, skill, and agent counts, and which are derived sources that must stay in sync.

- `sources-authoritative.md` — Canonical count sources per component type, commands to read them, known legitimate differences

## 2. Drift Reporting (reporting) — HIGH — 1 rule

How to compare all sources and surface mismatches with enough detail to fix them immediately.

- `drift-reporting.md` — Comparison table format, per-row MATCH/DRIFT classification, fix instruction format

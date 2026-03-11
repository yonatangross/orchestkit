---
title: Memory Fabric Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Graph Consistency (consistency) — HIGH — 1 rule

Validates graph state after every mutation to prevent orphaned nodes, dangling relations, and inconsistent query results.

- `graph-consistency.md` — After any mutation, verify node properties, validate relation endpoints, detect orphans, and run deduplication check

## 2. Staleness Management (recency) — MEDIUM — 1 rule

Detects and flags outdated nodes beyond configurable thresholds to keep memory search results relevant and trustworthy.

- `stale-node-detection.md` — Flag nodes beyond staleness thresholds (90 days for decisions, 180 for patterns); prune only with user confirmation

---
title: Upgrade Assessment Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Knowledge Evaluation (evaluation) — HIGH — 1 rule

Evaluating platform upgrade readiness with structured scoring across model, hooks, skills, agents, memory, and CI/CD dimensions.

- `knowledge-evaluation.md` — 6-dimension scoring rubric, weighted calculation, severity classification

## 2. Knowledge Compatibility (compatibility) — HIGH — 1 rule

Tracking compatibility across model versions, CC versions, and OrchestKit versions. Migration patterns and breaking change detection.

- `knowledge-compatibility.md` — Version compatibility matrix, breaking change patterns, migration effort estimation

## 3. Detection (detection) — HIGH — 1 rule

Precondition checks and environment detection scripts to verify upgrade readiness before scanning.

- `detection-checks.md` — Environment detection, version checks, precondition validation

## 4. Scanning (scanning) — HIGH — 1 rule

Grep patterns and severity classification for finding upgrade-impacted code across the codebase.

- `codebase-scan-patterns.md` — Pattern-based codebase scanning, severity classification, grep templates

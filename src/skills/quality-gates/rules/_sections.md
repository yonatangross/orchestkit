---
title: Quality Gates Rule Categories
version: 3.0.0
---

# Rule Categories

3 rules across 2 categories. The complexity rubric, blocking thresholds, and gate
decision flow live in `SKILL.md`, not in `rules/`. OrchestKit-specific scars and house
decisions live in `references/ork-delta.md`.

## 1. Scope Control (yagni), CRITICAL, 1 rule

Pre-implementation check that blocks architecture disproportionate to the project tier.

- `yagni-gate.md`: justified complexity ratio, tier LOC budgets, simpler alternatives, security exemption

## 2. Best Practices (practices), HIGH, 2 rules

Personal pattern library for tracking success/failure patterns and code standards across projects.

- `practices-code-standards.md`: pattern library management, success/failure tracking, confidence scoring
- `practices-review-checklist.md`: category-based review, proactive anti-pattern detection, memory integration
